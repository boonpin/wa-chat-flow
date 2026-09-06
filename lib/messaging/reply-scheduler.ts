import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  getConversation,
  listConversationsAwaitingReply,
  setAutoReplyDueAt,
} from '@/lib/conversation/service'
import { normalizeReplyTiming, type ReplyTiming } from '@/lib/settings/reply-timing'
import { buildContext } from '@/lib/ai/context'
import { runAutoReply, type AutoReplySkipReason, type PersistedIncoming } from './incoming-handler'

/**
 * Decides *when* a thread gets answered, so that a burst of messages costs one
 * reply instead of one reply each.
 *
 * An inbound message opens a window rather than triggering a reply. Every
 * further message restarts it, and when it finally elapses `runAutoReply` reads
 * the whole unanswered burst at once. Three messages typed in five seconds are
 * one question, and answering them separately produced three replies that each
 * saw a different, partial conversation — and three chances to fire the same
 * tool. See lib/settings/reply-timing.ts for the knobs.
 *
 * The deadline lives in `conversations.auto_reply_due_at` as well as in the
 * timer. The timer is what fires in the normal case; the column is what lets a
 * restart mid-window pick the reply back up instead of dropping it silently.
 */

declare global {
  var __replyTimers: Map<string, ReturnType<typeof setTimeout>>
  var __replyInFlight: Set<string>
}

globalThis.__replyTimers ??= new Map()
globalThis.__replyInFlight ??= new Set()

/** Slack for timer imprecision when comparing a deadline against the clock. */
const CLOCK_TOLERANCE_MS = 250

/** How long to wait behind a reply that is still being generated. */
const IN_FLIGHT_RETRY_MS = 2_000

/**
 * How far past its deadline a recovered reply may be and still be sent.
 *
 * A restart that takes a minute should not lose the answer; a container that
 * was down all night should not wake up and answer everyone at once. Past this
 * the thread simply stays unanswered in the Inbox, which is the honest state.
 */
const STALE_AFTER_MS = 10 * 60 * 1000

export type ScheduleOutcome =
  | { status: 'scheduled'; dueAt: string }
  | { status: 'skipped'; reason: AutoReplySkipReason }

/**
 * Opens or extends this thread's reply window.
 *
 * Called instead of `runAutoReply` for every stored inbound message. The only
 * check made here is the one that cannot change later — whether there is any
 * text to answer. Policy, mode and bot are all re-read when the window elapses,
 * because all three can move while it is open.
 */
export function scheduleAutoReply(persisted: PersistedIncoming): ScheduleOutcome {
  resumePendingReplies()

  const { incoming, conversation } = persisted

  // Media carries no text to reason about — leave those for a human, and do not
  // let an image extend a window that a question opened.
  if (incoming.type !== 'text' || !incoming.text?.trim()) {
    return { status: 'skipped', reason: 'unsupported_type' }
  }

  const timing = readReplyTiming()
  const now = Date.now()

  // The ceiling is measured from the oldest unanswered message, not from this
  // one. Without that anchor a customer typing steadily would push the window
  // ahead of themselves indefinitely and never be answered at all.
  const anchor = Date.parse(buildContext(conversation.id).pendingSince ?? '') || now
  const due = Math.max(
    now,
    Math.min(now + timing.windowSeconds * 1000, anchor + timing.maxWaitSeconds * 1000)
  )

  const dueAt = new Date(due).toISOString()
  setAutoReplyDueAt(conversation.id, dueAt)
  arm(conversation.id, due - now)

  return { status: 'scheduled', dueAt }
}

/**
 * Drops any reply this thread was still owed.
 *
 * Called when an operator takes the thread over — switching it to human
 * replies, resolving it, or simply answering it themselves. The window would
 * resolve to `already_answered` on its own in most of those cases, but
 * cancelling is what stops the customer seeing a "typing…" indicator for a
 * reply that was never going to be sent.
 */
export function cancelAutoReply(conversationId: string): void {
  const timer = globalThis.__replyTimers.get(conversationId)
  if (timer) clearTimeout(timer)
  globalThis.__replyTimers.delete(conversationId)
  setAutoReplyDueAt(conversationId, null)
}

/**
 * Re-arms timers for windows that were open when the process last stopped.
 *
 * Runs once, lazily, the same way session reconciliation does — from the
 * message path that needs it and from the Inbox, rather than from a startup
 * hook. See the note in CLAUDE.md about `instrumentation.ts`.
 */
let resumed = false

export function resumePendingReplies(): void {
  if (resumed) return
  resumed = true

  for (const conversation of listConversationsAwaitingReply()) {
    const due = Date.parse(conversation.autoReplyDueAt ?? '')
    if (!Number.isFinite(due)) {
      setAutoReplyDueAt(conversation.id, null)
      continue
    }

    const overdue = Date.now() - due
    if (overdue > STALE_AFTER_MS) {
      console.warn(
        `[wa] Dropping an auto-reply for ${conversation.id} that came due ${Math.round(overdue / 60_000)}m ago`
      )
      setAutoReplyDueAt(conversation.id, null)
      continue
    }

    arm(conversation.id, Math.max(0, -overdue))
  }
}

/** Reads the workspace's batching settings, defaulted and bounded. */
export function readReplyTiming(): ReplyTiming {
  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  return normalizeReplyTiming({
    windowSeconds: settings?.replyWindowSeconds,
    maxWaitSeconds: settings?.replyMaxWaitSeconds,
  })
}

function arm(conversationId: string, delayMs: number): void {
  const existing = globalThis.__replyTimers.get(conversationId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    void flush(conversationId).catch((err) => {
      console.error(`[wa] Auto-reply flush failed for ${conversationId}:`, err)
    })
  }, delayMs)

  globalThis.__replyTimers.set(conversationId, timer)
}

async function flush(conversationId: string): Promise<void> {
  globalThis.__replyTimers.delete(conversationId)

  const conversation = getConversation(conversationId)
  if (!conversation?.autoReplyDueAt) return

  // A message that landed after this timer was armed pushed the deadline out
  // and armed its own. This one is a leftover.
  if (Date.parse(conversation.autoReplyDueAt) - Date.now() > CLOCK_TOLERANCE_MS) return

  // A reply already being generated has written no outbound row yet — the row
  // exists but is still `processing`, which conversation memory ignores — so
  // answering now would answer the same burst twice. Wait for it to land.
  if (globalThis.__replyInFlight.has(conversationId)) {
    arm(conversationId, IN_FLIGHT_RETRY_MS)
    return
  }

  // Claim the deadline before replying: a crash mid-reply must not leave a
  // window that every later restart re-fires.
  setAutoReplyDueAt(conversationId, null)

  globalThis.__replyInFlight.add(conversationId)
  try {
    const outcome = await runAutoReply(conversationId)
    if (outcome.status === 'skipped' && outcome.reason !== 'already_answered') {
      console.log(`[wa] Auto-reply skipped for ${conversationId}: ${outcome.reason}`)
    }
  } finally {
    globalThis.__replyInFlight.delete(conversationId)
  }
}

import { db } from '@/lib/db'
import { contacts as contactsTable, messages, systemSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { findOrCreateContact, type Contact } from '@/lib/contacts/service'
import {
  getConversation,
  getOrCreateOpenConversation,
  touchConversation,
  type Conversation,
} from '@/lib/conversation/service'
import { buildContext } from '@/lib/ai/context'
import { resolveHandler } from '@/lib/ai/handler'
import { attachUsageToMessage } from '@/lib/ai/usage'
import { resolveTools } from '@/lib/tools/registry'
import { getProvider } from '@/lib/wa/provider'
import { selectBot } from './bot-selection'
import { sendOutgoingMessage } from './outgoing'
import { repliesToExisting, repliesToNew, type AutoReplyMode } from '@/lib/settings/auto-reply'
import type { IncomingMessage } from '@/lib/wa/types'
import type { ToolRun } from '@/lib/tools/types'

/**
 * The single entry point for every inbound WhatsApp message, regardless of
 * transport. Webhooks do nothing but normalise and call in here.
 *
 *   dedupe → contact → conversation → store      (persistIncomingMessage)
 *   → open or extend the reply window            (scheduleAutoReply)
 *   → mode check → bot → context → AI → send     (runAutoReply)
 *
 * The first split matters for delivery: persistence must finish before the
 * webhook is acked so a retry cannot duplicate the message, while the AI call —
 * which can take seconds — must not hold the webhook connection open.
 *
 * The second split matters for the reply itself. `runAutoReply` is keyed on the
 * conversation, not the message that woke it: by the time it runs the customer
 * may have sent three more, and answering the burst once is the entire point of
 * lib/messaging/reply-scheduler.ts. Everything it needs is re-read from the
 * database, so it behaves identically whether a timer or a restart called it.
 */

export interface PersistedIncoming {
  status: 'stored'
  incoming: IncomingMessage
  contact: Contact
  conversation: Conversation
  /** True when this message opened the thread rather than continuing one. */
  openedConversation: boolean
  storedMessageId: string
}

export type PersistResult = PersistedIncoming | { status: 'duplicate' }

export type AutoReplySkipReason =
  | 'auto_reply_disabled'
  | 'new_conversation'
  | 'human_mode'
  | 'no_bot'
  | 'unsupported_type'
  | 'empty_reply'
  /** Someone — an operator, or an earlier flush — answered the burst first. */
  | 'already_answered'
  | 'gone'
  | 'no_session'

export type AutoReplyOutcome =
  | { status: 'skipped'; reason: AutoReplySkipReason }
  | { status: 'replied'; messageId: string }
  | { status: 'failed'; error: string }

/** Steps 1–4: everything that must happen before the webhook returns. */
export function persistIncomingMessage(incoming: IncomingMessage): PersistResult {
  // ─── 1. Deduplicate ─────────────────────────────────────────────────────────
  // Webhook delivery is at-least-once: WAHA retries on non-2xx and a restart
  // can replay events. The provider message id is the idempotency key.
  const alreadySeen = db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.provider, incoming.provider),
        eq(messages.providerMessageId, incoming.providerMessageId)
      )
    )
    .get()

  if (alreadySeen) return { status: 'duplicate' }

  // ─── 2. Contact ─────────────────────────────────────────────────────────────
  const contact = findOrCreateContact({
    phone: incoming.phone,
    name: incoming.contactName,
    waSessionId: incoming.sessionId,
  })

  // ─── 3. Conversation ────────────────────────────────────────────────────────
  // The mode a new thread opens on is where `existing` does its work: the
  // customer's own AI default only applies while the workspace is fully
  // automatic. Writing 'human' here rather than skipping the reply later makes
  // the decision stick — the second and third message on that thread are not
  // answered either — and shows an operator in the Inbox exactly why.
  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  const autoReplyMode = (settings?.autoReplyMode ?? 'off') as AutoReplyMode

  const { conversation, opened: openedConversation } = getOrCreateOpenConversation({
    contactId: contact.id,
    waSessionId: incoming.sessionId,
    defaultMode: contact.aiEnabled && repliesToNew(autoReplyMode) ? 'auto' : 'human',
    defaultBotId: contact.aiBotId,
  })

  // ─── 4. Store ───────────────────────────────────────────────────────────────
  const receivedAt = incoming.timestamp.toISOString()
  const storedMessageId = uuidv4()

  try {
    db.insert(messages)
      .values({
        id: storedMessageId,
        conversationId: conversation.id,
        contactId: contact.id,
        provider: incoming.provider,
        providerMessageId: incoming.providerMessageId,
        direction: 'incoming',
        senderType: 'customer',
        messageType: incoming.type,
        content: incoming.text ?? '',
        status: 'received',
        error: null,
        createdAt: receivedAt,
      })
      .run()
  } catch (err) {
    // The unique index on (provider, provider_message_id) is the real guard:
    // two concurrent deliveries of one event race past the check above.
    if (isUniqueViolation(err)) return { status: 'duplicate' }
    throw err
  }

  touchConversation(conversation.id, receivedAt)

  console.log(
    `[wa] [IN] ${contact.name || contact.phoneNumber}: ${incoming.text ?? `<${incoming.type}>`}`
  )

  return { status: 'stored', incoming, contact, conversation, openedConversation, storedMessageId }
}

/**
 * Steps 5–8: decide whether the AI answers this thread, and answer.
 *
 * Takes a conversation rather than a message because a reply answers a burst,
 * not a line. Every input is re-read here — the policy, the thread's mode, the
 * bot, and the unanswered messages themselves — because minutes can pass
 * between the webhook that armed the window and this call, and an operator may
 * have taken the thread over in between.
 */
export async function runAutoReply(conversationId: string): Promise<AutoReplyOutcome> {
  const conversation = getConversation(conversationId)
  if (!conversation) return { status: 'skipped', reason: 'gone' }

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  const autoReplyMode = (settings?.autoReplyMode ?? 'off') as AutoReplyMode

  // ─── 5. Should the AI answer at all? ────────────────────────────────────────
  if (!repliesToExisting(autoReplyMode)) return { status: 'skipped', reason: 'auto_reply_disabled' }
  if (conversation.mode !== 'auto') return { status: 'skipped', reason: 'human_mode' }

  // ─── 6. What is actually unanswered ─────────────────────────────────────────
  // An empty burst is the normal outcome of a race the window exists to absorb:
  // the operator typed a reply while the AI was still waiting to. Whoever spoke
  // first wins, and nobody gets answered twice.
  const context = buildContext(conversation.id)
  if (context.pending.length === 0) return { status: 'skipped', reason: 'already_answered' }

  // Nothing said before the burst means the thread opens with it. Under
  // `existing` that is a new conversation, which this policy does not answer —
  // a second guard behind the mode written at creation, for a policy that
  // tightened while the window was open.
  if (context.history.length === 0 && !repliesToNew(autoReplyMode)) {
    return { status: 'skipped', reason: 'new_conversation' }
  }

  const contact = db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, conversation.contactId))
    .get()
  if (!contact) return { status: 'skipped', reason: 'gone' }

  const sessionId = conversation.waSessionId ?? contact.waSessionId
  if (!sessionId) return { status: 'skipped', reason: 'no_session' }

  // ─── 7. Bot ─────────────────────────────────────────────────────────────────
  const bot = selectBot({
    conversationBotId: conversation.botId,
    contactBotId: contact.aiBotId,
    settingsDefaultBotId: settings?.defaultBotId,
  })
  if (!bot) return { status: 'skipped', reason: 'no_bot' }

  const provider = getProvider()

  // Filled in by the handler as it calls the model. Declared out here because
  // the reply can throw part-way through, and those tokens still belong to the
  // failure row written in the catch.
  const usageIds: string[] = []

  try {
    // ─── 8. Context + AI ──────────────────────────────────────────────────────
    // The burst is joined into one turn rather than replayed as several: it is
    // one thought the customer happened to send in pieces, and splitting it
    // would invite the model to answer the last fragment alone.
    await provider.setTyping({ sessionId, phone: contact.phoneNumber, typing: true })

    const output = await resolveHandler(bot).reply({
      bot,
      history: context.history,
      message: context.pending.join('\n'),
      contact: { name: contact.name, phone: contact.phoneNumber },
      conversationId: conversation.id,
      contactId: contact.id,
      tools: resolveTools(bot.id),
      usageSink: usageIds,
    })

    // Tool runs are recorded even when the model then falls silent, so an
    // operator can see that a lead was captured on a thread that looks stalled.
    for (const run of output.toolRuns ?? []) {
      recordToolRun(conversation.id, contact.id, provider.name, run)
    }

    const reply = output.text.trim()
    if (!reply) return { status: 'skipped', reason: 'empty_reply' }

    // ─── 9. Send ──────────────────────────────────────────────────────────────
    const sent = await sendOutgoingMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      phone: contact.phoneNumber,
      sessionId,
      text: reply,
      senderType: 'ai',
    })

    // Now that the reply row exists, the calls that paid for it can name it.
    // Done whether or not the send succeeded: the row is written before the
    // send either way, and a reply that cost tokens and never arrived is
    // exactly the one an operator wants the number for.
    attachUsageToMessage(usageIds, sent.messageId)

    if (sent.ok) {
      const answered = context.pending.length
      const tokens = output.usage
        ? ` [${output.usage.inputTokens} in / ${output.usage.outputTokens} out]`
        : ''
      console.log(
        `[wa] [AI] ${contact.name || contact.phoneNumber}${answered > 1 ? ` (${answered} messages)` : ''}${tokens}: ${reply}`
      )
    }

    return sent.ok
      ? { status: 'replied', messageId: sent.messageId }
      : { status: 'failed', error: sent.error ?? 'Send failed' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[wa] AI reply error:', err)
    // Rounds that completed before the failure were still billed, so they are
    // linked to the failure row rather than left floating on the ledger.
    const failureId = recordAiFailure(conversation.id, contact.id, provider.name, error)
    attachUsageToMessage(usageIds, failureId)
    return { status: 'failed', error }
  } finally {
    // The indicator outlives a crashed reply otherwise, leaving the customer
    // watching a bot that is never going to finish its sentence.
    await provider
      .setTyping({ sessionId, phone: contact.phoneNumber, typing: false })
      .catch(() => {})
  }
}

/**
 * Notes a tool run in the transcript.
 *
 * `message_type = 'tool'` keeps it out of `buildHistory`, which only feeds text
 * back to the model — the model already saw the call in its own loop, and
 * replaying it as dialogue would confuse the next turn. The Inbox renders
 * `sender_type = 'system'` as a centred notice, so it shows up with no UI work.
 *
 * A sink failure is logged as `failed` even though the model was told the
 * capture succeeded: the customer should not be re-asked for details we already
 * hold, but the operator does need to see that the sheet is out of sync.
 */
function recordToolRun(
  conversationId: string,
  contactId: string,
  provider: string,
  run: ToolRun
): void {
  const error = run.result.ok ? run.result.syncError : run.result.error

  db.insert(messages)
    .values({
      id: uuidv4(),
      conversationId,
      contactId,
      provider,
      providerMessageId: null,
      direction: 'outgoing',
      senderType: 'system',
      messageType: 'tool',
      content: `Ran tool: ${run.call.name}`,
      status: error ? 'failed' : 'sent',
      error: error ?? null,
      toolInvocationId: run.result.ok ? (run.result.invocationId ?? null) : null,
      createdAt: new Date().toISOString(),
    })
    .run()
}

/**
 * Leaves a visible failure in the thread. Without this an AI outage looks
 * identical to a customer who simply was not answered.
 */
function recordAiFailure(
  conversationId: string,
  contactId: string,
  provider: string,
  error: string
): string {
  const id = uuidv4()

  db.insert(messages)
    .values({
      id,
      conversationId,
      contactId,
      provider,
      providerMessageId: null,
      direction: 'outgoing',
      senderType: 'system',
      messageType: 'text',
      content: '',
      status: 'failed',
      error: `AI reply failed: ${error}`,
      createdAt: new Date().toISOString(),
    })
    .run()

  return id
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

import { listMessages } from '@/lib/conversation/service'
import type { ChatTurn } from './types'

/** How many prior messages the bot remembers. Keeps prompts small and cheap. */
export const HISTORY_LIMIT = 20

/**
 * How many unanswered customer messages are folded into one reply. A burst
 * longer than this is answered from its most recent messages — the older ones
 * stay in the thread and in the next reply's history, they just do not get to
 * push the whole prompt out of shape.
 */
export const PENDING_LIMIT = 10

export interface ConversationContext {
  /** Everything said before the customer's current, unanswered burst. */
  history: ChatTurn[]
  /** The unanswered burst, oldest first. Empty when someone has already replied. */
  pending: string[]
  /** When the oldest unanswered message arrived — the anchor for the reply deadline. */
  pendingSince: string | null
}

/**
 * Splits a conversation into what the bot should answer and what it should
 * remember.
 *
 * The boundary is not a stored cursor but the last thing *anyone else* said:
 * the trailing run of customer messages is by definition what nobody has
 * answered yet. That makes the split self-maintaining — an operator replying by
 * hand moves it exactly as an AI reply does — and it survives a restart, since
 * it is derived from the messages themselves rather than from a timer.
 *
 * Both halves come out of one filtered list, so the bot can never be handed a
 * message as "current" that its own history also contains.
 */
export function buildContext(conversationId: string): ConversationContext {
  const rows = deliveredText(conversationId)

  let boundary = rows.length
  while (boundary > 0 && rows[boundary - 1].direction === 'incoming') boundary--

  const history = rows.slice(0, boundary).slice(-HISTORY_LIMIT)
  const pending = rows.slice(boundary).slice(-PENDING_LIMIT)

  return {
    history: history.map(toTurn),
    pending: pending.map((m) => m.content),
    pendingSince: pending[0]?.createdAt ?? null,
  }
}

/**
 * Conversation memory alone, for callers that already know what is being
 * answered. Kept as its own export because history and the current message are
 * separate arguments to every AI handler.
 */
export function buildHistory(conversationId: string, excludeMessageId?: string): ChatTurn[] {
  return deliveredText(conversationId)
    .filter((m) => m.id !== excludeMessageId)
    .slice(-HISTORY_LIMIT)
    .map(toTurn)
}

/**
 * The messages that actually count as conversation.
 *
 * Only delivered text: failed sends and non-text media would otherwise teach
 * the model that it said things the customer never saw. Tool rows are excluded
 * by the same filter — the model already saw those calls in its own loop.
 */
function deliveredText(conversationId: string) {
  return listMessages(conversationId, HISTORY_LIMIT + PENDING_LIMIT + 1)
    .filter((m) => m.messageType === 'text' && m.content.trim().length > 0)
    .filter((m) => m.direction === 'incoming' || m.status === 'sent')
}

function toTurn(m: { direction: string; content: string }): ChatTurn {
  return {
    role: m.direction === 'incoming' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }
}

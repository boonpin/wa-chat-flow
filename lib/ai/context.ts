import { listMessages } from '@/lib/conversation/service'
import { isConversationRow, renderRow, renderSkipped, type MessageRow } from './media-render'
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
  /**
   * The rows `pending` was rendered from.
   *
   * Handed out because the media pass has to know which attachments belong to
   * the burst it is about to answer, and this is the only place that boundary
   * is worked out. Describing anything outside it would bill an operator for
   * photos nobody is waiting on.
   */
  pendingRows: MessageRow[]
  /** When the oldest unanswered message arrived — the anchor for the reply deadline. */
  pendingSince: string | null
  /**
   * Whether any line in either half came from an attachment rather than from
   * something the customer typed.
   *
   * Computed across history as well as the burst: a photo described four turns
   * ago is still sitting in the model's memory as a `[Photo] …` line, and a
   * model that has not been told what that notation means is a model that will
   * eventually repeat it to a customer.
   */
  hasMedia: boolean
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
  const rows = conversationRows(conversationId)

  let boundary = rows.length
  while (boundary > 0 && rows[boundary - 1].direction === 'incoming') boundary--

  const history = rows.slice(0, boundary).slice(-HISTORY_LIMIT)
  const pendingRows = rows.slice(boundary).slice(-PENDING_LIMIT)

  // The cap note is appended once, after the burst, rather than sitting where
  // the photos it stands for were: it is a fact about the whole burst, and
  // threading it between two messages would read as part of one of them.
  const skipped = renderSkipped(pendingRows)
  const pending = pendingRows
    .map((row) => renderRow(row, { pending: true }))
    .filter((line): line is string => line !== null)

  return {
    history: history.map(toTurn).filter((turn): turn is ChatTurn => turn !== null),
    pending: skipped ? [...pending, skipped] : pending,
    pendingRows,
    pendingSince: pendingRows[0]?.createdAt ?? null,
    hasMedia: [...history, ...pendingRows].some((row) => row.mediaStatus !== null),
  }
}

/**
 * Conversation memory alone, for callers that already know what is being
 * answered. Kept as its own export because history and the current message are
 * separate arguments to every AI handler.
 */
export function buildHistory(conversationId: string, excludeMessageId?: string): ChatTurn[] {
  return conversationRows(conversationId)
    .filter((m) => m.id !== excludeMessageId)
    .slice(-HISTORY_LIMIT)
    .map(toTurn)
    .filter((turn): turn is ChatTurn => turn !== null)
}

/**
 * The messages that actually count as conversation.
 *
 * Outbound rows must have been delivered: a failed send would otherwise teach
 * the model that it said something the customer never saw. Tool rows are
 * excluded too — the model already saw those calls in its own loop.
 *
 * Attachments are in, which is the change that let the bot answer a photo at
 * all: an image row carries whatever the media pass understood it to be, and
 * one that could not be read carries a note saying so. Both are conversation.
 */
function conversationRows(conversationId: string): MessageRow[] {
  return listMessages(conversationId, HISTORY_LIMIT + PENDING_LIMIT + 1)
    .filter((m) => m.direction === 'incoming' || m.status === 'sent')
    .filter(isConversationRow)
}

function toTurn(row: MessageRow): ChatTurn | null {
  const content = renderRow(row, { pending: false })
  if (!content) return null

  return {
    role: row.direction === 'incoming' ? ('user' as const) : ('assistant' as const),
    content,
  }
}

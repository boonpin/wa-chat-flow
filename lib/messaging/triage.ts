import type { IncomingMessage, MessageType } from '@/lib/wa/types'

/**
 * Whether an inbound message is worth waking a reply for.
 *
 * Every message is stored regardless — this decides only whether it opens or
 * extends the thread's reply window. The distinction matters because the window
 * is shared: a message that cannot be answered must not push back the deadline
 * on a question that can be, and a 👍 arriving after a resolved exchange must
 * not restart the conversation.
 *
 * A message that is ignored here is still part of the burst if a window is
 * already open. That is deliberate: a thumbs-up cannot start a conversation,
 * but it is perfectly good context inside one.
 */

export type TriageAction = 'answer' | 'ignore'

export interface TriageDecision {
  action: TriageAction
  /** Why, for the log line. Only meaningful when ignoring. */
  reason?: string
}

const ANSWER: TriageDecision = { action: 'answer' }

/** Attachment kinds that get an answer — either a real one or an honest refusal. */
const MEDIA_TYPES: ReadonlySet<MessageType> = new Set(['image', 'audio', 'video', 'document'])

export function triageIncoming(incoming: IncomingMessage): TriageDecision {
  const text = incoming.text?.trim() ?? ''

  if (incoming.type === 'text') {
    if (!text) return { action: 'ignore', reason: 'empty' }
    if (isDecorationOnly(text)) return { action: 'ignore', reason: 'emoji_only' }
    return ANSWER
  }

  // A named sticker says something — "thank you", "shocked" — and reads as a
  // short message. An unnamed one is decoration, and guessing at it would be
  // inventing a customer's words.
  if (incoming.type === 'sticker') {
    return incoming.stickerName?.trim()
      ? ANSWER
      : { action: 'ignore', reason: 'sticker_without_name' }
  }

  // Video and documents are answered too, even though nothing reads them: the
  // reply is the refusal, and the offer to fetch a colleague.
  if (MEDIA_TYPES.has(incoming.type)) return ANSWER

  return { action: 'ignore', reason: `unsupported_type:${incoming.type}` }
}

/**
 * True for a message made only of emoji.
 *
 * `\p{Emoji_Component}` deliberately goes unused: it matches bare digits, `#`
 * and `*`, so an order number would read as decoration and go unanswered.
 * Keycap sequences are the price of that, and they fall through as text — which
 * is the safe direction to be wrong in.
 */
const EXPRESSIVE = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u
const DECORATION_ONLY =
  /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️\s]+$/u

export function isDecorationOnly(text: string): boolean {
  if (!EXPRESSIVE.test(text)) return false
  return DECORATION_ONLY.test(text)
}

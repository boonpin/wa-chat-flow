import type { messages } from '@/lib/db/schema'

/**
 * How an attachment reaches the model, and what the caps on reading one are.
 *
 * Split from ./media — which calls the vendors — because none of this needs a
 * database, a key or a network. That is what makes it testable, and the
 * wording here is exactly the part most worth testing: it is what the customer
 * ends up being told.
 */

export type MessageRow = typeof messages.$inferSelect

/**
 * How many images one burst may cost.
 *
 * A customer photographing a receipt from four angles is asking one question.
 * Past that the marginal photo almost never changes the answer, and the cost is
 * linear, so the rest are counted and named rather than read. The cap is on
 * *distinct* images: duplicates are deduplicated before it is applied, because
 * paying twice for the same bytes is not a judgement call.
 */
export const MAX_IMAGES_PER_BURST = 4

/**
 * The same ceiling for voice notes, lower because each one is a whole message
 * and nobody sends four in a row for emphasis.
 */
export const MAX_VOICE_NOTES_PER_BURST = 3


// ─── Rendering ────────────────────────────────────────────────────────────────
//
// How an attachment reaches the model: as a line of text, in square brackets,
// alongside whatever the customer typed.
//
// Two shapes, and the difference matters. A *described* attachment reads as
// content — it is what the customer said, just carried in a photo. Everything
// else reads as a note to the bot about what it could not do, phrased as an
// instruction while it is still the burst being answered, and in the past tense
// once it is only history. Without that split a bot apologises for the same
// unreadable video on every turn for the rest of the conversation.

/** What to call each kind in a sentence a customer will read. */
const NOUNS: Record<string, string> = {
  image: 'photo',
  audio: 'voice note',
  video: 'video',
  document: 'file',
  sticker: 'sticker',
}

/** What the bot failed to do with it — "see" a photo, "watch" a video. */
const VERBS: Record<string, string> = {
  image: 'see',
  audio: 'listen to',
  video: 'watch',
  document: 'open',
  sticker: 'read',
}

/** What to do about it, when it is the thing currently being answered. */
const REMEDIES: Record<string, string> = {
  image:
    'Say so briefly, then ask them to describe it in words, or offer to pass the chat to a colleague who can look at it.',
  audio: 'Say so briefly and ask them to type their message instead.',
  video: 'Say so briefly and offer to pass the chat to a colleague who can watch it.',
  document: 'Say so briefly and offer to pass the chat to a colleague who can open it.',
  sticker: 'Ignore it and answer whatever else they said.',
}

function noun(messageType: string): string {
  return NOUNS[messageType] ?? 'attachment'
}

/**
 * Statuses that say nothing on their own: not yet looked at, left out by the
 * cap, or deliberately never mentioned. A row in one of these still counts as
 * part of the conversation — it may carry a caption, and a `skipped` one is
 * counted by `renderSkipped` — it just contributes no note of its own.
 */
const SILENT = new Set(['ignored', 'skipped', 'pending'])

/**
 * Whether a row belongs in the conversation the model is shown at all.
 *
 * Wider than "has something to say": `pending` and `skipped` rows are kept
 * because the media pass has to find them and the cap has to count them.
 * Rendering is what decides whether they produce a line.
 */
export function isConversationRow(row: MessageRow): boolean {
  if (row.messageType === 'tool') return false
  if (row.mediaStatus === 'ignored') return false
  if (row.mediaStatus) return true
  return row.content.trim().length > 0
}

/**
 * One message as the model should read it, or null when it has nothing to add.
 *
 * `pending` means this row is part of the burst being answered right now, as
 * opposed to history the model is only remembering.
 */
export function renderRow(row: MessageRow, options: { pending: boolean }): string | null {
  const caption = row.content.trim()

  if (!row.mediaStatus || SILENT.has(row.mediaStatus)) return caption || null

  const summary = row.mediaSummary?.trim()
  if (row.mediaStatus === 'described' && summary) {
    const body =
      row.messageType === 'sticker'
        ? `[Sticker: ${summary}]`
        : `[${label(row.messageType)}] ${summary}`
    return caption ? `${caption}\n${body}` : body
  }

  const kind = noun(row.messageType)
  const verb = VERBS[row.messageType] ?? 'read'

  // A `described` row that arrives here has an empty summary — the call
  // succeeded and said nothing, which is a failure from the customer's side.
  const status = row.mediaStatus === 'described' ? 'failed' : row.mediaStatus

  const note = options.pending
    ? pendingNote(status, kind, verb, row.messageType)
    : `[The customer sent a ${kind}, which you could not ${verb}.]`

  return caption ? `${caption}\n${note}` : note
}

function pendingNote(status: string, kind: string, verb: string, messageType: string): string {
  if (status === 'too_large') {
    return `[The customer sent a ${kind} that was too large to open. Say so briefly and ask them to send a smaller one.]`
  }
  if (status === 'failed') {
    return `[The customer sent a ${kind} that could not be opened. Say so briefly and ask them to send it again.]`
  }

  const remedy = REMEDIES[messageType] ?? 'Say so briefly and offer to pass the chat to a colleague.'
  return `[The customer sent a ${kind}. You cannot ${verb} ${plural(kind)}. ${remedy}]`
}

function label(messageType: string): string {
  const name = noun(messageType)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * The one line that accounts for everything the per-burst cap left out.
 *
 * Aggregate rather than per-row on purpose: six photos should cost the bot one
 * sentence of hedging, not four identical apologies, and the number is the only
 * part the customer needs to hear.
 */
export function renderSkipped(rows: MessageRow[]): string | null {
  const skipped = rows.filter((row) => row.mediaStatus === 'skipped')
  if (skipped.length === 0) return null

  // Counted per kind: photos and voice notes have different caps, and a burst
  // carrying both would otherwise be reported as several of whichever arrived
  // first — a number the bot would then repeat to the customer.
  const byKind = new Map<string, number>()
  for (const row of skipped) byKind.set(row.messageType, (byKind.get(row.messageType) ?? 0) + 1)

  const clauses = [...byKind.entries()].map(([messageType, count]) => {
    const kind = noun(messageType)
    const read = messageType === 'image' ? MAX_IMAGES_PER_BURST : MAX_VOICE_NOTES_PER_BURST
    return `${count} further ${count === 1 ? kind : plural(kind)} (only the ${read} most recent were read)`
  })

  return (
    `[${clauses.join(', and ')} arrived but were not read. ` +
    `If your answer depends on them, say that you could only check the ones you were shown.]`
  )
}

function plural(kind: string): string {
  return kind === 'photo' ? 'photos' : `${kind}s`
}

/**
 * The half of this that lives in the prompt.
 *
 * The bracket convention is invisible to the customer and has to stay that way:
 * a model that has not been told what `[Photo]` means will happily repeat it
 * back into a WhatsApp message. Appended next to `channelGuidance` for the same
 * reason — it is about how to read the conversation, never about what to say.
 */
export function mediaGuidance(): string {
  return [
    'Some lines in this conversation are in square brackets. They are notes about',
    'attachments the customer sent — never words the customer typed, and never',
    'something to repeat back. A line like "[Photo] ..." is a description of an',
    'image they sent: treat what it says as though you had seen the picture',
    'yourself. A line like "[Voice note] ..." is what they said out loud. Answer',
    'the customer normally, in their language, without mentioning descriptions,',
    'transcriptions or brackets.',
  ].join(' ')
}

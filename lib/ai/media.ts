import crypto from 'crypto'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getProvider } from '@/lib/wa/provider'
import { getProviderModule } from './providers'
import type { DescribeRequest, DescribeResponse } from './providers'
import { resolveCapability, type BotConnection, type MediaCapability } from './connection'
import { recordUsage } from './usage'
import {
  MAX_IMAGES_PER_BURST,
  MAX_VOICE_NOTES_PER_BURST,
  type MessageRow,
} from './media-render'
import type { Bot } from './types'

/**
 * Turns attachments into words, so the text model can answer them.
 *
 * This runs between the burst being assembled and the reply being written —
 * inside `runAutoReply`, never in the webhook, because a vision call takes
 * seconds and the webhook has to be acked in milliseconds.
 *
 * Everything it learns is written back onto the message row. That makes the
 * description three things at once: the cache (an attachment is never sent to a
 * vendor twice, however long the conversation runs on), the audit trail (an
 * operator can see what the bot thought it was looking at), and the memory (a
 * photo from six turns ago is still readable, for free).
 *
 * Nothing here throws. A blind bot that says so is useful; a reply that dies
 * because a photo would not download is not.
 */

/** Ceilings on what is worth sending a vendor. WhatsApp compresses well below both. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_AUDIO_BYTES = 16 * 1024 * 1024

const IMAGE_PROMPT = [
  'You are reading an image that a customer sent to a business on WhatsApp.',
  'Describe what it shows in at most three sentences, plainly and factually.',
  'Quote any text, numbers, amounts, dates, names or reference codes exactly —',
  'those are usually the whole reason the image was sent.',
  'Do not greet anyone, do not offer help, and do not guess what the customer wants.',
  'Describe only what is actually visible.',
].join(' ')

const VOICE_PROMPT = [
  'Transcribe this voice note exactly, in the language it was spoken in.',
  'Output only the transcription, with no commentary, labels or translation.',
].join(' ')

/** True when this row is waiting on a model before it can be answered. */
export function hasPendingMedia(rows: MessageRow[]): boolean {
  return rows.some((row) => row.mediaStatus === 'pending')
}

export interface DescribeMediaInput {
  bot: Bot
  conversationId: string
  /** The unanswered burst, oldest first. Nothing outside it is touched. */
  rows: MessageRow[]
  /** Collects the ledger rows written here, exactly as the reply loop does. */
  usageSink?: string[]
}

/**
 * Resolves every `pending` attachment in the burst.
 *
 * Deliberately scoped to the burst rather than the whole thread: a conversation
 * that spent a week on human replies can have dozens of unread photos in it,
 * and describing all of them the moment it switches to AI would be a surprise
 * bill for messages nobody is waiting on an answer to.
 */
export async function describePendingMedia(input: DescribeMediaInput): Promise<void> {
  const pending = input.rows.filter((row) => row.mediaStatus === 'pending')
  if (pending.length === 0) return

  // Nothing reads these, and nothing ever will — no capability to check, no
  // call to make, no key required.
  for (const row of pending.filter((r) => r.messageType === 'video' || r.messageType === 'document')) {
    mark(row.id, 'unsupported')
  }

  await Promise.all([
    describeKind({
      ...input,
      rows: pending.filter((r) => r.messageType === 'image'),
      capability: 'image',
      cap: MAX_IMAGES_PER_BURST,
      maxBytes: MAX_IMAGE_BYTES,
    }),
    describeKind({
      ...input,
      rows: pending.filter((r) => r.messageType === 'audio'),
      capability: 'voice',
      cap: MAX_VOICE_NOTES_PER_BURST,
      maxBytes: MAX_AUDIO_BYTES,
    }),
  ])
}

interface DescribeKindInput extends DescribeMediaInput {
  capability: MediaCapability
  cap: number
  maxBytes: number
}

async function describeKind(input: DescribeKindInput): Promise<void> {
  if (input.rows.length === 0) return

  // One resolution for the whole kind: whether this bot can see is a property
  // of its provider, not of any particular photo.
  const connection = resolveCapability(input.bot, input.capability)
  if (!connection) {
    for (const row of input.rows) mark(row.id, 'unsupported')
    return
  }

  const vendor = getProviderModule(connection.kind)
  const describe = input.capability === 'image' ? vendor.describeImages : vendor.transcribeAudio
  if (!describe) {
    for (const row of input.rows) mark(row.id, 'unsupported')
    return
  }

  // Everything is downloaded, then only some of it is described. The cap is on
  // vendor calls, which cost money; the downloads are a local network hop, and
  // the bytes are what the deduplication below compares.
  const fetched = await Promise.all(
    input.rows.map((row, position) => download(row, position, input.maxBytes))
  )
  const usable = fetched.filter((item): item is Fetched => item !== null)

  // Identical bytes are one question asked twice — WhatsApp albums and re-sends
  // produce them constantly, and each costs a full call if nobody looks.
  const groups = new Map<string, Fetched[]>()
  for (const item of usable) {
    const group = groups.get(item.hash)
    if (group) group.push(item)
    else groups.set(item.hash, [item])
  }

  // Newest first when something has to give: the most recent attachment is the
  // one the customer is most likely still talking about. A group is ranked by
  // its *newest* member, not its first — a photo sent early and sent again just
  // now is a recent photo, and dropping it would drop both copies.
  const ordered = [...groups.values()].sort((a, b) => lastIndexIn(b) - lastIndexIn(a))
  const kept = ordered.slice(0, input.cap)
  for (const group of ordered.slice(input.cap)) {
    for (const item of group) mark(item.row.id, 'skipped')
  }

  await Promise.all(
    kept.map(async (group) => {
      const lead = group[0]
      const summary = await runDescribe({
        describe,
        connection,
        input,
        item: lead,
      })

      for (const item of group) {
        if (summary.ok) mark(item.row.id, 'described', summary.text)
        else mark(item.row.id, 'failed', null, summary.error)
      }
    })
  )
}

interface Fetched {
  row: MessageRow
  /** Position in the burst, oldest first. What "most recent" is measured on. */
  position: number
  hash: string
  data: Buffer
  mimeType: string
}

function lastIndexIn(group: Fetched[]): number {
  return Math.max(...group.map((item) => item.position))
}

/**
 * Pulls one attachment's bytes, resolving the row itself when it cannot.
 *
 * Returns null for anything that will not be described, having already recorded
 * why: `too_large` is fixed by the customer sending a smaller file, `failed` by
 * them sending it again, and telling them apart is the difference between
 * useful advice and "something went wrong".
 */
async function download(
  row: MessageRow,
  position: number,
  maxBytes: number
): Promise<Fetched | null> {
  if (!row.mediaUrl) {
    mark(row.id, 'failed', null, 'The provider delivered no file for this message')
    return null
  }

  try {
    const media = await getProvider().downloadMedia(row.mediaUrl)
    if (media.data.length > maxBytes) {
      mark(row.id, 'too_large')
      return null
    }

    return {
      row,
      position,
      hash: crypto.createHash('sha256').update(media.data).digest('hex'),
      data: media.data,
      // The stored MIME is what the sender claimed; the served one is what the
      // bytes actually are, and the vendor will be parsing the bytes.
      mimeType: media.mimeType || row.mediaMime || 'application/octet-stream',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    mark(row.id, /too large/i.test(message) ? 'too_large' : 'failed', null, message)
    return null
  }
}

type DescribeOutcome = { ok: true; text: string } | { ok: false; error: string }

type DescribeFn = (req: DescribeRequest) => Promise<DescribeResponse>

/**
 * One vendor call, always leaving a ledger row behind — the same bargain the
 * reply loop makes. A photo that was read and then answered badly should not
 * look cheaper than one that was never read at all.
 */
async function runDescribe(args: {
  describe: DescribeFn
  connection: BotConnection
  input: DescribeKindInput
  item: Fetched
}): Promise<DescribeOutcome> {
  const { describe, connection, input, item } = args
  const startedAt = Date.now()

  const ledger = {
    connection,
    botId: input.bot.id,
    conversationId: input.conversationId,
    round: 0,
    stage: input.capability === 'image' ? ('image' as const) : ('voice' as const),
  }

  try {
    const response = await describe({
      prompt: input.capability === 'image' ? IMAGE_PROMPT : VOICE_PROMPT,
      model: connection.model,
      apiKey: connection.apiKey,
      media: [{ mimeType: item.mimeType, data: item.data.toString('base64') }],
      ...(item.row.content.trim() ? { text: item.row.content.trim() } : {}),
    })

    const id = recordUsage({ ...ledger, usage: response.usage, latencyMs: Date.now() - startedAt })
    if (id) input.usageSink?.push(id)

    const text = response.text.trim()
    return text
      ? { ok: true, text }
      : { ok: false, error: 'The model returned nothing for this attachment' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const id = recordUsage({ ...ledger, latencyMs: Date.now() - startedAt, error })
    if (id) input.usageSink?.push(id)
    console.error(`[ai] Could not read ${input.capability} attachment:`, err)
    return { ok: false, error }
  }
}

function mark(
  messageId: string,
  status: string,
  summary: string | null = null,
  error?: string
): void {
  try {
    db.update(messages)
      .set({
        mediaStatus: status,
        mediaSummary: summary,
        ...(error ? { error } : {}),
      })
      .where(eq(messages.id, messageId))
      .run()
  } catch (err) {
    console.error('[ai] Could not record what an attachment turned out to be:', err)
  }
}

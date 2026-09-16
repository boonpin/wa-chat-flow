import { fromChatId, isGroupChat, isIndividualChat, isLidChat } from './phone'
import type {
  IncomingMedia,
  IncomingMessage,
  MessageType,
  SessionStatus,
  SessionStatusEvent,
} from './types'

/**
 * Translates raw WAHA webhook payloads into the internal, provider-independent
 * shapes. Keeping this separate from the HTTP route means a second transport
 * only needs its own normaliser.
 */

export interface WahaWebhookBody {
  id?: string
  event?: string
  session?: string
  timestamp?: number
  payload?: Record<string, unknown>
}

const TYPE_MAP: Record<string, MessageType> = {
  chat: 'text',
  text: 'text',
  image: 'image',
  sticker: 'sticker',
  video: 'video',
  audio: 'audio',
  ptt: 'audio',
  voice: 'audio',
  document: 'document',
}

const STATUS_MAP: Record<string, SessionStatus> = {
  STOPPED: 'offline',
  STARTING: 'starting',
  SCAN_QR_CODE: 'waiting_qr',
  WORKING: 'connected',
  FAILED: 'failed',
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Translates a `@lid` address into a bare phone number. */
export type LidResolver = (sessionId: string, lid: string) => Promise<string | null>

/**
 * Normalises a `message` event. Returns null for anything we deliberately drop:
 * our own outbound echoes, group chats, channels, status broadcasts and
 * malformed events.
 *
 * One-to-one chats reach us addressed either by phone number (`@c.us`) or by
 * linked identity (`@lid`). Both are real people; the latter needs its opaque
 * id translated before we can store a contact or reply, which is what
 * `resolveLid` is for.
 */
export async function normalizeIncomingMessage(
  body: WahaWebhookBody,
  resolveLid: LidResolver
): Promise<IncomingMessage | null> {
  const sessionId = str(body.session)
  const payload = body.payload
  if (!sessionId || !payload) return null

  if (payload.fromMe === true) return null

  const chatId = str(payload.from)
  if (!chatId) return null
  // Groups, channels and status broadcasts have no single person to reply to.
  if (isGroupChat(chatId) || chatId === 'status@broadcast' || chatId.endsWith('@newsletter')) {
    return null
  }

  const providerMessageId = str(payload.id)
  if (!providerMessageId) return null

  const phone = await resolvePhone(chatId, sessionId, resolveLid)
  if (!phone) return null

  const raw = (payload._data as Record<string, unknown> | undefined) ?? {}
  const rawType = str(payload.type) ?? str(raw.type) ?? 'chat'

  const seconds = typeof payload.timestamp === 'number' ? payload.timestamp : body.timestamp
  const timestamp = clampToNow(seconds)

  const media = readMedia(payload, raw)
  const type = readType(rawType, media)

  return {
    provider: 'waha',
    sessionId,
    providerMessageId,
    chatId,
    phone,
    contactName: str(payload.notifyName) ?? str(raw.notifyName) ?? str(raw.pushname),
    type,
    text: readCaption(payload, raw, media),
    ...(media ? { media } : {}),
    ...(type === 'sticker' ? { stickerName: readStickerName(raw) } : {}),
    timestamp,
  }
}

/**
 * The attachment, where the provider has one.
 *
 * WAHA only populates this once it has finished downloading the file; a media
 * message whose download failed arrives with `media.error` set and no URL,
 * which is indistinguishable from no attachment at all as far as we are
 * concerned — either way there is nothing to send a model.
 */
function readMedia(
  payload: Record<string, unknown>,
  raw: Record<string, unknown>
): IncomingMedia | undefined {
  const media = (payload.media ?? raw.media) as Record<string, unknown> | undefined
  const url = str(media?.url)
  if (!url) return undefined

  const size = media?.size ?? raw.size
  return {
    url,
    mimeType: str(media?.mimetype) ?? str(raw.mimetype),
    filename: str(media?.filename) ?? str(raw.filename),
    ...(typeof size === 'number' ? { sizeBytes: size } : {}),
  }
}

/**
 * The declared type, corrected against what actually arrived.
 *
 * Engines disagree on the label for the same file — a voice note is `ptt` on
 * one and `audio` on another — and an unrecognised label would otherwise make a
 * perfectly readable photo `unknown`. The MIME type is the more reliable
 * witness, so it wins whenever the label tells us nothing.
 */
function readType(rawType: string, media: IncomingMedia | undefined): MessageType {
  const declared = TYPE_MAP[rawType]
  if (declared) return declared

  const mime = media?.mimeType ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime) return 'document'

  return 'unknown'
}

/**
 * What the customer actually typed alongside an attachment.
 *
 * Engines disagree wildly about `body` on a media message: some put the caption
 * there, some put the file's own URL, and some put a base64 thumbnail of the
 * image. None of the last two is something a customer wrote, and letting one
 * through shows it in the Inbox as their words and feeds it to the model as
 * their question — a thumbnail costs a few hundred tokens a turn to say nothing.
 */
function readCaption(
  payload: Record<string, unknown>,
  raw: Record<string, unknown>,
  media: IncomingMedia | undefined
): string | undefined {
  const explicit = str(payload.caption) ?? str(raw.caption)
  if (explicit) return explicit

  const body = str(payload.body) ?? str(raw.body)
  if (!body) return undefined
  if (!media) return body

  if (body === media.url) return undefined
  if (/^(https?|data):/i.test(body)) return undefined
  if (looksEncoded(body)) return undefined
  return body
}

/**
 * True for a body that is encoded bytes rather than writing.
 *
 * Length plus the base64 alphabet, and deliberately no space character: any
 * caption long enough to trip the length test has a space in it, while a base64
 * blob never does. That is what keeps a genuinely chatty caption safe.
 */
function looksEncoded(value: string): boolean {
  return value.length > 100 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(value)
}

/**
 * A sticker's name, if WhatsApp sent one.
 *
 * Engines carry this in different places and often not at all, so every known
 * field is tried and the answer is allowed to be "none" — which is the signal
 * upstream uses to ignore the sticker rather than invent a meaning for it.
 */
function readStickerName(raw: Record<string, unknown>): string | undefined {
  const pack = raw.stickerPack as Record<string, unknown> | undefined
  return str(raw.stickerName) ?? str(pack?.name) ?? str(raw.stickerPackName)
}

/** Normalises a `session.status` event. */
export function normalizeSessionStatus(body: WahaWebhookBody): SessionStatusEvent | null {
  const sessionId = str(body.session) ?? str(body.payload?.name)
  const status = str(body.payload?.status)
  if (!sessionId || !status) return null

  return {
    provider: 'waha',
    sessionId,
    status: STATUS_MAP[status] ?? 'offline',
  }
}

/**
 * Produces the bare phone number for a one-to-one chat.
 *
 * `@lid` senders are looked up through the provider. If the mapping is missing
 * we drop the message rather than invent a contact from the opaque id — but we
 * say so loudly, because that is a customer going unanswered.
 */
async function resolvePhone(
  chatId: string,
  sessionId: string,
  resolveLid: LidResolver
): Promise<string | null> {
  if (isIndividualChat(chatId)) return fromChatId(chatId) || null

  if (isLidChat(chatId)) {
    const phone = await resolveLid(sessionId, chatId)
    if (!phone) {
      console.warn(`[wa] Could not resolve ${chatId} to a phone number — message dropped`)
      return null
    }
    return phone
  }

  console.log(`[wa] Ignoring message from unsupported address: ${chatId}`)
  return null
}

/**
 * Resolves the provider timestamp, never allowing it past "now".
 *
 * A future-dated message — a skewed sender clock, a bad event — would otherwise
 * pin its conversation to the top of the inbox permanently and scramble the
 * history the model is given, both of which are ordered by this value.
 */
function clampToNow(value: number | undefined): Date {
  const now = Date.now()
  if (!value) return new Date(now)

  // WAHA emits seconds in most events but milliseconds in a few.
  const ms = value > 1e12 ? value : value * 1000
  return new Date(Number.isFinite(ms) ? Math.min(ms, now) : now)
}

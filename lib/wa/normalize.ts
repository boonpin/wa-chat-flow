import { fromChatId, isGroupChat, isIndividualChat, isLidChat } from './phone'
import type { IncomingMessage, MessageType, SessionStatus, SessionStatusEvent } from './types'

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
  sticker: 'image',
  video: 'image',
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

  return {
    provider: 'waha',
    sessionId,
    providerMessageId,
    chatId,
    phone,
    contactName: str(payload.notifyName) ?? str(raw.notifyName) ?? str(raw.pushname),
    type: TYPE_MAP[rawType] ?? 'unknown',
    text: str(payload.body) ?? str(raw.body),
    timestamp,
  }
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

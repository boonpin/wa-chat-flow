import { fromChatId, isGroupChat } from './phone'
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

/**
 * Normalises a `message` event. Returns null for anything we deliberately drop:
 * our own outbound echoes, group chats, status broadcasts and malformed events.
 */
export function normalizeIncomingMessage(body: WahaWebhookBody): IncomingMessage | null {
  const sessionId = str(body.session)
  const payload = body.payload
  if (!sessionId || !payload) return null

  if (payload.fromMe === true) return null

  const chatId = str(payload.from)
  if (!chatId) return null
  if (isGroupChat(chatId) || chatId === 'status@broadcast') return null

  const providerMessageId = str(payload.id)
  if (!providerMessageId) return null

  const phone = fromChatId(chatId)
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

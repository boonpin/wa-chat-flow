/**
 * Transport-agnostic WhatsApp types.
 *
 * Nothing outside `lib/wa/` should know which engine actually talks to
 * WhatsApp. Swapping WAHA for the Meta Cloud API later means writing another
 * `WhatsAppProvider` — not touching business logic.
 */

/** Normalised session lifecycle, mapped from whatever the provider reports. */
export type SessionStatus = 'offline' | 'starting' | 'waiting_qr' | 'connected' | 'failed'

export type MessageType = 'text' | 'image' | 'audio' | 'document' | 'unknown'

export interface SendTextInput {
  sessionId: string
  /** Bare phone number (digits only). Converted to a chat id by the provider. */
  phone: string
  text: string
}

export interface SendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

export interface SessionInfo {
  id: string
  status: SessionStatus
  /** The connected WhatsApp account, when the session is authenticated. */
  me?: { id: string; pushName?: string }
}

/**
 * A provider-independent inbound message. Everything downstream of
 * `handleIncomingMessage` speaks this shape only.
 */
export interface IncomingMessage {
  provider: 'waha'
  sessionId: string
  providerMessageId: string
  chatId: string
  phone: string
  contactName?: string
  type: MessageType
  text?: string
  timestamp: Date
}

/** A session lifecycle change pushed by the provider. */
export interface SessionStatusEvent {
  provider: 'waha'
  sessionId: string
  status: SessionStatus
}

export interface WhatsAppProvider {
  readonly name: 'waha'

  sendText(input: SendTextInput): Promise<SendResult>

  getSessionStatus(sessionId: string): Promise<SessionInfo>

  /** Creates the session if it does not exist yet, then starts it. */
  startSession(sessionId: string): Promise<void>

  stopSession(sessionId: string): Promise<void>

  logoutSession(sessionId: string): Promise<void>

  /** Stops, logs out and removes the session and its stored credentials. */
  deleteSession(sessionId: string): Promise<void>

  /** Returns a `data:` URL for the pairing QR, or null when not pairing. */
  getQrCode(sessionId: string): Promise<string | null>
}

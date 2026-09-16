/**
 * Transport-agnostic WhatsApp types.
 *
 * Nothing outside `lib/wa/` should know which engine actually talks to
 * WhatsApp. Swapping WAHA for the Meta Cloud API later means writing another
 * `WhatsAppProvider` — not touching business logic.
 */

import type { Channel } from '@/lib/channel/types'

/** Normalised session lifecycle, mapped from whatever the provider reports. */
export type SessionStatus = 'offline' | 'starting' | 'waiting_qr' | 'connected' | 'failed'

/**
 * Kinds of inbound message, kept finer-grained than what we can act on.
 *
 * `sticker` and `video` were once folded into `image`, which made three
 * different policies — describe it, read its name, decline it — impossible to
 * tell apart by the time they reached the reply path.
 */
export type MessageType =
  | 'text'
  | 'image'
  | 'sticker'
  | 'audio'
  | 'video'
  | 'document'
  | 'unknown'

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

export interface SetTypingInput {
  sessionId: string
  /** Bare phone number (digits only). Converted to a chat id by the provider. */
  phone: string
  typing: boolean
}

export interface SessionInfo {
  id: string
  status: SessionStatus
  /** The connected WhatsApp account, when the session is authenticated. */
  me?: { id: string; pushName?: string }
}

/**
 * A provider-independent inbound message. Everything downstream of
 * `persistIncomingMessage` speaks this shape only.
 */
export interface IncomingMessage {
  provider: 'waha'
  sessionId: string
  providerMessageId: string
  chatId: string
  phone: string
  contactName?: string
  type: MessageType
  /** The caption, for media. Never a description of the file itself. */
  text?: string
  /** Where the provider is holding the attachment, when there is one. */
  media?: IncomingMedia
  /**
   * A sticker's own name, where WhatsApp carries one.
   *
   * It is the whole reason a sticker can be answered at all: a named sticker
   * says something ("thank you", "shocked"), an unnamed one is decoration and
   * is ignored rather than guessed at.
   */
  stickerName?: string
  timestamp: Date
}

/** An attachment as the provider describes it, before anything is downloaded. */
export interface IncomingMedia {
  /**
   * Provider-side location. Not necessarily reachable from a browser, or from
   * anywhere outside the app's own network — only `downloadMedia` may resolve it.
   */
  url: string
  mimeType?: string
  filename?: string
  sizeBytes?: number
}

/** An attachment's actual bytes, once fetched. */
export interface DownloadedMedia {
  data: Buffer
  mimeType: string
}

/** A session lifecycle change pushed by the provider. */
export interface SessionStatusEvent {
  provider: 'waha'
  sessionId: string
  status: SessionStatus
}

export interface WhatsAppProvider {
  /**
   * The vendor carrying the messages, and the namespace
   * `messages.provider_message_id` is unique within.
   */
  readonly name: 'waha'

  /**
   * The surface those messages are rendered on, which is a separate question
   * from who carries them — see `lib/channel/types.ts`. It is what decides how
   * a model's reply is written, so a second WhatsApp transport would change
   * `name` and leave this alone.
   */
  readonly channel: Channel

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

  /**
   * Shows or clears the "typing…" indicator in a chat.
   *
   * Cosmetic, and therefore best-effort: an implementation must resolve rather
   * than throw when the transport cannot do it, because a missing indicator is
   * never a reason to abandon a reply.
   */
  setTyping(input: SetTypingInput): Promise<void>

  /**
   * Resolves a `@lid` address to a bare phone number, or null when the
   * provider has no mapping for it.
   */
  resolveLid(sessionId: string, lid: string): Promise<string | null>

  /**
   * Fetches an attachment's bytes from wherever the provider is holding them.
   *
   * Here rather than at the call site because the location is the provider's
   * business: WAHA serves files from its own host behind its own API key, and
   * nothing above `lib/wa/` should have to know that — or be able to hand that
   * URL to a third party.
   */
  downloadMedia(url: string): Promise<DownloadedMedia>
}

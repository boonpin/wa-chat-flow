import { db } from '@/lib/db'
import { messages, systemSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { findOrCreateContact, type Contact } from '@/lib/contacts/service'
import {
  getConversation,
  getOrCreateOpenConversation,
  touchConversation,
  type Conversation,
} from '@/lib/conversation/service'
import { buildHistory } from '@/lib/ai/context'
import { resolveHandler } from '@/lib/ai/handler'
import { selectBot } from './bot-selection'
import { sendOutgoingMessage } from './outgoing'
import type { IncomingMessage } from '@/lib/wa/types'

/**
 * The single entry point for every inbound WhatsApp message, regardless of
 * transport. Webhooks do nothing but normalise and call in here.
 *
 *   dedupe → contact → conversation → store   (persistIncomingMessage)
 *   → mode check → bot → context → AI → send  (runAutoReply)
 *
 * The split matters: persistence must finish before the webhook is acked so a
 * retry cannot duplicate the message, while the AI call — which can take
 * seconds — must not hold the webhook connection open.
 */

export interface PersistedIncoming {
  status: 'stored'
  incoming: IncomingMessage
  contact: Contact
  conversation: Conversation
  storedMessageId: string
}

export type PersistResult = PersistedIncoming | { status: 'duplicate' }

export type AutoReplyOutcome =
  | { status: 'skipped'; reason: 'auto_reply_disabled' | 'human_mode' | 'no_bot' | 'unsupported_type' | 'empty_reply' }
  | { status: 'replied'; messageId: string }
  | { status: 'failed'; error: string }

/** Steps 1–4: everything that must happen before the webhook returns. */
export function persistIncomingMessage(incoming: IncomingMessage): PersistResult {
  // ─── 1. Deduplicate ─────────────────────────────────────────────────────────
  // Webhook delivery is at-least-once: WAHA retries on non-2xx and a restart
  // can replay events. The provider message id is the idempotency key.
  const alreadySeen = db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.provider, incoming.provider),
        eq(messages.providerMessageId, incoming.providerMessageId)
      )
    )
    .get()

  if (alreadySeen) return { status: 'duplicate' }

  // ─── 2. Contact ─────────────────────────────────────────────────────────────
  const contact = findOrCreateContact({
    phone: incoming.phone,
    name: incoming.contactName,
    waSessionId: incoming.sessionId,
  })

  // ─── 3. Conversation ────────────────────────────────────────────────────────
  const conversation = getOrCreateOpenConversation({
    contactId: contact.id,
    waSessionId: incoming.sessionId,
    defaultMode: contact.aiEnabled ? 'auto' : 'human',
    defaultBotId: contact.aiBotId,
  })

  // ─── 4. Store ───────────────────────────────────────────────────────────────
  const receivedAt = incoming.timestamp.toISOString()
  const storedMessageId = uuidv4()

  try {
    db.insert(messages)
      .values({
        id: storedMessageId,
        conversationId: conversation.id,
        contactId: contact.id,
        provider: incoming.provider,
        providerMessageId: incoming.providerMessageId,
        direction: 'incoming',
        senderType: 'customer',
        messageType: incoming.type,
        content: incoming.text ?? '',
        status: 'received',
        error: null,
        createdAt: receivedAt,
      })
      .run()
  } catch (err) {
    // The unique index on (provider, provider_message_id) is the real guard:
    // two concurrent deliveries of one event race past the check above.
    if (isUniqueViolation(err)) return { status: 'duplicate' }
    throw err
  }

  touchConversation(conversation.id, receivedAt)

  console.log(
    `[wa] [IN] ${contact.name || contact.phoneNumber}: ${incoming.text ?? `<${incoming.type}>`}`
  )

  return { status: 'stored', incoming, contact, conversation, storedMessageId }
}

/** Steps 5–8: decide whether the AI answers, and answer. */
export async function runAutoReply(persisted: PersistedIncoming): Promise<AutoReplyOutcome> {
  const { incoming, contact, storedMessageId } = persisted

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()

  // Re-read the conversation: this runs after the webhook was acked, so an
  // operator may have taken the thread off auto in the meantime.
  const conversation = getConversation(persisted.conversation.id) ?? persisted.conversation

  // ─── 5. Should the AI answer at all? ────────────────────────────────────────
  if (!settings?.autoReplyEnabled) return { status: 'skipped', reason: 'auto_reply_disabled' }
  if (conversation.mode !== 'auto') return { status: 'skipped', reason: 'human_mode' }

  // Media carries no text to reason about — leave those for a human.
  const text = incoming.text?.trim()
  if (incoming.type !== 'text' || !text) return { status: 'skipped', reason: 'unsupported_type' }

  // ─── 6. Bot ─────────────────────────────────────────────────────────────────
  const bot = selectBot({
    conversationBotId: conversation.botId,
    contactBotId: contact.aiBotId,
    settingsDefaultBotId: settings.defaultBotId,
  })
  if (!bot) return { status: 'skipped', reason: 'no_bot' }

  try {
    // ─── 7. Context + AI ──────────────────────────────────────────────────────
    const output = await resolveHandler(bot).reply({
      bot,
      history: buildHistory(conversation.id, storedMessageId),
      message: text,
      contact: { name: contact.name, phone: contact.phoneNumber },
      conversationId: conversation.id,
    })

    const reply = output.text.trim()
    if (!reply) return { status: 'skipped', reason: 'empty_reply' }

    // ─── 8. Send ──────────────────────────────────────────────────────────────
    const sent = await sendOutgoingMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      phone: contact.phoneNumber,
      sessionId: incoming.sessionId,
      text: reply,
      senderType: 'ai',
    })

    if (sent.ok) console.log(`[wa] [AI] ${contact.name || contact.phoneNumber}: ${reply}`)

    return sent.ok
      ? { status: 'replied', messageId: sent.messageId }
      : { status: 'failed', error: sent.error ?? 'Send failed' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[wa] AI reply error:', err)
    recordAiFailure(conversation.id, contact.id, incoming.provider, error)
    return { status: 'failed', error }
  }
}

/** Convenience wrapper that runs both phases. */
export async function handleIncomingMessage(
  incoming: IncomingMessage
): Promise<PersistResult | AutoReplyOutcome> {
  const persisted = persistIncomingMessage(incoming)
  if (persisted.status === 'duplicate') return persisted
  return runAutoReply(persisted)
}

/**
 * Leaves a visible failure in the thread. Without this an AI outage looks
 * identical to a customer who simply was not answered.
 */
function recordAiFailure(
  conversationId: string,
  contactId: string,
  provider: string,
  error: string
): void {
  db.insert(messages)
    .values({
      id: uuidv4(),
      conversationId,
      contactId,
      provider,
      providerMessageId: null,
      direction: 'outgoing',
      senderType: 'system',
      messageType: 'text',
      content: '',
      status: 'failed',
      error: `AI reply failed: ${error}`,
      createdAt: new Date().toISOString(),
    })
    .run()
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

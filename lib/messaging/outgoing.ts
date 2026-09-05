import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getProvider } from '@/lib/wa/provider'
import { touchConversation } from '@/lib/conversation/service'

export type SenderType = 'ai' | 'human' | 'system'

export interface SendOutgoingInput {
  conversationId: string
  contactId: string
  phone: string
  sessionId: string
  text: string
  senderType: SenderType
}

export interface SendOutgoingResult {
  ok: boolean
  messageId: string
  error?: string
}

/**
 * Sends an outbound message and records its delivery outcome.
 *
 * The row is written before the send so a crashed or hung provider call leaves
 * a visible `processing` message rather than a silently lost reply.
 */
export async function sendOutgoingMessage(input: SendOutgoingInput): Promise<SendOutgoingResult> {
  const now = new Date().toISOString()
  const messageId = uuidv4()
  const provider = getProvider()

  db.insert(messages)
    .values({
      id: messageId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      provider: provider.name,
      providerMessageId: null,
      direction: 'outgoing',
      senderType: input.senderType,
      messageType: 'text',
      content: input.text,
      status: 'processing',
      error: null,
      createdAt: now,
    })
    .run()

  const result = await provider.sendText({
    sessionId: input.sessionId,
    phone: input.phone,
    text: input.text,
  })

  db.update(messages)
    .set(
      result.ok
        ? { status: 'sent', providerMessageId: result.providerMessageId ?? null, error: null }
        : { status: 'failed', error: result.error ?? 'Unknown send error' }
    )
    .where(eq(messages.id, messageId))
    .run()

  touchConversation(input.conversationId, now)

  if (!result.ok) {
    console.error(`[wa] Send failed → ${input.phone}: ${result.error}`)
  }

  return { ok: result.ok, messageId, error: result.error }
}

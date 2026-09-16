import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getProvider } from '@/lib/wa/provider'
import { formatForChannel } from '@/lib/channel'
import { touchConversation } from '@/lib/conversation/service'

export type SenderType = 'ai' | 'human' | 'system'

export interface SendOutgoingInput {
  conversationId: string
  contactId: string
  phone: string
  sessionId: string
  text: string
  senderType: SenderType
  /**
   * Whether `text` is model-authored Markdown that has to be rewritten for the
   * channel before it goes out.
   *
   * Defaults by sender, which is the rule that matters: an operator's message
   * is sent exactly as they typed it, asterisks and all, because they were
   * writing to a person and not to a renderer.
   */
  format?: 'markdown' | 'none'
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
 *
 * It stores the text as the channel received it, not the Markdown it came
 * from: the Inbox is a mirror of the customer's phone, and an operator picking
 * up a thread has to see the words the customer is actually looking at.
 */
export async function sendOutgoingMessage(input: SendOutgoingInput): Promise<SendOutgoingResult> {
  const now = new Date().toISOString()
  const messageId = uuidv4()
  const provider = getProvider()

  const format = input.format ?? (input.senderType === 'ai' ? 'markdown' : 'none')
  const text = format === 'markdown' ? formatForChannel(provider.channel, input.text) : input.text

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
      content: text,
      status: 'processing',
      error: null,
      createdAt: now,
    })
    .run()

  const result = await provider.sendText({
    sessionId: input.sessionId,
    phone: input.phone,
    text,
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

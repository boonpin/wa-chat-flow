import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  getConversation,
  updateConversation,
  recordConversationEvent,
} from '@/lib/conversation/service'
import { sendOutgoingMessage } from '@/lib/messaging/outgoing'
import { cancelAutoReply } from '@/lib/messaging/reply-scheduler'

/** Manual reply from an operator in the inbox. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const conversation = getConversation(id)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const contact = db.select().from(contacts).where(eq(contacts.id, conversation.contactId)).get()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const sessionId = conversation.waSessionId ?? contact.waSessionId
  if (!sessionId) {
    return NextResponse.json(
      { error: 'This conversation is not linked to a WhatsApp number' },
      { status: 409 },
    )
  }

  if (body.expectedVersion !== undefined && body.expectedVersion !== conversation.replyVersion) {
    return NextResponse.json(
      { error: 'This conversation changed. Refresh before sending.' },
      { status: 409 },
    )
  }
  // Mode is committed before any asynchronous send; failure keeps team ownership.
  const claimed = db.transaction(() => {
    const next = updateConversation(
      id,
      { mode: 'human', status: 'open' },
      conversation.replyVersion,
    )
    if (!next) return false
    if (conversation.mode !== 'human')
      recordConversationEvent(id, 'mode_changed', 'Your team took over to reply')
    cancelAutoReply(id)
    return true
  })
  if (!claimed)
    return NextResponse.json(
      { error: 'This conversation changed. Refresh before sending.' },
      { status: 409 },
    )

  // The operator is answering this burst themselves. Cancel before sending, so
  // a window that elapses mid-send cannot start a second reply to the same
  // messages.
  cancelAutoReply(conversation.id)

  const result = await sendOutgoingMessage({
    conversationId: conversation.id,
    contactId: contact.id,
    phone: contact.phoneNumber,
    sessionId,
    text,
    senderType: 'human',
  })

  const stored = db.select().from(messages).where(eq(messages.id, result.messageId)).get()

  // The message row is returned either way — a failed send stays visible in the
  // thread with its error rather than vanishing.
  return NextResponse.json(
    { ok: result.ok, error: result.error, message: stored },
    { status: result.ok ? 200 : 502 },
  )
}

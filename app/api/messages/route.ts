import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { messages, contacts } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOrCreateOpenConversation } from '@/lib/conversation/service'
import { sendOutgoingMessage } from '@/lib/messaging/outgoing'

/** Message log feed, newest first. */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 100
  const contactId = searchParams.get('contactId')

  const rows = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      direction: messages.direction,
      senderType: messages.senderType,
      messageType: messages.messageType,
      message: messages.content,
      status: messages.status,
      error: messages.error,
      createdAt: messages.createdAt,
      contactId: messages.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phoneNumber,
    })
    .from(messages)
    .leftJoin(contacts, eq(messages.contactId, contacts.id))
    .where(contactId ? eq(messages.contactId, contactId) : undefined)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()

  return NextResponse.json(rows)
}

/** Manual operator reply addressed by contact. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactId, message } = await req.json()
  if (!contactId || !message?.trim()) {
    return NextResponse.json({ error: 'contactId and message are required' }, { status: 400 })
  }

  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get()
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const conversation = getOrCreateOpenConversation({
    contactId: contact.id,
    waSessionId: contact.waSessionId,
    defaultMode: contact.aiEnabled ? 'auto' : 'human',
    defaultBotId: contact.aiBotId,
  })

  const sessionId = conversation.waSessionId ?? contact.waSessionId
  if (!sessionId) {
    return NextResponse.json(
      { error: 'This contact is not linked to a WhatsApp number yet' },
      { status: 409 }
    )
  }

  const result = await sendOutgoingMessage({
    conversationId: conversation.id,
    contactId: contact.id,
    phone: contact.phoneNumber,
    sessionId,
    text: message.trim(),
    senderType: 'human',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 502 })
  }

  const stored = db.select().from(messages).where(eq(messages.id, result.messageId)).get()
  return NextResponse.json(stored)
}

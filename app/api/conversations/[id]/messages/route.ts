import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getConversation } from '@/lib/conversation/service'
import { sendOutgoingMessage } from '@/lib/messaging/outgoing'

/** Manual reply from an operator in the inbox. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = getConversation(id)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const text = (body.text as string)?.trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const contact = db.select().from(contacts).where(eq(contacts.id, conversation.contactId)).get()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const sessionId = conversation.waSessionId ?? contact.waSessionId
  if (!sessionId) {
    return NextResponse.json(
      { error: 'This conversation is not linked to a WhatsApp number' },
      { status: 409 }
    )
  }

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
    { status: result.ok ? 200 : 502 }
  )
}

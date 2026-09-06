import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { messages, contacts } from '@/lib/db/schema'
import { count, eq, desc } from 'drizzle-orm'
import { getOrCreateOpenConversation } from '@/lib/conversation/service'
import { sendOutgoingMessage } from '@/lib/messaging/outgoing'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 200

/**
 * Message log feed, newest first, one page at a time.
 *
 * Returns an envelope rather than a bare array: the table needs the total to
 * render "showing 26–50 of 812" and to know when it has reached the last page.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')
  const where = contactId ? eq(messages.contactId, contactId) : undefined

  const pageSize = clamp(parseInt(searchParams.get('pageSize') ?? '', 10), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const total = db.select({ value: count() }).from(messages).where(where).get()?.value ?? 0

  // Clamp the page to what exists: deleting rows, or a stale link, must not
  // land the table on an empty page it cannot navigate out of.
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1), lastPage)

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
    .where(where)
    // The id tiebreak is what makes paging safe: two messages can share a
    // millisecond (a tool run writes several in a tight loop), and without a
    // deterministic secondary sort a tie straddling a page boundary can repeat
    // a row on one page and drop it from the next.
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  return NextResponse.json({ rows, total, page, pageSize, lastPage })
}

function clamp(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.min(value, max)
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

  const { conversation } = getOrCreateOpenConversation({
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

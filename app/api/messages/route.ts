import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages, contacts, waSessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getClient, getWAStatus } from '@/lib/wa/client'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 100
  const contactId = searchParams.get('contactId')

  const query = db
    .select({
      id: messages.id,
      direction: messages.direction,
      message: messages.message,
      createdAt: messages.createdAt,
      contactId: messages.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phoneNumber,
    })
    .from(messages)
    .leftJoin(contacts, eq(messages.contactId, contacts.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit)

  const rows = contactId
    ? query.where(eq(messages.contactId, contactId)).all()
    : query.all()

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { contactId, message } = await req.json()
  if (!contactId || !message?.trim()) {
    return NextResponse.json({ error: 'contactId and message are required' }, { status: 400 })
  }

  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get()
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Find a connected session
  const sessions = db.select().from(waSessions).all()
  let sent = false
  for (const session of sessions) {
    if (getWAStatus(session.id) === 'connected') {
      const client = getClient(session.id)
      if (client) {
        await client.sendMessage(`${contact.phoneNumber}@c.us`, message.trim())
        sent = true
        break
      }
    }
  }

  if (!sent) {
    return NextResponse.json({ error: 'No connected WhatsApp session' }, { status: 503 })
  }

  const now = new Date().toISOString()
  const newMessage = {
    id: uuidv4(),
    contactId,
    direction: 'outgoing' as const,
    message: message.trim(),
    createdAt: now,
  }
  db.insert(messages).values(newMessage).run()

  return NextResponse.json(newMessage)
}

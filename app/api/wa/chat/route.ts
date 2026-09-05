import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, messages } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { normalizePhone } from '@/lib/wa/phone'

/**
 * Chat history for a phone number.
 *
 * Under whatsapp-web.js this reached into the live browser session. With WAHA
 * the transport holds no history for us, so our own message store is the source
 * of truth — which also means history survives restarts and reconnects.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const contact = db
    .select()
    .from(contacts)
    .where(eq(contacts.phoneNumber, normalizePhone(phone)))
    .get()

  if (!contact) {
    return NextResponse.json({ offline: false, messages: [], hasMore: false })
  }

  const rows = db
    .select()
    .from(messages)
    .where(eq(messages.contactId, contact.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()

  return NextResponse.json({
    offline: false,
    messages: rows.reverse().map((m) => ({
      id: m.id,
      body: m.content,
      fromMe: m.direction === 'outgoing',
      timestamp: new Date(m.createdAt).getTime(),
      type: m.messageType,
      senderType: m.senderType,
      status: m.status,
      error: m.error,
    })),
    hasMore: rows.length === limit,
  })
}

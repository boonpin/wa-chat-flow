import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts, waSessions } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const list = db
    .select({
      id: contacts.id,
      phoneNumber: contacts.phoneNumber,
      name: contacts.name,
      aiEnabled: contacts.aiEnabled,
      aiBotId: contacts.aiBotId,
      waSessionId: contacts.waSessionId,
      waSessionName: waSessions.sessionName,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .leftJoin(waSessions, eq(contacts.waSessionId, waSessions.id))
    .all()

  return NextResponse.json(list)
}

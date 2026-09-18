import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts, aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // Whitelist: phone number and timestamps are not client-editable.
  const patch: {
    name?: string
    aiEnabled?: boolean
    aiBotId?: string | null
    waSessionId?: string | null
  } = {}
  if (typeof body.name === 'string') patch.name = body.name.trim()
  if (typeof body.aiEnabled === 'boolean') patch.aiEnabled = body.aiEnabled
  if ('aiBotId' in body) {
    if (body.aiBotId !== null && body.aiBotId !== '' && typeof body.aiBotId !== 'string')
      return NextResponse.json({ error: 'Choose a valid AI agent.' }, { status: 400 })
    patch.aiBotId = body.aiBotId || null
    if (patch.aiBotId && !db.select().from(aiBots).where(eq(aiBots.id, patch.aiBotId)).get())
      return NextResponse.json(
        { error: 'This AI agent no longer exists. Refresh before choosing it.' },
        { status: 400 },
      )
  }
  if ('waSessionId' in body) patch.waSessionId = body.waSessionId || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  db.update(contacts)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(contacts.id, id))
    .run()

  // Contact preferences seed future conversations; takeover belongs to Inbox.
  const contact = db.select().from(contacts).where(eq(contacts.id, id)).get()
  return NextResponse.json(contact)
}

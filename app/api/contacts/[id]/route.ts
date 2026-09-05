import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts, conversations } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // Whitelist: phone number and timestamps are not client-editable.
  const patch: { name?: string; aiEnabled?: boolean; aiBotId?: string | null; waSessionId?: string | null } = {}
  if (typeof body.name === 'string') patch.name = body.name.trim()
  if (typeof body.aiEnabled === 'boolean') patch.aiEnabled = body.aiEnabled
  if ('aiBotId' in body) patch.aiBotId = body.aiBotId || null
  if ('waSessionId' in body) patch.waSessionId = body.waSessionId || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  db.update(contacts)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(contacts.id, id))
    .run()

  // The contact-level AI toggle is the default for new threads; apply it to the
  // open one too so the switch does what the operator expects right now.
  if (patch.aiEnabled !== undefined) {
    db.update(conversations)
      .set({ mode: patch.aiEnabled ? 'auto' : 'human', updatedAt: new Date().toISOString() })
      .where(and(eq(conversations.contactId, id), eq(conversations.status, 'open')))
      .run()
  }

  const contact = db.select().from(contacts).where(eq(contacts.id, id)).get()
  return NextResponse.json(contact)
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  db.update(contacts)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(contacts.id, id))
    .run()

  const contact = db.select().from(contacts).where(eq(contacts.id, id)).get()
  return NextResponse.json(contact)
}

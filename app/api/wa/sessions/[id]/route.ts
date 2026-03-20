import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { waSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logoutWhatsapp, getWAStatus } from '@/lib/wa/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const existing = db.select().from(waSessions).where(eq(waSessions.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.update(waSessions).set({ sessionName: name }).where(eq(waSessions.id, id)).run()
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = db.select().from(waSessions).where(eq(waSessions.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Logout if connected/active before deleting
  const status = getWAStatus(id)
  if (status !== 'offline') {
    await logoutWhatsapp(id)
  }

  db.delete(waSessions).where(eq(waSessions.id, id)).run()
  return NextResponse.json({ ok: true })
}

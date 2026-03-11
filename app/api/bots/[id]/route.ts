import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.isDefault) {
    db.update(aiBots).set({ isDefault: false }).run()
    db.update(systemSettings).set({ defaultBotId: id }).where(eq(systemSettings.id, 'default')).run()
  }

  db.update(aiBots)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(aiBots.id, id))
    .run()

  const bot = db.select().from(aiBots).where(eq(aiBots.id, id)).get()
  return NextResponse.json(bot)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  db.delete(aiBots).where(eq(aiBots.id, id)).run()
  return NextResponse.json({ ok: true })
}

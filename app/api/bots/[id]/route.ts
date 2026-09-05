import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { readBotInput, toPublicBot } from '../serialize'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = db.select().from(aiBots).where(eq(aiBots.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const input = readBotInput(await req.json().catch(() => ({})))

  if (input.isDefault) {
    db.update(aiBots).set({ isDefault: false }).run()
    db.update(systemSettings).set({ defaultBotId: id }).where(eq(systemSettings.id, 'default')).run()
  }

  db.update(aiBots)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(aiBots.id, id))
    .run()

  const bot = db.select().from(aiBots).where(eq(aiBots.id, id)).get()
  return NextResponse.json(bot ? toPublicBot(bot) : null)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  db.delete(aiBots).where(eq(aiBots.id, id)).run()

  // Do not leave the system pointing at a bot that no longer exists.
  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  if (settings?.defaultBotId === id) {
    db.update(systemSettings).set({ defaultBotId: null }).where(eq(systemSettings.id, 'default')).run()
  }

  return NextResponse.json({ ok: true })
}

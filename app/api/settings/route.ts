import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings, aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.defaultBotId) {
    db.update(aiBots).set({ isDefault: false }).run()
    db.update(aiBots).set({ isDefault: true }).where(eq(aiBots.id, body.defaultBotId)).run()
  }

  db.update(systemSettings).set(body).where(eq(systemSettings.id, 'default')).run()

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  return NextResponse.json(settings)
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bots = db.select().from(aiBots).all()
  return NextResponse.json(bots)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const now = new Date().toISOString()

  if (body.isDefault) {
    db.update(aiBots).set({ isDefault: false }).run()
  }

  const bot = {
    id: uuidv4(),
    name: body.name,
    provider: body.provider,
    apiKey: body.apiKey,
    model: body.model,
    prompt: body.prompt,
    isDefault: body.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(aiBots).values(bot).run()

  if (body.isDefault) {
    db.update(systemSettings).set({ defaultBotId: bot.id }).where(eq(systemSettings.id, 'default')).run()
  }

  return NextResponse.json(bot)
}

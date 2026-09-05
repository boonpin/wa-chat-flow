import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { v4 as uuidv4 } from 'uuid'
import { toPublicBot, readBotInput } from './serialize'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(db.select().from(aiBots).all().map(toPublicBot))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const input = readBotInput(body)

  if (!input.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!input.provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 })

  const now = new Date().toISOString()
  const id = uuidv4()

  if (input.isDefault) {
    db.update(aiBots).set({ isDefault: false }).run()
  }

  db.insert(aiBots)
    .values({
      id,
      name: input.name.trim(),
      provider: input.provider,
      apiKey: input.apiKey ?? null,
      model: input.model ?? '',
      prompt: input.prompt ?? '',
      handlerType: input.handlerType ?? 'direct',
      enabled: input.enabled ?? true,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  if (input.isDefault) {
    db.update(systemSettings).set({ defaultBotId: id }).where(eq(systemSettings.id, 'default')).run()
  }

  const bot = db.select().from(aiBots).where(eq(aiBots.id, id)).get()
  return NextResponse.json(bot ? toPublicBot(bot) : null)
}

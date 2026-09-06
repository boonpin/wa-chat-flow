import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { v4 as uuidv4 } from 'uuid'
import { toPublicBot, readBotInput, setBotTools } from './serialize'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(db.select().from(aiBots).all().map(toPublicBot))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, error } = readBotInput(await req.json().catch(() => ({})))
  if (error) return NextResponse.json({ error }, { status: 400 })

  if (!input.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!input.providerId) {
    return NextResponse.json(
      { error: 'providerId is required — pick the AI provider this bot answers through' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const id = uuidv4()

  if (input.isDefault) {
    db.update(aiBots).set({ isDefault: false }).run()
  }

  db.insert(aiBots)
    .values({
      id,
      name: input.name.trim(),
      providerId: input.providerId,
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

  if (input.toolIds) setBotTools(id, input.toolIds)

  const bot = db.select().from(aiBots).where(eq(aiBots.id, id)).get()
  return NextResponse.json(bot ? toPublicBot(bot) : null)
}

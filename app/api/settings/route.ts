import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings, aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { AUTO_REPLY_MODES, isAutoReplyMode, type AutoReplyMode } from '@/lib/settings/auto-reply'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Whitelist: never spread a request body straight into an update.
  const patch: { autoReplyMode?: AutoReplyMode; defaultBotId?: string | null } = {}

  if ('autoReplyMode' in body) {
    // Rejected rather than coerced: an unrecognised value would otherwise be
    // stored and then read back as the most permissive branch of the policy.
    if (!isAutoReplyMode(body.autoReplyMode)) {
      return NextResponse.json(
        { error: `autoReplyMode must be one of: ${AUTO_REPLY_MODES.join(', ')}` },
        { status: 400 }
      )
    }
    patch.autoReplyMode = body.autoReplyMode
  }

  if ('defaultBotId' in body) patch.defaultBotId = body.defaultBotId || null

  if (patch.defaultBotId) {
    const bot = db.select().from(aiBots).where(eq(aiBots.id, patch.defaultBotId)).get()
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 400 })

    db.update(aiBots).set({ isDefault: false }).run()
    db.update(aiBots).set({ isDefault: true }).where(eq(aiBots.id, patch.defaultBotId)).run()
  }

  if (Object.keys(patch).length > 0) {
    db.update(systemSettings).set(patch).where(eq(systemSettings.id, 'default')).run()
  }

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
  return NextResponse.json(settings)
}

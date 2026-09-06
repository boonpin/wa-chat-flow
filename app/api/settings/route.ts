import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings, aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { AUTO_REPLY_MODES, isAutoReplyMode, type AutoReplyMode } from '@/lib/settings/auto-reply'
import {
  REPLY_MAX_WAIT_BOUNDS,
  REPLY_WINDOW_BOUNDS,
  isReplyTimingValue,
  normalizeReplyTiming,
} from '@/lib/settings/reply-timing'

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
  const patch: {
    autoReplyMode?: AutoReplyMode
    defaultBotId?: string | null
    replyWindowSeconds?: number
    replyMaxWaitSeconds?: number
  } = {}

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

  if ('replyWindowSeconds' in body || 'replyMaxWaitSeconds' in body) {
    // Rejected rather than clamped: silently widening a window an operator
    // typed would leave the page showing a number the bot does not use.
    if ('replyWindowSeconds' in body && !isReplyTimingValue(body.replyWindowSeconds, REPLY_WINDOW_BOUNDS)) {
      return NextResponse.json(
        {
          error: `replyWindowSeconds must be a whole number between ${REPLY_WINDOW_BOUNDS.min} and ${REPLY_WINDOW_BOUNDS.max}`,
        },
        { status: 400 }
      )
    }
    if ('replyMaxWaitSeconds' in body && !isReplyTimingValue(body.replyMaxWaitSeconds, REPLY_MAX_WAIT_BOUNDS)) {
      return NextResponse.json(
        {
          error: `replyMaxWaitSeconds must be a whole number between ${REPLY_MAX_WAIT_BOUNDS.min} and ${REPLY_MAX_WAIT_BOUNDS.max}`,
        },
        { status: 400 }
      )
    }

    // The pair is stored normalised so that nothing downstream has to reason
    // about a ceiling that sits below the window it is supposed to cap.
    const current = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
    const timing = normalizeReplyTiming({
      windowSeconds: ('replyWindowSeconds' in body ? body.replyWindowSeconds : current?.replyWindowSeconds) as number,
      maxWaitSeconds: ('replyMaxWaitSeconds' in body ? body.replyMaxWaitSeconds : current?.replyMaxWaitSeconds) as number,
    })
    patch.replyWindowSeconds = timing.windowSeconds
    patch.replyMaxWaitSeconds = timing.maxWaitSeconds
  }

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

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { resolveConnection } from '@/lib/ai/connection'
import { getProviderModule } from '@/lib/ai/providers'
import { recordUsage } from '@/lib/ai/usage'

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (
    typeof body.question !== 'string' ||
    !body.question.trim() ||
    body.question.length > 2000 ||
    typeof body.botId !== 'string'
  )
    return NextResponse.json(
      { error: 'Choose a saved assistant and enter a question (up to 2,000 characters).' },
      { status: 400 },
    )
  const bot = db.select().from(aiBots).where(eq(aiBots.id, body.botId)).get()
  if (!bot)
    return NextResponse.json({ error: 'Save your business details first.' }, { status: 400 })
  try {
    const connection = resolveConnection(bot),
      startedAt = Date.now()
    // One generation, no tools, no WhatsApp transport, no customer records.
    try {
      const result = await getProviderModule(connection.kind).generate({
        prompt: bot.prompt,
        turns: [{ role: 'user', content: body.question.trim() }],
        model: connection.model,
        apiKey: connection.apiKey,
      })
      recordUsage({
        connection,
        botId: bot.id,
        conversationId: null,
        stage: 'preview',
        round: 0,
        usage: result.usage,
        latencyMs: Date.now() - startedAt,
      })
      return NextResponse.json({
        text:
          result.kind === 'text'
            ? result.text
            : 'The assistant requested an action. Actions are disabled in this preview.',
      })
    } catch (error) {
      recordUsage({
        connection,
        botId: bot.id,
        conversationId: null,
        stage: 'preview',
        round: 0,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Preview failed',
      })
      throw error
    }
  } catch {
    return NextResponse.json(
      { error: 'The preview could not run. Check your AI connection in Technical settings.' },
      { status: 502 },
    )
  }
}

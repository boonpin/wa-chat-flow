import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { toolInvocations, tools, aiUsage, conversationEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const split = id.indexOf(':'),
    kind = id.slice(0, split),
    sourceId = id.slice(split + 1)
  if (kind === 'capture') {
    const row = db
      .select({
        id: toolInvocations.id,
        conversationId: toolInvocations.conversationId,
        toolName: tools.name,
        sheetTab: tools.sheetTab,
        args: toolInvocations.args,
        payload: toolInvocations.payload,
        status: toolInvocations.status,
        error: toolInvocations.error,
        createdAt: toolInvocations.createdAt,
        syncedAt: toolInvocations.syncedAt,
      })
      .from(toolInvocations)
      .leftJoin(tools, eq(toolInvocations.toolId, tools.id))
      .where(eq(toolInvocations.id, sourceId))
      .get()
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    function parse(value: string | null) {
      try {
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    }
    return NextResponse.json({
      invocation: { ...row, args: parse(row.args) ?? {}, payload: parse(row.payload) },
    })
  }
  if (kind === 'usage') {
    const row = db
      .select({
        model: aiUsage.model,
        stage: aiUsage.stage,
        inputTokens: aiUsage.inputTokens,
        outputTokens: aiUsage.outputTokens,
        latencyMs: aiUsage.latencyMs,
        status: aiUsage.status,
        error: aiUsage.error,
      })
      .from(aiUsage)
      .where(eq(aiUsage.id, sourceId))
      .get()
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const row = db.select().from(conversationEvents).where(eq(conversationEvents.id, sourceId)).get()
  return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

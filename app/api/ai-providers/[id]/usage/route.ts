import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, aiUsage } from '@/lib/db/schema'
import { and, eq, gte, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

/**
 * What this account has spent, split the two ways an operator asks for it:
 * "how much in total" and "which bot is spending it".
 *
 * Read straight off `ai_usage` rather than kept as running totals on the
 * provider row — a counter would drift the moment a row is written by a call
 * that later failed, and the ledger is small enough to sum on demand.
 */

const TOTALS = {
  calls: sql<number>`count(*)`,
  failed: sql<number>`sum(case when ${aiUsage.status} = 'failed' then 1 else 0 end)`,
  inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
  outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
  totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const allTime = db.select(TOTALS).from(aiUsage).where(eq(aiUsage.providerId, id)).get()

  const recent = db
    .select(TOTALS)
    .from(aiUsage)
    .where(and(eq(aiUsage.providerId, id), gte(aiUsage.createdAt, since)))
    .get()

  // Left join: a bot deleted since the call was made keeps its tokens on the
  // ledger, and shows as an unnamed row rather than vanishing from the total.
  const byBot = db
    .select({
      botId: aiUsage.botId,
      botName: aiBots.name,
      model: aiUsage.model,
      ...TOTALS,
    })
    .from(aiUsage)
    .leftJoin(aiBots, eq(aiUsage.botId, aiBots.id))
    .where(eq(aiUsage.providerId, id))
    .groupBy(aiUsage.botId, aiUsage.model)
    .orderBy(sql`sum(${aiUsage.totalTokens}) desc`)
    .all()

  return NextResponse.json({
    allTime: normalize(allTime),
    last30Days: normalize(recent),
    byBot: byBot.map((row) => ({ ...normalize(row), botId: row.botId, botName: row.botName, model: row.model })),
  })
}

type Totals = { calls: number; failed: number | null; inputTokens: number; outputTokens: number; totalTokens: number }

/** SUM over no rows is null in SQLite; the dashboard wants a number. */
function normalize(row: Totals | undefined) {
  return {
    calls: row?.calls ?? 0,
    failed: row?.failed ?? 0,
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: row?.outputTokens ?? 0,
    totalTokens: row?.totalTokens ?? 0,
  }
}

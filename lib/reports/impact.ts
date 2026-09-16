import { and, asc, gte, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  aiBots,
  aiModelRates,
  aiProviders,
  aiUsage,
  messages,
  systemSettings,
} from '@/lib/db/schema'
import type {
  ImpactActuals,
  ImpactAssumptions,
  ImpactBreakdownRow,
  ImpactEstimates,
  ImpactPeriodSummary,
  ImpactRange,
  ImpactReport,
  ImpactTrendPoint,
  ImpactUsage,
} from './impact-types'

type MessageRow = Pick<
  typeof messages.$inferSelect,
  'id' | 'conversationId' | 'contactId' | 'direction' | 'senderType' | 'status' | 'createdAt'
>
type UsageRow = Pick<
  typeof aiUsage.$inferSelect,
  | 'id'
  | 'botId'
  | 'conversationId'
  | 'messageId'
  | 'kind'
  | 'model'
  | 'inputTokens'
  | 'outputTokens'
  | 'totalTokens'
  | 'status'
  | 'createdAt'
>
type RateRow = typeof aiModelRates.$inferSelect

const DAY_MS = 24 * 60 * 60 * 1000

export function isImpactRange(value: number): value is ImpactRange {
  return value === 7 || value === 30 || value === 90
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function isServiceReply(message: MessageRow): boolean {
  return (
    message.direction === 'outgoing' &&
    message.status === 'sent' &&
    (message.senderType === 'ai' || message.senderType === 'human')
  )
}

function inPeriod(iso: string, from: string, to: string): boolean {
  return iso >= from && iso < to
}

/**
 * Response time is measured from the last customer message in a burst to the
 * next successful AI or human reply. A system notice is neither a reply nor a
 * reset, so it cannot make the service look faster than it was.
 */
function responseTimes(rows: MessageRow[], from: string, to: string) {
  const byConversation = new Map<string, MessageRow[]>()
  for (const row of rows) {
    const list = byConversation.get(row.conversationId) ?? []
    list.push(row)
    byConversation.set(row.conversationId, list)
  }

  const ai: number[] = []
  const human: number[] = []
  for (const list of byConversation.values()) {
    let lastIncomingAt: number | null = null
    for (const row of list) {
      if (row.direction === 'incoming' && row.senderType === 'customer') {
        lastIncomingAt = new Date(row.createdAt).getTime()
        continue
      }
      if (!isServiceReply(row)) continue
      if (lastIncomingAt !== null && inPeriod(row.createdAt, from, to)) {
        const duration = new Date(row.createdAt).getTime() - lastIncomingAt
        if (duration >= 0) (row.senderType === 'ai' ? ai : human).push(duration)
      }
      lastIncomingAt = null
    }
  }
  return { ai, human }
}

function latestRate(rates: RateRow[], usage: UsageRow, currency: string): RateRow | null {
  let match: RateRow | null = null
  for (const rate of rates) {
    if (
      rate.kind === usage.kind &&
      rate.model === usage.model &&
      rate.currency === currency &&
      rate.effectiveFrom <= usage.createdAt &&
      (!match || rate.effectiveFrom > match.effectiveFrom)
    ) {
      match = rate
    }
  }
  return match
}

function usageSummary(rows: UsageRow[], rates: RateRow[], currency: string): ImpactUsage {
  const summary: ImpactUsage = {
    calls: 0,
    failedCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    pricedCalls: 0,
    unpricedCalls: 0,
    untrackedReplies: 0,
    costMicros: 0,
    costComplete: true,
  }

  for (const row of rows) {
    summary.calls++
    if (row.status === 'failed') summary.failedCalls++
    summary.inputTokens += row.inputTokens
    summary.outputTokens += row.outputTokens
    summary.totalTokens += row.totalTokens
    const rate = latestRate(rates, row, currency)
    if (!rate) {
      summary.unpricedCalls++
      summary.costComplete = false
      continue
    }
    summary.pricedCalls++
    summary.costMicros +=
      (row.inputTokens * rate.inputRateMicros + row.outputTokens * rate.outputRateMicros) /
      1_000_000
  }

  return summary
}

function estimate(
  aiReplies: number,
  usage: ImpactUsage,
  assumptions: Pick<ImpactAssumptions, 'manualReplyMinutes' | 'laborCostMinor'>
): ImpactEstimates {
  const savedMinutes =
    assumptions.manualReplyMinutes === null ? null : aiReplies * assumptions.manualReplyMinutes
  const laborValueMicros =
    savedMinutes === null || assumptions.laborCostMinor === null
      ? null
      : (savedMinutes / 60) * assumptions.laborCostMinor * 10_000
  const aiCostMicros = usage.costComplete ? usage.costMicros : null

  return {
    savedMinutes,
    laborValueMicros,
    aiCostMicros,
    netSavingsMicros:
      laborValueMicros === null || aiCostMicros === null ? null : laborValueMicros - aiCostMicros,
  }
}

function periodSummary(
  allMessages: MessageRow[],
  allUsage: UsageRow[],
  rates: RateRow[],
  assumptions: ImpactAssumptions,
  from: string,
  to: string
): ImpactPeriodSummary {
  const replies = allMessages.filter((row) => isServiceReply(row) && inPeriod(row.createdAt, from, to))
  const aiReplies = replies.filter((row) => row.senderType === 'ai')
  const humanReplies = replies.filter((row) => row.senderType === 'human')
  const response = responseTimes(allMessages, from, to)
  const periodUsage = allUsage.filter((row) => inPeriod(row.createdAt, from, to))
  const usage = usageSummary(periodUsage, rates, assumptions.currency)
  const linkedReplyIds = new Set(periodUsage.flatMap((row) => (row.messageId ? [row.messageId] : [])))
  usage.untrackedReplies = aiReplies.filter((row) => !linkedReplyIds.has(row.id)).length
  if (usage.untrackedReplies > 0) usage.costComplete = false
  const totalReplies = aiReplies.length + humanReplies.length

  const actuals: ImpactActuals = {
    aiReplies: aiReplies.length,
    humanReplies: humanReplies.length,
    automationRate: totalReplies === 0 ? null : aiReplies.length / totalReplies,
    conversationsAssisted: new Set(aiReplies.map((row) => row.conversationId)).size,
    contactsAssisted: new Set(aiReplies.map((row) => row.contactId)).size,
    medianAiResponseMs: median(response.ai),
    medianHumanResponseMs: median(response.human),
  }

  return { actuals, usage, estimates: estimate(aiReplies.length, usage, assumptions) }
}

function dateKeys(from: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    new Date(from.getTime() + index * DAY_MS).toISOString().slice(0, 10)
  )
}

function buildTrend(
  rows: MessageRow[],
  usage: UsageRow[],
  from: Date,
  rangeDays: ImpactRange,
  manualReplyMinutes: number | null
): ImpactTrendPoint[] {
  const points = new Map(
    dateKeys(from, rangeDays).map((date) => [
      date,
      { date, aiReplies: 0, humanReplies: 0, savedMinutes: manualReplyMinutes === null ? null : 0, tokens: 0 },
    ])
  )
  for (const row of rows) {
    if (!isServiceReply(row)) continue
    const point = points.get(row.createdAt.slice(0, 10))
    if (!point) continue
    if (row.senderType === 'ai') {
      point.aiReplies++
      if (point.savedMinutes !== null) point.savedMinutes += manualReplyMinutes ?? 0
    } else {
      point.humanReplies++
    }
  }
  for (const row of usage) {
    const point = points.get(row.createdAt.slice(0, 10))
    if (point) point.tokens += row.totalTokens
  }
  return [...points.values()]
}

function buildBreakdown(
  usageRows: UsageRow[],
  rates: RateRow[],
  assumptions: ImpactAssumptions,
  botNames: Map<string, string>,
  aiReplyIds: ReadonlySet<string>
): ImpactBreakdownRow[] {
  const groups = new Map<string, UsageRow[]>()
  for (const row of usageRows) {
    const key = `${row.botId ?? 'deleted'}\u0000${row.kind}\u0000${row.model}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const usage = usageSummary(rows, rates, assumptions.currency)
      const replyIds = new Set(
        rows.flatMap((row) => (row.messageId && aiReplyIds.has(row.messageId) ? [row.messageId] : []))
      )
      const conversationIds = new Set(
        rows.flatMap((row) =>
          row.messageId && aiReplyIds.has(row.messageId) && row.conversationId
            ? [row.conversationId]
            : []
        )
      )
      const estimates = estimate(replyIds.size, usage, assumptions)
      const first = rows[0]
      return {
        key,
        botName: first.botId ? (botNames.get(first.botId) ?? null) : null,
        kind: first.kind,
        model: first.model,
        replies: replyIds.size,
        conversations: conversationIds.size,
        calls: usage.calls,
        failedCalls: usage.failedCalls,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        costMicros: usage.costMicros,
        costComplete: usage.costComplete,
        savedMinutes: estimates.savedMinutes,
        laborValueMicros: estimates.laborValueMicros,
        netSavingsMicros: estimates.netSavingsMicros,
      }
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

function currentRates(rates: RateRow[], currency: string) {
  const latest = new Map<string, RateRow>()
  for (const rate of rates) {
    if (rate.currency !== currency) continue
    const key = `${rate.kind}\u0000${rate.model}`
    const current = latest.get(key)
    if (!current || rate.effectiveFrom > current.effectiveFrom) latest.set(key, rate)
  }
  return latest
}

export function getImpactAssumptions(): ImpactAssumptions {
  const settings = db.select().from(systemSettings).get()
  const currency = settings?.reportCurrency ?? 'MYR'
  const rates = db.select().from(aiModelRates).orderBy(asc(aiModelRates.effectiveFrom)).all()
  const latest = currentRates(rates, currency)

  const modelKeys = new Map<string, { kind: string; model: string }>()
  for (const row of db
    .select({ kind: aiProviders.kind, model: aiProviders.model })
    .from(aiProviders)
    .groupBy(aiProviders.kind, aiProviders.model)
    .all()) {
    modelKeys.set(`${row.kind}\u0000${row.model}`, row)
  }
  for (const row of db
    .select({ kind: aiUsage.kind, model: aiUsage.model })
    .from(aiUsage)
    .groupBy(aiUsage.kind, aiUsage.model)
    .all()) {
    modelKeys.set(`${row.kind}\u0000${row.model}`, row)
  }

  return {
    manualReplyMinutes: settings?.manualReplyMinutes ?? null,
    laborCostMinor: settings?.laborCostMinor ?? null,
    currency,
    rates: [...modelKeys.entries()]
      .map(([key, item]) => {
        const rate = latest.get(key)
        return {
          ...item,
          inputRatePerMillion: rate ? rate.inputRateMicros / 1_000_000 : null,
          outputRatePerMillion: rate ? rate.outputRateMicros / 1_000_000 : null,
          effectiveFrom: rate?.effectiveFrom ?? null,
        }
      })
      .sort((a, b) => `${a.kind}/${a.model}`.localeCompare(`${b.kind}/${b.model}`)),
  }
}

export function getImpactReport(rangeDays: ImpactRange): ImpactReport {
  const generatedAt = new Date()
  const to = generatedAt
  // Calendar-day buckets are easier to read than rolling 24-hour windows and
  // guarantee that today's activity has a trend column.
  const today = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  const from = new Date(today.getTime() - (rangeDays - 1) * DAY_MS)
  const previousFrom = new Date(from.getTime() - rangeDays * DAY_MS)
  const queryFrom = new Date(previousFrom.getTime() - DAY_MS)
  const toIso = to.toISOString()
  const fromIso = from.toISOString()
  const previousFromIso = previousFrom.toISOString()

  const messageRows = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      contactId: messages.contactId,
      direction: messages.direction,
      senderType: messages.senderType,
      status: messages.status,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(gte(messages.createdAt, queryFrom.toISOString()), lt(messages.createdAt, toIso)))
    .orderBy(asc(messages.conversationId), asc(messages.createdAt))
    .all()

  const usageRows = db
    .select({
      id: aiUsage.id,
      botId: aiUsage.botId,
      conversationId: aiUsage.conversationId,
      messageId: aiUsage.messageId,
      kind: aiUsage.kind,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      totalTokens: aiUsage.totalTokens,
      status: aiUsage.status,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, previousFromIso), lt(aiUsage.createdAt, toIso)))
    .orderBy(asc(aiUsage.createdAt))
    .all()

  const rates = db.select().from(aiModelRates).orderBy(asc(aiModelRates.effectiveFrom)).all()
  const assumptions = getImpactAssumptions()
  const botNames = new Map(db.select({ id: aiBots.id, name: aiBots.name }).from(aiBots).all().map((b) => [b.id, b.name]))
  const currentAiReplyIds = new Set(
    messageRows
      .filter(
        (row) =>
          inPeriod(row.createdAt, fromIso, toIso) &&
          isServiceReply(row) &&
          row.senderType === 'ai'
      )
      .map((row) => row.id)
  )

  return {
    rangeDays,
    period: { from: fromIso, to: toIso },
    previousPeriod: { from: previousFromIso, to: fromIso },
    current: periodSummary(messageRows, usageRows, rates, assumptions, fromIso, toIso),
    previous: periodSummary(messageRows, usageRows, rates, assumptions, previousFromIso, fromIso),
    trend: buildTrend(
      messageRows.filter((row) => inPeriod(row.createdAt, fromIso, toIso)),
      usageRows.filter((row) => inPeriod(row.createdAt, fromIso, toIso)),
      from,
      rangeDays,
      assumptions.manualReplyMinutes
    ),
    breakdown: buildBreakdown(
      usageRows.filter((row) => inPeriod(row.createdAt, fromIso, toIso)),
      rates,
      assumptions,
      botNames,
      currentAiReplyIds
    ),
    assumptions,
    generatedAt: generatedAt.toISOString(),
  }
}

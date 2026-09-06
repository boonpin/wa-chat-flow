import { db } from '@/lib/db'
import { aiUsage } from '@/lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { BotConnection } from './connection'
import type { TokenUsage } from './providers/types'

/**
 * The token ledger: one row per API call, written straight after the call
 * returns — or fails.
 *
 * It is written here rather than handed back to the caller because a reply can
 * be several calls and can die on any of them. Recording as we go means the
 * rounds that did complete are still accounted for, which is exactly the case
 * where an operator wants to know what a failing bot is costing.
 */

export interface UsageEntry {
  connection: BotConnection
  botId: string
  conversationId: string | null
  /** Round of the tool loop; 0 is the first ask. */
  round: number
  usage?: TokenUsage
  latencyMs: number
  /** Present when the call itself failed. Tokens are then unknown, not zero. */
  error?: string
}

/**
 * Never throws, and returns the row it wrote so the caller can come back and
 * name the message these tokens paid for. Null means nothing was written.
 *
 * A bookkeeping row is not worth losing a customer's reply over, so a failed
 * write is logged and the reply continues.
 */
export function recordUsage(entry: UsageEntry): string | null {
  const id = uuidv4()
  try {
    db.insert(aiUsage)
      .values({
        id,
        providerId: entry.connection.providerId,
        botId: entry.botId,
        conversationId: entry.conversationId,
        kind: entry.connection.kind,
        model: entry.connection.model,
        inputTokens: entry.usage?.inputTokens ?? 0,
        outputTokens: entry.usage?.outputTokens ?? 0,
        totalTokens: entry.usage?.totalTokens ?? 0,
        round: entry.round,
        status: entry.error ? 'failed' : 'ok',
        error: entry.error ?? null,
        latencyMs: entry.latencyMs,
        createdAt: new Date().toISOString(),
      })
      .run()
    return id
  } catch (err) {
    console.error('[ai] Could not record token usage:', err)
    return null
  }
}

/**
 * Names the message a reply's calls paid for, once it has actually been sent.
 *
 * Two-phase on purpose: the calls happen before the message row exists, and a
 * reply that fails on the way out should leave its tokens recorded but
 * unattached — they were still spent, they just never became a message.
 */
export function attachUsageToMessage(usageIds: string[], messageId: string): void {
  if (usageIds.length === 0) return
  try {
    db.update(aiUsage).set({ messageId }).where(inArray(aiUsage.id, usageIds)).run()
  } catch (err) {
    console.error('[ai] Could not link token usage to message:', err)
  }
}

/** Running total across the calls one reply took. */
export function addUsage(total: TokenUsage, next: TokenUsage | undefined): TokenUsage {
  if (!next) return total
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    totalTokens: total.totalTokens + next.totalTokens,
  }
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

/** Tokens a single reply cost, summed across the calls it took. */
export interface MessageUsage {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * Token totals for a page of messages, in one query.
 *
 * Keyed by message so the caller can render a column without a lookup per row,
 * and absent rather than zero for anything that never called a model — a human
 * reply and a reply that cost nothing are different facts.
 */
export function usageByMessage(messageIds: string[]): Map<string, MessageUsage> {
  const totals = new Map<string, MessageUsage>()
  if (messageIds.length === 0) return totals

  const rows = db
    .select({
      messageId: aiUsage.messageId,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
    })
    .from(aiUsage)
    .where(inArray(aiUsage.messageId, messageIds))
    .groupBy(aiUsage.messageId)
    .all()

  for (const row of rows) {
    if (!row.messageId) continue
    totals.set(row.messageId, {
      calls: row.calls,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
    })
  }

  return totals
}

/**
 * The individual calls behind one reply, oldest round first.
 *
 * A reply is usually one row; it is several when the model called tools, and
 * seeing them separately is the only way to tell an expensive question from an
 * expensive tool loop.
 */
export function usageCallsForMessage(messageId: string) {
  return db
    .select({
      id: aiUsage.id,
      round: aiUsage.round,
      kind: aiUsage.kind,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      totalTokens: aiUsage.totalTokens,
      latencyMs: aiUsage.latencyMs,
      status: aiUsage.status,
      error: aiUsage.error,
      providerId: aiUsage.providerId,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(eq(aiUsage.messageId, messageId))
    .orderBy(aiUsage.round, aiUsage.createdAt)
    .all()
}

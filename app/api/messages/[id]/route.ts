import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, conversations, messages, toolInvocations, tools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { usageCallsForMessage } from '@/lib/ai/usage'
import { getAiProvider } from '@/lib/ai/connection'

/**
 * Everything known about one log entry.
 *
 * The list feed stays deliberately thin — this is what the Logs detail drawer
 * opens. For a tool row it also resolves the linked capture, which is where the
 * interesting failure lives: the model may have been told the capture succeeded
 * while the sheet write did not.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const row = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      direction: messages.direction,
      senderType: messages.senderType,
      messageType: messages.messageType,
      message: messages.content,
      status: messages.status,
      error: messages.error,
      provider: messages.provider,
      providerMessageId: messages.providerMessageId,
      toolInvocationId: messages.toolInvocationId,
      createdAt: messages.createdAt,
      contactId: messages.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phoneNumber,
      conversationMode: conversations.mode,
      conversationStatus: conversations.status,
    })
    .from(messages)
    .leftJoin(contacts, eq(messages.contactId, contacts.id))
    .leftJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(messages.id, id))
    .get()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...row,
    invocation: resolveInvocation(row.toolInvocationId),
    ...resolveUsage(row.id),
  })
}

/**
 * What this reply cost, and the calls it took.
 *
 * Both are absent for every row that never called a model — a customer message,
 * a human reply, a tool audit row — which is what lets the dashboard show a
 * dash rather than a misleading zero.
 */
function resolveUsage(messageId: string) {
  const calls = usageCallsForMessage(messageId)
  if (calls.length === 0) return { usage: null, usageCalls: [] }

  const usage = calls.reduce(
    (total, call) => ({
      calls: total.calls + 1,
      inputTokens: total.inputTokens + call.inputTokens,
      outputTokens: total.outputTokens + call.outputTokens,
      totalTokens: total.totalTokens + call.totalTokens,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  )

  const provider = calls[0].providerId ? getAiProvider(calls[0].providerId) : undefined

  return { usage: { ...usage, providerName: provider?.name ?? null }, usageCalls: calls }
}

/**
 * The capture behind a tool row.
 *
 * Returns null for rows that never wrote one — a call the model made with
 * missing fields is rejected before anything is stored, so the message row's
 * own `error` is the whole story there.
 */
function resolveInvocation(invocationId: string | null) {
  if (!invocationId) return null

  const invocation = db
    .select({
      id: toolInvocations.id,
      toolId: toolInvocations.toolId,
      toolName: tools.name,
      sheetTab: tools.sheetTab,
      spreadsheetUrl: tools.spreadsheetUrl,
      args: toolInvocations.args,
      payload: toolInvocations.payload,
      status: toolInvocations.status,
      error: toolInvocations.error,
      createdAt: toolInvocations.createdAt,
      syncedAt: toolInvocations.syncedAt,
    })
    .from(toolInvocations)
    .leftJoin(tools, eq(toolInvocations.toolId, tools.id))
    .where(eq(toolInvocations.id, invocationId))
    .get()

  if (!invocation) return null

  return {
    ...invocation,
    args: safeParse(invocation.args) ?? {},
    // Null is meaningful here: nothing was ever transmitted.
    payload: invocation.payload ? safeParse(invocation.payload) : null,
  }
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

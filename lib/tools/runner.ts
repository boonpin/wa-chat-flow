import { db } from '@/lib/db'
import { contacts, toolInvocations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getTool, getToolByName, parseFields } from './registry'
import { AppsScriptSink } from './sinks/apps-script'
import type { CaptureSink } from './sinks/types'
import type { ToolCall, ToolContext, ToolField, ToolResult, ToolRow } from './types'

/**
 * Executes one tool call and records it.
 *
 * Never throws. Every failure — unknown tool, missing field, Google unreachable
 * — comes back as `{ ok: false }`, because the model reads this result and is
 * expected to react to it: ask the customer for the missing email, apologise
 * for the outage, and so on. Throwing here would abort the whole reply instead.
 */

const sinks: Record<string, CaptureSink> = {
  apps_script: new AppsScriptSink(),
}

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const tool = getToolByName(call.name)
  if (!tool) return { ok: false, error: `Unknown tool: ${call.name}` }
  if (!tool.enabled) return { ok: false, error: `Tool "${call.name}" is disabled` }

  const fields = parseFields(tool.fields)
  const validation = validateArgs(fields, call.args)
  if (!validation.ok) return { ok: false, error: validation.error }

  // Write before the network call. If the sink is down, the lead is still on
  // disk and visibly failed rather than silently lost — same reasoning as
  // outgoing messages. This row is also what the retry endpoint picks up.
  const invocationId = uuidv4()
  const capturedAt = new Date().toISOString()

  db.insert(toolInvocations)
    .values({
      id: invocationId,
      toolId: tool.id,
      conversationId: ctx.conversationId,
      contactId: ctx.contactId,
      args: JSON.stringify(validation.values),
      status: 'pending',
      error: null,
      createdAt: capturedAt,
      syncedAt: null,
    })
    .run()

  const result = await pushToSink(tool, {
    values: labelledValues(fields, validation.values),
    conversationId: ctx.conversationId,
    contactName: ctx.contact.name,
    contactPhone: ctx.contact.phone,
    capturedAt,
  })

  if (!result.ok) {
    // `not_submitted` means nothing ever left the app — a misconfigured tool,
    // not a network or sheet problem. The operator needs to tell those apart:
    // one is fixed in the dashboard, the other by retrying.
    db.update(toolInvocations)
      .set({
        status: result.submitted ? 'failed' : 'not_submitted',
        error: result.error ?? 'Sink write failed',
        payload: result.payload ? JSON.stringify(result.payload) : null,
      })
      .where(eq(toolInvocations.id, invocationId))
      .run()

    console.error(`[tools] ${tool.name} capture failed: ${result.error}`)

    // The record is safe on our side, so do not tell the model to re-ask the
    // customer for everything — that would be a worse experience than a row
    // an operator syncs manually.
    return {
      ok: true,
      message:
        'Details recorded. The team has been notified and will follow up — ' +
        'do not ask the customer to repeat their details.',
      invocationId,
      syncError: result.error ?? 'Sink write failed',
    }
  }

  db.update(toolInvocations)
    .set({
      status: 'synced',
      error: null,
      payload: result.payload ? JSON.stringify(result.payload) : null,
      syncedAt: new Date().toISOString(),
    })
    .where(eq(toolInvocations.id, invocationId))
    .run()

  console.log(`[tools] ${tool.name} captured for ${ctx.contact.phone}`)

  return { ok: true, message: 'Details recorded successfully.', invocationId }
}

/** Re-attempts a failed invocation from the dashboard. */
export async function retryInvocation(invocationId: string): Promise<ToolResult> {
  const invocation = db
    .select()
    .from(toolInvocations)
    .where(eq(toolInvocations.id, invocationId))
    .get()
  if (!invocation) return { ok: false, error: 'Invocation not found' }

  const row = getTool(invocation.toolId)
  if (!row) return { ok: false, error: 'Tool no longer exists' }

  const fields = parseFields(row.fields)
  const values = JSON.parse(invocation.args) as Record<string, string | number>
  const contact = db.select().from(contacts).where(eq(contacts.id, invocation.contactId)).get()

  const result = await pushToSink(row, {
    values: labelledValues(fields, values),
    conversationId: invocation.conversationId,
    contactName: contact?.name ?? null,
    contactPhone: contact?.phoneNumber ?? '',
    // The original capture time, so a retry does not backdate or re-date the row.
    capturedAt: invocation.createdAt,
  })

  db.update(toolInvocations)
    .set({
      status: result.ok ? 'synced' : result.submitted ? 'failed' : 'not_submitted',
      error: result.ok ? null : (result.error ?? 'Sink write failed'),
      payload: result.payload ? JSON.stringify(result.payload) : null,
      ...(result.ok ? { syncedAt: new Date().toISOString() } : {}),
    })
    .where(eq(toolInvocations.id, invocationId))
    .run()

  return result.ok ? { ok: true, message: 'Synced' } : { ok: false, error: result.error! }
}

async function pushToSink(tool: ToolRow, row: Parameters<CaptureSink['append']>[1]) {
  const sink = sinks[tool.sinkType]
  if (!sink) return { ok: false, submitted: false, error: `Unknown sink type: ${tool.sinkType}` }
  return sink.append(tool, row)
}

/** Column header → value, in configured field order. Order fixes sheet columns. */
function labelledValues(
  fields: ToolField[],
  values: Record<string, string | number>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.name]
    out[field.label] = value === undefined || value === null ? '' : String(value)
  }
  return out
}

type Validation =
  | { ok: true; values: Record<string, string | number> }
  | { ok: false; error: string }

/**
 * Checks the model's arguments against the configured fields.
 *
 * The error strings are written for the *model* to read, not an operator: they
 * name what is missing so the next turn asks the customer for exactly that.
 */
function validateArgs(fields: ToolField[], args: Record<string, unknown>): Validation {
  if (fields.length === 0) return { ok: false, error: 'This tool has no fields configured.' }

  const values: Record<string, string | number> = {}
  const missing: string[] = []

  for (const field of fields) {
    const raw = args[field.name]
    const empty = raw === undefined || raw === null || String(raw).trim() === ''

    if (empty) {
      if (field.required) missing.push(field.label)
      continue
    }

    if (field.type === 'number') {
      const num = Number(raw)
      if (Number.isNaN(num)) {
        return { ok: false, error: `"${field.label}" must be a number, got: ${String(raw)}` }
      }
      values[field.name] = num
      continue
    }

    const text = String(raw).trim()

    if (field.type === 'enum' && field.options?.length && !field.options.includes(text)) {
      return {
        ok: false,
        error: `"${field.label}" must be one of: ${field.options.join(', ')}. Ask the customer which applies.`,
      }
    }

    values[field.name] = text
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        `Missing required details: ${missing.join(', ')}. ` +
        'Ask the customer for these before calling this tool again.',
    }
  }

  return { ok: true, values }
}

import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { conversationQueue } from './attention'
export interface ActivityEvent {
  id: string
  sourceId: string
  conversationId: string | null
  contactId: string | null
  kind: string
  detail: string
  status: string
  createdAt: string
  contactName: string | null
  contactPhone: string | null
  sessionName: string | null
}
interface Cursor {
  at: string
  id: string
}
function readCursor(value: string | null): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value || '', 'base64url').toString())
    return typeof parsed.at === 'string' && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}
function cursor(row: { createdAt: string; id: string }) {
  return Buffer.from(JSON.stringify({ at: row.createdAt, id: row.id })).toString('base64url')
}
export function activityView(params: URLSearchParams) {
  const rawTo = params.get('to'),
    rawFrom = params.get('from')
  const to =
    rawTo && Number.isFinite(Date.parse(rawTo))
      ? new Date(rawTo).toISOString()
      : new Date().toISOString()
  const days = [7, 30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30
  const from =
    rawFrom && Number.isFinite(Date.parse(rawFrom))
      ? new Date(rawFrom).toISOString()
      : new Date(Date.parse(to) - days * 86400000).toISOString()
  const contactId = params.get('contactId'),
    conversationId = params.get('conversationId'),
    search = params.get('search')?.toLowerCase(),
    session = params.get('session')
  const metric = params.get('metric'),
    result = params.get('result'),
    system = params.get('view') === 'system'
  const events = db
    .all<ActivityEvent>(
      sql`
    SELECT e.*, ct.name AS contactName, ct.phone_number AS contactPhone, w.session_name AS sessionName FROM (
      SELECT 'message:' || id AS id, id AS sourceId, conversation_id AS conversationId, contact_id AS contactId,
        CASE WHEN sender_type='customer' THEN 'customer' WHEN sender_type='ai' THEN 'ai' WHEN sender_type='human' THEN 'team' ELSE 'system' END AS kind,
        content AS detail, status, created_at AS createdAt FROM messages WHERE message_type!='tool'
      UNION ALL SELECT 'event:' || id, id, conversation_id, contact_id, kind, detail, 'recorded', created_at FROM conversation_events
      UNION ALL SELECT 'capture:' || id, id, conversation_id, contact_id, 'capture', 'Customer details saved locally', status, created_at FROM tool_invocations
      UNION ALL SELECT 'usage:' || u.id, u.id, u.conversation_id, c.contact_id, CASE WHEN u.stage='preview' THEN 'preview_usage' ELSE 'usage' END,
        CASE WHEN u.usage_known=0 THEN u.model || ': usage not recorded' ELSE u.model || ': ' || u.input_tokens || ' input / ' || u.output_tokens || ' output tokens' END, u.status, u.created_at
        FROM ai_usage u LEFT JOIN conversations c ON c.id=u.conversation_id
    ) e LEFT JOIN contacts ct ON ct.id=e.contactId LEFT JOIN conversations c ON c.id=e.conversationId LEFT JOIN wa_sessions w ON w.id=c.wa_session_id
    WHERE e.createdAt >= ${from} AND e.createdAt < ${to}
    ORDER BY e.createdAt DESC, e.id DESC
  `,
    )
    .filter(
      (e) =>
        (!contactId || e.contactId === contactId) &&
        (!conversationId || e.conversationId === conversationId) &&
        (!session || e.sessionName === session) &&
        (!search ||
          `${e.contactName ?? ''} ${e.contactPhone ?? ''}`.toLowerCase().includes(search)) &&
        (!metric || (metric === 'ai' ? e.kind === 'ai' && e.status === 'sent' : true)) &&
        (!result || result !== 'failed' || ['failed', 'not_submitted'].includes(e.status)) &&
        (!system || !e.contactId),
    )
  const after = readCursor(params.get('cursor'))
  const pageSize = 25
  if (conversationId) events.reverse()
  if (contactId || conversationId || params.get('view') === 'events' || system || metric) {
    const matching = after
      ? events.filter((e) =>
          conversationId
            ? e.createdAt > after.at || (e.createdAt === after.at && e.id > after.id)
            : e.createdAt < after.at || (e.createdAt === after.at && e.id < after.id),
        )
      : events
    const rows = matching.slice(0, pageSize)
    const conversations = [
      ...new Map(
        events
          .filter((e) => e.conversationId)
          .map((e) => [e.conversationId, { id: e.conversationId!, sessionName: e.sessionName }]),
      ).values(),
    ]
    return {
      view: 'events',
      rows,
      total: events.length,
      nextCursor: matching.length > pageSize ? cursor(rows[rows.length - 1]) : null,
      conversations,
      period: { from, to },
    }
  }
  const currency = db.select().from(systemSettings).get()?.reportCurrency ?? 'MYR'
  const costRows = db.all<{ contactId: string | null; costMicros: number | null }>(sql`
    SELECT c.contact_id AS contactId,
      CASE WHEN u.usage_known=0 THEN NULL ELSE (u.input_tokens * (SELECT r.input_rate_micros FROM ai_model_rates r WHERE r.kind=u.kind AND r.model=u.model AND r.currency=${currency} AND r.effective_from<=u.created_at ORDER BY r.effective_from DESC LIMIT 1)
      + u.output_tokens * (SELECT r.output_rate_micros FROM ai_model_rates r WHERE r.kind=u.kind AND r.model=u.model AND r.currency=${currency} AND r.effective_from<=u.created_at ORDER BY r.effective_from DESC LIMIT 1)) / 1000000.0 END AS costMicros
    FROM ai_usage u LEFT JOIN conversations c ON c.id=u.conversation_id LEFT JOIN wa_sessions w ON w.id=c.wa_session_id WHERE u.created_at >= ${from} AND u.created_at < ${to} AND (${session ?? null} IS NULL OR w.session_name=${session ?? null})
  `)
  const costs = new Map<string, number | null>()
  for (const row of costRows) {
    if (!row.contactId) continue
    const previous = costs.get(row.contactId)
    costs.set(
      row.contactId,
      row.costMicros === null || previous === null ? null : (previous ?? 0) + row.costMicros,
    )
  }
  const issues = new Map(
    conversationQueue({ limit: 100 }).rows.map((r) => [r.id, r.attentionReason]),
  )
  // Queue rows are paginated; collect all pages before calculating contact issue totals.
  const first = conversationQueue({ limit: 100 })
  for (let page = 2; page <= first.lastPage; page++)
    for (const r of conversationQueue({ page, limit: 100 }).rows)
      issues.set(r.id, r.attentionReason)
  const groups = new Map<
    string,
    {
      id: string
      contactName: string | null
      contactPhone: string | null
      createdAt: string
      events: number
      failures: number
      conversations: Set<string>
      numbers: Set<string>
    }
  >()
  for (const e of events) {
    if (!e.contactId) continue
    let group = groups.get(e.contactId)
    if (!group) {
      group = {
        id: e.contactId,
        contactName: e.contactName,
        contactPhone: e.contactPhone,
        createdAt: e.createdAt,
        events: 0,
        failures: 0,
        conversations: new Set(),
        numbers: new Set(),
      }
      groups.set(e.contactId, group)
    }
    group.events++
    if (e.conversationId) group.conversations.add(e.conversationId)
    if (e.sessionName) group.numbers.add(e.sessionName)
    if (e.kind === 'capture' && ['failed', 'not_submitted'].includes(e.status)) group.failures++
  }
  let matching = [...groups.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  if (after)
    matching = matching.filter(
      (e) => e.createdAt < after.at || (e.createdAt === after.at && e.id < after.id),
    )
  const rows = matching
    .slice(0, pageSize)
    .map((g) => ({
      ...g,
      conversations: g.conversations.size,
      numbers: [...g.numbers],
      costMicros: costs.has(g.id) ? costs.get(g.id) : null,
      hasUsage: costs.has(g.id),
      failures: g.failures + [...g.conversations].filter((id) => issues.get(id)).length,
    }))
  return {
    view: 'contacts',
    rows,
    total: groups.size,
    nextCursor: matching.length > pageSize ? cursor(rows[rows.length - 1]) : null,
    currency,
    period: { from, to },
  }
}

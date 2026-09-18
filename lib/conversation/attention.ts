import { db } from '@/lib/db'
import { aiBots, aiProviders, systemSettings } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { triageIncoming } from '@/lib/messaging/triage'
import type { IncomingMessage } from '@/lib/wa/types'

export interface AttentionConversation {
  id: string
  contactId: string
  contactName: string | null
  contactPhone: string
  waSessionId: string | null
  waSessionName: string | null
  botId: string | null
  botName: string | null
  mode: 'auto' | 'human'
  status: 'open' | 'resolved'
  lastMessageAt: string | null
  lastMessagePreview: string | null
  attentionReason: string | null
  waitingSince: string | null
  channelStatus: string | null
  autoReplyDueAt: string | null
  aiReplyStartedAt: string | null
  lastReplyAt: string | null
  lastFailureAt: string | null
}

/** All-record derivation, independent of the visible page and list cap. */
export function conversationQueue(filter: {
  status?: string
  mode?: string
  search?: string
  attention?: boolean
  page?: number
  limit?: number
}) {
  const settings = db.select().from(systemSettings).get()
  const bots = db.select().from(aiBots).all()
  const providers = new Map(
    db
      .select()
      .from(aiProviders)
      .all()
      .map((p) => [p.id, p]),
  )
  const rows = db.all<AttentionConversation>(sql`
    SELECT c.id, c.contact_id AS contactId, ct.name AS contactName, ct.phone_number AS contactPhone,
      c.wa_session_id AS waSessionId, w.session_name AS waSessionName, c.bot_id AS botId, b.name AS botName,
      c.mode, c.status, c.last_message_at AS lastMessageAt, 
      w.status AS channelStatus, c.auto_reply_due_at AS autoReplyDueAt, c.ai_reply_started_at AS aiReplyStartedAt,
      (SELECT content FROM messages m WHERE m.conversation_id=c.id AND m.sender_type!='system' AND content!='' ORDER BY created_at DESC, id DESC LIMIT 1) AS lastMessagePreview,
      (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id=c.id AND m.sender_type IN ('ai','human') AND m.status='sent') AS lastReplyAt,
      (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id=c.id AND m.status='failed' AND m.message_type!='tool') AS lastFailureAt
    FROM conversations c JOIN contacts ct ON ct.id=c.contact_id
    LEFT JOIN wa_sessions w ON w.id=c.wa_session_id LEFT JOIN ai_bots b ON b.id=c.bot_id
    ORDER BY c.last_message_at DESC, c.id DESC
  `)
  const pending = db.all<{
    conversationId: string
    createdAt: string
    content: string
    messageType: string
  }>(sql`
    SELECT m.conversation_id AS conversationId, m.created_at AS createdAt, m.content, m.message_type AS messageType
    FROM messages m JOIN conversations c ON c.id=m.conversation_id
    WHERE c.status='open' AND m.sender_type='customer' AND m.created_at > COALESCE(
      (SELECT MAX(r.created_at) FROM messages r WHERE r.conversation_id=m.conversation_id AND r.sender_type IN ('ai','human') AND r.status='sent'), '')
    ORDER BY m.created_at ASC, m.id ASC
  `)
  const waits = new Map<string, string>()
  for (const m of pending) {
    if (
      !waits.has(m.conversationId) &&
      triageIncoming({ type: m.messageType, text: m.content } as IncomingMessage).action ===
        'answer'
    )
      waits.set(m.conversationId, m.createdAt)
  }
  const now = Date.now()
  for (const row of rows) {
    row.waitingSince = waits.get(row.id) ?? null
    row.attentionReason = null
    if (row.status !== 'open') continue
    const bot =
      [row.botId, settings?.defaultBotId]
        .map((id) => bots.find((b) => b.id === id && b.enabled))
        .find(Boolean) ?? bots.find((b) => b.isDefault && b.enabled)
    const provider = bot?.providerId ? providers.get(bot.providerId) : null
    if (row.lastFailureAt && (!row.lastReplyAt || row.lastFailureAt > row.lastReplyAt))
      row.attentionReason = 'Reply failed'
    else if (row.waitingSince) {
      if (row.mode === 'human') row.attentionReason = 'Waiting for your team'
      else if (settings?.autoReplyMode === 'off') row.attentionReason = 'AI replies paused'
      else if (row.channelStatus !== 'connected')
        row.attentionReason = 'WhatsApp connection needs attention'
      else if (!bot || !provider?.enabled) row.attentionReason = 'AI assistant unavailable'
      else if (row.aiReplyStartedAt && now - Date.parse(row.aiReplyStartedAt) > 120_000)
        row.attentionReason = 'AI reply is overdue'
      else if (
        !row.aiReplyStartedAt &&
        ((!row.autoReplyDueAt && now - Date.parse(row.waitingSince) > 60_000) ||
          (row.autoReplyDueAt && now - Date.parse(row.autoReplyDueAt) > 120_000))
      )
        row.attentionReason = 'AI reply is overdue'
    }
  }
  const counts = {
    attention: rows.filter((r) => r.attentionReason).length,
    open: rows.filter((r) => r.status === 'open').length,
    done: rows.filter((r) => r.status === 'resolved').length,
  }
  const search = filter.search?.trim().toLowerCase()
  const matching = rows.filter(
    (r) =>
      (!filter.status || r.status === filter.status) &&
      (!filter.mode || r.mode === filter.mode) &&
      (!filter.attention || !!r.attentionReason) &&
      (!search || `${r.contactName ?? ''} ${r.contactPhone}`.toLowerCase().includes(search)),
  )
  if (filter.attention)
    matching.sort(
      (a, b) =>
        Number(b.attentionReason === 'Reply failed') -
          Number(a.attentionReason === 'Reply failed') ||
        (a.waitingSince ?? a.lastMessageAt ?? '').localeCompare(
          b.waitingSince ?? b.lastMessageAt ?? '',
        ),
    )
  const limit = Math.max(1, Math.min(100, filter.limit || 25))
  const lastPage = Math.max(1, Math.ceil(matching.length / limit))
  const page = Math.max(1, Math.min(lastPage, filter.page || 1))
  return {
    rows: matching.slice((page - 1) * limit, page * limit),
    total: matching.length,
    counts,
    page,
    lastPage,
  }
}

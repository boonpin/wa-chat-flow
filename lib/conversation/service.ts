import { db } from '@/lib/db'
import { conversations, contacts, messages, waSessions, aiBots } from '@/lib/db/schema'
import { and, desc, eq, like, ne, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export type Conversation = typeof conversations.$inferSelect
export type ConversationMode = 'auto' | 'human'
export type ConversationStatus = 'open' | 'resolved'

/**
 * Conversations sit between contacts and messages. A contact has at most one
 * open conversation at a time; resolving it and writing again starts a new one,
 * which keeps history readable as discrete threads.
 *
 * `opened` reports whether this call started the thread. Auto-reply policy
 * turns on that distinction — under `existing` a thread that was already
 * running keeps its AI replies while one opening right now does not get them —
 * and the caller cannot recover it afterwards, because a conversation created a
 * millisecond ago and one created last week look identical on read.
 */
export function getOrCreateOpenConversation(input: {
  contactId: string
  waSessionId?: string | null
  /** Mode applied only when a new conversation is created. */
  defaultMode: ConversationMode
  defaultBotId?: string | null
}): { conversation: Conversation; opened: boolean } {
  const existing = db
    .select()
    .from(conversations)
    .where(and(eq(conversations.contactId, input.contactId), eq(conversations.status, 'open')))
    .orderBy(desc(conversations.lastMessageAt))
    .get()

  if (existing) return { conversation: existing, opened: false }

  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: uuidv4(),
    contactId: input.contactId,
    waSessionId: input.waSessionId ?? null,
    botId: input.defaultBotId ?? null,
    mode: input.defaultMode,
    status: 'open',
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(conversations).values(conversation).run()
  return { conversation, opened: true }
}

export function getConversation(id: string): Conversation | undefined {
  return db.select().from(conversations).where(eq(conversations.id, id)).get()
}

/** Marks activity and reopens the thread if it had been resolved. */
export function touchConversation(id: string, at: string = new Date().toISOString()): void {
  db.update(conversations)
    .set({ lastMessageAt: at, status: 'open', updatedAt: at })
    .where(eq(conversations.id, id))
    .run()
}

export function updateConversation(
  id: string,
  patch: { mode?: ConversationMode; status?: ConversationStatus; botId?: string | null }
): Conversation | undefined {
  db.update(conversations)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, id))
    .run()
  return getConversation(id)
}

export interface ConversationListItem {
  id: string
  contactId: string
  contactName: string | null
  contactPhone: string
  waSessionId: string | null
  waSessionName: string | null
  botId: string | null
  botName: string | null
  mode: string
  status: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastMessageDirection: string | null
}

export function listConversations(filter: {
  status?: ConversationStatus
  search?: string
  limit?: number
}): ConversationListItem[] {
  // Preview the newest message that actually has text. Bodyless rows — a failed
  // send recorded by the system, an unsupported attachment — would otherwise
  // leave the list showing a blank preview for an active conversation.
  const lastMessage = db
    .select({
      conversationId: messages.conversationId,
      content: messages.content,
      direction: messages.direction,
      createdAt: messages.createdAt,
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${messages.conversationId} ORDER BY ${messages.createdAt} DESC)`.as(
        'rank'
      ),
    })
    .from(messages)
    .where(ne(messages.content, ''))
    .as('last_message')

  const conditions = []
  if (filter.status) conditions.push(eq(conversations.status, filter.status))
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`
    conditions.push(or(like(contacts.name, term), like(contacts.phoneNumber, term)))
  }

  return db
    .select({
      id: conversations.id,
      contactId: conversations.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phoneNumber,
      waSessionId: conversations.waSessionId,
      waSessionName: waSessions.sessionName,
      botId: conversations.botId,
      botName: aiBots.name,
      mode: conversations.mode,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      lastMessagePreview: lastMessage.content,
      lastMessageDirection: lastMessage.direction,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .leftJoin(waSessions, eq(conversations.waSessionId, waSessions.id))
    .leftJoin(aiBots, eq(conversations.botId, aiBots.id))
    .leftJoin(lastMessage, and(eq(lastMessage.conversationId, conversations.id), eq(lastMessage.rank, 1)))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(filter.limit ?? 100)
    .all() as ConversationListItem[]
}

export function listMessages(conversationId: string, limit = 200) {
  const rows = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()

  return rows.reverse()
}

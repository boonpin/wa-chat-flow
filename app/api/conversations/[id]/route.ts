import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, waSessions, aiBots, messages, systemSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  getConversation,
  listMessages,
  updateConversation,
  recordConversationEvent,
} from '@/lib/conversation/service'
import { cancelAutoReply, resumeConversationReply } from '@/lib/messaging/reply-scheduler'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = getConversation(id)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contact = db.select().from(contacts).where(eq(contacts.id, conversation.contactId)).get()
  const waSession = conversation.waSessionId
    ? db.select().from(waSessions).where(eq(waSessions.id, conversation.waSessionId)).get()
    : undefined

  return NextResponse.json({
    conversation,
    contact,
    waSessionName: waSession?.sessionName ?? null,
    // `media_url` points into the gateway's internal address space and is
    // reachable only with its API key, so the browser is told that a file
    // exists and nothing else. It fetches the bytes back through
    // /api/messages/[id]/media.
    messages: listMessages(id).map(({ mediaUrl, mediaMime, ...row }) => ({
      ...row,
      hasMedia: !!mediaUrl,
      mediaMime,
    })),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const conversation = getConversation(id)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: { mode?: 'auto' | 'human'; status?: 'open' | 'resolved'; botId?: string | null } = {}

  if (body.mode === 'auto' || body.mode === 'human') patch.mode = body.mode
  if (body.status === 'open' || body.status === 'resolved') patch.status = body.status
  if ('botId' in body) patch.botId = body.botId || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  if (body.expectedVersion !== undefined && body.expectedVersion !== conversation.replyVersion) {
    return NextResponse.json(
      { error: 'This conversation changed. Refresh before trying again.' },
      { status: 409 },
    )
  }
  if (patch.botId && !db.select().from(aiBots).where(eq(aiBots.id, patch.botId)).get()) {
    return NextResponse.json({ error: 'Assistant not found.' }, { status: 400 })
  }
  const settings = db.select().from(systemSettings).get()
  if (patch.mode === 'auto' && settings?.autoReplyMode === 'off') {
    return NextResponse.json(
      { error: 'AI replies are paused for everyone. Turn them on in Automatic replies.' },
      { status: 409 },
    )
  }
  // Taking the thread off AI, or closing it, must also drop a reply that is
  // still inside its window — otherwise the bot answers a conversation the
  // operator has just claimed.

  const updated = db.transaction(() => {
    const next = updateConversation(id, patch, conversation.replyVersion)
    if (!next) return undefined
    if (patch.mode === 'human' || patch.status === 'resolved' || 'botId' in patch)
      cancelAutoReply(id)
    if (patch.mode && patch.mode !== conversation.mode)
      recordConversationEvent(
        id,
        'mode_changed',
        patch.mode === 'human'
          ? 'Your team took over this conversation'
          : 'Conversation handed back to AI',
      )
    if (patch.status && patch.status !== conversation.status)
      recordConversationEvent(
        id,
        'status_changed',
        patch.status === 'resolved' ? 'Conversation marked as done' : 'Conversation reopened',
      )
    return next
  })
  if (!updated)
    return NextResponse.json(
      { error: 'This conversation changed. Refresh before trying again.' },
      { status: 409 },
    )
  if (
    (patch.mode === 'auto' || 'botId' in patch) &&
    updated.mode === 'auto' &&
    updated.status === 'open'
  )
    resumeConversationReply(id)
  const sendInProgress = !!db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, id),
        eq(messages.senderType, 'ai'),
        eq(messages.status, 'processing'),
      ),
    )
    .get()
  return NextResponse.json({ ...updated, sendInProgress })
}

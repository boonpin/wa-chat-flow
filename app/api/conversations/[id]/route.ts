import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, waSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getConversation, listMessages, updateConversation } from '@/lib/conversation/service'
import { cancelAutoReply } from '@/lib/messaging/reply-scheduler'

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
    messages: listMessages(id),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = getConversation(id)
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const patch: { mode?: 'auto' | 'human'; status?: 'open' | 'resolved'; botId?: string | null } = {}

  if (body.mode === 'auto' || body.mode === 'human') patch.mode = body.mode
  if (body.status === 'open' || body.status === 'resolved') patch.status = body.status
  if ('botId' in body) patch.botId = body.botId || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Mirror the operator's intent onto the contact, which is what seeds the mode
  // and bot of the *next* conversation once this one is resolved. Without this,
  // turning AI on here would silently lapse when a new thread opens.
  const contactPatch: { aiEnabled?: boolean; aiBotId?: string | null } = {}
  if (patch.mode !== undefined) contactPatch.aiEnabled = patch.mode === 'auto'
  if (patch.botId !== undefined) contactPatch.aiBotId = patch.botId

  if (Object.keys(contactPatch).length > 0) {
    db.update(contacts)
      .set({ ...contactPatch, updatedAt: new Date().toISOString() })
      .where(eq(contacts.id, conversation.contactId))
      .run()
  }

  // Taking the thread off AI, or closing it, must also drop a reply that is
  // still inside its window — otherwise the bot answers a conversation the
  // operator has just claimed.
  if (patch.mode === 'human' || patch.status === 'resolved') cancelAutoReply(id)

  return NextResponse.json(updateConversation(id, patch))
}

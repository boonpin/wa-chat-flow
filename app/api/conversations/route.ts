import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listConversations, type ConversationStatus } from '@/lib/conversation/service'
import { conversationQueue } from '@/lib/conversation/attention'
import { resumePendingReplies } from '@/lib/messaging/reply-scheduler'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cheap and once per process. Opening the Inbox is the other thing that
  // reliably happens after a restart, so a window left open by one is picked
  // up even on a workspace where no new message has arrived since.
  resumePendingReplies()

  const params = request.nextUrl.searchParams
  const statusParam = params.get('status')
  const status =
    statusParam === 'open' || statusParam === 'resolved' ? (statusParam as ConversationStatus) : undefined

  if (params.get('view') === 'queue') return NextResponse.json(conversationQueue({
    status, mode: params.get('mode') ?? undefined, search: params.get('search') ?? undefined,
    attention: params.get('attention') === 'true', page: Number(params.get('page')) || 1, limit: Number(params.get('limit')) || 25,
  }))
  return NextResponse.json(
    listConversations({
      status,
      search: params.get('search') ?? undefined,
      limit: Math.min(100, Math.max(1, Number(params.get('limit')) || 100)),
    })
  )
}

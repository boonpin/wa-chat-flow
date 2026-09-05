import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listConversations, type ConversationStatus } from '@/lib/conversation/service'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const statusParam = params.get('status')
  const status =
    statusParam === 'open' || statusParam === 'resolved' ? (statusParam as ConversationStatus) : undefined

  return NextResponse.json(
    listConversations({
      status,
      search: params.get('search') ?? undefined,
      limit: params.get('limit') ? parseInt(params.get('limit')!, 10) : undefined,
    })
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { logoutSession } from '@/lib/wa/sessions'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sessionId = body.sessionId as string | undefined
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })

  try {
    await logoutSession(sessionId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log out session'
    console.error('[wa] Logout failed:', err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

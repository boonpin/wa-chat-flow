import { NextRequest, NextResponse } from 'next/server'
import { initWhatsappClient } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sessionId = body.sessionId ?? 'main'

  initWhatsappClient(sessionId).catch(console.error)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getWAStatus } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = request.nextUrl.searchParams.get('sessionId') ?? 'main'
  return NextResponse.json({ status: getWAStatus(sessionId) })
}

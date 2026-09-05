import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { retryInvocation } from '@/lib/tools/runner'

/** Re-pushes a failed capture to the sheet, e.g. after fixing the Apps Script URL. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await retryInvocation(id)

  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: result.error }, { status: 400 })
}

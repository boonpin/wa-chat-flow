import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getImpactReport, isImpactRange } from '@/lib/reports/impact'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requested = Number(req.nextUrl.searchParams.get('range') ?? 30)
  if (!isImpactRange(requested)) {
    return NextResponse.json({ error: 'Range must be 7, 30 or 90 days.' }, { status: 400 })
  }

  return NextResponse.json(getImpactReport(requested))
}


import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { activityView } from '@/lib/conversation/activity'
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(activityView(request.nextUrl.searchParams))
}

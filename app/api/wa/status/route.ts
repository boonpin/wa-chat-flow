import { NextResponse } from 'next/server'
import { getWAStatus } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ status: getWAStatus() })
}

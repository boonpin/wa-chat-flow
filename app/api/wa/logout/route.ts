import { NextResponse } from 'next/server'
import { logoutWhatsapp } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await logoutWhatsapp()
  return NextResponse.json({ ok: true })
}

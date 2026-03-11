import { NextResponse } from 'next/server'
import { initWhatsappClient } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  initWhatsappClient().catch(console.error)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProvider } from '@/lib/wa/provider'
import { getLiveStatus } from '@/lib/wa/sessions'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })

  try {
    // WAHA renders the pairing code itself, so it arrives ready to display.
    const qr = await getProvider().getQrCode(sessionId)
    if (!qr) {
      return NextResponse.json(
        { error: 'No QR available', status: await getLiveStatus(sessionId) },
        { status: 404 }
      )
    }
    return NextResponse.json({ qr })
  } catch (err) {
    console.error('[wa] QR fetch failed:', err)
    return NextResponse.json({ error: 'Could not reach WhatsApp gateway' }, { status: 502 })
  }
}

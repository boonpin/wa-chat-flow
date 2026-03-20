import { NextRequest, NextResponse } from 'next/server'
import { getQRCode, getWAStatus } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = request.nextUrl.searchParams.get('sessionId') ?? 'main'
  const qr = getQRCode(sessionId)
  if (!qr) {
    return NextResponse.json({ error: 'No QR available', status: getWAStatus(sessionId) }, { status: 404 })
  }

  const dataUrl = await QRCode.toDataURL(qr)
  return NextResponse.json({ qr: dataUrl })
}

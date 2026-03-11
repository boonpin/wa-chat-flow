import { NextResponse } from 'next/server'
import { getQRCode, getWAStatus } from '@/lib/wa/client'
import { getSession } from '@/lib/auth/session'
import QRCode from 'qrcode'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const qr = getQRCode()
  if (!qr) {
    return NextResponse.json({ error: 'No QR available', status: getWAStatus() }, { status: 404 })
  }

  const dataUrl = await QRCode.toDataURL(qr)
  return NextResponse.json({ qr: dataUrl })
}

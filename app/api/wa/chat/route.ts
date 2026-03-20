import { NextResponse } from 'next/server'
import { getClient, getWAStatus } from '@/lib/wa/client'
import { db } from '@/lib/db'
import { waSessions } from '@/lib/db/schema'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  // Find a connected session
  const sessions = db.select().from(waSessions).all()
  let client = null
  for (const session of sessions) {
    if (getWAStatus(session.id) === 'connected') {
      client = getClient(session.id)
      if (client) break
    }
  }

  if (!client) {
    return NextResponse.json({ offline: true, messages: [], hasMore: false })
  }

  try {
    const chatId = `${phone}@c.us`
    const chat = await client.getChatById(chatId)
    const rawMessages = await chat.fetchMessages({ limit })

    const messages = rawMessages.map((m) => ({
      id: m.id._serialized,
      body: m.body,
      fromMe: m.fromMe,
      timestamp: m.timestamp * 1000,
      type: m.type,
    }))

    return NextResponse.json({
      offline: false,
      messages,
      hasMore: rawMessages.length === limit,
    })
  } catch {
    return NextResponse.json({ offline: true, messages: [], hasMore: false })
  }
}

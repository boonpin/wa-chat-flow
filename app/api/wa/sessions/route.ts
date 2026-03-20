import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { waSessions } from '@/lib/db/schema'
import { getWAStatus } from '@/lib/wa/client'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = db.select().from(waSessions).all()
  const result = sessions.map((s) => ({
    ...s,
    status: getWAStatus(s.id),
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const id = uuidv4()
  db.insert(waSessions).values({
    id,
    sessionName: name,
    status: 'offline',
    lastConnectedAt: null,
  }).run()

  return NextResponse.json({ id, sessionName: name, status: 'offline', lastConnectedAt: null })
}

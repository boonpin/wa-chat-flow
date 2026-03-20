import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { blastCampaigns, blastRecipients, waSessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { normalizePhone } from '@/lib/blast/renderer'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = db
    .select({
      id: blastCampaigns.id,
      name: blastCampaigns.name,
      status: blastCampaigns.status,
      waSessionId: blastCampaigns.waSessionId,
      waSessionName: waSessions.sessionName,
      totalRecipients: blastCampaigns.totalRecipients,
      sentCount: blastCampaigns.sentCount,
      failedCount: blastCampaigns.failedCount,
      delaySeconds: blastCampaigns.delaySeconds,
      createdAt: blastCampaigns.createdAt,
      updatedAt: blastCampaigns.updatedAt,
    })
    .from(blastCampaigns)
    .leftJoin(waSessions, eq(blastCampaigns.waSessionId, waSessions.id))
    .orderBy(desc(blastCampaigns.createdAt))
    .all()

  return NextResponse.json(campaigns)
}

interface RecipientInput {
  phone: string
  name?: string
  variables?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { name, messageTemplate, waSessionId, delaySeconds = 3, recipients } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!messageTemplate?.trim()) return NextResponse.json({ error: 'messageTemplate is required' }, { status: 400 })
  if (!waSessionId) return NextResponse.json({ error: 'waSessionId is required' }, { status: 400 })
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 })
  }

  // Deduplicate by normalized phone
  const seen = new Set<string>()
  const deduped: RecipientInput[] = []
  for (const r of recipients as RecipientInput[]) {
    const normalized = normalizePhone(r.phone)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push({ ...r, phone: normalized })
  }

  const now = new Date().toISOString()
  const campaignId = uuidv4()

  db.insert(blastCampaigns).values({
    id: campaignId,
    name: name.trim(),
    messageTemplate: messageTemplate.trim(),
    waSessionId,
    status: 'draft',
    totalRecipients: deduped.length,
    sentCount: 0,
    failedCount: 0,
    delaySeconds: Math.max(1, Number(delaySeconds) || 3),
    createdAt: now,
    updatedAt: now,
  }).run()

  for (const r of deduped) {
    db.insert(blastRecipients).values({
      id: uuidv4(),
      campaignId,
      phone: r.phone,
      name: r.name ?? null,
      variables: r.variables ? JSON.stringify(r.variables) : null,
      status: 'pending',
    }).run()
  }

  return NextResponse.json({ id: campaignId }, { status: 201 })
}

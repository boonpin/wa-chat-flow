import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { blastCampaigns, blastRecipients, waSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = db
    .select({
      id: blastCampaigns.id,
      name: blastCampaigns.name,
      messageTemplate: blastCampaigns.messageTemplate,
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
    .where(eq(blastCampaigns.id, id))
    .get()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1')
  const perPage = 50
  const offset = (page - 1) * perPage

  const recipients = db
    .select()
    .from(blastRecipients)
    .where(eq(blastRecipients.campaignId, id))
    .limit(perPage)
    .offset(offset)
    .all()

  // Filter for status tab if requested
  const statusFilter = request.nextUrl.searchParams.get('status')
  const filteredRecipients = statusFilter
    ? db
        .select()
        .from(blastRecipients)
        .where(and(eq(blastRecipients.campaignId, id), eq(blastRecipients.status, statusFilter)))
        .limit(perPage)
        .offset(offset)
        .all()
    : recipients

  return NextResponse.json({ campaign, recipients: filteredRecipients, page, perPage })
}

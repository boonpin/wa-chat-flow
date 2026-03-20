import { db } from '@/lib/db'
import { blastCampaigns, blastRecipients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { startProcessor, stopProcessor } from './queue'

export function startCampaign(campaignId: string): { ok: boolean; error?: string } {
  const campaign = db.select().from(blastCampaigns).where(eq(blastCampaigns.id, campaignId)).get()
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (!['draft', 'failed'].includes(campaign.status)) {
    return { ok: false, error: `Cannot start campaign with status: ${campaign.status}` }
  }

  db.update(blastCampaigns)
    .set({ status: 'sending', updatedAt: new Date().toISOString() })
    .where(eq(blastCampaigns.id, campaignId))
    .run()

  startProcessor(campaignId)
  return { ok: true }
}

export function pauseCampaign(campaignId: string): { ok: boolean; error?: string } {
  const campaign = db.select().from(blastCampaigns).where(eq(blastCampaigns.id, campaignId)).get()
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (campaign.status !== 'sending') {
    return { ok: false, error: `Cannot pause campaign with status: ${campaign.status}` }
  }

  db.update(blastCampaigns)
    .set({ status: 'paused', updatedAt: new Date().toISOString() })
    .where(eq(blastCampaigns.id, campaignId))
    .run()

  stopProcessor(campaignId)
  return { ok: true }
}

export function resumeCampaign(campaignId: string): { ok: boolean; error?: string } {
  const campaign = db.select().from(blastCampaigns).where(eq(blastCampaigns.id, campaignId)).get()
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (campaign.status !== 'paused') {
    return { ok: false, error: `Cannot resume campaign with status: ${campaign.status}` }
  }

  db.update(blastCampaigns)
    .set({ status: 'sending', updatedAt: new Date().toISOString() })
    .where(eq(blastCampaigns.id, campaignId))
    .run()

  startProcessor(campaignId)
  return { ok: true }
}

export function cancelCampaign(campaignId: string): { ok: boolean; error?: string } {
  const campaign = db.select().from(blastCampaigns).where(eq(blastCampaigns.id, campaignId)).get()
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (['completed', 'cancelled'].includes(campaign.status)) {
    return { ok: false, error: `Campaign already ${campaign.status}` }
  }

  db.update(blastCampaigns)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(eq(blastCampaigns.id, campaignId))
    .run()

  stopProcessor(campaignId)

  // Mark remaining pending/sending recipients as skipped
  db.update(blastRecipients)
    .set({ status: 'skipped' })
    .where(eq(blastRecipients.campaignId, campaignId))
    .run()

  return { ok: true }
}

import { db } from '@/lib/db'
import { blastCampaigns, blastRecipients } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getClient } from '@/lib/wa/client'
import { renderTemplate, normalizePhone } from './renderer'

declare global {
  var __blastTimers: Map<string, ReturnType<typeof setTimeout>>
  var __blastConsecFails: Map<string, number>
}

globalThis.__blastTimers ??= new Map()
globalThis.__blastConsecFails ??= new Map()

const CONSEC_FAIL_LIMIT = 5

/** Translate raw JS / wwebjs errors into a user-readable message. */
function toFriendlyError(err: unknown): { friendly: string; raw: string } {
  const raw = err instanceof Error
    ? (err.stack ?? err.message)
    : String(err)
  const msg = err instanceof Error ? err.message : String(err)

  if (msg.includes('getChat') || msg.includes('Cannot read properties of undefined') || msg.includes('Cannot read properties of null')) {
    return { raw, friendly: 'WhatsApp session error: browser page is no longer available. Please reconnect the session.' }
  }
  if (msg.includes('not open') || msg.includes('Target closed') || msg.includes('Session closed')) {
    return { raw, friendly: 'WhatsApp session closed unexpectedly. Please reconnect the session.' }
  }
  if (msg.includes('ETIMEOUT') || msg.includes('ETIMEDOUT') || msg.toLowerCase().includes('timeout')) {
    return { raw, friendly: 'Request timed out. Check your internet connection.' }
  }
  if (msg.toLowerCase().includes('not authorized') || msg.toLowerCase().includes('unauthorized')) {
    return { raw, friendly: 'Session not authorized. Please reconnect WhatsApp.' }
  }
  return { raw, friendly: `Send failed: ${msg}` }
}

export function isProcessorRunning(campaignId: string): boolean {
  return globalThis.__blastTimers.has(campaignId)
}

export function startProcessor(campaignId: string): void {
  if (globalThis.__blastTimers.has(campaignId)) return
  // Use null as sentinel so has() returns true even while first tick runs
  globalThis.__blastTimers.set(campaignId, null as unknown as ReturnType<typeof setTimeout>)
  processTick(campaignId).catch(console.error)
}

export function stopProcessor(campaignId: string): void {
  const timer = globalThis.__blastTimers.get(campaignId)
  if (timer) clearTimeout(timer)
  globalThis.__blastTimers.delete(campaignId)
  globalThis.__blastConsecFails.delete(campaignId)
}

async function processTick(campaignId: string): Promise<void> {
  try {
    const campaign = db.select().from(blastCampaigns).where(eq(blastCampaigns.id, campaignId)).get()

    if (!campaign || campaign.status !== 'sending') {
      globalThis.__blastTimers.delete(campaignId)
      return
    }

    const recipient = db
      .select()
      .from(blastRecipients)
      .where(and(eq(blastRecipients.campaignId, campaignId), eq(blastRecipients.status, 'pending')))
      .limit(1)
      .get()

    if (!recipient) {
      // All recipients processed – mark campaign completed
      db.update(blastCampaigns)
        .set({ status: 'completed', updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()
      globalThis.__blastTimers.delete(campaignId)
      console.log(`[BLAST] Campaign ${campaignId} completed`)
      return
    }

    // Mark recipient as sending
    db.update(blastRecipients)
      .set({ status: 'sending' })
      .where(eq(blastRecipients.id, recipient.id))
      .run()

    // Render message
    const vars: Record<string, string> = {
      name: recipient.name ?? '',
      phone: recipient.phone,
      ...(recipient.variables ? JSON.parse(recipient.variables) : {}),
    }
    const message = renderTemplate(campaign.messageTemplate, vars)

    // Send via WA client
    const client = getClient(campaign.waSessionId)

    if (!client) {
      const friendlyMsg = 'WhatsApp session not connected. Please reconnect the session first.'
      db.update(blastRecipients)
        .set({ status: 'failed', error: friendlyMsg })
        .where(eq(blastRecipients.id, recipient.id))
        .run()
      db.update(blastCampaigns)
        .set({ failedCount: campaign.failedCount + 1, updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()
      console.error(`[BLAST] [${campaign.name}] No WA client for session "${campaign.waSessionId}" — pausing campaign`)
      // Immediately pause: no point retrying without a session
      db.update(blastCampaigns)
        .set({ status: 'paused', updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()
      globalThis.__blastTimers.delete(campaignId)
      globalThis.__blastConsecFails.delete(campaignId)
      return
    } else {
      try {
        const phone = normalizePhone(recipient.phone)
        const result = await client.sendMessage(`${phone}@c.us`, message)

        db.update(blastRecipients)
          .set({ status: 'sent', providerMessageId: result.id._serialized, sentAt: new Date().toISOString() })
          .where(eq(blastRecipients.id, recipient.id))
          .run()
        db.update(blastCampaigns)
          .set({ sentCount: campaign.sentCount + 1, updatedAt: new Date().toISOString() })
          .where(eq(blastCampaigns.id, campaignId))
          .run()

        // Reset consecutive failure count on success
        globalThis.__blastConsecFails.delete(campaignId)
        console.log(`[BLAST] [${campaign.name}] ✓ Sent → ${recipient.phone}`)
      } catch (err) {
        const { friendly, raw } = toFriendlyError(err)
        db.update(blastRecipients)
          .set({ status: 'failed', error: friendly })
          .where(eq(blastRecipients.id, recipient.id))
          .run()
        db.update(blastCampaigns)
          .set({ failedCount: campaign.failedCount + 1, updatedAt: new Date().toISOString() })
          .where(eq(blastCampaigns.id, campaignId))
          .run()

        console.error(`[BLAST] [${campaign.name}] ✗ Failed → ${recipient.phone}: ${friendly}`)
        console.error(`[BLAST] Raw error:`, raw)

        // Track consecutive failures — auto-pause if threshold exceeded
        const consecFails = (globalThis.__blastConsecFails.get(campaignId) ?? 0) + 1
        globalThis.__blastConsecFails.set(campaignId, consecFails)

        if (consecFails >= CONSEC_FAIL_LIMIT) {
          console.error(`[BLAST] [${campaign.name}] ${consecFails} consecutive failures — auto-pausing campaign`)
          db.update(blastCampaigns)
            .set({ status: 'paused', updatedAt: new Date().toISOString() })
            .where(eq(blastCampaigns.id, campaignId))
            .run()
          globalThis.__blastTimers.delete(campaignId)
          globalThis.__blastConsecFails.delete(campaignId)
          return
        }
      }
    }

    // Schedule next tick after delay
    const timer = setTimeout(() => {
      processTick(campaignId).catch(console.error)
    }, campaign.delaySeconds * 1000)

    globalThis.__blastTimers.set(campaignId, timer)
  } catch (err) {
    // Outer catch: unexpected processor crash — log fully and mark campaign as failed
    console.error(`[BLAST] Processor crash for campaign ${campaignId}:`, err)
    db.update(blastCampaigns)
      .set({ status: 'failed', updatedAt: new Date().toISOString() })
      .where(eq(blastCampaigns.id, campaignId))
      .run()
    globalThis.__blastTimers.delete(campaignId)
    globalThis.__blastConsecFails.delete(campaignId)
  }
}

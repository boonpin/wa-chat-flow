import { db } from '@/lib/db'
import { blastCampaigns, blastRecipients } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getProvider } from '@/lib/wa/provider'
import { getLiveStatus } from '@/lib/wa/sessions'
import { normalizePhone } from '@/lib/wa/phone'
import { renderTemplate } from './renderer'

declare global {
  var __blastTimers: Map<string, ReturnType<typeof setTimeout>>
  var __blastConsecFails: Map<string, number>
}

globalThis.__blastTimers ??= new Map()
globalThis.__blastConsecFails ??= new Map()

const CONSEC_FAIL_LIMIT = 5

/** Translate raw transport errors into a message an operator can act on. */
function toFriendlyError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('cannot reach waha') || lower.includes('econnrefused')) {
    return 'WhatsApp gateway is unreachable. Check that the WAHA service is running.'
  }
  if (lower.includes('session') && (lower.includes('not found') || lower.includes('stopped'))) {
    return 'WhatsApp session is not running. Please reconnect the session.'
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('403')) {
    return 'WhatsApp gateway rejected the request. Check WAHA_API_KEY.'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return 'Request timed out. Check your internet connection.'
  }
  return `Send failed: ${message}`
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

function pauseCampaign(campaignId: string, reason: string, campaignName: string): void {
  console.error(`[BLAST] [${campaignName}] ${reason} — pausing campaign`)
  db.update(blastCampaigns)
    .set({ status: 'paused', updatedAt: new Date().toISOString() })
    .where(eq(blastCampaigns.id, campaignId))
    .run()
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

    // A disconnected session fails every send, so check once per tick rather
    // than burning through the recipient list.
    const sessionStatus = await getLiveStatus(campaign.waSessionId)
    if (sessionStatus !== 'connected') {
      const message = 'WhatsApp session not connected. Please reconnect the session first.'
      db.update(blastRecipients)
        .set({ status: 'failed', error: message })
        .where(eq(blastRecipients.id, recipient.id))
        .run()
      db.update(blastCampaigns)
        .set({ failedCount: campaign.failedCount + 1, updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()
      pauseCampaign(campaignId, `Session "${campaign.waSessionId}" is ${sessionStatus}`, campaign.name)
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

    const result = await getProvider().sendText({
      sessionId: campaign.waSessionId,
      phone: normalizePhone(recipient.phone),
      text: message,
    })

    if (result.ok) {
      db.update(blastRecipients)
        .set({
          status: 'sent',
          providerMessageId: result.providerMessageId ?? null,
          error: null,
          sentAt: new Date().toISOString(),
        })
        .where(eq(blastRecipients.id, recipient.id))
        .run()
      db.update(blastCampaigns)
        .set({ sentCount: campaign.sentCount + 1, updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()

      globalThis.__blastConsecFails.delete(campaignId)
      console.log(`[BLAST] [${campaign.name}] ✓ Sent → ${recipient.phone}`)
    } else {
      const friendly = toFriendlyError(result.error ?? 'Unknown error')
      db.update(blastRecipients)
        .set({ status: 'failed', error: friendly })
        .where(eq(blastRecipients.id, recipient.id))
        .run()
      db.update(blastCampaigns)
        .set({ failedCount: campaign.failedCount + 1, updatedAt: new Date().toISOString() })
        .where(eq(blastCampaigns.id, campaignId))
        .run()

      console.error(`[BLAST] [${campaign.name}] ✗ Failed → ${recipient.phone}: ${friendly}`)
      console.error(`[BLAST] Raw error: ${result.error}`)

      const consecFails = (globalThis.__blastConsecFails.get(campaignId) ?? 0) + 1
      globalThis.__blastConsecFails.set(campaignId, consecFails)

      if (consecFails >= CONSEC_FAIL_LIMIT) {
        pauseCampaign(campaignId, `${consecFails} consecutive failures`, campaign.name)
        return
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

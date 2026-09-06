import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { waha } from '@/lib/config'
import { normalizeIncomingMessage, normalizeSessionStatus, type WahaWebhookBody } from '@/lib/wa/normalize'
import { persistIncomingMessage } from '@/lib/messaging/incoming-handler'
import { scheduleAutoReply } from '@/lib/messaging/reply-scheduler'
import { recordStatus } from '@/lib/wa/sessions'
import { getProvider } from '@/lib/wa/provider'

/**
 * WAHA event receiver.
 *
 * Deliberately thin: validate → normalise → hand to the message handler →
 * return 200. No AI logic lives here. The auto-reply is scheduled rather than
 * run, so neither a slow LLM nor the reply window can make WAHA time out and
 * redeliver the event.
 *
 * This route is public by design (WAHA has no session cookie), so the HMAC
 * signature is the only thing standing between the internet and the handler.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (!verifySignature(request, raw)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: WahaWebhookBody
  try {
    body = JSON.parse(raw) as WahaWebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    switch (body.event) {
      case 'message':
      case 'message.any': {
        // Resolving a @lid sender needs a provider round-trip, so this awaits.
        const incoming = await normalizeIncomingMessage(body, (session, lid) =>
          getProvider().resolveLid(session, lid)
        )
        // Groups, our own echoes and malformed events normalise to null.
        if (!incoming) return NextResponse.json({ ok: true, ignored: true })

        const persisted = persistIncomingMessage(incoming)
        if (persisted.status === 'duplicate') {
          return NextResponse.json({ ok: true, duplicate: true })
        }

        // Opens or extends the thread's reply window rather than replying now:
        // the answer is sent once the customer stops typing, and covers every
        // message they sent in the meantime. Nothing here waits for it.
        try {
          scheduleAutoReply(persisted)
        } catch (err) {
          // The message is already stored, so a scheduling failure must not
          // turn into a 500 and make WAHA redeliver it.
          console.error('[webhook] Could not schedule the auto-reply:', err)
        }

        return NextResponse.json({ ok: true })
      }

      case 'session.status': {
        const event = normalizeSessionStatus(body)
        if (event) recordStatus(event.sessionId, event.status)
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ ok: true, ignored: true })
    }
  } catch (err) {
    console.error('[webhook] Processing error:', err)
    // 500 tells WAHA to retry, which is what we want for transient failures.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

/**
 * Verifies WAHA's `X-Webhook-Hmac` header (HMAC of the raw body).
 *
 * With no key configured the check is skipped — acceptable for local
 * development, and loudly discouraged in `.env.example` for anything else.
 */
function verifySignature(request: NextRequest, raw: string): boolean {
  if (!waha.webhookHmacKey) return true

  const provided = request.headers.get('x-webhook-hmac')
  if (!provided) return false

  const algorithm = (request.headers.get('x-webhook-hmac-algorithm') || 'sha512').toLowerCase()
  if (!['sha512', 'sha256'].includes(algorithm)) return false

  const expected = crypto.createHmac(algorithm, waha.webhookHmacKey).update(raw).digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(provided.trim())
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

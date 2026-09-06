import { waha } from '@/lib/config'
import { fromChatId, toChatId } from './phone'
import type {
  SendResult,
  SendTextInput,
  SessionInfo,
  SessionStatus,
  SetTypingInput,
  WhatsAppProvider,
} from './types'

/**
 * WAHA (WhatsApp HTTP API) transport.
 *
 * This module is the ONLY place that knows WAHA's REST surface. It maps WAHA's
 * vocabulary onto the neutral `WhatsAppProvider` contract.
 *
 * @see https://waha.devlike.pro/docs/how-to/
 */

const REQUEST_TIMEOUT_MS = 30_000

/** WAHA session engine states → our normalised statuses. */
const STATUS_MAP: Record<string, SessionStatus> = {
  STOPPED: 'offline',
  STARTING: 'starting',
  SCAN_QR_CODE: 'waiting_qr',
  WORKING: 'connected',
  FAILED: 'failed',
}

/** Events we subscribe each session to. Keep this tight — noise costs writes. */
const WEBHOOK_EVENTS = ['message', 'session.status']

/** LID → phone number. The mapping does not change, so cache it per process. */
const lidCache = new Map<string, string | null>()

class WahaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'WahaError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: { accept?: string; raw?: boolean }
): Promise<T> {
  const headers: Record<string, string> = { Accept: init?.accept ?? 'application/json' }
  if (waha.apiKey) headers['X-Api-Key'] = waha.apiKey
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${waha.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new WahaError(`Cannot reach WAHA at ${waha.baseUrl}: ${reason}`)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new WahaError(
      `WAHA ${method} ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      response.status
    )
  }

  if (init?.raw) return response as unknown as T
  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

interface WahaWebhookConfig {
  url?: string
  events?: string[]
  hmac?: { key?: string } | null
}

interface WahaSessionResponse {
  name: string
  status?: string
  me?: { id?: string; pushName?: string } | null
  config?: { webhooks?: WahaWebhookConfig[] } | null
}

/**
 * True when the live session already has the webhook config we would push.
 *
 * Restarting a WORKING session is not free: each restart tears down the browser
 * and re-handshakes with WhatsApp, and enough churn makes WhatsApp drop the
 * linked device, forcing the user to scan a new QR code. So we only touch a
 * healthy session when its configuration has actually drifted.
 */
function webhookConfigMatches(session: WahaSessionResponse): boolean {
  const desired = sessionConfig().webhooks[0]
  const current = session.config?.webhooks?.find((w) => w.url === desired.url)
  if (!current) return false

  const hasHmac = !!current.hmac?.key
  const wantsHmac = !!waha.webhookHmacKey
  if (hasHmac !== wantsHmac) return false

  const currentEvents = [...(current.events ?? [])].sort()
  const desiredEvents = [...desired.events].sort()
  return (
    currentEvents.length === desiredEvents.length &&
    currentEvents.every((e, i) => e === desiredEvents[i])
  )
}

/** WAHA session config we (re)apply whenever a session is created or started. */
function sessionConfig() {
  return {
    webhooks: [
      {
        url: waha.webhookUrl,
        events: WEBHOOK_EVENTS,
        ...(waha.webhookHmacKey ? { hmac: { key: waha.webhookHmacKey } } : {}),
        retries: { delaySeconds: 2, attempts: 3 },
      },
    ],
  }
}

/**
 * WAHA message ids are sometimes returned bare and sometimes nested inside the
 * raw WhatsApp payload, depending on version and engine. Dig for whichever.
 */
function extractMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const p = payload as Record<string, unknown>

  if (typeof p.id === 'string') return p.id
  if (p.id && typeof p.id === 'object') {
    const serialized = (p.id as Record<string, unknown>)._serialized
    if (typeof serialized === 'string') return serialized
  }
  if (p._data && typeof p._data === 'object') {
    return extractMessageId(p._data)
  }
  return undefined
}

export class WahaProvider implements WhatsAppProvider {
  readonly name = 'waha' as const

  async sendText({ sessionId, phone, text }: SendTextInput): Promise<SendResult> {
    try {
      const result = await request<unknown>('POST', '/api/sendText', {
        session: sessionId,
        chatId: toChatId(phone),
        text,
      })
      return { ok: true, providerMessageId: extractMessageId(result) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Drives the chat's presence so a held reply does not read as a dead bot.
   *
   * WAHA never sends `typing` on its own — the indicator has to be set before
   * `sendText` and cleared afterwards. Failures are swallowed: older builds have
   * no `/presence` route at all, and losing the indicator must never cost the
   * reply it was decorating.
   */
  async setTyping({ sessionId, phone, typing }: SetTypingInput): Promise<void> {
    try {
      await request('POST', `/api/${encodeURIComponent(sessionId)}/presence`, {
        chatId: toChatId(phone),
        presence: typing ? 'typing' : 'paused',
      })
    } catch (err) {
      console.warn(`[wa] Could not set presence for ${phone}:`, err instanceof Error ? err.message : err)
    }
  }

  async getSessionStatus(sessionId: string): Promise<SessionInfo> {
    try {
      const session = await request<WahaSessionResponse>(
        'GET',
        `/api/sessions/${encodeURIComponent(sessionId)}`
      )
      return {
        id: sessionId,
        status: STATUS_MAP[session?.status ?? ''] ?? 'offline',
        me: session?.me?.id ? { id: session.me.id, pushName: session.me.pushName } : undefined,
      }
    } catch (err) {
      // A session that has never been created reads as offline, not as an error.
      if (err instanceof WahaError && err.status === 404) {
        return { id: sessionId, status: 'offline' }
      }
      throw err
    }
  }

  async startSession(sessionId: string): Promise<void> {
    const existing = await this.fetchSession(sessionId)

    if (!existing) {
      await request('POST', '/api/sessions', {
        name: sessionId,
        start: true,
        config: sessionConfig(),
      })
      return
    }

    // Already connected and correctly configured — do nothing. Restarting here
    // would risk WhatsApp unlinking the device for no benefit.
    if (existing.status === 'WORKING' && webhookConfigMatches(existing)) return

    // Re-apply the webhook config in case APP_URL or the HMAC key changed.
    await request('PUT', `/api/sessions/${encodeURIComponent(sessionId)}`, {
      config: sessionConfig(),
    }).catch(() => {
      /* older WAHA builds have no PUT /sessions/{name}; start still works */
    })

    await request('POST', `/api/sessions/${encodeURIComponent(sessionId)}/start`, {}).catch((err) => {
      // Already-running sessions answer 4xx here; that is a no-op, not a failure.
      if (err instanceof WahaError && err.status && err.status < 500) return
      throw err
    })
  }

  async stopSession(sessionId: string): Promise<void> {
    await request('POST', `/api/sessions/${encodeURIComponent(sessionId)}/stop`, {}).catch(
      swallowMissingSession
    )
  }

  async logoutSession(sessionId: string): Promise<void> {
    await request('POST', `/api/sessions/${encodeURIComponent(sessionId)}/logout`, {}).catch(
      swallowMissingSession
    )
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.logoutSession(sessionId)
    await request('DELETE', `/api/sessions/${encodeURIComponent(sessionId)}`).catch(
      swallowMissingSession
    )
  }

  async getQrCode(sessionId: string): Promise<string | null> {
    try {
      const response = await request<Response>(
        'GET',
        `/api/${encodeURIComponent(sessionId)}/auth/qr?format=image`,
        undefined,
        { accept: 'image/png', raw: true }
      )

      const contentType = response.headers.get('content-type') ?? ''

      // Newer builds return the PNG directly; some return {mimetype, data}.
      if (contentType.includes('application/json')) {
        const json = (await response.json()) as { mimetype?: string; data?: string }
        if (!json?.data) return null
        return `data:${json.mimetype ?? 'image/png'};base64,${json.data}`
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length === 0) return null
      return `data:${contentType || 'image/png'};base64,${buffer.toString('base64')}`
    } catch (err) {
      // No QR is available unless the session is actually waiting to be scanned.
      if (err instanceof WahaError && err.status && err.status < 500) return null
      throw err
    }
  }

  /**
   * Resolves a `@lid` address to a bare phone number.
   *
   * WhatsApp increasingly addresses ordinary one-to-one chats by a
   * linked identity rather than a phone number. WAHA keeps the mapping, so a
   * LID message is a real customer we can answer — provided we translate it
   * first. Results are cached because the mapping is stable.
   */
  async resolveLid(sessionId: string, lid: string): Promise<string | null> {
    const cacheKey = `${sessionId}:${lid}`
    const cached = lidCache.get(cacheKey)
    if (cached !== undefined) return cached

    let phone: string | null = null
    try {
      const result = await request<{ lid?: string; pn?: string }>(
        'GET',
        `/api/${encodeURIComponent(sessionId)}/lids/${encodeURIComponent(lid)}`
      )
      phone = result?.pn ? fromChatId(result.pn) || null : null
    } catch (err) {
      // No mapping yet is a 404, not a failure worth throwing over.
      if (!(err instanceof WahaError && err.status && err.status < 500)) throw err
    }

    lidCache.set(cacheKey, phone)
    return phone
  }

  /** Returns the raw session, or null when WAHA has never seen it. */
  private async fetchSession(sessionId: string): Promise<WahaSessionResponse | null> {
    try {
      return await request<WahaSessionResponse>(
        'GET',
        `/api/sessions/${encodeURIComponent(sessionId)}`
      )
    } catch (err) {
      if (err instanceof WahaError && err.status === 404) return null
      throw err
    }
  }
}

function swallowMissingSession(err: unknown): void {
  if (err instanceof WahaError && err.status === 404) return
  throw err
}

export { WahaError }

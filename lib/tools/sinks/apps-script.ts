import type { CaptureRow, CaptureSink, SinkResult } from './types'
import type { ToolRow } from '../types'

/**
 * Writes to a Google Sheet through an Apps Script Web App.
 *
 * This module is the ONLY place that knows the Apps Script wire format.
 *
 * Why not the Sheets API? A public sheet link is not writable — the REST API
 * always needs OAuth or a service account, which means a GCP project the SME
 * has to set up. An Apps Script bound to the sheet and deployed as "execute as
 * me / anyone can access" gives a plain POST endpoint with no credentials on
 * our side, at the cost of the URL itself being a bearer secret. Hence the
 * shared token in the body: a leaked URL alone cannot write.
 *
 * The companion script lives in docs/11-tools-and-capture.md.
 */

/** Apps Script cold starts are slow, but a customer is waiting on this. */
const REQUEST_TIMEOUT_MS = 10_000

export class AppsScriptSink implements CaptureSink {
  async append(tool: ToolRow, row: CaptureRow): Promise<SinkResult> {
    if (!tool.sinkUrl) {
      return {
        ok: false,
        submitted: false,
        error: 'No Apps Script URL configured for this tool — nothing was sent anywhere',
      }
    }

    // The body carries the shared secret; `payload` is the same thing with the
    // credential dropped, and is what gets recorded and shown in the log.
    const payload = {
      sheet: tool.sheetTab,
      conversationId: row.conversationId,
      capturedAt: row.capturedAt,
      contactName: row.contactName ?? '',
      contactPhone: row.contactPhone,
      values: row.values,
    }
    const body = { secret: tool.sinkSecret ?? '', ...payload }

    let response: Response
    try {
      response = await fetch(tool.sinkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
        // Apps Script answers /exec with a 302 to script.googleusercontent.com.
        redirect: 'follow',
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      // The request was attempted — it just did not arrive.
      return { ok: false, submitted: true, payload, error: `Cannot reach Apps Script: ${reason}` }
    }

    const responseText = await response.text().catch(() => '')

    if (!response.ok) {
      return {
        ok: false,
        submitted: true,
        payload,
        error: `Apps Script returned ${response.status}: ${truncate(responseText)}`,
      }
    }

    // Apps Script happily returns 200 with an HTML error page when the
    // deployment is misconfigured, so a status check alone is not enough.
    try {
      const parsed = JSON.parse(responseText) as { ok?: boolean; error?: string }
      if (parsed.ok === false) {
        return { ok: false, submitted: true, payload, error: parsed.error || 'Apps Script rejected the row' }
      }
      if (parsed.ok !== true) {
        return {
          ok: false,
          submitted: true,
          payload,
          error: `Unexpected Apps Script response: ${truncate(responseText)}`,
        }
      }
    } catch {
      return {
        ok: false,
        submitted: true,
        payload,
        error:
          'Apps Script did not return JSON. Check the deployment is set to ' +
          `"Execute as: Me" and "Who has access: Anyone". Got: ${truncate(responseText)}`,
      }
    }

    return { ok: true, submitted: true, payload }
  }
}

function truncate(text: string, max = 200): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed
}

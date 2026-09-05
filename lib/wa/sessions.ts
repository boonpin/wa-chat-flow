import { db } from '@/lib/db'
import { waSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getProvider } from './provider'
import type { SessionStatus } from './types'

/**
 * Session bookkeeping: WA Chat Flow owns the session record (id, display name,
 * last-seen status) while the provider owns the actual WhatsApp connection.
 */

export interface WaSessionView {
  id: string
  sessionName: string
  provider: string
  status: SessionStatus
  lastConnectedAt: string | null
}

export function createSession(name: string): WaSessionView {
  const now = new Date().toISOString()
  const id = uuidv4()

  db.insert(waSessions)
    .values({
      id,
      sessionName: name,
      provider: getProvider().name,
      status: 'offline',
      lastConnectedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { id, sessionName: name, provider: getProvider().name, status: 'offline', lastConnectedAt: null }
}

/** Persists a status reported by the provider (webhook or poll). */
export function recordStatus(sessionId: string, status: SessionStatus): void {
  const existing = db.select().from(waSessions).where(eq(waSessions.id, sessionId)).get()
  if (!existing) return

  const now = new Date().toISOString()
  db.update(waSessions)
    .set({
      status,
      lastConnectedAt: status === 'connected' ? now : existing.lastConnectedAt,
      updatedAt: now,
    })
    .where(eq(waSessions.id, sessionId))
    .run()
}

/**
 * Reads the live status from the provider and mirrors it into the database.
 * Falls back to the stored status when the provider is unreachable, so the
 * dashboard degrades to "last known" instead of erroring.
 */
export async function getLiveStatus(sessionId: string): Promise<SessionStatus> {
  try {
    const info = await getProvider().getSessionStatus(sessionId)
    recordStatus(sessionId, info.status)
    return info.status
  } catch (err) {
    console.error(`[wa] Status check failed for session ${sessionId}:`, err)
    const stored = db.select().from(waSessions).where(eq(waSessions.id, sessionId)).get()
    return (stored?.status as SessionStatus) ?? 'offline'
  }
}

export async function listSessions(): Promise<WaSessionView[]> {
  await ensureSessionsReconciled()

  const rows = db.select().from(waSessions).all()

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      sessionName: row.sessionName,
      provider: row.provider,
      status: await getLiveStatus(row.id),
      lastConnectedAt: row.lastConnectedAt,
    }))
  )
}

export async function startSession(sessionId: string): Promise<void> {
  await getProvider().startSession(sessionId)
  recordStatus(sessionId, 'starting')
}

export async function logoutSession(sessionId: string): Promise<void> {
  await getProvider().logoutSession(sessionId)
  await getProvider().stopSession(sessionId)
  recordStatus(sessionId, 'offline')
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getProvider()
    .deleteSession(sessionId)
    .catch((err) => {
      // The local record should disappear even if WAHA is down.
      console.error(`[wa] Provider delete failed for session ${sessionId}:`, err)
    })
  db.delete(waSessions).where(eq(waSessions.id, sessionId)).run()
}

/**
 * Re-applies webhook configuration to every known session, so a redeployed app
 * (or a changed APP_URL / HMAC key) does not silently stop receiving events.
 *
 * Runs once per process, lazily, on the first session listing rather than from
 * `instrumentation.ts`. Next.js does not apply `outputFileTracingExcludes` to
 * the instrumentation entry, so importing the database layer there dragged the
 * whole project directory — runtime state included — into the build output.
 *
 * `startSession` is a no-op for a session that is already connected with
 * matching configuration, so this costs one request per session and never
 * disturbs a healthy WhatsApp link.
 */
let reconcilePromise: Promise<void> | null = null

export function ensureSessionsReconciled(): Promise<void> {
  reconcilePromise ??= reconcileSessions()
  return reconcilePromise
}

async function reconcileSessions(): Promise<void> {
  const rows = db.select().from(waSessions).all()

  for (const row of rows) {
    try {
      const info = await getProvider().getSessionStatus(row.id)
      recordStatus(row.id, info.status)
      if (info.status !== 'offline') {
        await getProvider().startSession(row.id)
      }
    } catch (err) {
      console.error(`[wa] Session reconcile failed for "${row.sessionName}":`, err)
    }
  }
}

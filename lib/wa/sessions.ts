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
 * Re-applies webhook configuration to every known session at boot, so a
 * restarted app (or a changed APP_URL) does not silently stop receiving events.
 */
export async function syncSessionsOnBoot(): Promise<void> {
  const rows = db.select().from(waSessions).all()
  if (rows.length === 0) return

  for (const row of rows) {
    try {
      const info = await getProvider().getSessionStatus(row.id)
      recordStatus(row.id, info.status)
      if (info.status !== 'offline') {
        // Session already lives in WAHA — refresh its webhook target.
        await getProvider().startSession(row.id)
      }
    } catch (err) {
      console.error(`[wa] Boot sync failed for session "${row.sessionName}":`, err)
    }
  }
}

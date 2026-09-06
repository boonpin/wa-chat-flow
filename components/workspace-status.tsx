'use client'

import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { request, useAsyncData } from '@/components/ui'
import type { ChannelStatus } from '@/components/ui'
import type { AutoReplyMode } from '@/lib/settings/auto-reply'

/**
 * The three facts that decide whether an automatic reply can happen at all:
 * which numbers are connected, whether AI replies are permitted, and which bots
 * exist. Loaded once for the whole shell so the navigation summary, Overview
 * and the Inbox thread header cannot disagree with each other.
 */

export interface ChannelView {
  id: string
  sessionName: string
  status: ChannelStatus
  lastConnectedAt: string | null
}

export interface BotSummary {
  id: string
  name: string
  /** All three come from the bot's AI provider row, and are null once it is gone. */
  providerId: string | null
  providerName: string | null
  provider: string | null
  model: string | null
  /** Null when there is no provider row at all; false when it is turned off. */
  providerEnabled: boolean | null
  enabled: boolean
  isDefault: boolean
  hasApiKey: boolean
}

export interface ReplySettings {
  autoReplyMode: AutoReplyMode
  defaultBotId: string | null
}

interface WorkspaceStatus {
  channels: ChannelView[]
  settings: ReplySettings
  bots: BotSummary[]
}

interface WorkspaceContext {
  status: WorkspaceStatus | null
  loading: boolean
  error: string | null
  stale: string | null
  loadedAt: Date | null
  refresh: () => void
}

const Ctx = createContext<WorkspaceContext>({
  status: null,
  loading: true,
  error: null,
  stale: null,
  loadedAt: null,
  refresh: () => {},
})

/** Ambient context, not a live feed: 30s is enough for a status strip. */
const POLL_MS = 30_000

export function WorkspaceStatusProvider({ children }: { children: ReactNode }) {
  const load = useCallback(async (signal: AbortSignal): Promise<WorkspaceStatus> => {
    const [channels, settings, bots] = await Promise.all([
      request<ChannelView[]>('/api/wa/sessions', { signal }),
      request<ReplySettings>('/api/settings', { signal }),
      request<BotSummary[]>('/api/bots', { signal }),
    ])
    return {
      channels: Array.isArray(channels) ? channels : [],
      settings: settings ?? { autoReplyMode: 'off', defaultBotId: null },
      bots: Array.isArray(bots) ? bots : [],
    }
  }, [])

  const { data, loading, error, stale, loadedAt, refresh } = useAsyncData(load, [load], {
    pollMs: POLL_MS,
  })

  return (
    <Ctx.Provider value={{ status: data, loading, error, stale, loadedAt, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useWorkspaceStatus() {
  return useContext(Ctx)
}

/**
 * The bot that would answer when nothing more specific is bound, and where that
 * choice comes from. `systemSettings.defaultBotId` and the legacy `isDefault`
 * flag can disagree; this reports what selection actually does rather than
 * quietly picking one of them.
 */
export function resolveFallbackBot(status: WorkspaceStatus | null): {
  bot: BotSummary | null
  source: 'settings' | 'flag' | null
  conflict: BotSummary | null
} {
  if (!status) return { bot: null, source: null, conflict: null }

  const flagged = status.bots.find((b) => b.isDefault && b.enabled) ?? null
  const chosen = status.settings.defaultBotId
    ? (status.bots.find((b) => b.id === status.settings.defaultBotId && b.enabled) ?? null)
    : null

  if (chosen) {
    return {
      bot: chosen,
      source: 'settings',
      conflict: flagged && flagged.id !== chosen.id ? flagged : null,
    }
  }
  return { bot: flagged, source: flagged ? 'flag' : null, conflict: null }
}

export function countConnected(channels: ChannelView[]): number {
  return channels.filter((c) => c.status === 'connected').length
}

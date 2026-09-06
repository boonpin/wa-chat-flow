'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, ChannelTag, type BadgeVariant } from './badge'
import { AlertTriangleIcon } from './icons'
import { repliesToExisting, type AutoReplyMode } from '@/lib/settings/auto-reply'

/* ─── Vocabulary ──────────────────────────────────────────────────────────────
   Six independent dimensions. A green toggle in one of them is never allowed to
   become a claim about any of the others.
   ─────────────────────────────────────────────────────────────────────────── */

export type ChannelStatus =
  | 'offline'
  | 'starting'
  | 'waiting_qr'
  | 'connected'
  | 'failed'
  /** The frontend could not reach the API — not the same as "disconnected". */
  | 'unknown'

/**
 * "Reported connected", not "Connected": the sessions API falls back to the
 * last stored status when the gateway is unreachable, and does not tell us
 * which one we got. Until it does, claiming live health would be a guess.
 */
const CHANNEL_LABEL: Record<ChannelStatus, { text: string; variant: BadgeVariant }> = {
  connected: { text: 'Reported connected', variant: 'success' },
  waiting_qr: { text: 'Scan QR code', variant: 'warning' },
  starting: { text: 'Starting', variant: 'warning' },
  failed: { text: 'Connection failed', variant: 'danger' },
  offline: { text: 'Not connected', variant: 'neutral' },
  unknown: { text: 'Status unavailable', variant: 'neutral' },
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  const { text, variant } = CHANNEL_LABEL[status] ?? CHANNEL_LABEL.unknown
  return (
    <Badge variant={variant} dot>
      {text}
    </Badge>
  )
}

export function channelStatusText(status: ChannelStatus): string {
  return (CHANNEL_LABEL[status] ?? CHANNEL_LABEL.unknown).text
}

export function ModeBadge({ mode }: { mode: 'auto' | 'human' }) {
  return mode === 'auto' ? <Badge variant="ai">AI replies</Badge> : <Badge variant="human">Human replies</Badge>
}

export function LifecycleBadge({ status }: { status: 'open' | 'resolved' }) {
  return status === 'open' ? <Badge variant="neutral">Open</Badge> : <Badge variant="info">Resolved</Badge>
}

/** `sent` means the gateway accepted it. It is not delivered, and not read. */
const MESSAGE_LABEL: Record<string, { text: string; variant: BadgeVariant }> = {
  received: { text: 'Received', variant: 'neutral' },
  processing: { text: 'Sending', variant: 'warning' },
  sent: { text: 'Sent', variant: 'success' },
  failed: { text: 'Failed', variant: 'danger' },
}

export function MessageStatusBadge({ status }: { status: string }) {
  const s = MESSAGE_LABEL[status] ?? { text: status, variant: 'neutral' as BadgeVariant }
  return <Badge variant={s.variant}>{s.text}</Badge>
}

/**
 * "Saved here" and "Synced to Google Sheets" are different facts. `not_submitted`
 * means nothing ever left the app — a misconfigured tool, fixed in the
 * dashboard; `failed` means a request was sent and rejected, fixed by retrying.
 */
const CAPTURE_LABEL: Record<string, { text: string; variant: BadgeVariant }> = {
  synced: { text: 'Synced to sheet', variant: 'success' },
  pending: { text: 'Pending', variant: 'info' },
  failed: { text: 'Sync failed', variant: 'danger' },
  not_submitted: { text: 'Not submitted', variant: 'warning' },
}

export function CaptureStatusBadge({ status }: { status: string }) {
  const s = CAPTURE_LABEL[status] ?? { text: status, variant: 'neutral' as BadgeVariant }
  return <Badge variant={s.variant}>{s.text}</Badge>
}

export function captureStatusText(status: string): string {
  return (CAPTURE_LABEL[status] ?? { text: status }).text
}

const CAMPAIGN_LABEL: Record<string, { text: string; variant: BadgeVariant }> = {
  draft: { text: 'Draft', variant: 'neutral' },
  sending: { text: 'Sending', variant: 'info' },
  paused: { text: 'Paused', variant: 'warning' },
  completed: { text: 'Processing complete', variant: 'success' },
  cancelled: { text: 'Cancelled', variant: 'neutral' },
  failed: { text: 'Failed', variant: 'danger' },
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const s = CAMPAIGN_LABEL[status] ?? { text: status, variant: 'neutral' as BadgeVariant }
  return (
    <Badge variant={s.variant} dot>
      {s.text}
    </Badge>
  )
}

const RECIPIENT_LABEL: Record<string, { text: string; variant: BadgeVariant }> = {
  pending: { text: 'Not sent yet', variant: 'neutral' },
  sending: { text: 'Sending', variant: 'info' },
  sent: { text: 'Sent', variant: 'success' },
  failed: { text: 'Failed', variant: 'danger' },
  skipped: { text: 'Skipped', variant: 'warning' },
}

export function RecipientStatusBadge({ status }: { status: string }) {
  const s = RECIPIENT_LABEL[status] ?? { text: status, variant: 'neutral' as BadgeVariant }
  return <Badge variant={s.variant}>{s.text}</Badge>
}

/* ─── The reply status line ───────────────────────────────────────────────────
   The signature pattern. It appears in the shell, on Overview, in the Inbox
   thread header, on a contact profile and in setup reviews — and it always
   separates the same four facts, so no single one of them can stand in for the
   whole system working.
   ─────────────────────────────────────────────────────────────────────────── */

export interface Blocker {
  /** What is true, in one sentence, plus what it means for the operator. */
  message: string
  action?: { label: string; href: string }
  tone?: 'warning' | 'danger'
}

export interface ReplyStatusInput {
  channel?: { name: string | null; status: ChannelStatus } | null
  mode?: 'auto' | 'human' | null
  bot?: { name: string | null; note?: string } | null
  blockers?: Blocker[]
}

export function ReplyStatusLine({
  channel,
  mode,
  bot,
  blockers = [],
  className = '',
}: ReplyStatusInput & { className?: string }) {
  const top = blockers[0]

  return (
    <div className={`rounded-lg border border-line bg-panel px-3 py-2.5 md:px-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {channel && (
          <span className="flex min-w-0 items-center gap-2">
            <ChannelTag name={channel.name ?? 'No channel'} />
            <ChannelStatusBadge status={channel.status} />
          </span>
        )}
        {mode && (
          <span className="flex items-center gap-2">
            <span className="text-ink-soft">Reply mode</span>
            <ModeBadge mode={mode} />
          </span>
        )}
        {bot !== undefined && bot !== null && (
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-ink-soft">Bot</span>
            <span className="truncate font-medium text-ink">{bot.name ?? 'None selected'}</span>
            {bot.note && <span className="shrink-0 text-xs text-ink-soft">{bot.note}</span>}
          </span>
        )}
      </div>

      {top && (
        <div
          className={`mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-soft pt-2.5
            text-sm ${top.tone === 'danger' ? 'text-danger' : 'text-warning'}`}
        >
          <AlertTriangleIcon size={14} />
          <span className="min-w-0">{top.message}</span>
          {top.action && (
            <Link
              href={top.action.href}
              className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
              {top.action.label}
            </Link>
          )}
          {blockers.length > 1 && (
            <span className="text-ink-soft">+{blockers.length - 1} more to review</span>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Routing explanation ─────────────────────────────────────────────────────
   A presentation of the behaviour that already exists in
   lib/messaging/bot-selection.ts and incoming-handler.ts — global permission →
   conversation mode → supported text → eligible bot. It explains; it does not
   decide. The most actionable blocker comes first.
   ─────────────────────────────────────────────────────────────────────────── */

export function deriveBlockers(input: {
  autoReplyMode: AutoReplyMode
  mode?: 'auto' | 'human' | null
  channelStatus?: ChannelStatus | null
  botName?: string | null
  botEnabled?: boolean
  /** True when the bot's AI provider row is gone — it cannot call anything. */
  botProviderMissing?: boolean
  /** False when that provider exists but is turned off. */
  botProviderEnabled?: boolean
}): Blocker[] {
  const blockers: Blocker[] = []

  if (input.channelStatus && input.channelStatus !== 'connected') {
    blockers.push({
      message:
        input.channelStatus === 'unknown'
          ? 'This number’s connection could not be checked, so new messages may not arrive.'
          : 'This number is not connected, so new messages will not arrive.',
      action: { label: 'Open WhatsApp channels', href: '/channels/whatsapp' },
      tone: input.channelStatus === 'failed' ? 'danger' : 'warning',
    })
  }

  if (input.mode === 'auto') {
    // `existing` is deliberately not a blocker here: this thread is already
    // running, which is exactly what that policy keeps answering.
    if (!repliesToExisting(input.autoReplyMode)) {
      blockers.push({
        message: 'AI replies are off for the whole workspace. You can still reply manually.',
        action: { label: 'Review reply settings', href: '/automation/replies' },
      })
    } else if (!input.botName) {
      blockers.push({
        message: 'No bot is selected and no default is set, so the AI will not answer.',
        action: { label: 'Choose a default bot', href: '/automation/replies' },
      })
    } else if (input.botEnabled === false) {
      blockers.push({
        message: `“${input.botName}” is turned off, so a different bot or none at all will answer.`,
        action: { label: 'Open AI bots', href: '/bots' },
      })
    } else if (input.botProviderMissing) {
      // The bot is otherwise ready, so nothing else reports this: the failure
      // would first appear as a customer who never got an answer.
      blockers.push({
        message: `“${input.botName}” has no AI provider, so every reply it tries will fail.`,
        action: { label: 'Open AI providers', href: '/ai-providers' },
        tone: 'danger',
      })
    } else if (input.botProviderEnabled === false) {
      blockers.push({
        message: `The AI provider for “${input.botName}” is turned off, so its replies will fail.`,
        action: { label: 'Open AI providers', href: '/ai-providers' },
        tone: 'danger',
      })
    }
  }

  return blockers
}

/** A compact fact for a summary strip: label above, value below. */
export function StatusFact({
  label,
  children,
  action,
  className = '',
}: {
  label: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs text-ink-soft">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink">{children}</div>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

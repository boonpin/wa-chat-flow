'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import {
  Badge,
  Banner,
  ChannelStatusBadge,
  ChannelTag,
  CheckIcon,
  ChevronRight,
  EmptyState,
  ErrorState,
  InboxIcon,
  LinkButton,
  ModeBadge,
  Panel,
  PanelHeader,
  PageBody,
  PageHeader,
  Skeleton,
  StaleNotice,
  contactLabel,
  request,
  timeAgo,
  useAsyncData,
} from '@/components/ui'
import {
  countConnected,
  resolveFallbackBot,
  useWorkspaceStatus,
} from '@/components/workspace-status'

interface ConversationRow {
  id: string
  contactName: string | null
  contactPhone: string
  waSessionName: string | null
  mode: 'auto' | 'human'
  status: 'open' | 'resolved'
  lastMessageAt: string | null
  lastMessagePreview: string | null
}

interface Issue {
  title: string
  detail: string
  href: string
  cta: string
  tone: 'warning' | 'danger'
}

/* ─── Setup checklist ─────────────────────────────────────────────────────────
   Progress is read from saved configuration, so the list resumes wherever the
   operator left it and the steps can be completed in any order.
   ─────────────────────────────────────────────────────────────────────────── */

function ChecklistItem({
  done,
  title,
  detail,
  href,
  cta,
}: {
  done: boolean
  title: string
  detail: string
  href: string
  cta: string
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line-soft px-4 py-3.5 last:border-0 md:px-5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-success text-white' : 'border border-line-strong/60 bg-inset'
        }`}
        aria-hidden="true"
      >
        {done && <CheckIcon size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? 'text-ink-muted line-through' : 'text-ink'}`}>
          {title}
        </p>
        <p className="mt-0.5 text-sm leading-5 text-ink-muted">{detail}</p>
      </div>
      <LinkButton href={href} size="sm" variant={done ? 'ghost' : 'secondary'} className="shrink-0">
        {done ? 'Review' : cta}
      </LinkButton>
      <span className="sr-only">{done ? 'Done' : 'Not done yet'}</span>
    </li>
  )
}

export default function OverviewPage() {
  const { status, loading: statusLoading, error: statusError, stale: statusStale, refresh } =
    useWorkspaceStatus()

  const loadConversations = useCallback(
    (signal: AbortSignal) =>
      request<ConversationRow[]>('/api/conversations?status=open&limit=6', { signal }),
    []
  )
  const conversations = useAsyncData(loadConversations, [loadConversations], { pollMs: 30_000 })

  const fallback = resolveFallbackBot(status)
  const channels = status?.channels ?? []
  const connected = countConnected(channels)
  const bots = status?.bots ?? []
  const aiEnabled = status?.settings.autoReplyEnabled ?? false
  const openCount = conversations.data?.length ?? 0

  const setupComplete = bots.length > 0 && connected > 0 && aiEnabled

  /* Known blockers, most actionable first. A number that is offline is more
     urgent than a default bot that has not been chosen. */
  const issues: Issue[] = []
  if (status) {
    if (channels.length === 0) {
      issues.push({
        title: 'No WhatsApp number connected',
        detail: 'Messages cannot reach WA Robot until a number is connected.',
        href: '/channels/whatsapp',
        cta: 'Connect number',
        tone: 'danger',
      })
    } else {
      // Every disconnected number is named. One healthy number must never hide
      // a broken one behind a single green aggregate.
      for (const channel of channels.filter((c) => c.status !== 'connected')) {
        issues.push({
          title: `“${channel.sessionName}” is not connected`,
          detail:
            channel.status === 'waiting_qr'
              ? 'This number is waiting for a QR code scan.'
              : 'Messages to this number will not arrive until it reconnects.',
          href: '/channels/whatsapp',
          cta: 'Repair',
          tone: channel.status === 'failed' ? 'danger' : 'warning',
        })
      }
    }

    if (bots.length === 0) {
      issues.push({
        title: 'No AI bot yet',
        detail: 'A bot holds the instructions the AI answers with.',
        href: '/bots/new',
        cta: 'Create bot',
        tone: 'warning',
      })
    } else if (!fallback.bot) {
      issues.push({
        title: 'No default bot',
        detail:
          'Conversations without their own bot will not get an AI reply until a default is chosen.',
        href: '/automation/replies',
        cta: 'Choose default',
        tone: 'warning',
      })
    } else if (fallback.conflict) {
      issues.push({
        title: 'Two bots are marked as the default',
        detail: `Reply settings select “${fallback.bot.name}”, while “${fallback.conflict.name}” still carries the older default flag. “${fallback.bot.name}” is the one that answers.`,
        href: '/automation/replies',
        cta: 'Review',
        tone: 'warning',
      })
    }

    if (!aiEnabled) {
      issues.push({
        title: 'AI replies are paused',
        detail: 'Messages still arrive and you can still reply manually.',
        href: '/automation/replies',
        cta: 'Review',
        tone: 'warning',
      })
    }
  }

  return (
    <PageBody width="content">
      <PageHeader
        title="Overview"
        description="What needs your attention, and what the AI will do next."
        actions={
          <LinkButton href="/inbox" variant="primary" size="md">
            <InboxIcon size={15} />
            Open Inbox
          </LinkButton>
        }
      />

      {statusStale && <StaleNotice at={null} onRetry={refresh} />}

      {statusError && !status && (
        <Panel className="mb-6">
          <ErrorState
            title="Could not load your workspace status"
            detail={`${statusError} Your settings and conversations have not been changed.`}
            onRetry={refresh}
          />
        </Panel>
      )}

      {statusLoading && !status && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {status && (
        <div className="space-y-6">
          {/* ── Setup checklist, only while something is genuinely missing ── */}
          {!setupComplete && (
            <Panel>
              <PanelHeader
                title="Finish setting up"
                description="Complete these in any order. Progress is read from what you have saved."
              />
              <ol className="list-none">
                <ChecklistItem
                  done={bots.length > 0}
                  title="Create an AI bot"
                  detail="Write the instructions the AI answers with."
                  href={bots.length > 0 ? '/bots' : '/bots/new'}
                  cta="Create bot"
                />
                <ChecklistItem
                  done={connected > 0}
                  title="Connect a WhatsApp number"
                  detail="Scan a QR code from the WhatsApp app on the business phone."
                  href="/channels/whatsapp"
                  cta="Connect number"
                />
                <ChecklistItem
                  done={aiEnabled}
                  title="Enable AI replies"
                  detail="Turns on automatic replies for conversations that are set to AI."
                  href="/automation/replies"
                  cta="Open settings"
                />
                <li className="flex items-start gap-3 px-4 py-3.5 md:px-5">
                  <span
                    className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-line-strong/60 bg-inset"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">Verify with a real message</p>
                    <p className="mt-0.5 text-sm leading-5 text-ink-muted">
                      Message your business number from another WhatsApp account and read the reply
                      in Inbox.{' '}
                      {openCount > 0
                        ? `${openCount} open ${openCount === 1 ? 'conversation is' : 'conversations are'} waiting there.`
                        : 'No conversations have arrived yet.'}{' '}
                      This step is checked by you, not by the app.
                    </p>
                  </div>
                  <LinkButton href="/inbox" size="sm" variant="secondary" className="shrink-0">
                    Open Inbox
                  </LinkButton>
                </li>
              </ol>
            </Panel>
          )}

          {/* ── Known issues lead. Never a blanket "all systems operational". ── */}
          {issues.length > 0 && (
            <Panel>
              <PanelHeader
                title={`${issues.length} ${issues.length === 1 ? 'thing needs' : 'things need'} attention`}
                description="Each one names the number, bot or setting it is about."
              />
              <ul>
                {issues.map((issue, i) => (
                  <li key={i}>
                    <Link
                      href={issue.href}
                      className="group flex items-start gap-3 border-b border-line-soft px-4 py-3.5 transition-colors last:border-0 hover:bg-hover md:px-5"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          issue.tone === 'danger' ? 'bg-danger' : 'bg-warning'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{issue.title}</span>
                        <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
                          {issue.detail}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-action">
                        {issue.cta}
                        <ChevronRight size={14} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {issues.length === 0 && setupComplete && (
            <Banner tone="success" title="No known issues">
              Every connected number reported a working connection when it was last checked, and AI
              replies are enabled. This reflects the last status the gateway reported — it is not a
              live guarantee.
            </Banner>
          )}

          {/* ── Today's work ── */}
          <Panel>
            <PanelHeader
              title="Open conversations"
              description="The most recent conversations still waiting to be resolved."
              action={
                <LinkButton href="/inbox" size="sm" variant="ghost">
                  View all
                  <ChevronRight size={14} />
                </LinkButton>
              }
            />
            {conversations.loading && !conversations.data ? (
              <div className="p-4 md:p-5">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : conversations.error ? (
              <ErrorState
                title="Could not load conversations"
                detail="Your saved conversations have not been changed."
                onRetry={conversations.refresh}
              />
            ) : (conversations.data?.length ?? 0) === 0 ? (
              <EmptyState
                title={connected > 0 ? 'Ready for your first conversation' : 'No conversations yet'}
                description={
                  connected > 0
                    ? 'Send a message to your connected business number from another WhatsApp account.'
                    : 'Incoming messages will appear here once a number is connected.'
                }
                action={
                  connected > 0 ? undefined : (
                    <LinkButton href="/channels/whatsapp" size="sm" variant="secondary">
                      Connect number
                    </LinkButton>
                  )
                }
              />
            ) : (
              <ul>
                {conversations.data!.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/inbox?c=${c.id}`}
                      className="flex items-start gap-3 border-b border-line-soft px-4 py-3.5 transition-colors last:border-0 hover:bg-hover md:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="truncate text-sm font-medium text-ink">
                            {contactLabel(c.contactName, c.contactPhone)}
                          </span>
                          {c.lastMessageAt && (
                            <time
                              dateTime={c.lastMessageAt}
                              title={new Date(c.lastMessageAt).toLocaleString()}
                              className="text-xs text-ink-soft tabular-nums"
                            >
                              {timeAgo(c.lastMessageAt)}
                            </time>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink-muted">
                          {c.lastMessagePreview ?? 'No messages yet'}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <ModeBadge mode={c.mode} />
                        {c.waSessionName && <ChannelTag name={c.waSessionName} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ── Configuration summary, last: supporting, not leading ── */}
          <Panel>
            <PanelHeader title="How replies are set up" />
            <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">
              <div>
                <p className="text-xs text-ink-soft">AI replies</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={aiEnabled ? 'success' : 'warning'} dot>
                    {aiEnabled ? 'Enabled' : 'Paused'}
                  </Badge>
                  <Link href="/automation/replies" className="text-[13px] font-medium text-action hover:underline">
                    Change
                  </Link>
                </div>
                <p className="mt-1.5 text-xs leading-4 text-ink-soft">
                  This gates automatic replies only. Manual replies and campaigns are unaffected.
                </p>
              </div>

              <div>
                <p className="text-xs text-ink-soft">Default bot</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {fallback.bot?.name ?? 'None selected'}
                  </span>
                  <Link href="/bots" className="text-[13px] font-medium text-action hover:underline">
                    Manage bots
                  </Link>
                </div>
                <p className="mt-1.5 text-xs leading-4 text-ink-soft">
                  {fallback.bot
                    ? fallback.source === 'flag'
                      ? 'Selected by the bot’s own default flag rather than reply settings.'
                      : 'Used when a conversation or contact has no bot of its own.'
                    : 'Conversations without their own bot will not receive an AI reply.'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-ink-soft">
                  WhatsApp numbers ({connected} of {channels.length} reported connected)
                </p>
                {channels.length === 0 ? (
                  <p className="mt-1.5 text-sm text-ink-muted">None added yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {channels.map((channel) => (
                      <li key={channel.id} className="flex items-center gap-2">
                        <ChannelTag name={channel.sessionName} />
                        <ChannelStatusBadge status={channel.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </PageBody>
  )
}

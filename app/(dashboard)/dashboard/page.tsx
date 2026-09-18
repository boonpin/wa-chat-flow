'use client'

import Link from 'next/link'
import { BusinessValue } from '@/components/business-value'
import type { ImpactReport } from '@/lib/reports/impact-types'
import { useCallback, useState } from 'react'
import {
  Badge,
  Button,
  ConfirmDialog,
  errorMessage,
  useToast,
  Banner,
  ChannelStatusBadge,
  ChannelTag,
  CheckIcon,
  ChevronRight,
  Disclosure,
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
import { AUTO_REPLY_MODE_COPY, repliesToExisting } from '@/lib/settings/auto-reply'

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
  const {
    status,
    loading: statusLoading,
    error: statusError,
    stale: statusStale,
    refresh,
  } = useWorkspaceStatus()

  const loadConversations = useCallback(
    (signal: AbortSignal) =>
      request<ConversationRow[]>('/api/conversations?status=open&limit=6', { signal }),
    [],
  )
  const conversations = useAsyncData(loadConversations, [loadConversations], { pollMs: 30_000 })

  const loadValue = useCallback(
    (signal: AbortSignal) => request<ImpactReport>('/api/reports/impact?range=30', { signal }),
    [],
  )
  const value = useAsyncData(loadValue, [loadValue], { pollMs: 30_000 })
  const loadQueue = useCallback(
    (signal: AbortSignal) =>
      request<{ counts: { attention: number } }>('/api/conversations?view=queue&limit=1', {
        signal,
      }),
    [],
  )
  const queue = useAsyncData(loadQueue, [loadQueue], { pollMs: 30_000 })
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pausing, setPausing] = useState(false)
  const { toast } = useToast()
  async function pauseAll() {
    setPausing(true)
    try {
      await request('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReplyMode: 'off' }),
      })
      refresh()
      queue.refresh()
      setPauseOpen(false)
      toast('AI replies paused for everyone. Your team can still reply in Inbox.')
    } catch (error) {
      toast(errorMessage(error, 'Could not pause AI replies.'), 'error')
    } finally {
      setPausing(false)
    }
  }
  const fallback = resolveFallbackBot(status)
  const channels = status?.channels ?? []
  const connected = countConnected(channels)
  const bots = status?.bots ?? []
  const autoReplyMode = status?.settings.autoReplyMode ?? 'off'
  const replyPolicy = AUTO_REPLY_MODE_COPY[autoReplyMode] ?? AUTO_REPLY_MODE_COPY.off
  const aiAnswersSomething = repliesToExisting(autoReplyMode)
  const openCount = conversations.data?.length ?? 0

  const setupComplete = bots.length > 0 && connected > 0 && aiAnswersSomething

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
        title: 'No AI assistant yet',
        detail: 'A assistant holds the instructions the AI answers with.',
        href: '/bots/new',
        cta: 'Add assistant',
        tone: 'warning',
      })
    } else if (!fallback.bot) {
      issues.push({
        title: 'No default assistant',
        detail:
          'Conversations without their own assistant will not get an AI reply until a default is chosen.',
        href: '/automation/replies',
        cta: 'Choose default',
        tone: 'warning',
      })
    } else if (fallback.conflict) {
      issues.push({
        title: 'Two assistants are marked as the default',
        detail: `Reply settings select “${fallback.bot.name}”, while “${fallback.conflict.name}” still carries the older default flag. “${fallback.bot.name}” is the one that answers.`,
        href: '/automation/replies',
        cta: 'Review',
        tone: 'warning',
      })
    }

    if (autoReplyMode === 'off') {
      issues.push({
        title: 'AI replies are off',
        detail: 'Messages still arrive and you can still reply manually.',
        href: '/automation/replies',
        cta: 'Review',
        tone: 'warning',
      })
    } else if (autoReplyMode === 'existing') {
      // A deliberate setting, listed anyway: it is the one policy that looks
      // like everything is working while every new customer goes unanswered.
      issues.push({
        title: 'New conversations are not answered automatically',
        detail:
          'AI replies are limited to conversations that were already running. Anyone writing in for the first time waits for a person.',
        href: '/automation/replies',
        cta: 'Review',
        tone: 'warning',
      })
    }
  }

  return (
    <PageBody width="content">
      <PageHeader
        title="Dashboard"
        description="What needs your attention, and what the AI will do next."
        actions={
          <div className="flex flex-wrap gap-2">
            {status && autoReplyMode !== 'off' && (
              <Button variant="secondary" onClick={() => setPauseOpen(true)}>
                Pause all AI replies
              </Button>
            )}
            <LinkButton href="/inbox" variant="primary" size="md">
              <InboxIcon size={15} />
              Open Inbox
            </LinkButton>
          </div>
        }
      />

      <ConfirmDialog
        open={pauseOpen}
        onClose={() => {
          if (!pausing) setPauseOpen(false)
        }}
        onConfirm={pauseAll}
        pending={pausing}
        title="Pause AI replies for everyone?"
        description="Customers can still send messages. Your team will need to answer them in Inbox. A message already sending may still arrive. Resume from Automatic replies when ready."
        confirmLabel="Pause all AI replies"
        pendingLabel="Pausing…"
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
          {/* ── Known issues lead. Never a blanket "all systems operational". ── */}
          {issues.length > 0 && (
            <Panel>
              <PanelHeader
                title={`${issues.length} ${issues.length === 1 ? 'thing needs' : 'things need'} attention`}
                description="Each one names the number, assistant or setting it is about."
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
              Your WhatsApp numbers last reported connected. AI replies are enabled.
            </Banner>
          )}

          {queue.error && (
            <ErrorState
              title="Could not check conversations needing attention"
              onRetry={queue.refresh}
            />
          )}
          {queue.stale && <StaleNotice at={queue.loadedAt} onRetry={queue.refresh} />}
          {queue.data && (
            <Banner
              tone={queue.data.counts.attention ? 'warning' : 'info'}
              title={
                queue.data.counts.attention
                  ? `${queue.data.counts.attention} conversations need your team`
                  : 'No conversations need your team right now'
              }
            >
              <Link href="/inbox" className="font-semibold text-action underline">
                Open inbox
              </Link>
            </Banner>
          )}
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
                  title="Set up your AI assistant"
                  detail="Write the instructions the AI answers with."
                  href="/settings/business"
                  cta="Add assistant"
                />
                <ChecklistItem
                  done={connected > 0}
                  title="Connect a WhatsApp number"
                  detail="Scan a QR code from the WhatsApp app on the business phone."
                  href="/channels/whatsapp"
                  cta="Connect number"
                />
                <ChecklistItem
                  done={aiAnswersSomething}
                  title="Turn on AI replies"
                  detail="Chooses how much the AI answers: everything, only conversations already running, or nothing."
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

          {value.stale && <StaleNotice at={value.loadedAt} onRetry={value.refresh} />}
          {value.loading && !value.data ? (
            <Skeleton className="h-56 w-full" />
          ) : value.error ? (
            <ErrorState title="Could not load time and costs" onRetry={value.refresh} />
          ) : (
            value.data && <BusinessValue report={value.data} />
          )}
          {/* ── Today's work ── */}
          <Panel>
            <PanelHeader
              title="Recent open conversations"
              description="The most recent conversations still open."
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
          <Disclosure summary="How replies are set up">
            <Panel>
              <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-5">
                <div>
                  <p className="text-xs text-ink-soft">AI replies</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant={replyPolicy.tone} dot>
                      {replyPolicy.label}
                    </Badge>
                    <Link
                      href="/automation/replies"
                      className="text-[13px] font-medium text-action hover:underline"
                    >
                      Change
                    </Link>
                  </div>
                  <p className="mt-1.5 text-xs leading-4 text-ink-soft">
                    {replyPolicy.detail} Manual replies and campaigns are unaffected.
                  </p>
                </div>

                <div>
                  <p className="text-xs text-ink-soft">Default agent</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {fallback.bot?.name ?? 'None selected'}
                    </span>
                    <Link
                      href="/bots"
                      className="text-[13px] font-medium text-action hover:underline"
                    >
                      Manage AI agents
                    </Link>
                  </div>
                  <p className="mt-1.5 text-xs leading-4 text-ink-soft">
                    {fallback.bot
                      ? fallback.source === 'flag'
                        ? 'Used when no assistant is selected for the customer or conversation.'
                        : 'Used when a conversation or contact has no assistant of its own.'
                      : 'Conversations without their own assistant will not receive an AI reply.'}
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
          </Disclosure>
        </div>
      )}
    </PageBody>
  )
}

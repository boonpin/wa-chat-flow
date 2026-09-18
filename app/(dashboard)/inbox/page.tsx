'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Badge,
  Banner,
  Button,
  ChannelTag,
  Drawer,
  Select,
  Switch,
  EmptyState,
  ErrorState,
  HttpError,
  IconButton,
  InboxIcon,
  LifecycleBadge,
  ModeBadge,
  Panel,
  ReplyStatusLine,
  SearchInput,
  SegmentedControl,
  Skeleton,
  SkeletonRows,
  StaleNotice,
  contactLabel,
  deriveBlockers,
  errorMessage,
  request,
  timeAgo,
  useAsyncData,
  useToast,
  type ChannelStatus,
} from '@/components/ui'
import { Composer, Transcript, type TranscriptMessage } from '@/components/transcript'
import { resolveFallbackBot, useWorkspaceStatus } from '@/components/workspace-status'

const POLL_MS = 5000
/** Server filtering and totals cover every matching conversation. */
const LIST_LIMIT = 25

type StatusFilter = 'attention' | 'open' | 'resolved' | 'all'
type ModeFilter = 'all' | 'auto' | 'human'

interface ConversationSummary {
  id: string
  contactId: string
  contactName: string | null
  contactPhone: string
  waSessionId: string | null
  waSessionName: string | null
  botId: string | null
  botName: string | null
  mode: 'auto' | 'human'
  status: 'open' | 'resolved'
  lastMessageAt: string | null
  lastMessagePreview: string | null
  attentionReason: string | null
  waitingSince: string | null
  replyVersion: number
}

interface ConversationDetail {
  conversation: ConversationSummary
  contact: {
    id: string
    name: string | null
    phoneNumber: string
    aiEnabled: boolean
    aiBotId: string | null
  } | null
  waSessionName: string | null
  messages: TranscriptMessage[]
}

/* ─── Conversation list ─────────────────────────────────────────────────────── */

function ConversationRow({
  conversation,
  active,
  hasDraft,
  onSelect,
}: {
  conversation: ConversationSummary
  active: boolean
  hasDraft: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={`w-full cursor-pointer border-l-2 px-4 py-3 text-left transition-colors
          duration-[--duration-control] ${
            active ? 'border-action bg-selected' : 'border-transparent hover:bg-hover'
          }`}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {contactLabel(conversation.contactName, conversation.contactPhone)}
          </span>
          {conversation.lastMessageAt && (
            <time
              dateTime={conversation.lastMessageAt}
              title={new Date(conversation.lastMessageAt).toLocaleString()}
              className="shrink-0 text-xs text-ink-soft tabular-nums"
            >
              {timeAgo(conversation.lastMessageAt)}
            </time>
          )}
        </span>

        {/* No "You:" prefix. The list response carries direction but not sender
            type, so labelling every outgoing preview as a person was wrong for
            every AI reply. */}
        <span className="mt-0.5 block truncate text-sm text-ink-muted">
          {conversation.lastMessagePreview ?? (
            <span className="text-ink-soft italic">No messages yet</span>
          )}
        </span>

        {conversation.attentionReason && (
          <span className="mt-1 block text-xs font-medium text-warning">
            {conversation.attentionReason}
            {conversation.waitingSince ? ` · ${timeAgo(conversation.waitingSince)}` : ''}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <ModeBadge mode={conversation.mode} />
          {conversation.status === 'resolved' && <LifecycleBadge status="resolved" />}
          {hasDraft && <Badge variant="warning">Unsent draft</Badge>}
          {conversation.waSessionName && <ChannelTag name={conversation.waSessionName} />}
        </span>
      </button>
    </li>
  )
}

/* ─── Thread ───────────────────────────────────────────────────────────────── */

function Thread({
  conversationId,
  draft,
  onDraftChange,
  onChanged,
  onBack,
}: {
  conversationId: string
  draft: string
  onDraftChange: (next: string) => void
  onChanged: () => void
  onBack: () => void
}) {
  const { toast } = useToast()
  const { status: workspace } = useWorkspaceStatus()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'mode' | 'status' | 'bot' | null>(null)
  // Phone only: the controls start folded so the transcript — the reason
  // anyone opened the thread — is not pushed off the screen. From md up they
  // are always visible and this state is ignored.
  const [controlsOpen, setControlsOpen] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(
    (signal: AbortSignal) =>
      request<ConversationDetail>(`/api/conversations/${conversationId}`, { signal }),
    [conversationId],
  )
  const { data, loading, error, stale, refresh } = useAsyncData(load, [load], {
    pollMs: POLL_MS,
  })

  const followMessages = useRef(true)
  const lastMessageId = data?.messages.at(-1)?.id
  const messageCount = data?.messages.length ?? 0
  useEffect(() => {
    if (followMessages.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messageCount, lastMessageId, conversationId])

  async function patch(
    body: Record<string, unknown>,
    action: 'mode' | 'status' | 'bot',
    success: string,
  ) {
    setPendingAction(action)
    try {
      const result = await request<{ sendInProgress?: boolean }>(
        `/api/conversations/${conversationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, expectedVersion: data?.conversation.replyVersion }),
        },
      )
      toast(
        result.sendInProgress
          ? `${success} An AI message was already sending; check the transcript.`
          : success,
      )
      if (action === 'mode' && body.mode === 'human')
        requestAnimationFrame(() => composerRef.current?.focus())
      refresh()
      onChanged()
    } catch (e) {
      toast(errorMessage(e, 'The change was not saved. Nothing was altered.'), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    try {
      await request(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, expectedVersion: data?.conversation.replyVersion }),
      })
      followMessages.current = true
      onDraftChange('')
      refresh()
      onChanged()
    } catch (e) {
      // The draft stays exactly where it is; the failure is stated inline
      // rather than in a toast that vanishes before it can be acted on.
      const message = errorMessage(e, 'Could not send this message.')
      setSendError(
        e instanceof HttpError && e.status === 502
          ? `${message} The message may still have reached WhatsApp — check the conversation before sending again.`
          : message,
      )
    } finally {
      setSending(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="flex-1" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <ErrorState
          title="Could not open this conversation"
          detail={`${error ?? 'It may have been resolved or removed.'} No messages have been changed.`}
          onRetry={refresh}
        />
      </div>
    )
  }

  const { conversation, contact } = data
  const isAuto = conversation.mode === 'auto'
  const fallback = resolveFallbackBot(workspace)
  const effectiveBot =
    [conversation.botId]
      .map((id) => workspace?.bots.find((b) => b.id === id && b.enabled))
      .find(Boolean) ?? fallback.bot
  const boundBot = effectiveBot && effectiveBot.id === conversation.botId ? effectiveBot : null

  const channel = workspace?.channels.find((c) => c.id === conversation.waSessionId) ?? null

  const blockers = deriveBlockers({
    autoReplyMode: workspace?.settings.autoReplyMode ?? 'off',
    mode: conversation.mode,
    channelStatus: (channel?.status ??
      (conversation.waSessionId ? 'unknown' : null)) as ChannelStatus | null,
    botName: effectiveBot?.name ?? null,
    botEnabled: effectiveBot?.enabled,
    botProviderMissing: effectiveBot ? !effectiveBot.providerId : false,
    botProviderEnabled: effectiveBot?.providerEnabled ?? undefined,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-3 py-3 md:px-4">
        <div className="flex items-start gap-2">
          <IconButton
            label="Back to conversations"
            size="sm"
            onClick={onBack}
            className="lg:hidden"
          >
            <ArrowLeft size={16} />
          </IconButton>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-ink">
              {contactLabel(contact?.name, contact?.phoneNumber)}
            </h2>
            <p className="truncate text-xs text-ink-soft">
              {contact?.phoneNumber}
              {data.waSessionName && ` · received on ${data.waSessionName}`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LifecycleBadge status={conversation.status} />
            <Button
              size="sm"
              variant={conversation.status === 'resolved' ? 'secondary' : 'primary'}
              pending={pendingAction === 'status'}
              pendingLabel="Saving…"
              onClick={() =>
                patch(
                  { status: conversation.status === 'resolved' ? 'open' : 'resolved' },
                  'status',
                  conversation.status === 'resolved'
                    ? 'Conversation reopened.'
                    : 'Conversation marked as done. Your draft is still here.',
                )
              }
            >
              {conversation.status === 'resolved' ? 'Reopen' : 'Mark as done'}
            </Button>
          </div>
        </div>

        <ReplyStatusLine
          className="mt-3"
          channel={
            conversation.waSessionId
              ? {
                  name: data.waSessionName ?? conversation.waSessionName,
                  status: (channel?.status ?? 'unknown') as ChannelStatus,
                }
              : null
          }
          mode={conversation.mode}
          bot={{
            name: effectiveBot?.name ?? null,
            note: boundBot
              ? 'chosen for this conversation'
              : effectiveBot
                ? 'workspace default'
                : undefined,
          }}
          blockers={blockers}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant={isAuto ? 'primary' : 'secondary'}
            pending={pendingAction === 'mode'}
            pendingLabel="Saving…"
            onClick={() =>
              patch(
                { mode: isAuto ? 'human' : 'auto' },
                'mode',
                isAuto
                  ? 'Your team is replying. AI replies are paused for this conversation.'
                  : 'AI replies are on for this conversation.',
              )
            }
            disabled={
              !isAuto &&
              (workspace?.settings.autoReplyMode === 'off' || conversation.status === 'resolved')
            }
          >
            {isAuto ? 'Take over' : 'Let AI reply'}
          </Button>
          <Button variant="ghost" onClick={() => setControlsOpen(true)}>
            Customer details
          </Button>
        </div>
        <p className="mt-2 text-xs leading-4 text-ink-muted">
          {isAuto
            ? 'Take over to reply yourself. This does not change this customer’s future conversations.'
            : 'Your team is replying. Hand back to AI to answer any waiting message, or wait for the next enquiry.'}
        </p>
        <Drawer
          open={controlsOpen}
          onClose={() => setControlsOpen(false)}
          title="Customer details"
          description={contact?.phoneNumber}
        >
          <div className="space-y-5">
            <Select
              label="Agent for this conversation"
              value={conversation.botId ?? ''}
              disabled={pendingAction !== null}
              onChange={(e) =>
                patch({ botId: e.target.value }, 'bot', 'Agent updated for this conversation.')
              }
            >
              <option value="">Use the customer’s default agent</option>
              {(workspace?.bots ?? []).map((bot) => (
                <option key={bot.id} value={bot.id} disabled={!bot.enabled}>
                  {bot.name}
                  {!bot.enabled ? ' (turned off)' : ''}
                </option>
              ))}
            </Select>
            <div className="flex items-start gap-3">
              <Switch
                checked={contact?.aiEnabled ?? false}
                label="Use AI for this customer’s new conversations"
                onChange={async (aiEnabled) => {
                  try {
                    await request(`/api/contacts/${conversation.contactId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ aiEnabled }),
                    })
                    toast('Preference saved for new conversations.')
                    refresh()
                  } catch (error) {
                    toast(errorMessage(error, 'Could not save preference.'), 'error')
                  }
                }}
              />
              <p className="text-sm">
                Use AI for this customer’s new conversations
                <span className="mt-1 block text-xs text-ink-muted">
                  Subject to Automatic replies settings. This conversation is unchanged.
                </span>
              </p>
            </div>
            <Link
              href={`/contacts?contact=${conversation.contactId}`}
              className="text-sm font-medium text-action underline"
            >
              View contact profile and history
            </Link>
          </div>
        </Drawer>
      </div>

      {stale && (
        <div className="px-3 pt-2 md:px-4">
          <StaleNotice at={null} onRetry={refresh} />
        </div>
      )}

      <Transcript
        messages={data.messages}
        scrollRef={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
      />

      <Composer
        value={draft}
        onChange={onDraftChange}
        onSend={send}
        sending={sending}
        inputRef={composerRef}
        sendLabel={isAuto ? 'Take over and send' : 'Send'}
        disabled={pendingAction !== null}
        notice={
          sendError ? (
            <Banner tone="danger" title="Send needs checking">
              {sendError} Your text is still in the box below.
            </Banner>
          ) : isAuto ? (
            <p className="rounded-md bg-info-bg px-2.5 py-1.5 text-xs leading-4 text-info">
              Sending your reply takes over this conversation and pauses AI replies.
            </p>
          ) : null
        }
      />
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

function InboxWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const { status: workspace } = useWorkspaceStatus()

  const selectedId = params.get('c')
  const statusFilter = (params.get('status') as StatusFilter) ?? 'attention'
  const modeFilter = (params.get('mode') as ModeFilter) ?? 'all'
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  // Drafts live at page level and are keyed by conversation, so switching
  // threads, filtering one out or resolving it never destroys unsent text.
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    const unsent = Object.values(drafts).some((d) => d.trim())
    if (!unsent) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drafts])

  const query = useMemo(() => {
    const q = new URLSearchParams()
    q.set('view', 'queue')
    q.set('page', params.get('page') ?? '1')
    if (statusFilter === 'attention') {
      q.set('attention', 'true')
      q.set('status', 'open')
    } else if (statusFilter !== 'all') q.set('status', statusFilter)
    if (modeFilter !== 'all') q.set('mode', modeFilter)
    if (debounced) q.set('search', debounced)
    q.set('limit', String(LIST_LIMIT))
    return q.toString()
  }, [statusFilter, debounced, modeFilter, params])

  const load = useCallback(
    (signal: AbortSignal) =>
      request<{
        rows: ConversationSummary[]
        total: number
        page: number
        lastPage: number
        counts: { attention: number; open: number; done: number }
      }>(`/api/conversations?${query}`, { signal }),
    [query],
  )
  const list = useAsyncData(load, [load], { pollMs: POLL_MS })

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    router.replace(`/inbox?${next.toString()}`, { scroll: false })
  }

  const conversations = useMemo(() => {
    const rows = list.data?.rows ?? []
    return modeFilter === 'all' ? rows : rows.filter((c) => c.mode === modeFilter)
  }, [list.data, modeFilter])

  // Selection is independent of the filters: a conversation you are reading
  // does not disappear because you resolved it or narrowed the list.
  const selectedInList = selectedId ? conversations.some((c) => c.id === selectedId) : false
  const filtersActive = statusFilter !== 'attention' || modeFilter !== 'all' || debounced !== ''

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height))] flex-col md:h-dvh">
      <div
        className={`shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-6 ${selectedId ? 'hidden lg:block' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-ink md:text-title">
              Inbox
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              See which customers need your team and take over when needed.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4 md:px-6 md:pb-6">
        <Panel className="flex h-full overflow-hidden">
          {/* List pane. On a phone it is the whole screen until a thread opens. */}
          <div
            className={`flex min-w-0 flex-col border-line lg:w-[288px] lg:shrink-0 lg:border-r xl:w-[320px] ${
              selectedId ? 'hidden lg:flex' : 'flex w-full'
            }`}
          >
            <div className="shrink-0 space-y-2.5 border-b border-line p-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                label="Search conversations by name or number"
                placeholder="Search name or number"
              />
              <div className="flex flex-wrap gap-2">
                <SegmentedControl
                  label="Conversation status"
                  value={statusFilter}
                  onChange={(v) => {
                    const next = new URLSearchParams(params.toString())
                    next.set('status', v)
                    next.delete('page')
                    router.replace(`/inbox?${next}`, { scroll: false })
                  }}
                  options={[
                    {
                      value: 'attention',
                      label: `Needs attention ${list.data?.counts.attention ?? ''}`,
                    },
                    { value: 'open', label: 'All open' },
                    { value: 'resolved', label: 'Done' },
                  ]}
                />
                <SegmentedControl
                  label="Who replies"
                  value={modeFilter}
                  onChange={(v) => setParam('mode', v === 'all' ? null : v)}
                  options={[
                    { value: 'all', label: 'Everyone' },
                    { value: 'auto', label: 'AI' },
                    { value: 'human', label: 'Your team' },
                  ]}
                />
              </div>
            </div>

            {list.stale && (
              <div className="p-2">
                <StaleNotice at={list.loadedAt} onRetry={list.refresh} />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.loading && !list.data ? (
                <SkeletonRows rows={6} />
              ) : list.error ? (
                <ErrorState
                  title="Could not load conversations"
                  detail="Your saved conversations have not been changed."
                  onRetry={list.refresh}
                />
              ) : conversations.length === 0 ? (
                <EmptyState
                  title={
                    list.data?.counts.open === 0 && list.data?.counts.done === 0 && !debounced
                      ? 'No customer messages yet'
                      : statusFilter === 'attention' &&
                          !debounced &&
                          list.data?.counts.attention === 0
                        ? 'No conversations need your team right now'
                        : debounced
                          ? 'No matching conversations'
                          : statusFilter === 'open'
                            ? 'No open conversations'
                            : 'No conversations here'
                  }
                  description={
                    debounced
                      ? 'Try another name or number, or clear your filters.'
                      : statusFilter === 'open'
                        ? 'Done conversations are still available.'
                        : 'Incoming messages start a conversation automatically.'
                  }
                  action={
                    list.data?.counts.open === 0 &&
                    list.data?.counts.done === 0 &&
                    workspace?.channels.length === 0 ? (
                      <Link
                        href="/channels/whatsapp"
                        className="text-sm font-semibold text-action underline"
                      >
                        Connect your WhatsApp number
                      </Link>
                    ) : filtersActive ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch('')
                          router.replace(selectedId ? `/inbox?c=${selectedId}` : '/inbox', {
                            scroll: false,
                          })
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ul className="divide-y divide-line-soft">
                    {conversations.map((c) => (
                      <ConversationRow
                        key={c.id}
                        conversation={c}
                        active={c.id === selectedId}
                        hasDraft={!!drafts[c.id]?.trim()}
                        onSelect={() => setParam('c', c.id)}
                      />
                    ))}
                  </ul>
                  <p className="px-4 py-3 text-xs text-ink-soft">
                    {list.data?.total ?? 0} matching conversations · Page {list.data?.page ?? 1} of{' '}
                    {list.data?.lastPage ?? 1}
                  </p>
                  <div className="flex justify-between gap-2 px-3 pb-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!list.data || list.data.page <= 1}
                      onClick={() => setParam('page', String((list.data?.page ?? 1) - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!list.data || list.data.page >= list.data.lastPage}
                      onClick={() => setParam('page', String((list.data?.page ?? 1) + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Thread pane */}
          <div className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
            {selectedId ? (
              <>
                {!selectedInList && !list.loading && (
                  <div className="border-b border-line bg-warning-bg px-4 py-2 text-xs text-warning">
                    This conversation is outside your current filters. It stays open until you
                    choose another one.
                  </div>
                )}
                <Thread
                  key={selectedId}
                  conversationId={selectedId}
                  draft={drafts[selectedId] ?? ''}
                  onDraftChange={(next) => setDrafts((d) => ({ ...d, [selectedId]: next }))}
                  onChanged={list.refresh}
                  onBack={() => setParam('c', null)}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={<InboxIcon size={22} />}
                  title="Choose a conversation"
                  description="Read the messages and check who will reply next."
                />
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <InboxWorkspace />
    </Suspense>
  )
}

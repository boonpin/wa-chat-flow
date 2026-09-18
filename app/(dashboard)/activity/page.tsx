'use client'
import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Badge,
  Button,
  CaptureStatusBadge,
  Disclosure,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  KeyValues,
  LinkButton,
  MessageStatusBadge,
  PageBody,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  SkeletonRows,
  StaleNotice,
  contactLabel,
  fullTimestamp,
  timeAgo,
  request,
  useAsyncData,
} from '@/components/ui'
import { CaptureDetail, type Invocation } from '@/components/capture-detail'
import type { ActivityEvent } from '@/lib/conversation/activity'
interface ContactGroup {
  id: string
  contactName: string | null
  contactPhone: string | null
  createdAt: string
  events: number
  failures: number
  conversations: number
  numbers: string[]
  hasUsage: boolean
  costMicros: number | null
}
interface ActivityData {
  view: string
  rows: (ContactGroup | ActivityEvent)[]
  total: number
  nextCursor: string | null
  period: { from: string; to: string }
  conversations?: { id: string; sessionName: string | null }[]
  currency?: string
}
const KINDS: Record<string, string> = {
  customer: 'Customer message',
  ai: 'AI reply',
  team: 'Team reply',
  capture: 'Saved customer details',
  usage: 'AI usage',
  preview_usage: 'Question preview usage',
  capture_retry: 'Google Sheets retry',
  ai_started: 'AI preparing a reply',
  ai_suppressed: 'AI reply stopped',
  mode_changed: 'Reply responsibility',
  status_changed: 'Conversation status',
  system: 'System event',
}
function Detail({ event, refresh }: { event: ActivityEvent; refresh: () => void }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Record<string, unknown> & { invocation?: Invocation }>(
        event.id.startsWith('message:')
          ? `/api/messages/${event.sourceId}`
          : `/api/activity/${encodeURIComponent(event.id)}`,
        { signal },
      ),
    [event],
  )
  const detail = useAsyncData(load, [load])
  return detail.loading && !detail.data ? (
    <SkeletonRows />
  ) : detail.error ? (
    <ErrorState title="Could not load details" onRetry={detail.refresh} />
  ) : detail.data?.invocation ? (
    <CaptureDetail
      invocation={detail.data.invocation}
      onSynced={() => {
        detail.refresh()
        refresh()
      }}
    />
  ) : (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap text-sm">{event.detail || 'No text recorded'}</p>
      {typeof detail.data?.error === 'string' && (
        <p className="text-sm text-danger">{detail.data.error}</p>
      )}
      <Disclosure summary="Technical details">
        <KeyValues
          rows={Object.entries(detail.data ?? {})
            .filter(
              ([key, value]) =>
                !['message', 'content', 'error', 'invocation', 'usageCalls'].includes(key) &&
                value !== null &&
                typeof value !== 'object',
            )
            .map(([key, value]) => [key, String(value)] as [string, string])}
        />
      </Disclosure>
    </div>
  )
}
function ActivityWorkspace() {
  const router = useRouter(),
    params = useSearchParams()
  const [selected, setSelected] = useState<ActivityEvent | null>(null)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const query = params.toString()
  const load = useCallback(
    (signal: AbortSignal) => request<ActivityData>(`/api/activity?${query}`, { signal }),
    [query],
  )
  const data = useAsyncData(load, [load])
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    next.delete('cursor')
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/activity?${next}`, { scroll: false })
  }
  function openContact(id: string) {
    const next = new URLSearchParams(params.toString())
    next.set('contactId', id)
    next.delete('cursor')
    next.delete('conversationId')
    if (data.data) {
      next.set('from', data.data.period.from)
      next.set('to', data.data.period.to)
    }
    router.push(`/activity?${next}`, { scroll: false })
  }
  function nextPage() {
    if (!data.data?.nextCursor) return
    const next = new URLSearchParams(params.toString())
    next.set('cursor', data.data.nextCursor)
    next.set('from', data.data.period.from)
    next.set('to', data.data.period.to)
    router.push(`/activity?${next}`, { scroll: false })
  }
  const timeline = data.data?.view === 'events',
    contactId = params.get('contactId')
  return (
    <PageBody width="wide">
      <PageHeader
        title="Activity"
        description="Message history and troubleshooting. Start with a contact, then inspect what happened in a conversation."
        back={
          contactId
            ? { href: '/activity', label: 'All contacts' }
            : { href: '/settings/technical', label: 'Technical settings' }
        }
        actions={
          <Button variant="secondary" onClick={data.refresh} pending={data.loading && !!data.data}>
            Refresh
          </Button>
        }
      />
      <Panel className="mb-5">
        <div className="grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setParam('search', search)
            }}
          >
            <SearchInput
              label="Search name or phone"
              value={search}
              onChange={setSearch}
              placeholder="Search, then press Enter"
            />
          </form>
          <Select
            label="Date range"
            value={params.get('days') ?? '30'}
            onChange={(e) => {
              const next = new URLSearchParams(params.toString())
              next.set('days', e.target.value)
              next.delete('from')
              next.delete('to')
              next.delete('cursor')
              router.replace(`/activity?${next}`, { scroll: false })
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
          <Input
            label="Business number name"
            value={params.get('session') ?? ''}
            onChange={(e) => setParam('session', e.target.value)}
            placeholder="All numbers"
          />
          <Select
            label="Result"
            value={params.get('result') ?? 'all'}
            onChange={(e) => setParam('result', e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All results</option>
            <option value="failed">Needs investigation</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <LinkButton
            size="sm"
            variant={!params.get('view') ? 'primary' : 'secondary'}
            href="/activity"
          >
            By contact
          </LinkButton>
          <LinkButton
            size="sm"
            variant={params.get('view') === 'events' ? 'primary' : 'secondary'}
            href="/activity?view=events"
          >
            All events
          </LinkButton>
          <LinkButton
            size="sm"
            variant={params.get('view') === 'system' ? 'primary' : 'secondary'}
            href="/activity?view=system"
          >
            System events
          </LinkButton>
        </div>
      </Panel>
      {data.stale && <StaleNotice at={data.loadedAt} onRetry={data.refresh} />}
      {params.get('metric') === 'ai' && (
        <p className="mb-4 text-sm text-ink-muted">
          Evidence: sent AI service replies from{' '}
          {data.data ? fullTimestamp(data.data.period.from) : '…'} to{' '}
          {data.data ? fullTimestamp(data.data.period.to) : '…'}.
        </p>
      )}
      {contactId && data.data?.conversations && (
        <div className="mb-4">
          <Select
            label="Conversation"
            value={params.get('conversationId') ?? ''}
            onChange={(e) => setParam('conversationId', e.target.value || null)}
          >
            <option value="">All conversations for this contact</option>
            {data.data.conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sessionName ?? 'Business number'} · {c.id.slice(0, 8)}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Panel>
        {data.loading && !data.data ? (
          <SkeletonRows />
        ) : data.error ? (
          <ErrorState
            title="Could not load activity"
            detail="Saved history has not changed."
            onRetry={data.refresh}
          />
        ) : !data.data?.rows.length ? (
          <EmptyState
            title="No activity matches these filters"
            description="Try a longer period or clear your filters."
          />
        ) : (
          <>
            {timeline ? (
              <ol className="divide-y divide-line-soft">
                {(data.data.rows as ActivityEvent[]).map((event) => (
                  <li key={event.id} className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {KINDS[event.kind] ?? event.kind}
                      </span>
                      <time dateTime={event.createdAt} className="text-xs text-ink-muted">
                        {fullTimestamp(event.createdAt)}
                      </time>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="neutral">
                        {contactLabel(event.contactName, event.contactPhone) || 'System'}
                      </Badge>
                      {event.sessionName && <Badge variant="neutral">{event.sessionName}</Badge>}
                      {event.kind === 'capture' ? (
                        <CaptureStatusBadge status={event.status} />
                      ) : (
                        <MessageStatusBadge status={event.status} />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">
                      {event.detail || 'No text recorded'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(event)}>
                        View details
                      </Button>
                      {event.conversationId && (
                        <Link
                          href={`/inbox?c=${event.conversationId}&status=all`}
                          className="self-center text-sm text-action underline"
                        >
                          Open in inbox
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="divide-y divide-line-soft">
                {(data.data.rows as ContactGroup[]).map((contact) => (
                  <li key={contact.id}>
                    <button
                      onClick={() => openContact(contact.id)}
                      className="grid w-full cursor-pointer gap-3 p-4 text-left hover:bg-hover sm:grid-cols-[1.4fr_1fr_1fr] md:p-5"
                    >
                      <span>
                        <span className="block text-sm font-semibold">
                          {contactLabel(contact.contactName, contact.contactPhone)}
                        </span>
                        <span className="mt-1 block text-xs text-ink-muted">
                          {contact.contactPhone} · {contact.numbers.join(', ')}
                        </span>
                      </span>
                      <span className="text-sm text-ink-muted">
                        {timeAgo(contact.createdAt)}
                        <span className="mt-1 block text-xs">
                          {contact.conversations} conversations · {contact.events} events
                        </span>
                      </span>
                      <span className="text-sm">
                        {contact.failures ? (
                          <Badge variant="warning">{contact.failures} issues need attention</Badge>
                        ) : (
                          <Badge variant="neutral">No unresolved issues</Badge>
                        )}
                        <span className="mt-1 block text-xs text-ink-muted">
                          AI cost for period:{' '}
                          {!contact.hasUsage
                            ? 'No AI usage'
                            : contact.costMicros === null || contact.costMicros === undefined
                              ? 'Incomplete'
                              : new Intl.NumberFormat(undefined, {
                                  style: 'currency',
                                  currency: data.data?.currency ?? 'MYR',
                                }).format(contact.costMicros / 1000000)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
              <p className="text-xs text-ink-muted">
                {data.data.total} matching {timeline ? 'events' : 'contacts'} ·{' '}
                {params.get('conversationId') ? 'Oldest' : 'Latest'} first. Refresh when you’re
                ready for updates.
              </p>
              <div className="flex gap-2">
                {params.get('cursor') && (
                  <Button variant="secondary" size="sm" onClick={() => setParam('cursor', null)}>
                    First page
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.data.nextCursor}
                  onClick={nextPage}
                >
                  Next page
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Activity details"
        width="wide"
      >
        {selected && <Detail event={selected} refresh={data.refresh} />}
      </Drawer>
    </PageBody>
  )
}
export default function ActivityPage() {
  return (
    <Suspense fallback={<SkeletonRows />}>
      <ActivityWorkspace />
    </Suspense>
  )
}

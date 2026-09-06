'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import {
  ActivityIcon,
  Badge,
  Banner,
  Button,
  Disclosure,
  Drawer,
  EmptyState,
  ErrorState,
  KeyValues,
  MessageStatusBadge,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  RefreshIcon,
  SkeletonRows,
  StaleNotice,
  Table,
  TableScroll,
  Td,
  Th,
  contactLabel,
  fullTimestamp,
  request,
  timeAgo,
  tokenCount,
  useAsyncData,
  type BadgeVariant,
} from '@/components/ui'
import { CaptureDetail, type Invocation } from '@/components/capture-detail'

/** Tokens one reply cost. Null on every row that never called a model. */
interface MessageUsage {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface UsageCall {
  id: string
  round: number
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number | null
  status: string
  error: string | null
}

interface EventRow {
  id: string
  direction: 'incoming' | 'outgoing'
  senderType: 'customer' | 'ai' | 'human' | 'system'
  messageType: string
  message: string
  status: string
  error: string | null
  createdAt: string
  contactId: string
  contactName: string | null
  contactPhone: string | null
  usage: MessageUsage | null
}

interface EventDetail extends EventRow {
  usage: (MessageUsage & { providerName: string | null }) | null
  usageCalls: UsageCall[]
  conversationId: string
  provider: string
  providerMessageId: string | null
  toolInvocationId: string | null
  conversationMode: string | null
  conversationStatus: string | null
  invocation: Invocation | null
}

/** Who or what produced the row. "System" covers events, not people. */
const SENDER: Record<EventRow['senderType'], { label: string; variant: BadgeVariant }> = {
  customer: { label: 'Customer', variant: 'neutral' },
  ai: { label: 'AI', variant: 'ai' },
  human: { label: 'You', variant: 'human' },
  system: { label: 'System', variant: 'neutral' },
}

function describeEvent(row: EventRow): string {
  if (row.messageType === 'tool') {
    const tool = row.message.replace(/^Ran tool:\s*/, '')
    return row.status === 'failed'
      ? `Captured details with ${tool} — sheet sync failed`
      : `Captured details with ${tool} and synced them`
  }
  if (row.senderType === 'system') return row.error ?? 'System event'
  if (row.message) return row.message
  return row.messageType === 'text' ? 'No text content' : `${row.messageType} attachment`
}

/**
 * Tokens for one row.
 *
 * A dash, not a zero, for everything that never called a model: a customer
 * message, a human reply and a tool audit row all cost nothing because nothing
 * was asked of the AI, and printing "0" would read as a model that answered for
 * free. A reply that took several rounds says so, since that is where a
 * surprising number usually comes from.
 */
function TokenCell({ usage }: { usage: MessageUsage | null }) {
  if (!usage) return <span className="text-ink-soft">—</span>

  return (
    <span className="block text-xs tabular-nums text-ink">
      {tokenCount(usage.inputTokens)} / {tokenCount(usage.outputTokens)}
      {usage.calls > 1 && (
        <span className="mt-0.5 block text-ink-soft">{usage.calls} calls</span>
      )}
    </span>
  )
}

export default function ActivityPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(
    (signal: AbortSignal) =>
      request<{ rows: EventRow[]; total: number; page: number; lastPage: number }>(
        `/api/messages?page=${page}&pageSize=${pageSize}`,
        { signal }
      ),
    [page, pageSize]
  )
  // Page 1 is the live view. Polling while someone reads page 4 would shuffle
  // rows out from under them as new messages arrive.
  const { data, loading, error, stale, loadedAt, refresh } = useAsyncData(load, [load], {
    pollMs: page === 1 ? 5000 : undefined,
  })

  const rows = data?.rows ?? []

  return (
    <PageBody width="wide">
      <PageHeader
        title="Activity"
        description="Everything sent, received and captured, newest first. Open a row to see what happened and how to fix it."
        actions={
          <Button variant="secondary" onClick={refresh} pending={loading && !!data} pendingLabel="Refreshing…">
            <RefreshIcon size={15} />
            Refresh
          </Button>
        }
      />

      {stale && (
        <div className="mb-4">
          <StaleNotice at={loadedAt} onRetry={refresh} />
        </div>
      )}

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorState
            title="Could not load activity"
            detail="Nothing has been changed — only this list failed to load."
            onRetry={refresh}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon size={22} />}
            title={page > 1 ? 'Nothing on this page' : 'No activity yet'}
            description={
              page > 1
                ? 'Go back a page to see recorded events.'
                : 'Messages and captures appear here as soon as they happen.'
            }
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-36">When</Th>
                    <Th className="w-24">From</Th>
                    <Th className="w-52">Customer</Th>
                    <Th>What happened</Th>
                    <Th className="w-32" numeric>
                      Tokens in / out
                    </Th>
                    <Th className="w-28">Result</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const sender = SENDER[row.senderType] ?? SENDER.customer
                    return (
                      <tr key={row.id} className="hover:bg-hover">
                        <Td className="align-top whitespace-nowrap text-ink-soft">
                          <time
                            dateTime={row.createdAt}
                            title={fullTimestamp(row.createdAt)}
                            className="text-xs tabular-nums"
                          >
                            {timeAgo(row.createdAt)}
                          </time>
                        </Td>
                        <Td className="align-top">
                          <Badge variant={sender.variant}>{sender.label}</Badge>
                        </Td>
                        <Td className="align-top">
                          <button
                            type="button"
                            onClick={() => setOpenId(row.id)}
                            className="cursor-pointer rounded-sm text-left text-sm font-medium text-ink hover:underline"
                          >
                            {contactLabel(row.contactName, row.contactPhone)}
                          </button>
                          {row.contactName && row.contactPhone && (
                            <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">
                              {row.contactPhone}
                            </span>
                          )}
                        </Td>
                        <Td className="max-w-0 align-top">
                          <button
                            type="button"
                            onClick={() => setOpenId(row.id)}
                            className="w-full cursor-pointer rounded-sm text-left"
                          >
                            <span className="block truncate text-sm text-ink">{describeEvent(row)}</span>
                            {row.error &&
                              row.messageType !== 'tool' &&
                              row.senderType !== 'system' && (
                                <span className="mt-0.5 block truncate text-xs text-danger">
                                  {row.error}
                                </span>
                              )}
                          </button>
                        </Td>
                        <Td className="align-top" numeric>
                          <TokenCell usage={row.usage} />
                        </Td>
                        <Td className="align-top">
                          <MessageStatusBadge status={row.status} />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableScroll>

            <Pagination
              page={data!.page}
              lastPage={data!.lastPage}
              total={data!.total}
              pageSize={pageSize}
              onPage={(next) => setPage(Math.min(Math.max(1, next), data!.lastPage))}
              onPageSize={(next) => {
                setPageSize(next)
                setPage(1)
              }}
              scopeNote={page === 1 ? 'page 1 refreshes automatically' : 'auto-refresh pauses off page 1'}
            />
          </>
        )}
      </Panel>

      {openId && <EventDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </PageBody>
  )
}

function EventDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const load = useCallback(
    (signal: AbortSignal) => request<EventDetail>(`/api/messages/${id}`, { signal }),
    [id]
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const sender = data ? (SENDER[data.senderType] ?? SENDER.customer) : null

  return (
    <Drawer
      open
      onClose={onClose}
      title="Event details"
      description={data ? fullTimestamp(data.createdAt) : undefined}
      width="wide"
    >
      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : error || !data ? (
        <ErrorState title="Could not load this event" detail={error ?? undefined} onRetry={refresh} />
      ) : (
        <div className="space-y-6">
          {/* Outcome first — it is the reason anyone opens this drawer. */}
          {data.messageType === 'tool' ? null : data.error ? (
            <Banner tone="danger" title="This event failed">
              {data.error}
            </Banner>
          ) : (
            <Banner tone="success" title="This event completed">
              No problem was recorded.
            </Banner>
          )}

          {data.messageType === 'tool' && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink">Captured details</h3>
              {data.invocation ? (
                <CaptureDetail
                  invocation={data.invocation}
                  showContact={false}
                  onSynced={() => {
                    refresh()
                    onChanged()
                  }}
                />
              ) : (
                <p className="text-sm leading-5 text-ink-muted">
                  Nothing was captured. The AI called this tool before it had every required detail,
                  so it asked the customer for the rest instead. That is expected behaviour, not an
                  error.
                </p>
              )}
            </section>
          )}

          {data.usage && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">AI token usage</h3>
              <KeyValues
                rows={[
                  ['Tokens in', tokenCount(data.usage.inputTokens)],
                  ['Tokens out', tokenCount(data.usage.outputTokens)],
                  ['Total', tokenCount(data.usage.totalTokens)],
                  [
                    'API calls',
                    data.usageCalls.length === 1
                      ? '1'
                      : `${data.usageCalls.length} — the model used tools before answering`,
                  ],
                  ['Provider', data.usage.providerName ?? 'Deleted provider'],
                ]}
              />

              {/* The rounds are only worth listing when there was more than
                  one: that is when the total stops being self-explanatory. */}
              {data.usageCalls.length > 1 && (
                <div className="mt-3 overflow-hidden rounded-md border border-line">
                  <Table>
                    <thead>
                      <tr>
                        <Th className="w-20">Round</Th>
                        <Th>Model</Th>
                        <Th numeric>In</Th>
                        <Th numeric>Out</Th>
                        <Th numeric className="w-20">
                          Took
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.usageCalls.map((call) => (
                        <tr key={call.id}>
                          <Td>{call.round + 1}</Td>
                          <Td className="font-mono text-xs">{call.model}</Td>
                          <Td numeric>{tokenCount(call.inputTokens)}</Td>
                          <Td numeric>{tokenCount(call.outputTokens)}</Td>
                          <Td numeric>
                            {call.latencyMs === null ? '—' : `${(call.latencyMs / 1000).toFixed(1)}s`}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {data.usageCalls.some((call) => call.status === 'failed') && (
                <p className="mt-2 text-xs leading-4 text-warning">
                  One or more calls failed and were retried. Failed calls are counted here even
                  though they returned no answer.
                </p>
              )}
            </section>
          )}

          {data.message && data.messageType !== 'tool' && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Message</h3>
              <p className="rounded-md border border-line bg-inset px-3 py-2.5 text-sm leading-5 break-words whitespace-pre-wrap text-ink">
                {data.message}
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Customer</h3>
            <KeyValues
              rows={[
                ['Name', data.contactName ?? 'Not provided by WhatsApp'],
                ['Phone', data.contactPhone ?? '—'],
                [
                  'Conversation',
                  data.conversationMode && data.conversationStatus ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {data.conversationStatus === 'open' ? 'Open' : 'Resolved'} ·{' '}
                      {data.conversationMode === 'auto' ? 'AI replies' : 'Human replies'}
                      <Link
                        href={`/inbox?c=${data.conversationId}`}
                        className="font-medium text-action hover:underline"
                      >
                        Open in Inbox
                      </Link>
                    </span>
                  ) : (
                    '—'
                  ),
                ],
              ]}
            />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Delivery</h3>
            <KeyValues
              rows={[
                ['Result', <MessageStatusBadge key="s" status={data.status} />],
                ['Direction', data.direction === 'incoming' ? 'Received from customer' : 'Sent to customer'],
                ['Sender', sender?.label ?? data.senderType],
                ['Type', data.messageType],
              ]}
            />
            {data.status === 'sent' && (
              <p className="mt-2 text-xs leading-4 text-ink-soft">
                Sent means the WhatsApp gateway accepted the message. It is not a delivery or read
                receipt.
              </p>
            )}
          </section>

          {/* Identifiers are for support conversations, not daily reading. */}
          <Disclosure summary="Technical identifiers">
            <KeyValues
              mono
              rows={[
                ['Message ID', data.id],
                ['Conversation ID', data.conversationId],
                ['Contact ID', data.contactId],
                ['Provider', data.provider],
                ['Provider message ID', data.providerMessageId ?? '—'],
              ]}
            />
          </Disclosure>
        </div>
      )}
    </Drawer>
  )
}

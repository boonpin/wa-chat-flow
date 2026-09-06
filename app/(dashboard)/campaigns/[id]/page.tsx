'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Banner,
  Button,
  CampaignStatusBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RecipientStatusBadge,
  Skeleton,
  Table,
  TableScroll,
  Td,
  Th,
  errorMessage,
  fullTimestamp,
  plural,
  request,
  useAsyncData,
  useToast,
} from '@/components/ui'

interface Campaign {
  id: string
  name: string
  messageTemplate: string
  status: string
  waSessionName: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  delaySeconds: number
  createdAt: string
  updatedAt: string
}

interface Recipient {
  id: string
  phone: string
  name: string | null
  status: string
  error: string | null
  sentAt: string | null
}

const PAGE_SIZE = 50

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p
        className={`mt-0.5 text-title leading-9 font-semibold tabular-nums ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'send' | 'cancel' | null>(null)

  const load = useCallback(
    (signal: AbortSignal) =>
      request<{ campaign: Campaign; recipients: Recipient[] }>(
        `/api/blast/campaign/${id}?page=${page}`,
        { signal }
      ),
    [id, page]
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load], {
    // Only poll while something is genuinely moving.
    pollMs: 3000,
  })

  const campaign = data?.campaign ?? null
  const recipients = data?.recipients ?? []

  async function act(action: 'start' | 'pause' | 'resume' | 'cancel', success: string) {
    setBusy(true)
    try {
      await request(`/api/blast/campaign/${id}/${action}`, { method: 'POST' })
      toast(success)
      setConfirm(null)
      refresh()
    } catch (e) {
      toast(errorMessage(e, 'That action did not go through.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <PageBody width="content">
        <Skeleton className="h-96 w-full" />
      </PageBody>
    )
  }

  if (error || !campaign) {
    return (
      <PageBody width="content">
        <Panel>
          <ErrorState
            title="Could not open this campaign"
            detail={error ?? 'It may have been removed.'}
            onRetry={refresh}
          />
          <div className="pb-6 text-center">
            <LinkButton href="/campaigns" variant="secondary" size="sm">
              Back to campaigns
            </LinkButton>
          </div>
        </Panel>
      </PageBody>
    )
  }

  const processed = campaign.sentCount + campaign.failedCount
  const remaining = Math.max(0, campaign.totalRecipients - processed)
  const pct =
    campaign.totalRecipients > 0 ? Math.round((processed / campaign.totalRecipients) * 100) : 0
  const cancelled = campaign.status === 'cancelled'
  const isDraft = campaign.status === 'draft'

  return (
    <PageBody width="content">
      <PageHeader
        title={campaign.name}
        description={`Sent from ${campaign.waSessionName ?? 'an unknown number'} · one message every ${campaign.delaySeconds} ${plural(campaign.delaySeconds, 'second')}`}
        back={{ href: '/campaigns', label: 'Campaigns' }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            {isDraft && (
              <Button onClick={() => setConfirm('send')}>Send campaign</Button>
            )}
            {campaign.status === 'failed' && (
              <Button onClick={() => act('start', 'Campaign started again.')} pending={busy}>
                Start again
              </Button>
            )}
            {campaign.status === 'sending' && (
              <Button variant="secondary" onClick={() => act('pause', 'Campaign paused.')} pending={busy}>
                Pause
              </Button>
            )}
            {campaign.status === 'paused' && (
              <Button onClick={() => act('resume', 'Campaign resumed.')} pending={busy}>
                Resume
              </Button>
            )}
            {['draft', 'sending', 'paused', 'failed'].includes(campaign.status) && (
              <Button variant="ghost" onClick={() => setConfirm('cancel')}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {isDraft && (
          <Banner tone="info" title="Nothing has been sent yet">
            This is a draft. Review the message and recipients below, then choose{' '}
            <strong>Send campaign</strong>.
          </Banner>
        )}

        {campaign.status === 'failed' && (
          <Banner tone="danger" title="The campaign stopped with an error">
            Recipients that were not reached are still marked as not sent. Starting again continues
            with those recipients — anyone already messaged is not messaged twice.
          </Banner>
        )}

        {/* Paused says paused. It does not guess that failures caused it. */}
        {campaign.status === 'paused' && (
          <Banner tone="warning" title="Campaign paused">
            No further messages are going out until you resume.
            {campaign.failedCount > 0 &&
              ` ${campaign.failedCount} ${plural(campaign.failedCount, 'message')} failed so far — a disconnected number is the usual cause.`}{' '}
            <Link href="/channels/whatsapp" className="font-semibold underline underline-offset-2">
              Check the number
            </Link>
          </Banner>
        )}

        {campaign.status === 'completed' && (
          <Banner tone="success" title="Processing complete">
            Every recipient has been processed. {campaign.sentCount}{' '}
            {plural(campaign.sentCount, 'message was', 'messages were')} accepted by WhatsApp
            {campaign.failedCount > 0 ? ` and ${campaign.failedCount} failed` : ''}. Accepted is not
            the same as delivered or read.
          </Banner>
        )}

        <Panel>
          <PanelHeader title="Progress" />
          <PanelBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Recipients" value={campaign.totalRecipients} />
              <Stat label="Sent" value={campaign.sentCount} tone="success" />
              <Stat label="Failed" value={campaign.failedCount} tone="danger" />
              <Stat label={cancelled ? 'Skipped' : 'Not sent yet'} value={remaining} />
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Processed</span>
                <span className="text-ink-muted tabular-nums">{pct}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-inset"
                role="progressbar"
                aria-valuenow={processed}
                aria-valuemin={0}
                aria-valuemax={campaign.totalRecipients}
                aria-label="Recipients processed"
              >
                <div
                  className="h-full rounded-full bg-action transition-[width] duration-[--duration-overlay] ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-soft tabular-nums">
                {processed} of {campaign.totalRecipients} processed. Processed means WhatsApp
                accepted or rejected the message — not that the customer received it.
              </p>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Message" description="Placeholders are filled in per recipient." />
          <PanelBody>
            <p className="rounded-md border border-line bg-inset px-3 py-2.5 text-sm leading-5 whitespace-pre-wrap text-ink">
              {campaign.messageTemplate}
            </p>
          </PanelBody>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Recipients"
            description={
              cancelled
                ? 'After a cancellation every remaining recipient is marked skipped, including any that had already been sent.'
                : undefined
            }
            action={
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-xs text-ink-muted tabular-nums">Page {page}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={recipients.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            }
          />
          {recipients.length === 0 ? (
            <EmptyState
              title={page > 1 ? 'No recipients on this page' : 'No recipients'}
              description={
                page > 1 ? 'Go back a page to see the list.' : 'This campaign has no recipients.'
              }
            />
          ) : (
            <TableScroll>
              <Table>
                <thead>
                  <tr>
                    <Th>Phone</Th>
                    <Th>Name</Th>
                    <Th>Status</Th>
                    <Th>Sent at</Th>
                    <Th>Problem</Th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="hover:bg-hover">
                      <Td className="whitespace-nowrap tabular-nums">{r.phone}</Td>
                      <Td className="text-ink-muted">{r.name ?? '—'}</Td>
                      <Td>
                        <RecipientStatusBadge status={r.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {r.sentAt ? (
                          <time dateTime={r.sentAt} title={fullTimestamp(r.sentAt)}>
                            {new Date(r.sentAt).toLocaleTimeString()}
                          </time>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="max-w-[18rem] text-sm break-words text-danger">
                        {r.error ?? <span className="text-ink-soft">—</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirm === 'send'}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={() => act('start', 'Campaign started. Messages are going out now.')}
        pending={busy}
        title={`Send to ${campaign.totalRecipients} ${plural(campaign.totalRecipients, 'recipient')}?`}
        description={`Messages go out from ${campaign.waSessionName ?? 'the selected number'}, one every ${campaign.delaySeconds} ${plural(campaign.delaySeconds, 'second')}. You can pause it once it starts, but a message that has been sent cannot be recalled.`}
        confirmLabel="Send campaign"
        pendingLabel="Starting…"
      />

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={() => act('cancel', 'Campaign cancelled. Remaining recipients were skipped.')}
        pending={busy}
        title={`Cancel “${campaign.name}”?`}
        description="Recipients who have not been messaged yet are skipped. Messages already sent cannot be recalled, and after cancelling the recipient list no longer distinguishes them."
        confirmLabel="Cancel campaign"
        pendingLabel="Cancelling…"
        destructive
      />
    </PageBody>
  )
}

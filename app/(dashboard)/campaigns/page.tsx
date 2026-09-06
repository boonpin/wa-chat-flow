'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import {
  CampaignIcon,
  CampaignStatusBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PlusIcon,
  SkeletonRows,
  Table,
  TableScroll,
  Td,
  Th,
  Button,
  errorMessage,
  fullTimestamp,
  plural,
  request,
  useAsyncData,
  usePendingSet,
  useToast,
} from '@/components/ui'

interface Campaign {
  id: string
  name: string
  status: string
  waSessionName: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
}

const POLL_MS = 5000

/** Processed is sent + failed. It is never called "delivered". */
function Progress({ campaign }: { campaign: Campaign }) {
  const processed = campaign.sentCount + campaign.failedCount
  const remaining = Math.max(0, campaign.totalRecipients - processed)
  const pct = campaign.totalRecipients > 0 ? Math.round((processed / campaign.totalRecipients) * 100) : 0
  const cancelled = campaign.status === 'cancelled'

  return (
    <div className="min-w-[10rem]">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
          <div className="h-full rounded-full bg-action" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {processed}/{campaign.totalRecipients}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-soft tabular-nums">
        {campaign.sentCount} sent · {campaign.failedCount} failed ·{' '}
        {remaining} {cancelled ? 'skipped' : 'not sent yet'}
      </p>
    </div>
  )
}

/** Only the transitions the engine accepts: a failed campaign restarts, it
 *  does not resume, and a completed one offers nothing. */
function actionsFor(status: string) {
  return {
    review: status === 'draft',
    restart: status === 'failed',
    pause: status === 'sending',
    resume: status === 'paused',
    cancel: ['sending', 'paused', 'draft', 'failed'].includes(status),
  }
}

export default function CampaignsPage() {
  const { toast } = useToast()
  const pending = usePendingSet()
  const [confirmCancel, setConfirmCancel] = useState<Campaign | null>(null)

  const load = useCallback(
    (signal: AbortSignal) => request<Campaign[]>('/api/blast/campaign', { signal }),
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load], { pollMs: POLL_MS })

  async function act(campaign: Campaign, action: 'start' | 'pause' | 'resume' | 'cancel', success: string) {
    await pending.run(campaign.id, async () => {
      try {
        await request(`/api/blast/campaign/${campaign.id}/${action}`, { method: 'POST' })
        toast(success)
        setConfirmCancel(null)
        refresh()
      } catch (e) {
        toast(errorMessage(e, 'That action did not go through.'), 'error')
      }
    })
  }

  const campaigns = data ?? []

  return (
    <PageBody width="wide">
      <PageHeader
        title="Campaigns"
        description="Send one deliberate message to a group of customers, one at a time with a delay between them."
        actions={
          <LinkButton href="/campaigns/new" variant="primary">
            <PlusIcon size={15} />
            Create campaign
          </LinkButton>
        }
      />

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <ErrorState
            title="Could not load campaigns"
            detail="No campaign has been started, paused or changed."
            onRetry={refresh}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<CampaignIcon size={22} />}
            title="No campaigns yet"
            description="Create a draft message for a group of customers. Nothing sends until you confirm it."
            action={
              <LinkButton href="/campaigns/new" variant="primary" size="sm">
                Create campaign
              </LinkButton>
            }
          />
        ) : (
          <>
            {/* Phone: stacked records, because the lifecycle actions are the
                point of this list and a side-scrolling table hides them. */}
            <ul className="divide-y divide-line-soft md:hidden">
              {campaigns.map((campaign) => {
                const busy = pending.isPending(campaign.id)
                const can = actionsFor(campaign.status)
                return (
                  <li key={campaign.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="text-base font-medium text-ink hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {campaign.totalRecipients} {plural(campaign.totalRecipients, 'recipient')}
                      {campaign.waSessionName ? ` · from ${campaign.waSessionName}` : ''}
                    </p>
                    <div className="mt-3">
                      <Progress campaign={campaign} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {can.review && (
                        <LinkButton href={`/campaigns/${campaign.id}`} size="sm" variant="primary">
                          Review and send
                        </LinkButton>
                      )}
                      {can.restart && (
                        <Button size="sm" pending={busy} onClick={() => act(campaign, 'start', 'Campaign started again.')}>
                          Start again
                        </Button>
                      )}
                      {can.pause && (
                        <Button size="sm" variant="secondary" pending={busy} onClick={() => act(campaign, 'pause', 'Campaign paused.')}>
                          Pause
                        </Button>
                      )}
                      {can.resume && (
                        <Button size="sm" pending={busy} onClick={() => act(campaign, 'resume', 'Campaign resumed.')}>
                          Resume
                        </Button>
                      )}
                      {can.cancel && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(campaign)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="hidden md:block">
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Status</Th>
                  <Th>Sent from</Th>
                  <Th>Progress</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const busy = pending.isPending(campaign.id)
                  return (
                    <tr key={campaign.id} className="hover:bg-hover">
                      <Td>
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="text-sm font-medium text-ink hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">
                          {campaign.totalRecipients} {plural(campaign.totalRecipients, 'recipient')}
                        </span>
                      </Td>
                      <Td>
                        <CampaignStatusBadge status={campaign.status} />
                      </Td>
                      <Td className="text-ink-muted">{campaign.waSessionName ?? '—'}</Td>
                      <Td>
                        <Progress campaign={campaign} />
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        <time dateTime={campaign.createdAt} title={fullTimestamp(campaign.createdAt)}>
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </time>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {/* Only transitions the engine actually accepts are
                              offered: a failed campaign is restarted, not resumed. */}
                          {actionsFor(campaign.status).review && (
                            <LinkButton href={`/campaigns/${campaign.id}`} size="sm" variant="primary">
                              Review and send
                            </LinkButton>
                          )}
                          {actionsFor(campaign.status).restart && (
                            <Button size="sm" pending={busy} onClick={() => act(campaign, 'start', 'Campaign started again.')}>
                              Start again
                            </Button>
                          )}
                          {actionsFor(campaign.status).pause && (
                            <Button size="sm" variant="secondary" pending={busy} onClick={() => act(campaign, 'pause', 'Campaign paused.')}>
                              Pause
                            </Button>
                          )}
                          {actionsFor(campaign.status).resume && (
                            <Button size="sm" pending={busy} onClick={() => act(campaign, 'resume', 'Campaign resumed.')}>
                              Resume
                            </Button>
                          )}
                          {actionsFor(campaign.status).cancel && (
                            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(campaign)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableScroll>
            </div>
          </>
        )}
      </Panel>

      <p className="mt-4 max-w-[65ch] text-xs leading-4 text-ink-soft">
        Pausing AI replies does not pause a campaign, and a campaign does not depend on a bot. A
        campaign sends the message you wrote, to the recipients you chose.
      </p>

      <ConfirmDialog
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() =>
          confirmCancel && act(confirmCancel, 'cancel', 'Campaign cancelled. Remaining recipients were skipped.')
        }
        pending={confirmCancel ? pending.isPending(confirmCancel.id) : false}
        title={`Cancel “${confirmCancel?.name ?? ''}”?`}
        description="Recipients who have not been messaged yet are skipped. Messages already sent cannot be recalled, and after cancelling the recipient list no longer distinguishes them."
        confirmLabel="Cancel campaign"
        pendingLabel="Cancelling…"
        destructive
      />
    </PageBody>
  )
}

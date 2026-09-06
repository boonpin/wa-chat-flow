'use client'

import { useCallback } from 'react'
import {
  ErrorState,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonRows,
  Table,
  TableScroll,
  Td,
  Th,
  request,
  tokenCount,
  useAsyncData,
} from '@/components/ui'

interface Totals {
  calls: number
  failed: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface BotRow extends Totals {
  botId: string | null
  botName: string | null
  model: string
}

interface UsageReport {
  allTime: Totals
  last30Days: Totals
  byBot: BotRow[]
}

/**
 * What this account has spent, straight off the ledger.
 *
 * Split by bot *and* model rather than by bot alone: repointing a provider at a
 * cheaper model is the main reason to look at this page, and rolling both
 * models into one row would hide whether the change did anything.
 */
export function UsagePanel({ providerId }: { providerId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => request<UsageReport>(`/api/ai-providers/${providerId}/usage`, { signal }),
    [providerId]
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  return (
    <Panel>
      <PanelHeader
        title="Token usage"
        description="Recorded on every API call this provider makes, including calls that failed."
      />

      {loading && !data ? (
        <SkeletonRows rows={2} />
      ) : error ? (
        <ErrorState title="Could not load token usage" detail={error} onRetry={refresh} />
      ) : !data || data.allTime.calls === 0 ? (
        <PanelBody>
          <p className="text-sm text-ink-muted">
            No API calls recorded yet. Counts appear here after this provider answers its first
            message.
          </p>
        </PanelBody>
      ) : (
        <>
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            <TotalsCard title="Last 30 days" totals={data.last30Days} />
            <TotalsCard title="All time" totals={data.allTime} />
          </PanelBody>

          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Bot</Th>
                  <Th>Model</Th>
                  <Th numeric>Calls</Th>
                  <Th numeric>Tokens in</Th>
                  <Th numeric>Tokens out</Th>
                </tr>
              </thead>
              <tbody>
                {data.byBot.map((row) => (
                  <tr key={`${row.botId ?? 'gone'}-${row.model}`}>
                    <Td>{row.botName ?? <span className="text-ink-soft">Deleted bot</span>}</Td>
                    <Td className="font-mono text-[13px]">{row.model}</Td>
                    <Td numeric>{tokenCount(row.calls)}</Td>
                    <Td numeric>{tokenCount(row.inputTokens)}</Td>
                    <Td numeric>{tokenCount(row.outputTokens)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </>
      )}
    </Panel>
  )
}

function TotalsCard({ title, totals }: { title: string; totals: Totals }) {
  return (
    <div className="rounded-md border border-line bg-inset/60 p-3">
      <p className="text-xs font-medium text-ink-soft">{title}</p>
      <p className="mt-1 text-lg font-semibold text-ink">
        {tokenCount(totals.totalTokens)} <span className="text-sm font-normal text-ink-muted">tokens</span>
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {tokenCount(totals.inputTokens)} in · {tokenCount(totals.outputTokens)} out
      </p>
      <p className="mt-0.5 text-sm text-ink-soft">
        {tokenCount(totals.calls)} call{totals.calls === 1 ? '' : 's'}
        {totals.failed > 0 && `, ${tokenCount(totals.failed)} failed`}
      </p>
    </div>
  )
}

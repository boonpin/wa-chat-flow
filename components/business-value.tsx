'use client'
import Link from 'next/link'
import { Panel, PanelBody, PanelHeader, Banner } from '@/components/ui'
import type { ImpactReport } from '@/lib/reports/impact-types'

export function reportMoney(micros: number | null, currency: string) {
  if (micros === null) return 'Not estimated'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(micros / 1_000_000)
}
export function reportTime(minutes: number | null) {
  if (minutes === null) return 'Not estimated'
  return minutes < 60
    ? `${minutes.toLocaleString()} minutes`
    : `${(minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} hours`
}
export function BusinessValue({ report }: { report: ImpactReport }) {
  const { current, assumptions } = report
  const q = new URLSearchParams({ from: report.period.from, to: report.period.to, metric: 'ai' })
  return (
    <Panel as="section">
      <PanelHeader
        title="What your AI agents helped with"
        description={`Last ${report.rangeDays} days · Updated ${new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        action={
          <Link
            href={`/reports/impact?range=${report.rangeDays}`}
            className="text-sm font-semibold text-action"
          >
            View time & costs
          </Link>
        }
      />
      <PanelBody>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-medium text-ink-muted">Estimated time saved</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-ink tabular-nums">
              {reportTime(current.estimates.savedMinutes)}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {assumptions.manualReplyMinutes === null
                ? 'Add your usual reply time to estimate the work saved.'
                : `Based on ${current.actuals.aiReplies.toLocaleString()} AI replies × ${assumptions.manualReplyMinutes} minutes per reply.`}
            </p>
            <Link
              href="/reports/impact#assumptions"
              className="mt-2 inline-block text-sm text-action underline"
            >
              Review estimate settings
            </Link>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <Link href={`/activity?${q}`} className="text-action underline">
                {current.actuals.aiReplies.toLocaleString()} AI replies sent
              </Link>
              <span>{current.actuals.contactsAssisted.toLocaleString()} customers assisted</span>
              <span>
                Typical AI reply:{' '}
                {current.actuals.medianAiResponseMs === null
                  ? 'No replies yet'
                  : `${Math.round(current.actuals.medianAiResponseMs / 1000)} seconds`}
              </span>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ['Estimated staff-time value', current.estimates.laborValueMicros],
              ['Subscription & other costs', current.estimates.recurringCostMicros],
              [
                assumptions.aiCostIncluded
                  ? 'AI usage included in subscription'
                  : 'Separate AI usage cost',
                assumptions.aiCostIncluded ? 0 : current.estimates.aiCostMicros,
              ],
              ['Service costs', current.estimates.serviceCostMicros],
              ['Estimated value after costs', current.estimates.netSavingsMicros],
            ].map(([label, value], i) => (
              <div
                key={String(label)}
                className={`flex justify-between gap-4 ${i === 4 ? 'border-t border-line pt-3 font-semibold' : ''}`}
              >
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-right tabular-nums text-ink">
                  {reportMoney(value as number | null, assumptions.currency)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {current.estimates.serviceCostMicros === null && (
          <div className="mt-4">
            <Banner tone="warning" title="Cost estimate incomplete">
              Add monthly costs, a billing start date and any missing AI prices or usage records in
              Time & costs. Unknown amounts are not treated as zero.
            </Banner>
          </div>
        )}
        <p className="mt-4 max-w-[85ch] text-xs leading-5 text-ink-muted">
          Time and staff-time value are estimates, not cash savings. Past estimates use your current
          settings.{' '}
          <Link href="/reports/impact#calculation" className="text-action underline">
            How this is calculated
          </Link>
        </p>
      </PanelBody>
    </Panel>
  )
}

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Button,
  Disclosure,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Panel,
  PanelBody,
  PanelHeader,
  PageBody,
  PageHeader,
  Skeleton,
  StaleNotice,
  Table,
  TableScroll,
  Td,
  Th,
  errorMessage,
  request,
  tokenCount,
  useAsyncData,
  useToast,
} from '@/components/ui'
import type {
  ImpactAssumptions,
  ImpactBreakdownRow,
  ImpactRange,
  ImpactReport,
  ImpactTrendPoint,
} from '@/lib/reports/impact-types'

const RANGES: ImpactRange[] = [7, 30, 90]

function readRange(value: string | null): ImpactRange {
  const number = Number(value)
  return number === 7 || number === 90 ? number : 30
}

function number(value: number): string {
  return value.toLocaleString()
}

function percent(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(value)
}

function duration(ms: number | null): string {
  if (ms === null) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`
}

function savedTime(minutes: number | null): string {
  if (minutes === null) return 'Not estimated'
  if (minutes < 60) return `${number(minutes)} min`
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(minutes / 60)} hr`
}

function money(micros: number | null, currency: string, precise = false): string {
  if (micros === null) return 'Not estimated'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: precise && Math.abs(micros) < 10_000 ? 4 : 2,
      maximumFractionDigits: precise ? 4 : 2,
    }).format(micros / 1_000_000)
  } catch {
    return `${currency} ${(micros / 1_000_000).toFixed(2)}`
  }
}

function change(current: number | null, previous: number | null, label: string): string {
  if (current === null || previous === null || previous === 0) return `No ${label} comparison yet`
  const value = (current - previous) / Math.abs(previous)
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'unchanged'
  if (direction === 'unchanged') return `Unchanged from the previous period`
  return `${direction === 'up' ? 'Up' : 'Down'} ${Math.abs(value * 100).toFixed(0)}% from the previous period`
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-1 text-2xl leading-8 font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-4 text-ink-muted">{detail}</dd>
    </div>
  )
}

function EvidenceStep({
  label,
  value,
  kind,
  detail,
  final,
}: {
  label: string
  value: string
  kind: 'recorded' | 'estimated'
  detail: string
  final?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-md p-3 ${final ? 'bg-selected' : 'bg-inset/70'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <span className={`text-[11px] font-medium ${kind === 'recorded' ? 'text-ai' : 'text-warning'}`}>
          {kind === 'recorded' ? 'Recorded' : 'Estimated'}
        </span>
      </div>
      <p className={`mt-2 font-semibold tracking-[-0.02em] text-ink tabular-nums ${final ? 'text-3xl leading-9' : 'text-xl leading-7'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-4 text-ink-muted">{detail}</p>
    </div>
  )
}

function EvidenceChain({ report }: { report: ImpactReport }) {
  const { current, assumptions } = report
  const hasOperatingAssumptions =
    assumptions.manualReplyMinutes !== null && assumptions.laborCostMinor !== null
  const operators = ['→', '→', '−', '=']

  const steps = [
    {
      label: 'AI reply turns',
      value: number(current.actuals.aiReplies),
      kind: 'recorded' as const,
      detail: `${number(current.actuals.conversationsAssisted)} conversations assisted`,
    },
    {
      label: 'Operator time',
      value: savedTime(current.estimates.savedMinutes),
      kind: 'estimated' as const,
      detail: assumptions.manualReplyMinutes === null ? 'Add a manual reply time' : `${assumptions.manualReplyMinutes} min per reply turn`,
    },
    {
      label: 'Labor value',
      value: money(current.estimates.laborValueMicros, assumptions.currency),
      kind: 'estimated' as const,
      detail: assumptions.laborCostMinor === null ? 'Add an hourly labor cost' : `${money(assumptions.laborCostMinor * 10_000, assumptions.currency)} per hour`,
    },
    {
      label: 'AI usage cost',
      value: money(current.estimates.aiCostMicros, assumptions.currency, true),
      kind: 'estimated' as const,
      detail: current.usage.costComplete
        ? `${number(current.usage.calls)} calls priced`
        : current.usage.untrackedReplies > 0
          ? `${number(current.usage.untrackedReplies)} replies have no usage record`
          : `${number(current.usage.unpricedCalls)} calls need a model rate`,
    },
    {
      label: 'Net savings',
      value: money(current.estimates.netSavingsMicros, assumptions.currency),
      kind: 'estimated' as const,
      detail: hasOperatingAssumptions && current.usage.costComplete ? 'Labor value minus AI usage cost' : 'Complete the assumptions below',
      final: true,
    },
  ]

  return (
    <Panel as="section">
      <PanelHeader
        title="From replies to estimated value"
        description="Recorded activity flows into your operating assumptions."
      />
      <PanelBody>
        <div className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1.15fr]">
          {steps.map((step, index) => (
            <div key={step.label} className="contents">
              <EvidenceStep {...step} />
              {index < operators.length && (
                <span className="flex items-center justify-center py-0.5 text-lg font-medium text-ink-soft" aria-hidden="true">
                  {operators[index]}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-4 text-ink-soft">
          Estimates exclude hosting, software subscriptions and taxes.
        </p>
      </PanelBody>
    </Panel>
  )
}

function DailyActivity({ points }: { points: ImpactTrendPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.aiReplies + point.humanReplies))
  const labelEvery = points.length <= 7 ? 1 : points.length <= 30 ? 5 : 15

  return (
    <>
      <div className="overflow-x-auto pb-2" tabIndex={0} aria-label="Daily reply chart. A data table follows.">
        <div
          className={`grid items-end gap-1 ${points.length > 30 ? 'min-w-[720px]' : 'min-w-full'}`}
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(6px, 1fr))` }}
          role="img"
          aria-label="Daily AI and human reply turns"
        >
          {points.map((point, index) => {
            const aiHeight = Math.max(point.aiReplies ? 4 : 0, (point.aiReplies / max) * 132)
            const humanHeight = Math.max(point.humanReplies ? 4 : 0, (point.humanReplies / max) * 132)
            return (
              <div key={point.date} className="flex min-w-0 flex-col items-center justify-end">
                <div className="flex h-36 w-full items-end justify-center gap-px border-b border-line">
                  <span className="w-[42%] max-w-3 rounded-t-sm bg-ai" style={{ height: aiHeight }} title={`${point.aiReplies} AI replies on ${point.date}`} />
                  <span className="w-[42%] max-w-3 rounded-t-sm bg-human/55" style={{ height: humanHeight }} title={`${point.humanReplies} human replies on ${point.date}`} />
                </div>
                <time dateTime={point.date} className="mt-1 h-4 whitespace-nowrap text-[10px] text-ink-soft tabular-nums">
                  {index % labelEvery === 0
                    ? new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
                    : ''}
                </time>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ai" />AI replies</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-human/55" />Human replies</span>
      </div>
      <Disclosure summary="View daily data">
        <TableScroll>
          <Table>
            <thead><tr><Th>Date</Th><Th numeric>AI replies</Th><Th numeric>Human replies</Th><Th numeric>Time saved</Th><Th numeric>Tokens</Th></tr></thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <Td><time dateTime={point.date}>{new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })}</time></Td>
                  <Td numeric>{number(point.aiReplies)}</Td>
                  <Td numeric>{number(point.humanReplies)}</Td>
                  <Td numeric>{savedTime(point.savedMinutes)}</Td>
                  <Td numeric>{tokenCount(point.tokens)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Disclosure>
    </>
  )
}

function Breakdown({ rows, currency }: { rows: ImpactBreakdownRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No AI usage in this period" description="Choose a longer period or return after the AI answers a message." />
  }
  return (
    <TableScroll>
      <Table>
        <thead>
          <tr><Th>Bot and model</Th><Th numeric>Replies</Th><Th numeric>Calls</Th><Th numeric>Tokens</Th><Th numeric>AI cost</Th><Th numeric>Net savings</Th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <Td>
                <span className="block font-medium text-ink">{row.botName ?? 'Deleted bot'}</span>
                <span className="mt-0.5 block font-mono text-xs text-ink-soft">{row.kind} · {row.model}</span>
              </Td>
              <Td numeric>{number(row.replies)}</Td>
              <Td numeric>{number(row.calls)}{row.failedCalls > 0 && <span className="block text-xs text-danger">{number(row.failedCalls)} failed</span>}</Td>
              <Td numeric>{tokenCount(row.totalTokens)}</Td>
              <Td numeric>{row.costComplete ? money(row.costMicros, currency, true) : <span className="text-warning">Incomplete</span>}</Td>
              <Td numeric>{money(row.netSavingsMicros, currency)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  )
}

interface RateDraft {
  kind: string
  model: string
  input: string
  output: string
}

function AssumptionForm({ assumptions, onSaved }: { assumptions: ImpactAssumptions; onSaved: () => void }) {
  const { toast } = useToast()
  const [manualMinutes, setManualMinutes] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [currency, setCurrency] = useState('MYR')
  const [rates, setRates] = useState<RateDraft[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setManualMinutes(assumptions.manualReplyMinutes?.toString() ?? '')
    setLaborCost(assumptions.laborCostMinor === null ? '' : (assumptions.laborCostMinor / 100).toString())
    setCurrency(assumptions.currency)
    setRates(assumptions.rates.map((rate) => ({
      kind: rate.kind,
      model: rate.model,
      input: rate.inputRatePerMillion?.toString() ?? '',
      output: rate.outputRatePerMillion?.toString() ?? '',
    })))
  }, [assumptions])

  function changeCurrency(next: string) {
    setCurrency(next.toUpperCase())
    if (next.toUpperCase() !== assumptions.currency) {
      setRates((current) => current.map((rate) => ({ ...rate, input: '', output: '' })))
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await request('/api/reports/impact/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualReplyMinutes: manualMinutes === '' ? null : Number(manualMinutes),
          laborCostPerHour: laborCost === '' ? null : Number(laborCost),
          currency,
          rates: rates.map((rate) => ({
            kind: rate.kind,
            model: rate.model,
            inputRatePerMillion: rate.input === '' ? null : Number(rate.input),
            outputRatePerMillion: rate.output === '' ? null : Number(rate.output),
          })),
        }),
      })
      toast('Report assumptions saved', 'success')
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not save report assumptions.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && <Banner tone="danger" title="Could not save assumptions">{error}</Banner>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Minutes per manual reply" hint="Your usual hands-on time for one reply turn." type="number" min={1} max={240} step={1} value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} />
        <Input label="Hourly labor cost" hint="Use the full employment or contractor cost." type="number" min={0} max={1000000} step="0.01" value={laborCost} onChange={(event) => setLaborCost(event.target.value)} />
        <Input label="Reporting currency" hint="Three-letter code, such as MYR or USD." maxLength={3} pattern="[A-Za-z]{3}" value={currency} onChange={(event) => changeCurrency(event.target.value)} required />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Model rates per 1 million tokens</h3>
        <p className="mt-1 text-sm leading-5 text-ink-muted">Enter rates in {currency || 'your reporting currency'}. Both fields are required to price a model.</p>
        {rates.length === 0 ? (
          <p className="mt-3 rounded-md bg-inset p-3 text-sm text-ink-muted">Model rates appear after you add an AI provider or record an AI call.</p>
        ) : (
          <div className="mt-3 divide-y divide-line-soft rounded-md border border-line">
            {rates.map((rate, index) => (
              <div key={`${rate.kind}-${rate.model}`} className="grid gap-3 p-3 md:grid-cols-[minmax(180px,1fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)] md:items-end">
                <div className="min-w-0 pb-1">
                  <p className="text-sm font-medium text-ink">{rate.model}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{rate.kind}</p>
                </div>
                <Input label={`Input rate for ${rate.model}`} type="number" min={0} max={1000000} step="0.000001" value={rate.input} onChange={(event) => setRates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, input: event.target.value } : item))} />
                <Input label={`Output rate for ${rate.model}`} type="number" min={0} max={1000000} step="0.000001" value={rate.output} onChange={(event) => setRates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, output: event.target.value } : item))} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs leading-4 text-ink-soft">The first rate covers existing usage. Later changes take effect when you save them.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" pending={pending} pendingLabel="Saving assumptions…">Save assumptions</Button>
      </div>
    </form>
  )
}

function ReportContent({ report, refresh }: { report: ImpactReport; refresh: () => void }) {
  const { current, previous, assumptions } = report
  const noActivity = current.actuals.aiReplies === 0 && current.usage.calls === 0
  const assumptionsMissing = assumptions.manualReplyMinutes === null || assumptions.laborCostMinor === null

  return (
    <div className="space-y-6">
      {noActivity && (
        <Panel>
          <EmptyState title="No AI activity in this period" description="Results appear after the AI answers a customer. Choose a longer period if you have earlier activity." action={<LinkButton href="/inbox" size="sm">Open inbox</LinkButton>} />
        </Panel>
      )}
      {assumptionsMissing && !noActivity && (
        <Banner tone="warning" title="Add assumptions to estimate savings">
          Recorded activity is ready. Add manual reply time and labor cost to value the work.
        </Banner>
      )}
      {!current.usage.costComplete && (
        <Banner tone="warning" title="AI cost is incomplete">
          {current.usage.untrackedReplies > 0
            ? `${number(current.usage.untrackedReplies)} ${current.usage.untrackedReplies === 1 ? 'reply has' : 'replies have'} no matching token record.`
            : `${number(current.usage.unpricedCalls)} ${current.usage.unpricedCalls === 1 ? 'call needs' : 'calls need'} a model rate.`}{' '}
          Net savings stay hidden until the cost is complete.
        </Banner>
      )}

      <EvidenceChain report={report} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Automation and response" description="Successful service replies only." />
          <PanelBody>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6">
              <Metric label="Automation rate" value={percent(current.actuals.automationRate)} detail={change(current.actuals.automationRate, previous.actuals.automationRate, 'rate')} />
              <Metric label="Median AI response" value={duration(current.actuals.medianAiResponseMs)} detail="From the last customer message" />
              <Metric label="Customers assisted" value={number(current.actuals.contactsAssisted)} detail={`${number(current.actuals.conversationsAssisted)} conversations`} />
              <Metric label="Human reply turns" value={number(current.actuals.humanReplies)} detail={`${number(current.actuals.aiReplies)} handled by AI`} />
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Token usage and cost" description="Includes successful and failed AI calls." />
          <PanelBody>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6">
              <Metric label="Total tokens" value={tokenCount(current.usage.totalTokens)} detail={change(current.usage.totalTokens, previous.usage.totalTokens, 'usage')} />
              <Metric label="Tokens per AI reply" value={current.actuals.aiReplies === 0 ? '—' : tokenCount(Math.round(current.usage.totalTokens / current.actuals.aiReplies))} detail="All model rounds included" />
              <Metric label="Input tokens" value={tokenCount(current.usage.inputTokens)} detail={`${tokenCount(current.usage.outputTokens)} output tokens`} />
              <Metric label="AI calls" value={number(current.usage.calls)} detail={current.usage.failedCalls === 0 ? 'No failed calls' : `${number(current.usage.failedCalls)} failed`} />
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Daily activity" description="AI and human reply turns by UTC day." />
        <PanelBody className="space-y-4"><DailyActivity points={report.trend} /></PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Bot and model breakdown" description="Reply value is attributed through the AI calls linked to each sent message." />
        <Breakdown rows={report.breakdown} currency={assumptions.currency} />
      </Panel>

      <Panel as="section" className="scroll-mt-6" >
        <div id="assumptions" className="scroll-mt-6">
          <PanelHeader title="Report assumptions" description="These settings affect estimates only. They do not change how bots reply." />
          <PanelBody><AssumptionForm assumptions={assumptions} onSaved={refresh} /></PanelBody>
        </div>
      </Panel>

      <Disclosure summary="How this report is calculated">
        <div className="max-w-[75ch] space-y-3 text-sm leading-5 text-ink-muted">
          <p><strong className="font-semibold text-ink">Automation rate</strong> is AI reply turns divided by AI and human reply turns. System notices, campaigns and failed sends are excluded.</p>
          <p><strong className="font-semibold text-ink">Response time</strong> runs from the last customer message in a burst to the next successful service reply.</p>
          <p><strong className="font-semibold text-ink">Time saved</strong> multiplies AI reply turns by your manual reply time. Labor value then uses your hourly cost.</p>
          <p><strong className="font-semibold text-ink">AI cost</strong> applies the model rate effective when each call occurred. Failed calls count when they recorded token usage.</p>
        </div>
      </Disclosure>
    </div>
  )
}

export function ImpactReportPage() {
  const searchParams = useSearchParams()
  const range = readRange(searchParams.get('range'))
  const load = useCallback(
    (signal: AbortSignal) => request<ImpactReport>(`/api/reports/impact?range=${range}`, { signal }),
    [range]
  )
  const report = useAsyncData(load, [load])

  const periodLabel = useMemo(() => `Previous ${range} days`, [range])

  return (
    <PageBody width="content">
      <PageHeader
        title="Impact report"
        description="See what AI handled, the time it may have saved, and what it cost."
        actions={<LinkButton href="#assumptions" variant="secondary">Edit assumptions</LinkButton>}
        meta={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Report period" className="inline-flex rounded-md border border-line bg-panel p-1">
              {RANGES.map((days) => (
                <Link key={days} href={`/reports/impact?range=${days}`} aria-current={range === days ? 'page' : undefined} className={`flex h-8 items-center rounded-sm px-3 text-[13px] font-medium transition-colors ${range === days ? 'bg-selected font-semibold text-ink' : 'text-ink-muted hover:bg-hover hover:text-ink'}`}>
                  {days} days
                </Link>
              ))}
            </nav>
            <p className="text-xs text-ink-soft">Compared with {periodLabel.toLowerCase()}</p>
          </div>
        }
      />

      {report.stale && <StaleNotice at={report.loadedAt} onRetry={report.refresh} />}
      {report.loading && !report.data && (
        <div className="space-y-6"><Skeleton className="h-56 w-full" /><div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>
      )}
      {report.error && !report.data && (
        <Panel><ErrorState title="Could not load the impact report" detail={`${report.error} Your saved assumptions have not changed.`} onRetry={report.refresh} /></Panel>
      )}
      {report.data && <ReportContent report={report.data} refresh={report.refresh} />}
    </PageBody>
  )
}

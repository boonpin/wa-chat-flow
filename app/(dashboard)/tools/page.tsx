'use client'

import Link from 'next/link'
import { Suspense, useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Badge,
  CaptureStatusBadge,
  ChevronRight,
  Drawer,
  EmptyState,
  ErrorState,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PlusIcon,
  RouteTabs,
  SheetIcon,
  Skeleton,
  SkeletonRows,
  ToolIcon,
  contactLabel,
  fullTimestamp,
  request,
  timeAgo,
  useAsyncData,
} from '@/components/ui'
import { CaptureDetail, type Invocation } from '@/components/capture-detail'
import type { ToolRecord } from './tool-form'

/** The captures endpoint caps at 500 and has no cursor, so counts say "recent". */
const CAPTURE_LIMIT = 100

function ToolsList() {
  const load = useCallback(
    (signal: AbortSignal) => request<ToolRecord[]>('/api/tools', { signal }),
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  if (loading && !data) return <SkeletonRows rows={3} />
  if (error)
    return (
      <ErrorState title="Could not load your tools" detail="Nothing has been changed." onRetry={refresh} />
    )
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={<ToolIcon size={22} />}
        title="Save customer details to a sheet"
        description="Start with a sales enquiry or support request, then attach it to a bot."
        action={
          <LinkButton href="/tools/new" variant="primary" size="sm">
            Create tool
          </LinkButton>
        }
      />
    )

  return (
    <ul>
      {data.map((tool) => (
        <li key={tool.id}>
          <Link
            href={`/tools/${tool.id}`}
            className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{tool.name}</span>
                <Badge variant="info">{tool.sheetTab}</Badge>
                {!tool.enabled && <Badge variant="neutral">Turned off</Badge>}
                {!tool.hasSinkUrl && <Badge variant="warning">Sheet not connected</Badge>}
              </span>
              <span className="mt-1 block text-sm leading-5 text-ink-muted">{tool.description}</span>
              <span className="mt-1 block text-sm text-ink-soft">
                {tool.fields.length === 0
                  ? 'No fields yet'
                  : `Collects: ${tool.fields.map((f) => f.label).join(', ')}`}
              </span>
            </span>
            <span className="mt-0.5 shrink-0 text-ink-soft">
              <ChevronRight size={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function CapturesList() {
  const [openId, setOpenId] = useState<string | null>(null)
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Invocation[]>(`/api/tools/invocations?limit=${CAPTURE_LIMIT}`, { signal }),
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])
  const open = data?.find((i) => i.id === openId) ?? null

  if (loading && !data) return <SkeletonRows rows={4} />
  if (error)
    return (
      <ErrorState
        title="Could not load captures"
        detail="Everything already captured is still stored."
        onRetry={refresh}
      />
    )
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={<SheetIcon size={22} />}
        title="No details collected yet"
        description="Captures appear here when a bot with this tool attached uses it in a conversation."
        action={
          <LinkButton href="/bots" variant="secondary" size="sm">
            Review bot attachment
          </LinkButton>
        }
      />
    )

  return (
    <>
      <ul>
        {data.map((invocation) => {
          const summary =
            Object.entries(invocation.payload?.values ?? invocation.args ?? {})
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(' · ') || 'Nothing captured'
          return (
            <li key={invocation.id}>
              <button
                type="button"
                onClick={() => setOpenId(invocation.id)}
                className="flex w-full cursor-pointer items-start gap-3 border-b border-line-soft px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-hover md:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {contactLabel(invocation.contactName, invocation.contactPhone)}
                    </span>
                    <CaptureStatusBadge status={invocation.status} />
                    {invocation.toolName && <Badge variant="neutral">{invocation.toolName}</Badge>}
                  </span>
                  <span className="mt-1 block truncate text-sm text-ink-muted">{summary}</span>
                  {invocation.error && (
                    <span className="mt-0.5 block truncate text-sm text-danger">{invocation.error}</span>
                  )}
                </span>
                <time
                  dateTime={invocation.createdAt}
                  title={fullTimestamp(invocation.createdAt)}
                  className="shrink-0 text-xs text-ink-soft tabular-nums"
                >
                  {timeAgo(invocation.createdAt)}
                </time>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="px-4 py-3 text-xs text-ink-soft md:px-5">
        {data.length === CAPTURE_LIMIT
          ? `Showing the ${CAPTURE_LIMIT} most recent captures.`
          : `${data.length} recent ${data.length === 1 ? 'capture' : 'captures'}.`}
      </p>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        title="Capture details"
        description={open ? fullTimestamp(open.createdAt) : undefined}
        width="wide"
      >
        {open && (
          <CaptureDetail
            invocation={open}
            onSynced={() => {
              refresh()
              setOpenId(null)
            }}
          />
        )}
      </Drawer>
    </>
  )
}

function ToolsWorkspace() {
  const params = useSearchParams()
  const view = params.get('view') === 'captures' ? 'captures' : 'tools'

  return (
    <PageBody width="content">
      <PageHeader
        title="Tools"
        description="Let a bot collect details mid-conversation and write them to a Google Sheet."
        actions={
          <LinkButton href="/tools/new" variant="primary">
            <PlusIcon size={15} />
            Create tool
          </LinkButton>
        }
      />

      <RouteTabs
        className="mb-5"
        current={view}
        items={[
          { key: 'tools', href: '/tools?view=tools', label: 'Tools' },
          { key: 'captures', href: '/tools?view=captures', label: 'Captures' },
        ]}
      />

      <Panel>{view === 'captures' ? <CapturesList /> : <ToolsList />}</Panel>
    </PageBody>
  )
}

export default function ToolsPage() {
  return (
    <Suspense fallback={<PageBody width="content"><Skeleton className="h-96 w-full" /></PageBody>}>
      <ToolsWorkspace />
    </Suspense>
  )
}

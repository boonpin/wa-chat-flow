'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import {
  Badge,
  ChevronRight,
  EmptyState,
  ErrorState,
  LinkButton,
  SkeletonRows,
  ToolIcon,
  request,
  useAsyncData,
} from '@/components/ui'
import type { ToolRecord } from '@/app/(dashboard)/tools/tool-form'

export function ToolSettingsList({ basePath = '/tools' }: { basePath?: string }) {
  const load = useCallback(
    (signal: AbortSignal) => request<ToolRecord[]>('/api/tools', { signal }),
    [],
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  if (loading && !data) return <SkeletonRows rows={3} />
  if (error)
    return (
      <ErrorState
        title="Could not load collection setups"
        detail="Nothing has been changed."
        onRetry={refresh}
      />
    )
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={<ToolIcon size={22} />}
        title="Save customer details to a sheet"
        description="Start with a sales enquiry or support request, then attach it to an agent."
        action={
          <LinkButton href={`${basePath}/new`} variant="primary" size="sm">
            Create collection setup
          </LinkButton>
        }
      />
    )

  return (
    <ul>
      {data.map((tool) => (
        <li key={tool.id}>
          <Link
            href={`${basePath}/${tool.id}`}
            className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{tool.name}</span>
                <Badge variant="info">{tool.sheetTab}</Badge>
                {!tool.enabled && <Badge variant="neutral">Turned off</Badge>}
                {!tool.hasSinkUrl && <Badge variant="warning">Sheet not connected</Badge>}
              </span>
              <span className="mt-1 block text-sm leading-5 text-ink-muted">
                {tool.description}
              </span>
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

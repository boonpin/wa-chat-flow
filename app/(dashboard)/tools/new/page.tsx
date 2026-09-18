'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  ErrorState,
  PageBody,
  PageHeader,
  Panel,
  Skeleton,
  request,
  useAsyncData,
} from '@/components/ui'
import { ToolForm, type BotChoice } from '../tool-form'

export default function NewToolPage() {
  const technical = usePathname().startsWith('/settings/technical/google-sheets')
  const returnHref = technical ? '/settings/technical/google-sheets' : '/tools'
  const load = useCallback(
    (signal: AbortSignal) => request<BotChoice[]>('/api/bots', { signal }),
    [],
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  return (
    <PageBody width="form">
      <PageHeader
        title={technical ? 'Create collection setup' : 'Create tool'}
        description="Choose what to capture, connect a sheet, and let an agent use it."
        back={{ href: returnHref, label: technical ? 'Google Sheets' : 'Tools' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Panel>
          <ErrorState title="Could not open the editor" detail={error} onRetry={refresh} />
        </Panel>
      ) : (
        <ToolForm tool={null} bots={data!} onBotsChanged={refresh} returnHref={returnHref} />
      )}
    </PageBody>
  )
}

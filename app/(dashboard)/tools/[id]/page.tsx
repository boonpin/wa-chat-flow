'use client'

import { useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  EmptyState,
  ErrorState,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  Skeleton,
  request,
  useAsyncData,
} from '@/components/ui'
import { ToolForm, type BotChoice, type ToolRecord } from '../tool-form'

export default function EditToolPage() {
  const { id } = useParams<{ id: string }>()

  const load = useCallback(async (signal: AbortSignal) => {
    const [tools, bots] = await Promise.all([
      request<ToolRecord[]>('/api/tools', { signal }),
      request<BotChoice[]>('/api/bots', { signal }),
    ])
    return { tools, bots }
  }, [])
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const tool = data?.tools.find((t) => t.id === id) ?? null

  return (
    <PageBody width="form">
      <PageHeader
        title={tool?.name ?? 'Edit tool'}
        description={tool ? 'Changes apply to the next capture this tool makes.' : undefined}
        back={{ href: '/tools', label: 'Tools' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Panel>
          <ErrorState title="Could not open this tool" detail={error} onRetry={refresh} />
        </Panel>
      ) : !tool ? (
        <Panel>
          <EmptyState
            title="This tool no longer exists"
            description="It may have been deleted. Details it captured are kept under Captures."
            action={
              <LinkButton href="/tools?view=captures" variant="secondary" size="sm">
                View captures
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        <ToolForm tool={tool} bots={data!.bots} onBotsChanged={refresh} />
      )}
    </PageBody>
  )
}

'use client'

import { useCallback } from 'react'
import {
  ErrorState,
  PageBody,
  PageHeader,
  Panel,
  Skeleton,
  request,
  useAsyncData,
} from '@/components/ui'
import { BotForm, type BotRecord, type ToolChoice } from '../bot-form'

export default function NewBotPage() {
  const load = useCallback(async (signal: AbortSignal) => {
    const [bots, tools] = await Promise.all([
      request<BotRecord[]>('/api/bots', { signal }),
      request<ToolChoice[]>('/api/tools', { signal }),
    ])
    return { bots, tools }
  }, [])
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const currentDefault = data?.bots.find((b) => b.isDefault) ?? null

  return (
    <PageBody width="form">
      <PageHeader
        title="Create AI bot"
        description="Describe what the bot should do, then connect it to a model."
        back={{ href: '/bots', label: 'AI bots' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Panel>
          <ErrorState title="Could not open the editor" detail={error} onRetry={refresh} />
        </Panel>
      ) : (
        <BotForm bot={null} tools={data!.tools} otherDefaultName={currentDefault?.name ?? null} />
      )}
    </PageBody>
  )
}

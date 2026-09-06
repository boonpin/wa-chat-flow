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
import { BotForm, type BotRecord, type ProviderChoice, type ToolChoice } from '../bot-form'

export default function EditBotPage() {
  const { id } = useParams<{ id: string }>()

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [bots, tools, providers] = await Promise.all([
        request<BotRecord[]>('/api/bots', { signal }),
        request<ToolChoice[]>('/api/tools', { signal }),
        request<ProviderChoice[]>('/api/ai-providers', { signal }),
      ])
      return { bots, tools, providers }
    },
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const bot = data?.bots.find((b) => b.id === id) ?? null
  const otherDefault = data?.bots.find((b) => b.isDefault && b.id !== id) ?? null

  return (
    <PageBody width="form">
      <PageHeader
        title={bot?.name ?? 'Edit bot'}
        description={bot ? 'Changes take effect for new replies as soon as you save.' : undefined}
        back={{ href: '/bots', label: 'AI bots' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Panel>
          <ErrorState title="Could not open this bot" detail={error} onRetry={refresh} />
        </Panel>
      ) : !bot ? (
        // A deep link to a deleted record gets its own state, not an empty form.
        <Panel>
          <EmptyState
            title="This bot no longer exists"
            description="It may have been deleted from another session."
            action={
              <LinkButton href="/bots" variant="secondary" size="sm">
                Back to AI bots
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        <BotForm
          bot={bot}
          tools={data!.tools}
          providers={data!.providers}
          otherDefaultName={otherDefault?.name ?? null}
        />
      )}
    </PageBody>
  )
}

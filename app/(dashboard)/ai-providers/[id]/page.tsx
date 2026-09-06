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
import { ProviderForm, type ProviderRecord } from '../provider-form'
import { UsagePanel } from '../usage-panel'

export default function EditAiProviderPage() {
  const { id } = useParams<{ id: string }>()

  const load = useCallback(
    (signal: AbortSignal) => request<ProviderRecord[]>('/api/ai-providers', { signal }),
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const provider = data?.find((p) => p.id === id) ?? null

  return (
    <PageBody width="form">
      <PageHeader
        title={provider?.name ?? 'Edit AI provider'}
        description={
          provider ? 'Changes take effect for new replies as soon as you save.' : undefined
        }
        back={{ href: '/ai-providers', label: 'AI providers' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Panel>
          <ErrorState title="Could not open this provider" detail={error} onRetry={refresh} />
        </Panel>
      ) : !provider ? (
        // A deep link to a deleted record gets its own state, not an empty form.
        <Panel>
          <EmptyState
            title="This AI provider no longer exists"
            description="It may have been deleted from another session."
            action={
              <LinkButton href="/ai-providers" variant="secondary" size="sm">
                Back to AI providers
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          <ProviderForm provider={provider} />
          <UsagePanel providerId={provider.id} />
        </div>
      )}
    </PageBody>
  )
}

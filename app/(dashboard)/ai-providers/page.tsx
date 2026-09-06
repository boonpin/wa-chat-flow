'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import {
  Badge,
  Banner,
  ChevronRight,
  EmptyState,
  ErrorState,
  KeyIcon,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PlusIcon,
  SkeletonRows,
  request,
  tokenCount,
  useAsyncData,
} from '@/components/ui'
import { providerLabel } from '@/lib/ai/provider-kinds'
import type { ProviderRecord } from './provider-form'

export default function AiProvidersPage() {
  const load = useCallback(
    (signal: AbortSignal) => request<ProviderRecord[]>('/api/ai-providers', { signal }),
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const providers = data ?? []
  const keyless = providers.filter((p) => !p.hasApiKey)

  return (
    <PageBody width="content">
      <PageHeader
        title="AI providers"
        description="An account the AI answers through: the vendor, the key that pays for it, and the model to run."
        actions={
          <LinkButton href="/ai-providers/new" variant="primary">
            <PlusIcon size={15} />
            Add provider
          </LinkButton>
        }
      />

      {keyless.length > 0 && (
        <Banner tone="info" title="Some providers have no key of their own" className="mb-5">
          {keyless.map((p) => p.name).join(', ')} fall back to the key set on the server. Replies
          fail if the server has none either.
        </Banner>
      )}

      <Panel>
        {loading && !data ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <ErrorState
            title="Could not load your AI providers"
            detail="Nothing has been changed. Try again."
            onRetry={refresh}
          />
        ) : providers.length === 0 ? (
          <EmptyState
            icon={<KeyIcon size={22} />}
            title="Add the AI account your bots answer through"
            description="Choose a vendor, paste its API key, and pick a model from what that key can reach."
            action={
              <LinkButton href="/ai-providers/new" variant="primary" size="sm">
                Add AI provider
              </LinkButton>
            }
          />
        ) : (
          <ul>
            {providers.map((provider) => (
              <li key={provider.id}>
                <Link
                  href={`/ai-providers/${provider.id}`}
                  className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{provider.name}</span>
                      <Badge variant="info">{providerLabel(provider.kind)}</Badge>
                      {!provider.enabled && <Badge variant="neutral">Turned off</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-ink-muted">
                      {provider.model} ·{' '}
                      {provider.hasApiKey ? 'own API key stored' : 'using the server key'} ·{' '}
                      {provider.botCount === 0
                        ? 'no bots yet'
                        : `${provider.botCount} bot${provider.botCount === 1 ? '' : 's'}`}
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      {provider.usage.calls === 0
                        ? 'No API calls recorded yet'
                        : `${tokenCount(provider.usage.inputTokens)} tokens in · ` +
                          `${tokenCount(provider.usage.outputTokens)} out · ` +
                          `${tokenCount(provider.usage.calls)} calls`}
                    </span>
                  </span>
                  <span className="mt-0.5 shrink-0 text-ink-soft">
                    <ChevronRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-4 text-xs leading-4 text-ink-soft">
        Token counts are what the vendor reported on each call, recorded as the call happened. They
        are this app’s own record, not a copy of your vendor invoice.
      </p>
    </PageBody>
  )
}

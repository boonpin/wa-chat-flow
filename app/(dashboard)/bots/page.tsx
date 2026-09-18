'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import {
  Badge,
  Banner,
  BotIcon,
  ChevronRight,
  EmptyState,
  ErrorState,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PlusIcon,
  SkeletonRows,
  request,
  useAsyncData,
} from '@/components/ui'
import type { BotRecord, ProviderChoice, ToolChoice } from './bot-form'
import { providerLabel } from '@/lib/ai/provider-kinds'
import { resolveFallbackBot, useWorkspaceStatus } from '@/components/workspace-status'

export default function BotsPage() {
  const { status } = useWorkspaceStatus()
  const load = useCallback(async (signal: AbortSignal) => {
    const [bots, tools, providers] = await Promise.all([
      request<BotRecord[]>('/api/bots', { signal }),
      request<ToolChoice[]>('/api/tools', { signal }),
      request<ProviderChoice[]>('/api/ai-providers', { signal }),
    ])
    return { bots, tools, providers }
  }, [])
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const fallback = resolveFallbackBot(status)
  const bots = data?.bots ?? []
  const toolsById = new Map((data?.tools ?? []).map((t) => [t.id, t]))

  return (
    <PageBody width="content">
      <PageHeader
        title="AI agents"
        description="Maintain different agents for sales, support or customer groups. Each has its own instructions and details to collect."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/bots/new" variant="secondary">
              Custom instructions
            </LinkButton>
            <LinkButton href="/settings/business?new=1" variant="primary">
              <PlusIcon size={15} />
              Add AI agent
            </LinkButton>
          </div>
        }
      />

      {data && data.providers.length === 0 && (
        <Banner tone="warning" title="No AI provider is configured" className="mb-5">
          An agent answers through an AI provider — the vendor, key and model live there.{' '}
          <Link href="/ai-providers/new" className="font-semibold underline underline-offset-2">
            Add one
          </Link>{' '}
          before creating an agent.
        </Banner>
      )}

      {fallback.conflict && fallback.bot && (
        <Banner tone="warning" title="Two agents are marked as the default" className="mb-5">
          Reply settings select <strong>{fallback.bot.name}</strong>, while{' '}
          <strong>{fallback.conflict.name}</strong> still carries the older default flag.{' '}
          <strong>{fallback.bot.name}</strong> is the one that answers.{' '}
          <Link href="/automation/replies" className="font-semibold underline underline-offset-2">
            Review reply settings
          </Link>
        </Banner>
      )}

      <Panel>
        {loading && !data ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <ErrorState
            title="Could not load your agents"
            detail="Nothing has been changed. Try again."
            onRetry={refresh}
          />
        ) : bots.length === 0 ? (
          <EmptyState
            icon={<BotIcon size={22} />}
            title="Create an AI agent for your customers"
            description="Set its instructions and choose the tools it can use."
            action={
              <LinkButton href="/settings/business?new=1" variant="primary" size="sm">
                Add AI agent
              </LinkButton>
            }
          />
        ) : (
          <ul>
            {bots.map((bot) => {
              const isFallback = fallback.bot?.id === bot.id
              const attached = bot.toolIds.map((id) => toolsById.get(id)?.name).filter(Boolean)
              return (
                <li key={bot.id}>
                  <Link
                    href={
                      bot.guidedSetup ? `/settings/business?botId=${bot.id}` : `/bots/${bot.id}`
                    }
                    className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{bot.name}</span>
                        {isFallback && <Badge variant="success">Default</Badge>}
                        {!bot.enabled && <Badge variant="neutral">Turned off</Badge>}
                        {bot.providerEnabled === false && (
                          <Badge variant="warning">Provider off</Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-ink-muted">
                        {bot.agentRole || 'Customer enquiries using custom instructions'}
                      </span>
                      <span className="mt-1 block text-xs text-ink-muted">
                        {bot.providerName ? (
                          <>
                            {bot.providerName} · {providerLabel(bot.provider ?? '')} · {bot.model}
                          </>
                        ) : (
                          // The provider row is gone, so this bot cannot answer at
                          // all — say so here rather than only inside the editor.
                          <span className="font-medium text-danger">No AI provider</span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-ink-soft">
                        {attached.length > 0
                          ? `Collects: ${attached.join(', ')}`
                          : 'No customer details to collect'}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 text-ink-soft">
                      <ChevronRight size={16} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mt-5">
        <div className="space-y-3 p-4 md:p-5">
          <h2 className="text-sm font-semibold">Choose an agent for each customer group</h2>
          <p className="text-sm text-ink-muted">
            Use Contacts to choose an agent for a customer’s future conversations, including several
            selected contacts at once. In Inbox, choose the agent for the current conversation.
            Customers without a selected agent use the workspace default. Customer groups are
            assigned by your team.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/contacts" variant="secondary" size="sm">
              Choose customers
            </LinkButton>
            <LinkButton href="/automation/replies" variant="secondary" size="sm">
              Workspace default
            </LinkButton>
          </div>
        </div>
      </Panel>
      <p className="mt-4 text-xs leading-4 text-ink-soft">
        An agent holds the instructions; its AI provider holds the key and the model. Two agents can
        share one provider, and their tokens are counted against it separately.
      </p>
    </PageBody>
  )
}

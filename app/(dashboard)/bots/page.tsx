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
import type { BotRecord, ToolChoice } from './bot-form'
import { resolveFallbackBot, useWorkspaceStatus } from '@/components/workspace-status'

export default function BotsPage() {
  const { status } = useWorkspaceStatus()
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [bots, tools] = await Promise.all([
        request<BotRecord[]>('/api/bots', { signal }),
        request<ToolChoice[]>('/api/tools', { signal }),
      ])
      return { bots, tools }
    },
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const fallback = resolveFallbackBot(status)
  const bots = data?.bots ?? []
  const toolsById = new Map((data?.tools ?? []).map((t) => [t.id, t]))

  return (
    <PageBody width="content">
      <PageHeader
        title="AI bots"
        description="A bot holds the instructions the AI answers with, and the tools it is allowed to use."
        actions={
          <LinkButton href="/bots/new" variant="primary">
            <PlusIcon size={15} />
            Create bot
          </LinkButton>
        }
      />

      {fallback.conflict && fallback.bot && (
        <Banner tone="warning" title="Two bots are marked as the default" className="mb-5">
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
            title="Could not load your bots"
            detail="Nothing has been changed. Try again."
            onRetry={refresh}
          />
        ) : bots.length === 0 ? (
          <EmptyState
            icon={<BotIcon size={22} />}
            title="Create an AI bot for your customers"
            description="Set its instructions and choose the tools it can use."
            action={
              <LinkButton href="/bots/new" variant="primary" size="sm">
                Create AI bot
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
                    href={`/bots/${bot.id}`}
                    className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{bot.name}</span>
                        {isFallback && <Badge variant="success">Default</Badge>}
                        {!bot.enabled && <Badge variant="neutral">Turned off</Badge>}
                      </span>
                      <span className="mt-1 block text-sm text-ink-muted">
                        {bot.provider === 'openai' ? 'OpenAI' : 'Google Gemini'} · {bot.model} ·{' '}
                        {bot.hasApiKey ? 'own API key stored' : 'using the server key'}
                      </span>
                      <span className="mt-1 block text-sm text-ink-soft">
                        {attached.length > 0
                          ? `Tools: ${attached.join(', ')}`
                          : 'No tools attached'}
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

      <p className="mt-4 text-xs leading-4 text-ink-soft">
        A stored API key does not prove the key or model works. The first real conversation is what
        verifies it.
      </p>
    </PageBody>
  )
}

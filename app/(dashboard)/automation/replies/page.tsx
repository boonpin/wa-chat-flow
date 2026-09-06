'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Banner,
  Button,
  ErrorState,
  FormSection,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RadioCards,
  Select,
  Skeleton,
  StatusFact,
  errorMessage,
  request,
  useAsyncData,
  useToast,
} from '@/components/ui'
import { resolveFallbackBot, useWorkspaceStatus, type BotSummary } from '@/components/workspace-status'
import {
  AUTO_REPLY_MODES,
  AUTO_REPLY_MODE_COPY,
  type AutoReplyMode,
} from '@/lib/settings/auto-reply'

interface Settings {
  autoReplyMode: AutoReplyMode
  defaultBotId: string | null
}

export default function ReplySettingsPage() {
  const { toast } = useToast()
  const workspace = useWorkspaceStatus()

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [settings, bots] = await Promise.all([
        request<Settings>('/api/settings', { signal }),
        request<BotSummary[]>('/api/bots', { signal }),
      ])
      return { settings, bots }
    },
    []
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  // Null means "no local edits" — the form then shows exactly what the server
  // confirmed. There is no copying step, so a draft can never be mistaken for
  // the saved policy and a refresh cannot silently overwrite an edit.
  const [edits, setEdits] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const saved = data?.settings ?? null
  const bots = useMemo(() => data?.bots ?? [], [data])
  const draft = edits ?? saved
  const dirty = useMemo(
    () => !!saved && !!edits && JSON.stringify(saved) !== JSON.stringify(edits),
    [saved, edits]
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const fallback = resolveFallbackBot(
    data ? { channels: [], settings: data.settings, bots: data.bots } : null
  )
  const savedPolicy = AUTO_REPLY_MODE_COPY[saved?.autoReplyMode ?? 'off'] ?? AUTO_REPLY_MODE_COPY.off
  const draftBot = draft?.defaultBotId ? bots.find((b) => b.id === draft.defaultBotId) : null

  async function save() {
    if (!draft) return
    setSaving(true)
    setSaveError(null)
    try {
      await request('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      toast('Reply settings saved.')
      setEdits(null)
      refresh()
      workspace.refresh()
    } catch (e) {
      setSaveError(errorMessage(e, 'Your changes were not saved. Your edits are still here.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageBody width="form">
      <PageHeader
        title="Reply settings"
        description="One policy decides how much the AI is allowed to answer, and one bot answers whatever has no bot of its own."
        back={{ href: '/settings', label: 'Settings' }}
      />

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error || !draft || !saved ? (
        <Panel>
          <ErrorState
            title="Could not load reply settings"
            detail="Nothing has been changed."
            onRetry={refresh}
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {/* Saved state first, and it always describes the server — never the
              switch the operator has just flipped but not saved. */}
          <Panel>
            <PanelHeader title="Currently saved" />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <StatusFact label="AI replies">
                <Badge variant={savedPolicy.tone} dot>
                  {savedPolicy.label}
                </Badge>
              </StatusFact>
              <StatusFact label="Default bot">
                <span className="font-medium">{fallback.bot?.name ?? 'None'}</span>
                {fallback.source === 'flag' && (
                  <span className="text-xs text-ink-soft">from the bot’s own default flag</span>
                )}
              </StatusFact>
            </PanelBody>
          </Panel>

          {fallback.conflict && fallback.bot && (
            <Banner tone="warning" title="Two bots are marked as the default">
              This page selects <strong>{fallback.bot.name}</strong>, while{' '}
              <strong>{fallback.conflict.name}</strong> still carries an older default flag from a
              previous version. <strong>{fallback.bot.name}</strong> is the one that answers. Saving
              a default here clears the flag on every other bot.
            </Banner>
          )}

          {saveError && (
            <Banner tone="danger" title="Changes were not saved">
              {saveError}
            </Banner>
          )}

          <FormSection
            title="How much the AI answers"
            scope="Applies to every number. Messages always arrive and you can always reply by hand; campaigns are unaffected."
          >
            <RadioCards<AutoReplyMode>
              legend="How much the AI answers"
              hideLegend
              value={draft.autoReplyMode}
              onChange={(mode) => setEdits({ ...draft, autoReplyMode: mode })}
              options={AUTO_REPLY_MODES.map((mode) => ({
                value: mode,
                label: AUTO_REPLY_MODE_COPY[mode].label,
                detail: AUTO_REPLY_MODE_COPY[mode].detail,
                badge:
                  dirty && draft.autoReplyMode === mode && saved.autoReplyMode !== mode ? (
                    <Badge variant="warning">Unsaved</Badge>
                  ) : undefined,
              }))}
            />

            {draft.autoReplyMode === 'existing' && (
              <Banner tone="warning" title="Nobody new gets an automatic reply">
                A conversation that opens from now on starts on human replies and stays there until
                you switch it over in Inbox — the second and third message are not answered either.
                Conversations already running on AI are untouched. Customers who write in for the
                first time during this period keep AI off afterwards too; switch them on in Contacts
                when you want them answered.
              </Banner>
            )}

            {draft.autoReplyMode === 'off' && (
              <Banner tone="warning" title="What turning it off does">
                No conversation receives an automatic reply, even one set to AI and even for a
                customer whose contact has AI switched on. Turning it back on later does not change
                any conversation that has since been set to human replies.
              </Banner>
            )}
          </FormSection>

          <FormSection
            title="Default bot"
            scope="Used when a conversation and its customer both have no bot of their own."
          >
            <Select
              label="Bot"
              value={draft.defaultBotId ?? ''}
              onChange={(e) => setEdits({ ...draft, defaultBotId: e.target.value || null })}
              hint="A bot that is turned off is skipped even if it is chosen here."
            >
              <option value="">No default bot</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                  {bot.enabled ? '' : ' (turned off)'}
                </option>
              ))}
            </Select>

            {draft.defaultBotId === null && (
              <Banner tone="warning" title="No default bot selected">
                Conversations without their own bot will not receive an AI reply.{' '}
                {fallback.source === 'flag' && fallback.bot
                  ? `“${fallback.bot.name}” still carries an older default flag and would answer until that flag is cleared.`
                  : ''}
              </Banner>
            )}

            {draftBot && !draftBot.enabled && (
              <Banner tone="warning" title={`“${draftBot.name}” is turned off`}>
                A bot that is turned off is never selected. Turn it on in the bot editor for this
                default to have any effect.{' '}
                <Link href={`/bots/${draftBot.id}`} className="font-semibold underline underline-offset-2">
                  Open the bot
                </Link>
              </Banner>
            )}

            {bots.length === 0 && (
              <p className="text-sm text-ink-muted">
                No bots exist yet.{' '}
                <Link href="/bots/new" className="font-medium text-action hover:underline">
                  Create one
                </Link>{' '}
                before turning AI replies on.
              </p>
            )}
          </FormSection>

          <Panel>
            <PanelHeader title="How a reply is decided" />
            <PanelBody>
              <ol className="space-y-3">
                {[
                  {
                    label: 'AI replies are allowed here',
                    detail: 'The policy above. If it is off, nothing below runs.',
                  },
                  {
                    label: 'The conversation is old enough to qualify',
                    detail:
                      'On “existing conversations only”, a thread that opens now starts on human replies instead.',
                  },
                  {
                    label: 'The conversation is set to AI replies',
                    detail: 'Set per conversation in Inbox, and inherited from the customer.',
                  },
                  {
                    label: 'The message is text the bot can read',
                    detail: 'Images, audio and documents are stored but not answered.',
                  },
                  {
                    label: 'A bot is available',
                    detail:
                      'The conversation’s bot, then the customer’s bot, then this default. Bots that are turned off are skipped.',
                  },
                ].map((step, i) => (
                  <li key={step.label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-inset text-xs font-semibold text-ink-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{step.label}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
                        {step.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </PanelBody>
          </Panel>

          <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-xs font-medium text-warning">
              {dirty ? 'Unsaved changes' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setEdits(null)}
                disabled={!dirty || saving}
              >
                Discard
              </Button>
              <Button onClick={save} pending={saving} pendingLabel="Saving…" disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </PageBody>
  )
}

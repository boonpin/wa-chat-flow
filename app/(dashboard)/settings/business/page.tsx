'use client'

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Banner,
  Button,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  Select,
  Skeleton,
  Textarea,
  request,
  useAsyncData,
  useToast,
  errorMessage,
} from '@/components/ui'
import type { BusinessDetails } from '@/lib/settings/business'
import type { BotRecord, ProviderChoice } from '../../bots/bot-form'

const EMPTY: BusinessDetails = {
  agentRole: '',
  businessName: '',
  openingHours: '',
  services: '',
  commonQuestions: '',
  language: '',
  handoffRules: '',
}
type Profile = BusinessDetails & { botId: string; agentName: string; updatedAt: string }

function AgentSetupPage() {
  const router = useRouter(),
    params = useSearchParams()
  const requestedId = params.get('botId'),
    creating = params.get('new') === '1'
  const scope = creating ? 'new' : (requestedId ?? 'overview')
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [profile, providers, agents] = await Promise.all([
        requestedId && !creating
          ? request<Profile | null>(
              `/api/settings/business?botId=${encodeURIComponent(requestedId)}`,
              { signal },
            )
          : Promise.resolve(null),
        request<ProviderChoice[]>('/api/ai-providers', { signal }),
        request<BotRecord[]>('/api/bots', { signal }),
      ])
      return { profile, providers, agents, scope }
    },
    [requestedId, creating, scope],
  )
  const data = useAsyncData(load, [load])
  const [profile, setProfile] = useState(EMPTY),
    [agentName, setAgentName] = useState(''),
    [providerId, setProviderId] = useState('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [testing, setTesting] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const { toast } = useToast()
  const selected = !creating
    ? data.data?.agents.find((agent) => agent.id === requestedId)
    : undefined

  useEffect(() => {
    if (scope === 'overview') router.replace('/bots')
  }, [scope, router])
  useEffect(() => {
    if (data.data?.scope !== scope) return
    const agent = data.data.agents.find((agent) => agent.id === requestedId)
    setProfile(data.data.profile ?? EMPTY)
    setAgentName(creating ? '' : (agent?.name ?? ''))
    setProviderId(creating ? '' : (agent?.providerId ?? ''))
    setQuestion('')
    setAnswer('')
    setError(null)
    setConfirmReplace(false)
  }, [data.data, scope, requestedId, creating])

  const dirty =
    agentName !== (selected?.name ?? '') ||
    Object.keys(EMPTY).some(
      (key) =>
        profile[key as keyof BusinessDetails] !==
        (data.data?.profile?.[key as keyof BusinessDetails] ?? EMPTY[key as keyof BusinessDetails]),
    )
  async function save(replaceInstructions = false) {
    setPending(true)
    setError(null)
    setAnswer('')
    try {
      const saved = await request<Profile>('/api/settings/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          agentName,
          providerId,
          newAgent: creating,
          ...(creating ? {} : { botId: requestedId, expectedUpdatedAt: selected?.updatedAt }),
          replaceInstructions,
        }),
      })
      setConfirmReplace(false)
      toast(
        `${saved.agentName} saved. Choose this agent for customers in Contacts or for this conversation in Inbox.`,
      )
      if (creating) router.replace(`/settings/business?botId=${saved.botId}`)
      else data.refresh()
    } catch (error) {
      setConfirmReplace(false)
      setError(errorMessage(error, 'Could not save this AI agent.'))
    } finally {
      setPending(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    // Converting an existing custom prompt must be an explicit, reviewable choice.
    if (selected && !selected.guidedSetup) setConfirmReplace(true)
    else void save()
  }
  async function preview() {
    if (!selected) return
    setTesting(true)
    setError(null)
    setAnswer('')
    try {
      const result = await request<{ text: string }>('/api/settings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: selected.id, question }),
      })
      setAnswer(result.text)
    } catch (error) {
      setError(errorMessage(error, 'Could not try this question.'))
    } finally {
      setTesting(false)
    }
  }
  return (
    <PageBody width="form">
      <PageHeader
        title={creating ? 'Add AI agent' : (selected?.name ?? 'AI agent details')}
        description="Give this agent a job and the information it needs for its customers. Each agent has its own instructions and collection settings."
        back={{ href: '/bots', label: 'AI agents' }}
      />
      {data.error ? (
        <ErrorState title="Could not load this AI agent" onRetry={data.refresh} />
      ) : !data.data || data.data.scope !== scope || scope === 'overview' ? (
        <Skeleton className="h-96 w-full" />
      ) : !creating && !selected ? (
        <EmptyState
          title="This AI agent no longer exists"
          action={<LinkButton href="/bots">View AI agents</LinkButton>}
        />
      ) : (
        <div className="space-y-6">
          {error && (
            <Banner tone="danger" title="Could not save or test this agent">
              {error}
            </Banner>
          )}
          {selected && !selected.guidedSetup && (
            <Banner tone="info" title="Review this agent’s saved instructions">
              You can keep editing its existing instructions below. Saving guided details here asks
              you to replace this agent’s instructions; its collected fields and other agents are
              preserved.
            </Banner>
          )}
          {selected?.handlerType !== undefined && selected.handlerType !== 'direct' ? (
            <Banner tone="warning" title="Use the custom editor for this agent type">
              <LinkButton href={`/bots/${selected.id}`} variant="secondary">
                Edit AI agent
              </LinkButton>
            </Banner>
          ) : (
            <Panel>
              <PanelBody>
                <form onSubmit={submit} className="space-y-4">
                  <Input
                    label="Agent name"
                    hint="For example: Sales enquiries, Customer support or Wholesale customers."
                    required
                    maxLength={200}
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                  <Textarea
                    label="Role and customer group"
                    hint="Explain who this agent helps and what it should handle. For example: answer trade pricing questions for wholesale customers."
                    value={profile.agentRole}
                    onChange={(e) => setProfile({ ...profile, agentRole: e.target.value })}
                    rows={3}
                  />
                  <Input
                    label="Business name"
                    required
                    maxLength={200}
                    value={profile.businessName}
                    onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  />
                  <Textarea
                    label="Opening hours"
                    hint="Include days, hours and your timezone."
                    value={profile.openingHours}
                    onChange={(e) => setProfile({ ...profile, openingHours: e.target.value })}
                    rows={2}
                  />
                  <Textarea
                    label="Services and prices"
                    hint="Include the information this agent should share with its customer group."
                    value={profile.services}
                    onChange={(e) => setProfile({ ...profile, services: e.target.value })}
                  />
                  <Textarea
                    label="Common questions and answers"
                    value={profile.commonQuestions}
                    onChange={(e) => setProfile({ ...profile, commonQuestions: e.target.value })}
                  />
                  <Input
                    label="Reply language"
                    hint="For example: English and Malay, or follow the customer’s language."
                    value={profile.language}
                    onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                  />
                  <Textarea
                    label="When should your team help?"
                    hint="For example: refunds, complaints, unknown prices or a request for a person. These instructions do not create automatic staff alerts."
                    value={profile.handoffRules}
                    onChange={(e) => setProfile({ ...profile, handoffRules: e.target.value })}
                    rows={3}
                  />
                  {creating && (
                    <Select
                      label="AI connection"
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      required
                    >
                      <option value="">Choose the connection prepared for your business</option>
                      {data.data.providers.map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.enabled}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  {creating && !data.data.providers.length && (
                    <LinkButton href="/ai-providers/new" variant="secondary">
                      Add AI connection
                    </LinkButton>
                  )}
                  <p className="text-sm text-ink-muted">
                    Saving replaces this agent’s instructions only. It does not change which
                    customers use it, the workspace default, or whether AI replies are paused.
                  </p>
                  <Button type="submit" pending={pending} pendingLabel="Saving…" disabled={testing}>
                    Save AI agent
                  </Button>
                </form>
              </PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelBody>
              <h2 className="text-lg font-semibold">Try a customer question</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {selected
                  ? `Tests ${selected.name} using its saved instructions.`
                  : 'Save this agent before trying a question.'}{' '}
                This preview may incur AI charges. It sends no WhatsApp message and saves no
                customer details to Google Sheets.
              </p>
              <div className="mt-4 space-y-3">
                <Textarea
                  label="Customer question"
                  value={question}
                  maxLength={2000}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                {dirty && (
                  <p className="text-sm text-ink-muted">Save your changes before testing them.</p>
                )}
                <Button
                  onClick={preview}
                  pending={testing}
                  disabled={
                    !selected ||
                    !question.trim() ||
                    pending ||
                    dirty ||
                    selected.handlerType !== 'direct'
                  }
                >
                  Try question
                </Button>
                {answer && (
                  <div
                    className="whitespace-pre-wrap rounded-md bg-inset p-4 text-base"
                    role="status"
                  >
                    {answer}
                  </div>
                )}
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <h2 className="text-lg font-semibold">Choose who uses this agent</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Set a customer’s agent in Contacts for future conversations, or choose an agent in
                Inbox for the current conversation. The workspace default handles customers without
                a selected agent. AI does not classify customer groups automatically.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <LinkButton href="/contacts" variant="secondary">
                  Choose customers
                </LinkButton>
                <LinkButton href="/inbox" variant="secondary">
                  Open Inbox
                </LinkButton>
                <LinkButton href="/automation/replies" variant="secondary">
                  Workspace default & reply rules
                </LinkButton>
              </div>
            </PanelBody>
          </Panel>
          <Disclosure summary="Custom instructions & collection settings">
            <p className="text-sm text-ink-muted">
              Each agent can have different instructions, AI connections and customer details to
              collect. Guided saving replaces only this agent’s instructions; use the custom editor
              for its collection settings or a custom prompt.
            </p>
            <LinkButton
              href={selected ? `/bots/${selected.id}` : '/bots/new'}
              variant="secondary"
              className="mt-3"
            >
              Open custom editor
            </LinkButton>
          </Disclosure>
        </div>
      )}
      <ConfirmDialog
        open={confirmReplace}
        onClose={() => !pending && setConfirmReplace(false)}
        onConfirm={() => void save(true)}
        pending={pending}
        title={`Replace ${selected?.name ?? 'this agent'}’s instructions?`}
        description="Your guided details will replace this agent’s existing custom instructions. Its collection settings, other agents and customer assignments stay as they are."
        confirmLabel="Replace and save"
        destructive
      />
    </PageBody>
  )
}

export default function BusinessSetupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AgentSetupPage />
    </Suspense>
  )
}

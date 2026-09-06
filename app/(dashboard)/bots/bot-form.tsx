'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Field,
  FormSection,
  Input,
  Panel,
  SecretField,
  Select,
  Switch,
  Textarea,
  errorMessage,
  request,
  useToast,
} from '@/components/ui'

export interface BotRecord {
  id: string
  name: string
  provider: string
  hasApiKey: boolean
  model: string
  prompt: string
  enabled: boolean
  isDefault: boolean
  toolIds: string[]
}

export interface ToolChoice {
  id: string
  name: string
  description: string
  sheetTab: string
  enabled: boolean
  hasSinkUrl: boolean
}

/**
 * Templates are starting points for the instructions, phrased as a job rather
 * than a model persona. Applying one asks first when there is already text to
 * lose.
 */
const TEMPLATES = [
  {
    label: 'General enquiries',
    text: 'You answer WhatsApp messages for our business. Reply clearly and briefly, in the customer’s own language. If you do not know something, say so and offer to pass the question to a person.',
  },
  {
    label: 'Customer support',
    text: 'You handle customer support over WhatsApp. Find out what has gone wrong, confirm the details back to the customer, and explain the next step. If the issue needs a person, say that someone will follow up and stop making promises about timing.',
  },
  {
    label: 'Sales enquiries',
    text: 'You answer product and pricing questions over WhatsApp. Ask what the customer is looking for, describe the options plainly, and collect their details when they are interested. Do not invent prices, discounts or stock levels.',
  },
]

/** Suggestions, not a closed list — a stored or newer model ID must survive. */
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
}

const PROVIDER_LABEL: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini' }

interface FormState {
  name: string
  provider: string
  model: string
  prompt: string
  apiKey: string
  enabled: boolean
  isDefault: boolean
  toolIds: string[]
}

function initialState(bot: BotRecord | null): FormState {
  return {
    name: bot?.name ?? '',
    provider: bot?.provider ?? 'openai',
    model: bot?.model ?? 'gpt-4o-mini',
    prompt: bot?.prompt ?? '',
    // Always blank: the stored key is never sent to the browser, and blank
    // means "keep whatever is stored".
    apiKey: '',
    enabled: bot?.enabled ?? true,
    isDefault: bot?.isDefault ?? false,
    toolIds: bot?.toolIds ?? [],
  }
}

export function BotForm({
  bot,
  tools,
  otherDefaultName,
}: {
  bot: BotRecord | null
  tools: ToolChoice[]
  /** The bot that currently holds the default, if it is not this one. */
  otherDefaultName: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const isNew = bot === null

  const [form, setForm] = useState<FormState>(() => initialState(bot))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; prompt?: string }>({})
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const baseline = useMemo(() => initialState(bot), [bot])
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'name' || key === 'prompt') setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function applyTemplate(text: string) {
    if (form.prompt.trim() && form.prompt.trim() !== text.trim()) setPendingTemplate(text)
    else update('prompt', text)
  }

  function leaveTo(href: string) {
    if (dirty) setConfirmLeave(href)
    else router.push(href)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!form.name.trim()) nextErrors.name = 'Give this bot a name so you can recognise it later.'
    if (!form.prompt.trim()) nextErrors.prompt = 'Instructions are required — this is what the AI answers with.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setSaveError('Check the highlighted fields and try again.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const payload = { ...form, name: form.name.trim(), prompt: form.prompt.trim() }
      if (isNew) {
        await request('/api/bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast(`“${payload.name}” created.`)
      } else {
        await request(`/api/bots/${bot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast('Bot saved.')
      }
      router.push('/bots')
      router.refresh()
    } catch (err) {
      // Nothing is cleared: the edits stay on screen so they can be retried.
      setSaveError(errorMessage(err, 'Changes were not saved. Your edits are still here.'))
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      await request(`/api/bots/${bot!.id}`, { method: 'DELETE' })
      toast(`“${bot!.name}” deleted.`)
      router.push('/bots')
      router.refresh()
    } catch (err) {
      setConfirmDelete(false)
      setDeleting(false)
      toast(errorMessage(err, 'The bot was not deleted.'), 'error')
    }
  }

  const impact: string[] = []
  if (!form.enabled) impact.push('This bot will never be selected for an automatic reply while it is turned off.')
  if (form.isDefault && otherDefaultName)
    impact.push(`“${otherDefaultName}” will stop being the default when you save.`)
  if (form.isDefault && !otherDefaultName)
    impact.push('This bot will answer conversations that have no bot of their own.')

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {saveError && (
        <Banner tone="danger" title="Changes were not saved">
          {saveError}
        </Banner>
      )}

      {/* Behaviour first. Model plumbing is a dependency, not the point. */}
      <FormSection title="What this bot does" scope="The name is for you. The instructions are what the AI answers with.">
        <Input
          label="Bot name"
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Sales assistant"
        />

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Start from a template</span>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyTemplate(t.text)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Textarea
          label="Bot instructions"
          required
          rows={9}
          value={form.prompt}
          error={errors.prompt}
          onChange={(e) => update('prompt', e.target.value)}
          hint="Describe the job, the tone and what the bot must not do. The customer never sees this text."
          placeholder="You answer WhatsApp messages for our business…"
        />
      </FormSection>

      <FormSection
        title="Tools"
        scope="Tools let this bot save customer details to a Google Sheet mid-conversation. The AI decides when to use one from its description."
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => leaveTo('/tools')}>
            Manage tools
          </Button>
        }
      >
        {tools.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No tools exist yet.{' '}
            <button
              type="button"
              onClick={() => leaveTo('/tools/new')}
              className="cursor-pointer font-medium text-action hover:underline"
            >
              Create one
            </button>{' '}
            to let this bot capture enquiries.
          </p>
        ) : (
          <ul className="space-y-2">
            {tools.map((tool) => {
              const checked = form.toolIds.includes(tool.id)
              return (
                <li key={tool.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-inset/60 p-3 hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        update(
                          'toolIds',
                          e.target.checked
                            ? [...form.toolIds, tool.id]
                            : form.toolIds.filter((id) => id !== tool.id)
                        )
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-action-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{tool.name}</span>
                        <Badge variant="info">{tool.sheetTab}</Badge>
                        {!tool.enabled && <Badge variant="neutral">Turned off</Badge>}
                        {!tool.hasSinkUrl && <Badge variant="warning">Sheet not connected</Badge>}
                      </span>
                      <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
                        {tool.description}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </FormSection>

      <FormSection
        title="AI connection"
        scope="Which model answers, and the key it uses. A key is required unless the server is configured with one."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Provider"
            value={form.provider}
            onChange={(e) => update('provider', e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </Select>

          {/* A free-text field with suggestions. A fixed dropdown silently drops
              a stored model the moment the provider ships a new one. */}
          <Field
            label="Model"
            hint={`Type any model ID your ${PROVIDER_LABEL[form.provider] ?? 'provider'} account can use.`}
          >
            {({ id, describedBy }) => (
              <>
                <input
                  id={id}
                  aria-describedby={describedBy}
                  list={`${id}-models`}
                  value={form.model}
                  onChange={(e) => update('model', e.target.value)}
                  className="h-11 w-full rounded-md border border-[var(--input-border)]/70 bg-inset px-3
                    text-base text-ink hover:border-[var(--input-border)] md:h-10 md:text-sm"
                />
                <datalist id={`${id}-models`}>
                  {(MODEL_SUGGESTIONS[form.provider] ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>

        <SecretField
          label="API key"
          stored={bot?.hasApiKey ?? false}
          storedLabel="Stored"
          emptyLabel="Using the server key"
          value={form.apiKey}
          onChange={(e) => update('apiKey', e.target.value)}
          hint={
            bot?.hasApiKey
              ? 'A key is stored for this bot. Leave blank to keep it.'
              : 'Optional. Without one, the bot falls back to the key configured on the server.'
          }
          placeholder={bot?.hasApiKey ? '••••••••' : 'sk-…'}
        />
        <p className="text-xs leading-4 text-ink-soft">
          Saving a key stores it. It does not check that the key or model works — the first real
          conversation does that.
        </p>
      </FormSection>

      <FormSection title="Availability" scope="When this bot is allowed to answer.">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Bot is available</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              A bot that is turned off is skipped even when a conversation names it.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onChange={(v) => update('enabled', v)}
            label={`${form.name || 'This bot'} is available`}
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-line-soft pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Use as the default bot</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Answers conversations that have no bot of their own.
            </p>
          </div>
          <Switch
            checked={form.isDefault}
            onChange={(v) => update('isDefault', v)}
            label={`Use ${form.name || 'this bot'} as the default`}
          />
        </div>

        {impact.length > 0 && (
          <Banner tone="info" title="When you save">
            <ul className="list-disc space-y-0.5 pl-4">
              {impact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Banner>
        )}
      </FormSection>

      {/* The footer belongs to the form, not to the viewport — it never floats
          over content it does not own. */}
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          {!isNew && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete bot
            </Button>
          )}
          {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => leaveTo('/bots')}>
            Cancel
          </Button>
          <Button type="submit" pending={saving} pendingLabel="Saving…" disabled={!dirty && !isNew}>
            {isNew ? 'Create bot' : 'Save changes'}
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        onConfirm={() => {
          update('prompt', pendingTemplate!)
          setPendingTemplate(null)
        }}
        title="Replace the instructions?"
        description="This template will overwrite the instructions you have written. Nothing is saved until you save the bot."
        confirmLabel="Replace instructions"
      />

      <ConfirmDialog
        open={confirmLeave !== null}
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => router.push(confirmLeave!)}
        title="Discard your changes?"
        description="This bot has edits that have not been saved."
        confirmLabel="Discard changes"
        destructive
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={remove}
        pending={deleting}
        title={`Delete “${bot?.name ?? ''}”?`}
        description="Conversations that used this bot keep their messages, but they will fall back to the default bot. This cannot be undone."
        confirmLabel="Delete bot"
        pendingLabel="Deleting…"
        destructive
      />
    </form>
  )
}

/** Shared loading/error frame for both editor routes. */
export function EditorFrame({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

export function BackToBots() {
  return (
    <Link href="/bots" className="text-[13px] font-medium text-ink-muted hover:text-ink">
      Back to AI bots
    </Link>
  )
}

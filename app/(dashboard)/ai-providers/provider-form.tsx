'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Banner,
  Button,
  ConfirmDialog,
  Field,
  FormSection,
  InlineError,
  Input,
  Panel,
  SecretField,
  Select,
  Switch,
  errorMessage,
  request,
  useToast,
} from '@/components/ui'
import {
  PROVIDER_KINDS,
  PROVIDER_ENV_KEYS,
  PROVIDER_LABELS,
  type ModelCapability,
  type ProviderKind,
} from '@/lib/ai/provider-kinds'

export interface ProviderRecord {
  id: string
  name: string
  kind: string
  model: string
  imageModel: string | null
  imageEnabled: boolean
  voiceModel: string | null
  voiceEnabled: boolean
  enabled: boolean
  hasApiKey: boolean
  /** How many bots answer through this provider. Deleting is refused above zero. */
  botCount: number
  usage: { calls: number; inputTokens: number; outputTokens: number; totalTokens: number }
}

interface ModelChoice {
  id: string
  label: string
}

interface FormState {
  name: string
  kind: ProviderKind
  model: string
  imageModel: string
  imageEnabled: boolean
  voiceModel: string
  voiceEnabled: boolean
  apiKey: string
  enabled: boolean
}

function initialState(provider: ProviderRecord | null): FormState {
  return {
    name: provider?.name ?? '',
    kind: (provider?.kind as ProviderKind) ?? 'openai',
    model: provider?.model ?? '',
    // The model survives the switch being turned off: an operator pausing a
    // capability for a week should not have to remember what they had chosen.
    imageModel: provider?.imageModel ?? '',
    imageEnabled: provider?.imageEnabled ?? false,
    voiceModel: provider?.voiceModel ?? '',
    voiceEnabled: provider?.voiceEnabled ?? false,
    // Always blank: the stored key is never sent to the browser, and blank
    // means "keep whatever is stored".
    apiKey: '',
    enabled: provider?.enabled ?? true,
  }
}

export function ProviderForm({ provider }: { provider: ProviderRecord | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const isNew = provider === null

  const [form, setForm] = useState<FormState>(() => initialState(provider))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{
    name?: string
    model?: string
    imageModel?: string
    voiceModel?: string
  }>({})
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const baseline = useMemo(() => initialState(provider), [provider])
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e))
  }

  function leaveTo(href: string) {
    if (dirty) setConfirmLeave(href)
    else router.push(href)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!form.name.trim()) nextErrors.name = 'Give this provider a name so you can recognise it later.'
    if (!form.model.trim()) nextErrors.model = 'Choose the model this provider runs.'
    // Caught here as well as on the server, because a capability that is on
    // with nothing behind it looks configured and behaves as though it is off.
    if (form.imageEnabled && !form.imageModel.trim()) {
      nextErrors.imageModel = 'Choose a model for reading images, or turn image reading off.'
    }
    if (form.voiceEnabled && !form.voiceModel.trim()) {
      nextErrors.voiceModel = 'Choose a model for voice notes, or turn voice notes off.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setSaveError('Check the highlighted fields and try again.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        model: form.model.trim(),
        imageModel: form.imageModel.trim(),
        voiceModel: form.voiceModel.trim(),
      }
      if (isNew) {
        await request('/api/ai-providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast(`“${payload.name}” added.`)
      } else {
        await request(`/api/ai-providers/${provider.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast('Provider saved.')
      }
      router.push('/ai-providers')
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
      await request(`/api/ai-providers/${provider!.id}`, { method: 'DELETE' })
      toast(`“${provider!.name}” deleted.`)
      router.push('/ai-providers')
      router.refresh()
    } catch (err) {
      // The server refuses while bots still point here, and says which ones.
      setConfirmDelete(false)
      setDeleting(false)
      toast(errorMessage(err, 'The provider was not deleted.'), 'error')
    }
  }

  const impact: string[] = []
  if (!form.enabled && (provider?.botCount ?? 0) > 0) {
    impact.push(
      `${provider!.botCount} bot${provider!.botCount === 1 ? '' : 's'} answer through this ` +
        'provider and will stop replying while it is turned off.'
    )
  }
  if (!isNew && provider && form.model !== provider.model && provider.botCount > 0) {
    impact.push(`Every bot on this provider switches to ${form.model || 'the new model'} at once.`)
  }

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {saveError && (
        <Banner tone="danger" title="Changes were not saved">
          {saveError}
        </Banner>
      )}

      <FormSection
        title="Account"
        scope="The name is for you. The vendor decides which API the key is sent to."
      >
        <Input
          label="Provider name"
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. OpenAI — production"
        />

        <Select
          label="Vendor"
          value={form.kind}
          hint="Changing the vendor clears the model, because the two catalogues share no names."
          onChange={(e) => {
            const kind = e.target.value as ProviderKind
            // All three, not just the reply model: no id survives a vendor
            // change, and a stale one left in a hidden field fails later.
            setForm((f) => ({ ...f, kind, model: '', imageModel: '', voiceModel: '' }))
          }}
        >
          {PROVIDER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PROVIDER_LABELS[kind]}
            </option>
          ))}
        </Select>

        <SecretField
          label="API key"
          stored={provider?.hasApiKey ?? false}
          storedLabel="Stored"
          emptyLabel="Using the server key"
          value={form.apiKey}
          onChange={(e) => update('apiKey', e.target.value)}
          hint={
            provider?.hasApiKey
              ? 'A key is stored for this provider. Leave blank to keep it.'
              : `Optional. Without one, ${PROVIDER_ENV_KEYS[form.kind]} from the server is used.`
          }
          placeholder={provider?.hasApiKey ? '••••••••' : form.kind === 'openai' ? 'sk-…' : 'AIza…'}
        />
      </FormSection>

      <FormSection
        title="Model"
        scope="Which model writes the replies. The list comes from the vendor, so it only offers what this key can actually use."
      >
        <ModelPicker
          kind={form.kind}
          apiKey={form.apiKey}
          providerId={provider?.id ?? null}
          capability="text"
          label="Reply model"
          required
          value={form.model}
          error={errors.model}
          onChange={(model) => update('model', model)}
        />
      </FormSection>

      <FormSection
        title="Attachments"
        scope="Photos and voice notes are read by a separate model first; the reply model above then answers what it found. Anything turned off here is declined politely in the chat instead of being ignored."
      >
        <Capability
          title="Read photos"
          description="Each photo costs one call of its own before the reply is written. At most four per burst are read — any more are counted and mentioned rather than read."
          enabled={form.imageEnabled}
          onToggle={(v) => update('imageEnabled', v)}
          name={form.name}
          noun="photos"
        >
          <ModelPicker
            kind={form.kind}
            apiKey={form.apiKey}
            providerId={provider?.id ?? null}
            capability="image"
            label="Image model"
            required
            value={form.imageModel}
            error={errors.imageModel}
            onChange={(model) => update('imageModel', model)}
          />
        </Capability>

        <Capability
          title="Listen to voice notes"
          description="Voice notes are transcribed, then answered as though the customer had typed them. At most three per burst."
          enabled={form.voiceEnabled}
          onToggle={(v) => update('voiceEnabled', v)}
          name={form.name}
          noun="voice notes"
        >
          <ModelPicker
            kind={form.kind}
            apiKey={form.apiKey}
            providerId={provider?.id ?? null}
            capability="voice"
            label="Voice model"
            required
            value={form.voiceModel}
            error={errors.voiceModel}
            onChange={(model) => update('voiceModel', model)}
          />
        </Capability>
      </FormSection>

      <FormSection title="Availability" scope="Whether bots may answer through this account.">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Provider is available</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              A provider that is turned off makes every bot on it fail rather than fall back to
              another account.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onChange={(v) => update('enabled', v)}
            label={`${form.name || 'This provider'} is available`}
          />
        </div>

        {impact.length > 0 && (
          <Banner tone="warning" title="When you save">
            <ul className="list-disc space-y-0.5 pl-4">
              {impact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Banner>
        )}
      </FormSection>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          {!isNew && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete provider
            </Button>
          )}
          {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => leaveTo('/ai-providers')}>
            Cancel
          </Button>
          <Button type="submit" pending={saving} pendingLabel="Saving…" disabled={!dirty && !isNew}>
            {isNew ? 'Add provider' : 'Save changes'}
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmLeave !== null}
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => router.push(confirmLeave!)}
        title="Discard your changes?"
        description="This provider has edits that have not been saved."
        confirmLabel="Discard changes"
        destructive
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={remove}
        pending={deleting}
        title={`Delete “${provider?.name ?? ''}”?`}
        description={
          (provider?.botCount ?? 0) > 0
            ? `${provider!.botCount} bot${provider!.botCount === 1 ? '' : 's'} still answer through this provider, so this will be refused until they are moved.`
            : 'Recorded token usage is kept. This cannot be undone.'
        }
        confirmLabel="Delete provider"
        pendingLabel="Deleting…"
        destructive
      />
    </form>
  )
}

/**
 * One optional capability: a switch, and the model it needs to work.
 *
 * The picker stays mounted but hidden when the switch is off, so the chosen
 * model is still in the form and still saved. Turning a capability off for a
 * fortnight should not cost an operator the setting they had made.
 */
function Capability({
  title,
  description,
  enabled,
  onToggle,
  name,
  noun,
  children,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: (value: boolean) => void
  name: string
  noun: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--input-border)]/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onChange={onToggle}
          label={`${name || 'This provider'} reads ${noun}`}
        />
      </div>

      {enabled ? (
        children
      ) : (
        <p className="text-xs text-ink-soft">
          Customers who send {noun} are told the bot cannot read them, and offered a person instead.
        </p>
      )}
    </div>
  )
}

/**
 * The model field.
 *
 * A dropdown of the vendor's own catalogue is the point — typing a model id
 * that the key cannot reach fails only once a customer is waiting. But the list
 * needs a working key and a network round trip, so a typed id stays available
 * as the fallback: a new model can ship before this app has heard of it.
 *
 * `capability` decides which catalogue is asked for, because the three do not
 * overlap: a transcription model cannot hold a conversation, and offering it in
 * the reply dropdown would be offering a way to break the bot.
 */
function ModelPicker({
  kind,
  apiKey,
  providerId,
  capability,
  label,
  required,
  value,
  error,
  onChange,
}: {
  kind: ProviderKind
  apiKey: string
  providerId: string | null
  capability: ModelCapability
  label: string
  required?: boolean
  value: string
  error?: string
  onChange: (model: string) => void
}) {
  const [models, setModels] = useState<ModelChoice[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [manual, setManual] = useState(false)

  // Only the newest request may write state: a slow first fetch must not
  // overwrite the list a later one already returned.
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await request<{ models: ModelChoice[]; source: string }>(
        '/api/ai-providers/models',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, apiKey, providerId, capability }),
        }
      )
      if (id !== requestId.current) return
      setModels(result.models)
      setSource(result.source)
      setManual(false)
    } catch (err) {
      if (id !== requestId.current) return
      setModels(null)
      setLoadError(errorMessage(err, 'Could not reach the vendor to list models.'))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [kind, apiKey, providerId, capability])

  // A saved provider already has a usable key, so the list is fetched without
  // being asked for. A new one waits: there is nothing to authenticate with yet.
  //
  // Guarded by what was last fetched rather than by the effect's dependencies:
  // `load` changes on every keystroke in the API key field, and without this a
  // saved provider would call the vendor once per character typed.
  const autoLoaded = useRef<string | null>(null)
  useEffect(() => {
    if (!providerId) return
    // The vendor changing is exactly when the old list becomes wrong.
    const token = `${providerId}:${kind}:${capability}`
    if (autoLoaded.current === token) return
    autoLoaded.current = token
    void load()
  }, [providerId, kind, capability, load])

  // The stored model may predate the list, or have been retired since. Keeping
  // it as an option means opening the form never silently changes the model.
  const options = useMemo(() => {
    const list = models ?? []
    if (value && !list.some((m) => m.id === value)) {
      return [{ id: value, label: `${value} (current)` }, ...list]
    }
    return list
  }, [models, value])

  const showList = !manual && models !== null

  return (
    <div className="space-y-2">
      {showList ? (
        <Select
          label={label}
          required={required}
          value={value}
          error={error}
          onChange={(e) => onChange(e.target.value)}
          hint={
            source === 'environment'
              ? `Listed with the ${PROVIDER_ENV_KEYS[kind]} key from the server.`
              : source === 'stored'
                ? 'Listed with the key stored on this provider.'
                : 'Listed with the key you entered above.'
          }
        >
          <option value="" disabled>
            Choose a model…
          </option>
          {options.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </Select>
      ) : (
        <Field
          label={label}
          required={required}
          error={error}
          hint={`Enter a model id exactly as ${PROVIDER_LABELS[kind]} names it, or load the list to choose from it.`}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholderFor(kind, capability)}
              className={`h-11 w-full rounded-md border bg-inset px-3 text-base text-ink md:h-10 md:text-sm ${
                invalid
                  ? 'border-[var(--input-error-border)]'
                  : 'border-[var(--input-border)]/70 hover:border-[var(--input-border)]'
              }`}
            />
          )}
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={load}
          pending={loading}
          pendingLabel="Asking the vendor…"
        >
          {models === null ? 'Load available models' : 'Refresh the list'}
        </Button>
        {models !== null && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setManual((m) => !m)}>
            {manual ? 'Choose from the list' : 'Enter a model id instead'}
          </Button>
        )}
        {models !== null && !loading && (
          <span className="text-xs text-ink-soft">
            {models.length} model{models.length === 1 ? '' : 's'} available
          </span>
        )}
      </div>

      {loadError && <InlineError>{loadError}</InlineError>}
    </div>
  )
}

function placeholderFor(kind: ProviderKind, capability: ModelCapability): string {
  if (kind === 'gemini') return 'gemini-2.0-flash'
  return capability === 'voice' ? 'gpt-4o-transcribe' : 'gpt-4o-mini'
}

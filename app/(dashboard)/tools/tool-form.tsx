'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Disclosure,
  ExternalLinkIcon,
  FormSection,
  IconButton,
  Input,
  Panel,
  SecretField,
  Select,
  Switch,
  Textarea,
  TrashIcon,
  errorMessage,
  request,
  useToast,
} from '@/components/ui'

export interface ToolField {
  name: string
  label: string
  type: 'string' | 'number' | 'enum'
  required: boolean
  description?: string
  options?: string[]
}

export interface ToolRecord {
  id: string
  name: string
  description: string
  hasSinkUrl: boolean
  hasSinkSecret: boolean
  spreadsheetUrl: string | null
  sheetTab: string
  fields: ToolField[]
  enabled: boolean
}

export interface BotChoice {
  id: string
  name: string
  enabled: boolean
  toolIds: string[]
}

/**
 * Both providers reject a function name that is not a plain identifier, so a
 * friendly label is turned into a safe key rather than rejected outright.
 */
export function toMachineKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 63)
  return slug
}

const TEMPLATES: {
  label: string
  summary: string
  name: string
  sheetTab: string
  description: string
  fields: ToolField[]
}[] = [
  {
    label: 'Sales enquiry',
    summary: 'Name, contact details and what the customer is interested in.',
    name: 'capture_sales_lead',
    sheetTab: 'Leads',
    description:
      'Capture a sales enquiry. Call this once you have collected the customer’s name, contact details and which product they are interested in. Do not call it for support questions.',
    fields: [
      { name: 'full_name', label: 'Name', type: 'string', required: true, description: 'The customer’s full name' },
      { name: 'contact_number', label: 'Contact', type: 'string', required: true, description: 'Phone number to reach them on' },
      { name: 'email', label: 'Email', type: 'string', required: false, description: 'Email address, if they give one' },
      { name: 'product', label: 'Interested product', type: 'string', required: true, description: 'The product or plan they asked about' },
    ],
  },
  {
    label: 'Support request',
    summary: 'What has gone wrong, how urgent it is and how to reach the customer.',
    name: 'capture_support_issue',
    sheetTab: 'Support',
    description:
      'Capture a support request. Call this once you understand what is wrong and have the customer’s name and contact details. Do not call it for sales or pricing enquiries.',
    fields: [
      { name: 'full_name', label: 'Name', type: 'string', required: true, description: 'The customer’s full name' },
      { name: 'contact_number', label: 'Contact', type: 'string', required: true, description: 'Phone number to reach them on' },
      { name: 'email', label: 'Email', type: 'string', required: false, description: 'Email address, if they give one' },
      { name: 'issue', label: 'Issue', type: 'string', required: true, description: 'What the problem is, in the customer’s own words' },
      { name: 'urgency', label: 'Urgency', type: 'enum', required: false, description: 'How urgent it is', options: ['low', 'medium', 'high'] },
    ],
  },
]

interface EditableField extends ToolField {
  /** Existing keys are locked: renaming one silently orphans a sheet column. */
  keyLocked: boolean
}

interface FormState {
  name: string
  description: string
  sheetTab: string
  spreadsheetUrl: string
  sinkUrl: string
  sinkSecret: string
  enabled: boolean
}

function initialForm(tool: ToolRecord | null): FormState {
  return {
    name: tool?.name ?? '',
    description: tool?.description ?? '',
    sheetTab: tool?.sheetTab ?? 'Sheet1',
    spreadsheetUrl: tool?.spreadsheetUrl ?? '',
    // Never prefilled — the server does not send them back. Blank means keep.
    sinkUrl: '',
    sinkSecret: '',
    enabled: tool?.enabled ?? true,
  }
}

export function ToolForm({
  tool,
  bots,
  onBotsChanged,
}: {
  tool: ToolRecord | null
  bots: BotChoice[]
  onBotsChanged?: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const isNew = tool === null

  const [form, setForm] = useState<FormState>(() => initialForm(tool))
  const [fields, setFields] = useState<EditableField[]>(
    () => (tool?.fields ?? []).map((f) => ({ ...f, keyLocked: true }))
  )
  const [attached, setAttached] = useState<string[]>(() =>
    bots.filter((b) => tool && b.toolIds.includes(tool.id)).map((b) => b.id)
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [attachWarning, setAttachWarning] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const baseline = useMemo(
    () => ({
      form: initialForm(tool),
      fields: (tool?.fields ?? []).map((f) => ({ ...f, keyLocked: true })),
      attached: bots.filter((b) => tool && b.toolIds.includes(tool.id)).map((b) => b.id),
    }),
    [tool, bots]
  )
  const dirty =
    JSON.stringify({ form, fields, attached: [...attached].sort() }) !==
    JSON.stringify({ ...baseline, attached: [...baseline.attached].sort() })

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function applyTemplate(template: (typeof TEMPLATES)[number]) {
    setForm((f) => ({
      ...f,
      name: template.name,
      description: template.description,
      sheetTab: template.sheetTab,
    }))
    setFields(template.fields.map((f) => ({ ...f, keyLocked: true })))
  }

  function patchField(index: number, patch: Partial<EditableField>) {
    setFields((list) =>
      list.map((f, i) => {
        if (i !== index) return f
        const next = { ...f, ...patch }
        // A new field's key follows its label until the key is edited by hand.
        if (patch.label !== undefined && !f.keyLocked) next.name = toMachineKey(patch.label)
        return next
      })
    )
  }

  function leaveTo(href: string) {
    if (dirty) setConfirmLeave(href)
    else router.push(href)
  }

  /**
   * Attaching a tool means rewriting each bot's whole tool set, so the freshest
   * assignments are read first and unrelated tools are preserved. If this half
   * fails the tool is still saved — and the message says exactly that.
   */
  async function syncBotAttachments(toolId: string): Promise<string | null> {
    let latest: BotChoice[]
    try {
      latest = await request<BotChoice[]>('/api/bots')
    } catch {
      return 'The tool was saved, but its bots could not be checked. Open the bot to attach it.'
    }

    const failures: string[] = []
    for (const bot of latest) {
      const shouldHave = attached.includes(bot.id)
      const has = bot.toolIds.includes(toolId)
      if (shouldHave === has) continue

      const toolIds = shouldHave
        ? [...bot.toolIds, toolId]
        : bot.toolIds.filter((id) => id !== toolId)

      try {
        await request(`/api/bots/${bot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolIds }),
        })
      } catch {
        failures.push(bot.name)
      }
    }

    return failures.length > 0
      ? `Tool saved. Attaching it to ${failures.join(', ')} needs another try.`
      : null
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setAttachWarning(null)

    if (!form.name.trim()) return setSaveError('The tool needs a name the AI can call.')
    if (!form.description.trim())
      return setSaveError('Describe when the AI should use this tool — it is what decides sales from support.')
    if (fields.length === 0) return setSaveError('Add at least one field. A tool with no fields cannot run.')
    const badField = fields.find((f) => !f.name || !/^[a-z][a-z0-9_]{0,62}$/.test(f.name))
    if (badField)
      return setSaveError(`“${badField.label || 'A field'}” needs a valid key: lowercase letters, digits and underscores.`)
    const badEnum = fields.find((f) => f.type === 'enum' && (f.options ?? []).length === 0)
    if (badEnum) return setSaveError(`“${badEnum.label}” is a choice field, so it needs allowed values.`)

    setSaving(true)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        fields: fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          description: f.description,
          options: f.options,
        })),
      }
      const saved = await request<{ id: string }>(isNew ? '/api/tools' : `/api/tools/${tool!.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const warning = await syncBotAttachments(saved?.id ?? tool!.id)
      onBotsChanged?.()

      if (warning) {
        setAttachWarning(warning)
        setSaving(false)
        toast(warning, 'warning')
        return
      }

      toast(isNew ? `“${payload.name}” created.` : 'Tool saved.')
      router.push('/tools')
      router.refresh()
    } catch (err) {
      setSaveError(errorMessage(err, 'Changes were not saved. Your edits are still here.'))
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      await request(`/api/tools/${tool!.id}`, { method: 'DELETE' })
      toast('Tool deleted. Captured details are kept.')
      router.push('/tools?view=captures')
      router.refresh()
    } catch (err) {
      setConfirmDelete(false)
      setDeleting(false)
      toast(errorMessage(err, 'The tool was not deleted.'), 'error')
    }
  }

  const sheetReady = (tool?.hasSinkUrl ?? false) || form.sinkUrl.trim().length > 0

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {saveError && (
        <Banner tone="danger" title="Changes were not saved">
          {saveError}
        </Banner>
      )}
      {attachWarning && (
        <Banner tone="warning" title="Partly saved">
          {attachWarning} Your edits above are already stored.
        </Banner>
      )}

      {isNew && (
        <FormSection title="Start from a template" scope="Templates fill in the purpose, fields and sheet tab. You can change all of them.">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => applyTemplate(template)}
                className="cursor-pointer rounded-md border border-line bg-inset/60 p-3 text-left transition-colors hover:bg-hover"
              >
                <span className="block text-sm font-medium text-ink">{template.label}</span>
                <span className="mt-0.5 block text-sm leading-5 text-ink-muted">{template.summary}</span>
              </button>
            ))}
          </div>
        </FormSection>
      )}

      <FormSection title="What this tool captures" scope="The description is what decides when the AI reaches for this tool instead of another one.">
        <Textarea
          label="When should the AI use this?"
          required
          rows={4}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          hint="Be explicit about when NOT to call it — that is what separates a sales capture from a support one."
          placeholder="Capture a sales enquiry once you have the customer’s name, contact details and the product they asked about. Do not call it for support questions."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tool name"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            hint="What the AI calls it. Lowercase letters, digits and underscores."
            placeholder="capture_sales_lead"
          />
          <Input
            label="Sheet tab"
            required
            value={form.sheetTab}
            onChange={(e) => update('sheetTab', e.target.value)}
            hint="Created automatically if it does not exist yet."
            placeholder="Leads"
          />
        </div>
      </FormSection>

      <FormSection
        title="Fields to collect"
        scope="Order fixes the sheet columns. The AI asks the customer for anything required that it does not already know."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setFields((list) => [
                ...list,
                { name: '', label: '', type: 'string', required: false, keyLocked: false },
              ])
            }
          >
            Add field
          </Button>
        }
      >
        {fields.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No fields yet. A tool cannot run until it has at least one.
          </p>
        ) : (
          <ol className="space-y-3">
            {fields.map((field, index) => (
              <li key={index} className="rounded-md border border-line bg-inset/60 p-3">
                <div className="flex items-start gap-3">
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    {/* The label leads: it is the sheet's column header and the
                        only part a person reads. The key is derived from it. */}
                    <Input
                      label={`Column heading (field ${index + 1})`}
                      value={field.label}
                      onChange={(e) => patchField(index, { label: e.target.value })}
                      placeholder="Name"
                    />
                    <Select
                      label="Type"
                      value={field.type}
                      onChange={(e) => patchField(index, { type: e.target.value as ToolField['type'] })}
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="enum">Choice</option>
                    </Select>
                  </div>
                  <IconButton
                    label={`Remove ${field.label || `field ${index + 1}`}`}
                    size="sm"
                    onClick={() => setFields((list) => list.filter((_, i) => i !== index))}
                  >
                    <TrashIcon size={15} />
                  </IconButton>
                </div>

                <div className="mt-3">
                  <Input
                    label="Hint for the AI"
                    value={field.description ?? ''}
                    onChange={(e) => patchField(index, { description: e.target.value })}
                    placeholder="The product or plan they asked about"
                  />
                </div>

                {field.type === 'enum' && (
                  <div className="mt-3">
                    <Input
                      label="Allowed values"
                      value={(field.options ?? []).join(', ')}
                      onChange={(e) =>
                        patchField(index, {
                          options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      hint="Comma separated, e.g. low, medium, high"
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                    <Switch
                      size="sm"
                      checked={field.required}
                      onChange={(v) => patchField(index, { required: v })}
                      label={`${field.label || `Field ${index + 1}`} is required`}
                    />
                    Required
                  </label>
                  <span className="text-xs text-ink-soft">
                    Key: <code className="font-mono">{field.name || '—'}</code>
                  </span>
                </div>

                <div className="mt-3">
                  <Disclosure summary="Advanced: edit the field key">
                    <Input
                      label="Field key"
                      value={field.name}
                      onChange={(e) => patchField(index, { name: e.target.value, keyLocked: true })}
                      hint={
                        field.keyLocked && tool
                          ? 'This key is already used in the sheet. Changing it starts a new column.'
                          : 'Generated from the column heading. Lowercase letters, digits and underscores.'
                      }
                    />
                  </Disclosure>
                </div>
              </li>
            ))}
          </ol>
        )}
      </FormSection>

      <FormSection
        title="Google Sheet connection"
        scope="A sheet link alone cannot be written to. An Apps Script deployed on your sheet gives WA Robot a URL it can post rows to."
      >
        <Banner tone="info" title="Set this up once per sheet">
          Open the step-by-step guide, copy the script into your sheet, deploy it as a web app and
          paste the resulting <code className="font-mono">/exec</code> URL below.{' '}
          <Link
            href="/help/google-sheets"
            target="_blank"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
          >
            Open the guide
            <ExternalLinkIcon size={12} />
          </Link>
        </Banner>

        <Input
          label="Sheet link"
          value={form.spreadsheetUrl}
          onChange={(e) => update('spreadsheetUrl', e.target.value)}
          hint="For your reference only — writes go through the Apps Script URL."
          placeholder="https://docs.google.com/spreadsheets/d/…"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SecretField
            label="Apps Script URL"
            stored={tool?.hasSinkUrl ?? false}
            storedLabel="Saved"
            emptyLabel="Not set"
            value={form.sinkUrl}
            onChange={(e) => update('sinkUrl', e.target.value)}
            hint={
              tool?.hasSinkUrl
                ? 'A URL is saved. Leave blank to keep it.'
                : 'Ends in /exec. It is a credential, so it is stored write-only.'
            }
            placeholder={tool?.hasSinkUrl ? '••••••••' : 'https://script.google.com/macros/s/…/exec'}
          />
          <SecretField
            label="Shared secret"
            stored={tool?.hasSinkSecret ?? false}
            storedLabel="Saved"
            emptyLabel="Not set"
            value={form.sinkSecret}
            onChange={(e) => update('sinkSecret', e.target.value)}
            hint={
              tool?.hasSinkSecret
                ? 'A secret is saved. Leave blank to keep it.'
                : 'Must match SECRET in the Apps Script.'
            }
            placeholder={tool?.hasSinkSecret ? '••••••••' : ''}
          />
        </div>

        {/* Saving credentials is not the same as proving they work. */}
        <p className="text-xs leading-4 text-ink-soft">
          {sheetReady
            ? 'Setup saved. The connection is only confirmed when a real capture writes a row.'
            : 'Without a URL, captures are still saved here — they are just not sent anywhere.'}
        </p>
      </FormSection>

      <FormSection
        title="Which bots can use it"
        scope="A tool does nothing until a bot is allowed to call it."
      >
        {bots.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No bots exist yet.{' '}
            <button
              type="button"
              onClick={() => leaveTo('/bots/new')}
              className="cursor-pointer font-medium text-action hover:underline"
            >
              Create one
            </button>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {bots.map((bot) => (
              <li key={bot.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-inset/60 p-3 hover:bg-hover">
                  <input
                    type="checkbox"
                    checked={attached.includes(bot.id)}
                    onChange={(e) =>
                      setAttached((list) =>
                        e.target.checked ? [...list, bot.id] : list.filter((id) => id !== bot.id)
                      )
                    }
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-action-primary)]"
                  />
                  <span className="text-sm font-medium text-ink">{bot.name}</span>
                  {!bot.enabled && <Badge variant="neutral">Turned off</Badge>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection title="Availability" scope="A tool that is turned off is never offered to any bot.">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Tool is available</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Existing captures stay exactly where they are either way.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onChange={(v) => update('enabled', v)}
            label={`${form.name || 'This tool'} is available`}
          />
        </div>
      </FormSection>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          {!isNew && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete tool
            </Button>
          )}
          {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => leaveTo('/tools')}>
            Cancel
          </Button>
          <Button type="submit" pending={saving} pendingLabel="Saving…" disabled={!dirty && !isNew}>
            {isNew ? 'Create tool' : 'Save changes'}
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmLeave !== null}
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => router.push(confirmLeave!)}
        title="Discard your changes?"
        description="This tool has edits that have not been saved."
        confirmLabel="Discard changes"
        destructive
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={remove}
        pending={deleting}
        title={`Delete “${tool?.name ?? ''}”?`}
        description="Details already captured are kept and stay readable under Captures. Bots lose access to this tool. This cannot be undone."
        confirmLabel="Delete tool"
        pendingLabel="Deleting…"
        destructive
      />
    </form>
  )
}

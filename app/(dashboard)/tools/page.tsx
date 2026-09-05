'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Select, Textarea, Toggle, useToast } from '@/components/ui'

interface ToolField {
  name: string
  label: string
  type: 'string' | 'number' | 'enum'
  required: boolean
  description?: string
  options?: string[]
}

interface Tool {
  id: string
  name: string
  kind: string
  description: string
  sinkType: string
  /** The URL and secret are write-only — the server only tells us they exist. */
  hasSinkUrl: boolean
  hasSinkSecret: boolean
  spreadsheetUrl: string | null
  sheetTab: string
  fields: ToolField[]
  enabled: boolean
}

interface Invocation {
  id: string
  toolName: string | null
  sheetTab: string | null
  contactName: string | null
  contactPhone: string | null
  args: Record<string, unknown>
  status: string
  error: string | null
  createdAt: string
}

const EMPTY_TOOL = {
  name: '',
  description: '',
  sinkUrl: '',
  sinkSecret: '',
  spreadsheetUrl: '',
  sheetTab: 'Sheet1',
  enabled: true,
}

/** Starting points for the two cases this was built for. */
const TEMPLATES: { label: string; name: string; sheetTab: string; description: string; fields: ToolField[] }[] = [
  {
    label: 'Sales lead',
    name: 'capture_sales_lead',
    sheetTab: 'Leads',
    description:
      'Capture a sales enquiry. Call this once you have collected the customer\'s name, ' +
      'contact details and which product they are interested in. Do not call it for support questions.',
    fields: [
      { name: 'full_name', label: 'Name', type: 'string', required: true, description: 'The customer\'s full name' },
      { name: 'contact_number', label: 'Contact', type: 'string', required: true, description: 'Phone number to reach them on' },
      { name: 'email', label: 'Email', type: 'string', required: false, description: 'Email address, if they give one' },
      { name: 'product', label: 'Interested Product', type: 'string', required: true, description: 'The product or plan they asked about' },
    ],
  },
  {
    label: 'Support ticket',
    name: 'capture_support_issue',
    sheetTab: 'Support',
    description:
      'Capture a support request. Call this once you understand what is wrong and have the ' +
      'customer\'s name and contact details. Do not call it for sales or pricing enquiries.',
    fields: [
      { name: 'full_name', label: 'Name', type: 'string', required: true, description: 'The customer\'s full name' },
      { name: 'contact_number', label: 'Contact', type: 'string', required: true, description: 'Phone number to reach them on' },
      { name: 'email', label: 'Email', type: 'string', required: false, description: 'Email address, if they give one' },
      { name: 'issue', label: 'Issue', type: 'string', required: true, description: 'What the problem is, in the customer\'s own words' },
      { name: 'urgency', label: 'Urgency', type: 'enum', required: false, description: 'How urgent it is', options: ['low', 'medium', 'high'] },
    ],
  },
]

const EMPTY_FIELD: ToolField = { name: '', label: '', type: 'string', required: false }

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [invocations, setInvocations] = useState<Invocation[]>([])
  const [selected, setSelected] = useState<Tool | null>(null)
  const [form, setForm] = useState({ ...EMPTY_TOOL })
  const [fields, setFields] = useState<ToolField[]>([])
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'tools' | 'captures'>('tools')
  const { toast } = useToast()

  async function fetchTools() {
    const r = await fetch('/api/tools')
    if (r.ok) setTools(await r.json())
  }

  async function fetchInvocations() {
    const r = await fetch('/api/tools/invocations')
    if (r.ok) setInvocations(await r.json())
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [t, i] = await Promise.all([fetch('/api/tools'), fetch('/api/tools/invocations')])
      if (cancelled) return
      if (t.ok) setTools(await t.json())
      if (i.ok) setInvocations(await i.json())
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function startNew(template?: (typeof TEMPLATES)[number]) {
    setIsNew(true)
    setSelected(null)
    setForm({
      ...EMPTY_TOOL,
      ...(template
        ? { name: template.name, description: template.description, sheetTab: template.sheetTab }
        : {}),
    })
    setFields(template ? template.fields.map((f) => ({ ...f })) : [])
  }

  function startEdit(tool: Tool) {
    setIsNew(false)
    setSelected(tool)
    setForm({
      name: tool.name,
      description: tool.description,
      // Never prefilled: the server does not send them back. Blank = keep stored.
      sinkUrl: '',
      sinkSecret: '',
      spreadsheetUrl: tool.spreadsheetUrl ?? '',
      sheetTab: tool.sheetTab,
      enabled: tool.enabled,
    })
    setFields(tool.fields.map((f) => ({ ...f })))
  }

  function cancel() {
    setIsNew(false)
    setSelected(null)
    setFields([])
  }

  async function save() {
    setSaving(true)
    const payload = { ...form, fields }
    const r = await fetch(isNew ? '/api/tools' : `/api/tools/${selected!.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)

    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Save failed' }))
      return toast(error ?? 'Save failed', 'error')
    }

    toast(isNew ? 'Tool created' : 'Tool saved', 'success')
    cancel()
    fetchTools()
  }

  async function remove(tool: Tool) {
    if (!confirm(`Delete "${tool.name}"? Captured rows are kept.`)) return
    const r = await fetch(`/api/tools/${tool.id}`, { method: 'DELETE' })
    if (!r.ok) return toast('Delete failed', 'error')
    toast('Tool deleted', 'success')
    cancel()
    fetchTools()
  }

  async function retry(invocation: Invocation) {
    const r = await fetch(`/api/tools/invocations/${invocation.id}/retry`, { method: 'POST' })
    const body = await r.json().catch(() => ({}))
    toast(r.ok ? 'Synced to sheet' : (body.error ?? 'Retry failed'), r.ok ? 'success' : 'error')
    fetchInvocations()
  }

  const editing = isNew || selected !== null
  const failedCount = invocations.filter((i) => i.status === 'failed').length

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[#0F172A]">Tools</h1>
          <p className="text-sm text-[#475569] mt-0.5">
            Let a bot collect details mid-conversation and write them to a Google Sheet.
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {TEMPLATES.map((t) => (
              <Button key={t.name} variant="secondary" onClick={() => startNew(t)}>
                + {t.label}
              </Button>
            ))}
            <Button onClick={() => startNew()}>+ Blank</Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-[#E6EAF0]">
        <TabButton active={tab === 'tools'} onClick={() => setTab('tools')}>
          Tools ({tools.length})
        </TabButton>
        <TabButton active={tab === 'captures'} onClick={() => setTab('captures')}>
          Captures ({invocations.length})
          {failedCount > 0 && <span className="ml-1.5 text-[#DC2626]">· {failedCount} failed</span>}
        </TabButton>
      </div>

      {tab === 'captures' ? (
        <CaptureList invocations={invocations} onRetry={retry} />
      ) : editing ? (
        <ToolEditor
          form={form}
          setForm={setForm}
          fields={fields}
          setFields={setFields}
          isNew={isNew}
          existing={selected}
          saving={saving}
          onSave={save}
          onCancel={cancel}
        />
      ) : tools.length === 0 ? (
        <Card className="p-6 text-sm text-[#94A3B8]">
          No tools yet. Start from a template above — a Sales lead or Support ticket capture is
          ready to go once you paste in an Apps Script URL.
        </Card>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <Card key={tool.id} className="px-4 py-3">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#0F172A]">{tool.name}</span>
                    <Badge variant={tool.enabled ? 'green' : 'gray'} dot>
                      {tool.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge variant="blue">{tool.sheetTab}</Badge>
                    {!tool.hasSinkUrl && <Badge variant="red">No sheet connected</Badge>}
                  </div>
                  <p className="text-xs text-[#475569] line-clamp-2">{tool.description}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    {tool.fields.length} field{tool.fields.length === 1 ? '' : 's'}:{' '}
                    {tool.fields.map((f) => f.label).join(', ') || '—'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(tool)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(tool)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors cursor-pointer ${
        active
          ? 'border-[#16A34A] text-[#16A34A] font-medium'
          : 'border-transparent text-[#475569] hover:text-[#0F172A]'
      }`}
    >
      {children}
    </button>
  )
}

function ToolEditor({
  form,
  setForm,
  fields,
  setFields,
  isNew,
  existing,
  saving,
  onSave,
  onCancel,
}: {
  form: typeof EMPTY_TOOL
  setForm: (f: typeof EMPTY_TOOL) => void
  fields: ToolField[]
  setFields: (f: ToolField[]) => void
  isNew: boolean
  existing: Tool | null
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  function updateField(index: number, patch: Partial<ToolField>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Tool name"
          hint="What the AI calls it. Lowercase, underscores, no spaces."
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="capture_sales_lead"
        />
        <Input
          label="Sheet tab"
          hint="Created automatically if it does not exist."
          value={form.sheetTab}
          onChange={(e) => setForm({ ...form, sheetTab: e.target.value })}
          placeholder="Leads"
        />
      </div>

      <Textarea
        label="When should the AI use this?"
        hint="This is what decides sales vs support — be explicit about when NOT to call it."
        rows={3}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div className="border-t border-[#E6EAF0] pt-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-[#0F172A]">Google Sheet connection</h3>
          <p className="text-xs text-[#475569] mt-0.5">
            A sheet link alone cannot be written to. Deploy the Apps Script from{' '}
            <code className="bg-[#F1F5F9] px-1 rounded">scripts/apps-script/capture.gs</code> on your
            sheet and paste its <code className="bg-[#F1F5F9] px-1 rounded">/exec</code> URL here.
          </p>
        </div>

        <Input
          label="Sheet link"
          hint="For your reference only — writes go through the Apps Script URL."
          value={form.spreadsheetUrl}
          onChange={(e) => setForm({ ...form, spreadsheetUrl: e.target.value })}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Apps Script URL"
            hint={
              !isNew && existing?.hasSinkUrl
                ? 'A URL is stored. Leave blank to keep it.'
                : 'https://script.google.com/macros/s/.../exec'
            }
            type="password"
            value={form.sinkUrl}
            onChange={(e) => setForm({ ...form, sinkUrl: e.target.value })}
            placeholder={!isNew && existing?.hasSinkUrl ? '••••••••' : ''}
          />
          <Input
            label="Shared secret"
            hint={
              !isNew && existing?.hasSinkSecret
                ? 'A secret is stored. Leave blank to keep it.'
                : 'Must match SECRET in the Apps Script.'
            }
            type="password"
            value={form.sinkSecret}
            onChange={(e) => setForm({ ...form, sinkSecret: e.target.value })}
            placeholder={!isNew && existing?.hasSinkSecret ? '••••••••' : ''}
          />
        </div>
      </div>

      <div className="border-t border-[#E6EAF0] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#0F172A]">Fields to collect</h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Order fixes the sheet columns. The AI asks the customer for anything required that it
              does not already know.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFields([...fields, { ...EMPTY_FIELD }])}>
            + Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-3">No fields yet — the tool cannot run without at least one.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start bg-[#F8FAFC] rounded-lg p-3">
                <div className="col-span-3">
                  <Input
                    placeholder="field_key"
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="Column header"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value as ToolField['type'] })}
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="enum">Choice</option>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-2 pt-2">
                  <Toggle checked={field.required} onChange={(v) => updateField(i, { required: v })} />
                  <span className="text-xs text-[#475569]">Required</span>
                </div>
                <div className="col-span-2 flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFields(fields.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>

                <div className="col-span-12">
                  <Input
                    placeholder="Hint for the AI, e.g. the product or plan they asked about"
                    value={field.description ?? ''}
                    onChange={(e) => updateField(i, { description: e.target.value })}
                  />
                </div>

                {field.type === 'enum' && (
                  <div className="col-span-12">
                    <Input
                      placeholder="Allowed values, comma separated: low, medium, high"
                      value={(field.options ?? []).join(', ')}
                      onChange={(e) =>
                        updateField(i, {
                          options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#E6EAF0] pt-4">
        <div className="flex items-center gap-2">
          <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
          <span className="text-sm text-[#475569]">Enabled</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving}>
            {isNew ? 'Create tool' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function CaptureList({
  invocations,
  onRetry,
}: {
  invocations: Invocation[]
  onRetry: (i: Invocation) => void
}) {
  if (invocations.length === 0) {
    return <Card className="p-6 text-sm text-[#94A3B8]">Nothing captured yet.</Card>
  }

  return (
    <div className="space-y-2">
      {invocations.map((inv) => (
        <Card key={inv.id} className="px-4 py-3">
          <div className="flex items-start gap-4">
            <div className="shrink-0 pt-0.5">
              <Badge variant={inv.status === 'synced' ? 'green' : inv.status === 'failed' ? 'red' : 'yellow'}>
                {inv.status}
              </Badge>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-[#0F172A]">
                  {inv.contactName || inv.contactPhone || 'Unknown contact'}
                </span>
                {inv.toolName && <Badge variant="gray" size="sm">{inv.toolName}</Badge>}
              </div>
              <p className="text-sm text-[#334155] break-words">
                {Object.entries(inv.args)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join('  ·  ')}
              </p>
              {inv.error && <p className="text-xs text-[#DC2626] break-words mt-0.5">{inv.error}</p>}
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <span className="text-xs text-[#94A3B8] whitespace-nowrap">
                {new Date(inv.createdAt).toLocaleString()}
              </span>
              {inv.status === 'failed' && (
                <Button variant="secondary" size="sm" onClick={() => onRetry(inv)}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

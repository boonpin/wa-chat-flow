'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Card, EmptyState, Input, Select, Textarea, Toggle, useToast } from '@/components/ui'

interface Bot {
  id: string
  name: string
  provider: string
  /** The stored key is never sent to the browser — only whether one exists. */
  hasApiKey: boolean
  model: string
  prompt: string
  handlerType: string
  enabled: boolean
  isDefault: boolean
  toolIds: string[]
}

/** Only what the assignment checklist needs — the Tools page owns the rest. */
interface ToolSummary {
  id: string
  name: string
  description: string
  sheetTab: string
  enabled: boolean
  hasSinkUrl: boolean
}

const EMPTY_BOT = {
  name: '',
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  prompt: '',
  enabled: true,
  isDefault: false,
  toolIds: [] as string[],
}

const PROMPT_TEMPLATES = [
  {
    label: 'General Assistant',
    value: 'You are a helpful WhatsApp assistant. Answer questions clearly and concisely. Be friendly and professional.',
  },
  {
    label: 'Customer Support',
    value: 'You are a customer support agent. Help users with their inquiries politely. For complex issues, tell them to contact support@company.com.',
  },
  {
    label: 'Sales Assistant',
    value: 'You are a sales assistant. Help customers understand our products and services. For pricing questions, direct them to contact our sales team.',
  },
]

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [tools, setTools] = useState<ToolSummary[]>([])
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null)
  const [form, setForm] = useState({ ...EMPTY_BOT })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { toast } = useToast()

  async function fetchBots() {
    const r = await fetch('/api/bots')
    const data = await r.json()
    setBots(data)
    return data
  }

  async function fetchTools() {
    const r = await fetch('/api/tools')
    if (r.ok) setTools(await r.json())
  }

  useEffect(() => {
    fetchBots()
    fetchTools()
  }, [])

  function openNew() {
    const f = { ...EMPTY_BOT }
    setForm(f)
    setSelectedBot(null)
    setIsNew(true)
    setDirty(false)
  }

  function openEdit(bot: Bot) {
    // API key stays blank: submitting an empty value keeps the stored one.
    setForm({
      name: bot.name,
      provider: bot.provider,
      apiKey: '',
      model: bot.model,
      prompt: bot.prompt,
      enabled: bot.enabled,
      isDefault: bot.isDefault,
      toolIds: bot.toolIds ?? [],
    })
    setSelectedBot(bot)
    setIsNew(false)
    setDirty(false)
  }

  function closePanel() {
    setSelectedBot(null)
    setIsNew(false)
    setDirty(false)
  }

  function updateForm<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(f => ({ ...f, [key]: val }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        const r = await fetch('/api/bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!r.ok) throw new Error('Failed to create')
        toast('Bot created successfully')
      } else if (selectedBot) {
        const r = await fetch(`/api/bots/${selectedBot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!r.ok) throw new Error('Failed to update')
        toast('Bot saved')
      }
      setDirty(false)
      const updated = await fetchBots()
      if (isNew) {
        const created = updated[updated.length - 1]
        if (created) openEdit(created)
        else closePanel()
      } else if (selectedBot) {
        const fresh = updated.find((b: Bot) => b.id === selectedBot.id)
        if (fresh) openEdit(fresh)
      }
    } catch {
      toast('Failed to save bot', 'error')
    }
    setSaving(false)
  }

  async function handleDelete(bot: Bot) {
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return
    await fetch(`/api/bots/${bot.id}`, { method: 'DELETE' })
    toast('Bot deleted')
    closePanel()
    fetchBots()
  }

  const showPanel = isNew || !!selectedBot

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Bots</h1>
          <p className="text-sm text-[#475569] mt-0.5">Configure AI bots to handle auto replies</p>
        </div>
        <Button onClick={openNew}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Bot
        </Button>
      </div>

      <div className={`grid gap-4 ${showPanel ? 'grid-cols-5' : 'grid-cols-1 max-w-2xl'}`}>
        {/* Bot list */}
        <div className={showPanel ? 'col-span-2' : 'col-span-1'}>
          <Card className="overflow-hidden">
            {bots.length === 0 ? (
              <EmptyState
                icon="🤖"
                title="No bots yet"
                description="Create your first AI bot to start auto-replying"
                action={<Button onClick={openNew} size="sm">Create bot</Button>}
              />
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {bots.map(bot => {
                  const active = selectedBot?.id === bot.id
                  return (
                    <button
                      key={bot.id}
                      onClick={() => openEdit(bot)}
                      className={`w-full text-left px-4 py-4 transition-colors hover:bg-[#F8FAFC] ${active ? 'bg-[#F0FDF4] border-l-2 border-[#16A34A]' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#0F172A]">{bot.name}</span>
                        <span className="flex items-center gap-1.5">
                          {!bot.enabled && <Badge variant="gray" size="sm">Off</Badge>}
                          {bot.isDefault && <Badge variant="green" size="sm">Default</Badge>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="gray">
                          {bot.provider === 'openai' ? 'OpenAI' : 'Gemini'}
                        </Badge>
                        <span className="text-xs text-[#94A3B8]">{bot.model}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Editor panel */}
        {showPanel && (
          <div className="col-span-3">
            <Card className="overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6EAF0]">
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  {isNew ? 'New Bot' : `Edit — ${selectedBot?.name}`}
                </h2>
                <button onClick={closePanel} className="text-[#94A3B8] hover:text-[#475569] transition-colors">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Name + Provider */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Bot Name"
                    value={form.name}
                    onChange={e => updateForm('name', e.target.value)}
                    placeholder="e.g. Customer Support"
                    required
                  />
                  <Select
                    label="AI Provider"
                    value={form.provider}
                    onChange={e => {
                      const p = e.target.value
                      updateForm('provider', p)
                      updateForm('model', MODELS[p][0])
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                  </Select>
                </div>

                {/* API Key + Model */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="API Key"
                    type="password"
                    value={form.apiKey}
                    onChange={e => updateForm('apiKey', e.target.value)}
                    placeholder={
                      !isNew && selectedBot?.hasApiKey
                        ? 'Stored — leave blank to keep'
                        : 'Leave blank to use the server key'
                    }
                    hint={
                      isNew || !selectedBot?.hasApiKey
                        ? 'Optional. Falls back to OPENAI_API_KEY / GEMINI_API_KEY.'
                        : undefined
                    }
                  />
                  <Select
                    label="Model"
                    value={form.model}
                    onChange={e => updateForm('model', e.target.value)}
                  >
                    {(MODELS[form.provider] || []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>

                {/* Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[#0F172A]">System Prompt</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#94A3B8]">Templates:</span>
                      {PROMPT_TEMPLATES.map(t => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => updateForm('prompt', t.value)}
                          className="text-xs text-[#16A34A] hover:underline px-1"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={form.prompt}
                    onChange={e => updateForm('prompt', e.target.value)}
                    rows={6}
                    className="w-full border border-[#E6EAF0] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent resize-none font-mono"
                    placeholder="You are a helpful WhatsApp assistant..."
                    required
                  />
                  <p className="text-xs text-[#94A3B8] mt-1">This is the AI&apos;s personality and instructions</p>
                </div>

                {/* Tools */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-[#0F172A]">Tools</label>
                    <a href="/tools" className="text-xs text-[#16A34A] hover:underline">Manage tools</a>
                  </div>
                  {tools.length === 0 ? (
                    <p className="text-xs text-[#94A3B8] py-2">
                      No tools configured yet. Create one under Tools to let this bot capture
                      details into a Google Sheet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {tools.map(tool => {
                        const checked = form.toolIds.includes(tool.id)
                        return (
                          <label
                            key={tool.id}
                            className="flex items-start gap-2.5 py-2 px-3 bg-[#F8FAFC] rounded-lg cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e =>
                                updateForm(
                                  'toolIds',
                                  e.target.checked
                                    ? [...form.toolIds, tool.id]
                                    : form.toolIds.filter(id => id !== tool.id)
                                )
                              }
                              className="mt-0.5 accent-[#16A34A]"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[#0F172A]">{tool.name}</span>
                                <Badge variant="blue" size="sm">{tool.sheetTab}</Badge>
                                {!tool.enabled && <Badge variant="gray" size="sm">Disabled</Badge>}
                                {!tool.hasSinkUrl && <Badge variant="red" size="sm">No sheet</Badge>}
                              </div>
                              <p className="text-xs text-[#475569] line-clamp-1">{tool.description}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-1.5">
                    The AI decides when to call these based on each tool&apos;s description
                  </p>
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center justify-between py-3 px-4 bg-[#F8FAFC] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Bot enabled</p>
                    <p className="text-xs text-[#475569]">Disabled bots are never selected for auto replies</p>
                  </div>
                  <Toggle checked={form.enabled} onChange={v => updateForm('enabled', v)} />
                </div>

                {/* Default toggle */}
                <div className="flex items-center justify-between py-3 px-4 bg-[#F8FAFC] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Set as default bot</p>
                    <p className="text-xs text-[#475569]">Used when a contact has no specific bot assigned</p>
                  </div>
                  <Toggle checked={form.isDefault} onChange={v => updateForm('isDefault', v)} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[#E6EAF0]">
                  <div>
                    {!isNew && selectedBot && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedBot)} className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEE2E2]">
                        Delete bot
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={closePanel}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty && !isNew}>
                      {saving ? 'Saving...' : 'Save Bot'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

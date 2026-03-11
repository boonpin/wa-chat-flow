'use client'

import { useEffect, useState } from 'react'
import { Badge, Card, Select, Toggle, useToast } from '@/components/ui'

interface Settings {
  id: string
  autoReplyEnabled: boolean
  defaultBotId: string | null
}

interface Bot {
  id: string
  name: string
  provider: string
  model: string
  isDefault: boolean
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-[#E6EAF0]">
        <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
        <p className="text-xs text-[#475569] mt-0.5">{description}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </Card>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [saved, setSaved] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchData() {
    const [sr, br] = await Promise.all([fetch('/api/settings'), fetch('/api/bots')])
    const s = await sr.json()
    const b = await br.json()
    setSettings(s)
    setSaved(s)
    setBots(b)
  }

  useEffect(() => { fetchData() }, [])

  function update<K extends keyof Settings>(key: K, val: Settings[K]) {
    setSettings(s => s ? { ...s, [key]: val } : s)
  }

  const dirty = settings && saved && (
    settings.autoReplyEnabled !== saved.autoReplyEnabled ||
    settings.defaultBotId !== saved.defaultBotId
  )

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!r.ok) throw new Error()
      setSaved({ ...settings })
      toast('Settings saved')
    } catch {
      toast('Failed to save settings', 'error')
    }
    setSaving(false)
  }

  function handleDiscard() {
    if (saved) setSettings({ ...saved })
  }

  if (!settings) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <div className="h-6 w-32 bg-[#E6EAF0] rounded animate-pulse mb-1" />
          <div className="h-4 w-48 bg-[#E6EAF0] rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-32 bg-[#E6EAF0] rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const defaultBot = bots.find(b => b.id === settings.defaultBotId)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Automation Settings</h1>
        <p className="text-sm text-[#475569] mt-0.5">Control how auto-replies work across the system</p>
      </div>

      <div className="space-y-4">
        {/* Auto Reply section */}
        <SectionCard
          title="Auto Reply"
          description="Globally enable or disable AI-powered auto replies for all contacts"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Enable Auto Reply</p>
              <p className="text-xs text-[#475569] mt-0.5">
                {settings.autoReplyEnabled
                  ? 'AI is currently replying to incoming messages'
                  : 'AI is paused — no replies will be sent'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={settings.autoReplyEnabled ? 'green' : 'gray'} dot>
                {settings.autoReplyEnabled ? 'Active' : 'Paused'}
              </Badge>
              <Toggle
                checked={settings.autoReplyEnabled}
                onChange={v => update('autoReplyEnabled', v)}
              />
            </div>
          </div>

          {!settings.autoReplyEnabled && (
            <div className="flex items-start gap-2.5 p-3 bg-[#FEF3C7] rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="shrink-0 mt-0.5">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-[#92400E]">
                Auto reply is disabled. Incoming messages will not receive AI responses, even if individual contacts have AI enabled.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Default Bot section */}
        <SectionCard
          title="Default Bot"
          description="The fallback bot used when a contact has no specific bot assigned"
        >
          <Select
            label="Default Bot"
            hint="Contacts without a specific bot assignment will use this bot"
            value={settings.defaultBotId || ''}
            onChange={e => update('defaultBotId', e.target.value || null)}
          >
            <option value="">None — AI won&apos;t reply without a bot assigned</option>
            {bots.map(bot => (
              <option key={bot.id} value={bot.id}>{bot.name} ({bot.provider} · {bot.model})</option>
            ))}
          </Select>

          {settings.defaultBotId && defaultBot && (
            <div className="flex items-center gap-3 p-3 bg-[#F0FDF4] rounded-lg">
              <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M12 11V7M9 7h6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#166534]">{defaultBot.name}</p>
                <p className="text-xs text-[#4ADE80] opacity-80">{defaultBot.provider} · {defaultBot.model}</p>
              </div>
            </div>
          )}

          {!settings.defaultBotId && (
            <div className="flex items-start gap-2.5 p-3 bg-[#FEF3C7] rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="shrink-0 mt-0.5">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-[#92400E]">
                No default bot set. Contacts without a specific bot assigned will not receive AI replies.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Guardrails section */}
        <SectionCard
          title="How Auto Reply Works"
          description="Understanding the reply decision logic"
        >
          <ol className="space-y-3">
            {[
              { step: '1', label: 'System auto reply', desc: 'Must be ON (controlled here)' },
              { step: '2', label: 'Contact AI enabled', desc: 'Per-contact setting in Contacts page' },
              { step: '3', label: 'Bot selection', desc: 'Contact\'s assigned bot → Default bot' },
              { step: '4', label: 'AI generates reply', desc: 'Using the bot\'s system prompt' },
            ].map(item => (
              <li key={item.step} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[#475569]">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                  <p className="text-xs text-[#475569]">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 ml-28 flex items-center gap-3 bg-[#0F172A] text-white px-5 py-3 rounded-2xl shadow-2xl z-30">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="text-sm">You have unsaved changes</span>
          <div className="w-px h-4 bg-white/20" />
          <button onClick={handleDiscard} className="text-sm text-white/60 hover:text-white transition-colors">Discard</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}

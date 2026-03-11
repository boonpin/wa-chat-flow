'use client'

import { useEffect, useState } from 'react'

interface Settings {
  id: string
  autoReplyEnabled: boolean
  defaultBotId: string | null
}

interface Bot {
  id: string
  name: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function fetchData() {
    const [sr, br] = await Promise.all([fetch('/api/settings'), fetch('/api/bots')])
    setSettings(await sr.json())
    setBots(await br.json())
  }

  useEffect(() => { fetchData() }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <div className="p-8 text-gray-400">Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Auto Reply</div>
            <div className="text-sm text-gray-500">Enable AI auto reply globally</div>
          </div>
          <button
            onClick={() => setSettings(s => s ? { ...s, autoReplyEnabled: !s.autoReplyEnabled } : s)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoReplyEnabled ? 'bg-green-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              settings.autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div>
          <label className="block font-medium text-gray-900 mb-1">Default Bot</label>
          <p className="text-sm text-gray-500 mb-2">Used when contact has no specific bot assigned</p>
          <select
            value={settings.defaultBotId || ''}
            onChange={e => setSettings(s => s ? { ...s, defaultBotId: e.target.value || null } : s)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">None</option>
            {bots.map(bot => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

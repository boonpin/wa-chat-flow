'use client'

import { useEffect, useState } from 'react'

interface Bot {
  id: string
  name: string
  provider: string
  apiKey: string
  model: string
  prompt: string
  isDefault: boolean
}

const EMPTY_BOT = { name: '', provider: 'openai', apiKey: '', model: 'gpt-4o-mini', prompt: '', isDefault: false }

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_BOT })
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchBots() {
    const r = await fetch('/api/bots')
    setBots(await r.json())
  }

  useEffect(() => { fetchBots() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    if (editId) {
      await fetch(`/api/bots/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false)
    setEditId(null)
    setForm({ ...EMPTY_BOT })
    fetchBots()
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bot?')) return
    await fetch(`/api/bots/${id}`, { method: 'DELETE' })
    fetchBots()
  }

  function handleEdit(bot: Bot) {
    setForm({ name: bot.name, provider: bot.provider, apiKey: bot.apiKey, model: bot.model, prompt: bot.prompt, isDefault: bot.isDefault })
    setEditId(bot.id)
    setShowForm(true)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Bots</h1>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...EMPTY_BOT }) }}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + New Bot
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">{editId ? 'Edit Bot' : 'New Bot'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: e.target.value === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="You are a helpful WhatsApp assistant..."
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default bot</label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Bot'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null) }}
                className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {bots.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            No bots yet. Create your first AI bot.
          </div>
        )}
        {bots.map(bot => (
          <div key={bot.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{bot.name}</span>
                {bot.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{bot.provider} · {bot.model}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(bot)}
                className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(bot.id)}
                className="text-sm text-red-600 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Toggle, useToast } from '@/components/ui'

interface Bot {
  id: string
  name: string
}

interface Contact {
  id: string
  phoneNumber: string
  name: string | null
  aiEnabled: boolean
  aiBotId: string | null
}

type FilterType = 'all' | 'ai_on' | 'ai_off'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  async function fetchData() {
    const [cr, br] = await Promise.all([fetch('/api/contacts'), fetch('/api/bots')])
    setContacts(await cr.json())
    setBots(await br.json())
  }

  useEffect(() => { fetchData() }, [])

  async function updateContact(id: string, data: Partial<Contact>) {
    setUpdating(u => new Set(u).add(id))
    try {
      await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setContacts(cs => cs.map(c => c.id === id ? { ...c, ...data } : c))
    } catch {
      toast('Failed to update contact', 'error')
    }
    setUpdating(u => { const s = new Set(u); s.delete(id); return s })
  }

  const filtered = useMemo(() => {
    let result = contacts
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        c.phoneNumber.includes(q)
      )
    }
    if (filter === 'ai_on') result = result.filter(c => c.aiEnabled)
    if (filter === 'ai_off') result = result.filter(c => !c.aiEnabled)
    return result
  }, [contacts, search, filter])

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  async function bulkSetAI(enabled: boolean) {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => updateContact(id, { aiEnabled: enabled })))
    toast(`AI reply ${enabled ? 'enabled' : 'disabled'} for ${ids.length} contact${ids.length > 1 ? 's' : ''}`)
    setSelected(new Set())
  }

  async function bulkAssignBot(botId: string) {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => updateContact(id, { aiBotId: botId || null })))
    const botName = bots.find(b => b.id === botId)?.name || 'default'
    toast(`Assigned "${botName}" to ${ids.length} contact${ids.length > 1 ? 's' : ''}`)
    setSelected(new Set())
  }

  const hasSelected = selected.size > 0

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Contacts</h1>
          <p className="text-sm text-[#475569] mt-0.5">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} — appear automatically when messages are received</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E6EAF0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>

        <div className="flex items-center gap-1 bg-white border border-[#E6EAF0] rounded-lg p-1">
          {([['all', 'All'], ['ai_on', 'AI ON'], ['ai_off', 'AI OFF']] as [FilterType, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === v ? 'bg-[#0F172A] text-white' : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {hasSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-[#0F172A] rounded-xl text-white text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-white/20" />
          <button onClick={() => bulkSetAI(true)} className="hover:text-[#4ADE80] transition-colors text-xs">Enable AI</button>
          <button onClick={() => bulkSetAI(false)} className="hover:text-[#FCA5A5] transition-colors text-xs">Disable AI</button>
          {bots.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-xs text-white/60">Assign bot:</span>
              <select
                onChange={e => { if (e.target.value !== '') bulkAssignBot(e.target.value) }}
                defaultValue=""
                className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white focus:outline-none"
              >
                <option value="">Choose...</option>
                <option value="">Default</option>
                {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
          <div className="ml-auto">
            <button onClick={() => setSelected(new Set())} className="text-xs text-white/60 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {contacts.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No contacts yet"
            description="Contacts appear automatically when WhatsApp messages are received"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No contacts match your search"
            description="Try a different search term or filter"
            action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilter('all') }}>Clear filters</Button>}
          />
        ) : (
          <table className="w-full">
            <thead className="border-b border-[#E6EAF0] bg-[#F8FAFC]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#E6EAF0] accent-[#16A34A] cursor-pointer"
                  />
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">Contact</th>
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">Phone</th>
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">AI Reply</th>
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">Assigned Bot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map(contact => {
                const isUpdating = updating.has(contact.id)
                const isSelected = selected.has(contact.id)
                const assignedBot = bots.find(b => b.id === contact.aiBotId)

                return (
                  <tr key={contact.id} className={`transition-colors ${isSelected ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-[#E6EAF0] accent-[#16A34A] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E6EAF0] to-[#CBD5E1] flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-[#475569]">
                            {(contact.name || contact.phoneNumber).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-[#0F172A]">{contact.name || <span className="text-[#94A3B8] font-normal">Unknown</span>}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#475569] font-mono">{contact.phoneNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={contact.aiEnabled}
                          onChange={v => updateContact(contact.id, { aiEnabled: v })}
                          disabled={isUpdating}
                        />
                        <span className={`text-xs ${contact.aiEnabled ? 'text-[#16A34A]' : 'text-[#94A3B8]'}`}>
                          {contact.aiEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={contact.aiBotId || ''}
                        onChange={e => updateContact(contact.id, { aiBotId: e.target.value || null })}
                        disabled={isUpdating}
                        className="text-xs border border-[#E6EAF0] rounded-lg px-2.5 py-1.5 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent bg-white disabled:opacity-50"
                      >
                        <option value="">Default Bot</option>
                        {bots.map(bot => (
                          <option key={bot.id} value={bot.id}>{bot.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

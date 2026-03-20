'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  waSessionId: string | null
  waSessionName: string | null
}

const SESSION_COLORS = [
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FAF5FF', text: '#9333EA' },
  { bg: '#FFF1F2', text: '#E11D48' },
]

function sessionColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length]
}

function SessionBadge({ id, name }: { id: string; name: string }) {
  const c = sessionColor(id)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {name}
    </span>
  )
}

interface WAMessage {
  id: string
  body: string
  fromMe: boolean
  timestamp: number
  type: string
}

type FilterType = 'all' | 'ai_on' | 'ai_off'

function ChatWindow({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [msgs, setMsgs] = useState<WAMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offline, setOffline] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const limitRef = useRef(50)
  const isAtBottomRef = useRef(true)
  const { toast } = useToast()

  async function fetchMessages(limit: number, scrollToBottom = false) {
    try {
      const r = await fetch(`/api/wa/chat?phone=${contact.phoneNumber}&limit=${limit}`)
      if (!r.ok) return
      const data = await r.json()
      setOffline(data.offline)
      setMsgs(data.messages ?? [])
      setHasMore(data.hasMore)
      if (scrollToBottom) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'instant' })
          isAtBottomRef.current = true
        })
      } else if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
      }
    } catch {
      setOffline(true)
    }
  }

  useEffect(() => {
    limitRef.current = 50
    setLoading(true)
    fetchMessages(50, true).then(() => setLoading(false))
    const interval = setInterval(() => fetchMessages(limitRef.current), 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (el.scrollTop < 80 && !loadingMore && hasMore) {
      handleLoadMore()
    }
  }

  async function handleLoadMore() {
    const el = containerRef.current
    if (!el || loadingMore) return
    setLoadingMore(true)
    const prevScrollHeight = el.scrollHeight
    const newLimit = limitRef.current + 50
    limitRef.current = newLimit
    try {
      const r = await fetch(`/api/wa/chat?phone=${contact.phoneNumber}&limit=${newLimit}`)
      if (r.ok) {
        const data = await r.json()
        setOffline(data.offline)
        setMsgs(data.messages ?? [])
        setHasMore(data.hasMore)
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
        })
      }
    } catch {
      // ignore
    }
    setLoadingMore(false)
  }

  async function handleSend() {
    const msg = text.trim()
    if (!msg) return
    setSending(true)
    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, message: msg }),
      })
      if (!r.ok) {
        const d = await r.json()
        toast(d.error || 'Failed to send', 'error')
      } else {
        setText('')
        isAtBottomRef.current = true
        await fetchMessages(limitRef.current, true)
      }
    } catch {
      toast('Failed to send', 'error')
    }
    setSending(false)
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Group messages by date
  const grouped: { date: string; messages: WAMessage[] }[] = []
  for (const m of msgs) {
    const date = formatDate(m.timestamp)
    const last = grouped[grouped.length - 1]
    if (last && last.date === date) {
      last.messages.push(m)
    } else {
      grouped.push({ date, messages: [m] })
    }
  }

  function renderBody(m: WAMessage) {
    if (m.type !== 'chat') return <span className="italic opacity-60">[{m.type}]</span>
    return <span className="leading-relaxed break-words">{m.body}</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col w-full max-w-md bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EAF0] bg-white shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E6EAF0] to-[#CBD5E1] flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-[#475569]">
              {(contact.name || contact.phoneNumber).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F172A] truncate">{contact.name || <span className="text-[#94A3B8]">Unknown</span>}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-[#94A3B8] font-mono">{contact.phoneNumber}</p>
              {contact.waSessionId && contact.waSessionName && (
                <SessionBadge id={contact.waSessionId} name={contact.waSessionName} />
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 bg-[#F8FAFC]"
        >
          {loadingMore && (
            <div className="flex justify-center py-2 mb-2">
              <div className="w-4 h-4 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loadingMore && !hasMore && msgs.length > 0 && (
            <p className="text-center text-[10px] text-[#CBD5E1] py-2 mb-2">Beginning of conversation</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <div className="w-5 h-5 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : offline ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-[#CBD5E1]">
                <path d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12v.01" strokeLinecap="round"/>
                <path d="M15.536 8.464a5 5 0 010 7.072M8.464 8.464a5 5 0 000 7.072" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-[#94A3B8]">WhatsApp offline</p>
              <p className="text-xs text-[#CBD5E1]">Connect WhatsApp to view messages</p>
            </div>
          ) : msgs.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <p className="text-sm text-[#94A3B8]">No messages yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-[#E6EAF0]" />
                    <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">{group.date}</span>
                    <div className="flex-1 h-px bg-[#E6EAF0]" />
                  </div>
                  <div className="space-y-2">
                    {group.messages.map(m => (
                      <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                          m.fromMe
                            ? 'bg-[#0F172A] text-white rounded-br-sm'
                            : 'bg-white text-[#0F172A] shadow-sm rounded-bl-sm border border-[#E6EAF0]'
                        }`}>
                          <p>{renderBody(m)}</p>
                          <p className={`text-[10px] mt-1 ${m.fromMe ? 'text-white/50' : 'text-[#94A3B8]'} text-right`}>
                            {formatTime(m.timestamp)}
                            {m.fromMe && <span className="ml-1 text-[#4ADE80]">✓</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#E6EAF0] bg-white shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={offline ? 'WhatsApp offline…' : 'Type a message...'}
              disabled={offline}
              rows={1}
              className="flex-1 resize-none border border-[#E6EAF0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 max-h-32 overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim() || offline}
              className="shrink-0 w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#1E293B] transition-colors"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sessionFilter, setSessionFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const [chatContact, setChatContact] = useState<Contact | null>(null)
  const { toast } = useToast()

  async function fetchData() {
    const [cr, br] = await Promise.all([fetch('/api/contacts'), fetch('/api/bots')])
    setContacts(await cr.json())
    setBots(await br.json())
  }

  useEffect(() => { fetchData() }, [])

  // Derive unique sessions from contacts
  const sessions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of contacts) {
      if (c.waSessionId && c.waSessionName) map.set(c.waSessionId, c.waSessionName)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [contacts])

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
    if (sessionFilter !== 'all') result = result.filter(c => c.waSessionId === sessionFilter)
    return result
  }, [contacts, search, filter, sessionFilter])

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
      {chatContact && (
        <ChatWindow
          contact={chatContact}
          onClose={() => setChatContact(null)}
        />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Contacts</h1>
          <p className="text-sm text-[#475569] mt-0.5">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} — appear automatically when messages are received</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
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

        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8]">Account</span>
            <div className="flex items-center gap-1 bg-white border border-[#E6EAF0] rounded-lg p-1">
              <button
                onClick={() => setSessionFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sessionFilter === 'all' ? 'bg-[#0F172A] text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                All
              </button>
              {sessions.map(s => {
                const c = sessionColor(s.id)
                const active = sessionFilter === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSessionFilter(s.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
                    style={active ? { background: c.bg, color: c.text } : {}}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? c.text : '#CBD5E1' }} />
                    <span className={active ? '' : 'text-[#475569]'}>{s.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {(search || filter !== 'all' || sessionFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilter('all'); setSessionFilter('all') }}
            className="text-xs text-[#94A3B8] hover:text-[#475569] transition-colors"
          >
            Clear filters
          </button>
        )}
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
            action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilter('all'); setSessionFilter('all') }}>Clear filters</Button>}
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
                {sessions.length > 0 && (
                  <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">Via</th>
                )}
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">AI Reply</th>
                <th className="text-left text-xs font-semibold text-[#475569] px-4 py-3 uppercase tracking-wide">Assigned Bot</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map(contact => {
                const isUpdating = updating.has(contact.id)
                const isSelected = selected.has(contact.id)
                const assignedBot = bots.find(b => b.id === contact.aiBotId)

                return (
                  <tr
                    key={contact.id}
                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'}`}
                    onClick={() => setChatContact(contact)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                    {sessions.length > 0 && (
                      <td className="px-4 py-3">
                        {contact.waSessionId && contact.waSessionName
                          ? <SessionBadge id={contact.waSessionId} name={contact.waSessionName} />
                          : <span className="text-xs text-[#CBD5E1]">—</span>
                        }
                      </td>
                    )}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                    <td className="px-4 py-3">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-[#CBD5E1]">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
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

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, EmptyState, Toggle, useToast } from '@/components/ui'

type ConversationStatus = 'open' | 'resolved'
type Tab = ConversationStatus | 'all'

interface ConversationSummary {
  id: string
  contactId: string
  contactName: string | null
  contactPhone: string
  waSessionId: string | null
  waSessionName: string | null
  botId: string | null
  botName: string | null
  mode: 'auto' | 'human'
  status: ConversationStatus
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastMessageDirection: 'incoming' | 'outgoing' | null
}

interface Message {
  id: string
  direction: 'incoming' | 'outgoing'
  senderType: 'customer' | 'ai' | 'human' | 'system'
  messageType: string
  content: string
  status: 'received' | 'processing' | 'sent' | 'failed'
  error: string | null
  createdAt: string
}

interface ConversationDetail {
  conversation: ConversationSummary & { waSessionId: string | null }
  contact: { id: string; name: string | null; phoneNumber: string } | null
  waSessionName: string | null
  messages: Message[]
}

interface BotOption {
  id: string
  name: string
  enabled: boolean
}

const POLL_INTERVAL_MS = 5000

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Conversation list ────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary
  active: boolean
  onSelect: () => void
}) {
  const name = conversation.contactName || conversation.contactPhone

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#F8FAFC] ${
        active ? 'bg-[#F0FDF4] border-l-2 border-[#16A34A]' : 'border-l-2 border-transparent'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-sm font-medium text-[#0F172A] truncate">{name}</span>
        <span className="text-[11px] text-[#94A3B8] shrink-0">{timeAgo(conversation.lastMessageAt)}</span>
      </div>
      <p className="text-xs text-[#475569] truncate">
        {conversation.lastMessagePreview ? (
          <>
            {conversation.lastMessageDirection === 'outgoing' && (
              <span className="text-[#94A3B8]">You: </span>
            )}
            {conversation.lastMessagePreview}
          </>
        ) : (
          <span className="italic text-[#94A3B8]">No messages yet</span>
        )}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5">
        {conversation.mode === 'auto' ? (
          <Badge variant="green" size="sm">AI</Badge>
        ) : (
          <Badge variant="gray" size="sm">Human</Badge>
        )}
        {conversation.status === 'resolved' && <Badge variant="blue" size="sm">Resolved</Badge>}
        {conversation.waSessionName && (
          <span className="text-[10px] text-[#94A3B8] truncate">{conversation.waSessionName}</span>
        )}
      </div>
    </button>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const SENDER_LABEL: Record<Message['senderType'], string> = {
  customer: '',
  ai: 'AI',
  human: 'You',
  system: 'System',
}

function MessageBubble({ message }: { message: Message }) {
  const incoming = message.direction === 'incoming'

  // System rows exist only to surface a failure that has no message body.
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center">
        <p className="text-[11px] text-[#991B1B] bg-[#FEE2E2] rounded-full px-3 py-1 max-w-md text-center">
          {message.error || 'Something went wrong'}
        </p>
      </div>
    )
  }

  const bubbleTone = incoming
    ? 'bg-white border border-[#E6EAF0] text-[#0F172A]'
    : message.status === 'failed'
      ? 'bg-[#FEE2E2] border border-[#FCA5A5] text-[#7F1D1D]'
      : message.senderType === 'ai'
        ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#0F172A]'
        : 'bg-[#16A34A] text-white'

  return (
    <div className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${bubbleTone}`}>
        {!incoming && SENDER_LABEL[message.senderType] && (
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
              message.senderType === 'human' && message.status !== 'failed'
                ? 'text-white/70'
                : 'text-[#16A34A]'
            }`}
          >
            {SENDER_LABEL[message.senderType]}
          </p>
        )}

        {message.messageType !== 'text' && (
          <p className="text-xs italic opacity-70 mb-0.5">[{message.messageType}]</p>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        <div className="flex items-center gap-1.5 justify-end mt-0.5">
          <span
            className={`text-[10px] ${
              !incoming && message.senderType === 'human' && message.status !== 'failed'
                ? 'text-white/70'
                : 'text-[#94A3B8]'
            }`}
          >
            {clockTime(message.createdAt)}
          </span>
          {message.status === 'processing' && <span className="text-[10px] text-[#94A3B8]">sending…</span>}
          {message.status === 'failed' && <span className="text-[10px] font-medium">failed</span>}
        </div>

        {message.status === 'failed' && message.error && (
          <p className="text-[10px] mt-1 opacity-80">{message.error}</p>
        )}
      </div>
    </div>
  )
}

// ─── Thread ───────────────────────────────────────────────────────────────────

function Thread({
  conversationId,
  bots,
  onChanged,
}: {
  conversationId: string
  bots: BotOption[]
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const r = await fetch(`/api/conversations/${conversationId}`)
    if (r.ok) setDetail(await r.json())
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    // Polling: state updates land after each fetch resolves, not during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setDraft('')
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  const messageCount = detail?.messages.length ?? 0
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messageCount, conversationId])

  async function patch(body: Record<string, unknown>, successMessage: string) {
    const r = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) {
      toast(successMessage)
      await load()
      onChanged()
    } else {
      toast('Update failed', 'error')
    }
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    const r = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await r.json().catch(() => ({}))

    if (r.ok) {
      setDraft('')
    } else {
      toast(data.error || 'Could not send message', 'error')
    }

    setSending(false)
    await load()
    onChanged()
  }

  if (loading && !detail) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#94A3B8]">Loading…</div>
  }
  if (!detail) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#94A3B8]">Conversation not found</div>
  }

  const { conversation, contact } = detail
  const isAuto = conversation.mode === 'auto'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E6EAF0] bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A] truncate">
              {contact?.name || contact?.phoneNumber}
            </p>
            <p className="text-xs text-[#94A3B8]">
              {contact?.phoneNumber}
              {detail.waSessionName && <> · via {detail.waSessionName}</>}
            </p>
          </div>
          <Button
            size="sm"
            variant={conversation.status === 'resolved' ? 'secondary' : 'primary'}
            onClick={() =>
              patch(
                { status: conversation.status === 'resolved' ? 'open' : 'resolved' },
                conversation.status === 'resolved' ? 'Conversation reopened' : 'Conversation resolved'
              )
            }
          >
            {conversation.status === 'resolved' ? 'Reopen' : 'Resolve'}
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-5 mt-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#475569]">AI Auto Reply</span>
            <Toggle
              checked={isAuto}
              onChange={(v) => patch({ mode: v ? 'auto' : 'human' }, v ? 'AI auto reply on' : 'Handed to a human')}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#475569]">Bot</span>
            <select
              value={conversation.botId ?? ''}
              onChange={(e) => patch({ botId: e.target.value }, 'Bot updated')}
              className="border border-[#E6EAF0] rounded-lg px-2 py-1 text-xs text-[#0F172A] bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            >
              <option value="">System default</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id} disabled={!bot.enabled}>
                  {bot.name}
                  {!bot.enabled ? ' (disabled)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-[#F6F8FB]">
        {detail.messages.length === 0 ? (
          <p className="text-center text-xs text-[#94A3B8] py-10">No messages in this conversation yet.</p>
        ) : (
          detail.messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#E6EAF0] bg-white px-5 py-3">
        {isAuto && (
          <p className="text-[11px] text-[#92400E] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 mb-2">
            AI auto reply is on. Your message is sent as-is; turn it off to take over the conversation.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={2}
            placeholder="Type a reply…  (Enter to send, Shift+Enter for a new line)"
            className="flex-1 border border-[#E6EAF0] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent resize-none"
          />
          <Button onClick={handleSend} loading={sending} disabled={!draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bots, setBots] = useState<BotOption[]>([])
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('status', tab)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [tab, search])

  const loadConversations = useCallback(async () => {
    const r = await fetch(`/api/conversations?${query}`)
    if (r.ok) setConversations(await r.json())
    setLoading(false)
  }, [query])

  useEffect(() => {
    // Polling: state updates land after each fetch resolves, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations()
    const interval = setInterval(loadConversations, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadConversations])

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBots(Array.isArray(data) ? data : []))
  }, [])

  // Keep a selection that has fallen out of the current filter usable.
  const selected = conversations.find((c) => c.id === selectedId) ?? null

  return (
    <div className="h-screen flex flex-col">
      <div className="px-8 pt-6 pb-4 shrink-0">
        <h1 className="text-xl font-semibold text-[#0F172A]">Inbox</h1>
        <p className="text-sm text-[#475569] mt-0.5">Every conversation, whether the AI or a human is handling it</p>
      </div>

      <div className="flex-1 min-h-0 px-8 pb-8">
        <Card className="h-full flex overflow-hidden">
          {/* List pane */}
          <div className="w-80 border-r border-[#E6EAF0] flex flex-col shrink-0">
            <div className="p-3 border-b border-[#E6EAF0] space-y-2.5">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number"
                className="w-full border border-[#E6EAF0] rounded-lg px-3 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
              />
              <div className="flex gap-1">
                {(['open', 'resolved', 'all'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                      tab === t ? 'bg-[#F0FDF4] text-[#16A34A]' : 'text-[#475569] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
              {loading ? (
                <p className="text-xs text-[#94A3B8] text-center py-8">Loading…</p>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-8 px-4">
                  {search.trim()
                    ? 'No conversations match your search.'
                    : tab === 'all'
                      ? 'No conversations yet.'
                      : `No ${tab} conversations.`}
                </p>
              ) : (
                conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    active={c.id === selectedId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Thread pane */}
          {selected ? (
            <Thread key={selected.id} conversationId={selected.id} bots={bots} onChanged={loadConversations} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon="💬"
                title="No conversation selected"
                description="Pick a conversation on the left to read it and reply."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

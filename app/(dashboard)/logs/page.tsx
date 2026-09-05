'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge, Button, Card, useToast } from '@/components/ui'

interface MessageLog {
  id: string
  direction: 'incoming' | 'outgoing'
  senderType: 'customer' | 'ai' | 'human' | 'system'
  messageType: string
  message: string
  status: 'received' | 'processing' | 'sent' | 'failed'
  error: string | null
  createdAt: string
  contactId: string
  contactName: string | null
  contactPhone: string | null
}

/** What a tool row captured. Null for calls rejected before anything was stored. */
interface Invocation {
  id: string
  toolName: string | null
  sheetTab: string | null
  spreadsheetUrl: string | null
  args: Record<string, unknown>
  status: string
  error: string | null
  createdAt: string
  syncedAt: string | null
}

interface MessageDetail extends MessageLog {
  conversationId: string
  provider: string
  providerMessageId: string | null
  toolInvocationId: string | null
  conversationMode: string | null
  conversationStatus: string | null
  invocation: Invocation | null
}

const SENDER_BADGE: Record<MessageLog['senderType'], { label: string; variant: 'blue' | 'green' | 'gray' | 'red' }> = {
  customer: { label: 'IN', variant: 'blue' },
  ai: { label: 'AI', variant: 'green' },
  human: { label: 'YOU', variant: 'gray' },
  system: { label: 'SYS', variant: 'red' },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString()
}

export default function LogsPage() {
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/messages?limit=200')
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Polling: the state update lands after the fetch resolves, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Message Logs</h1>
          <p className="text-sm text-[#475569] mt-0.5">
            Everything sent and received (auto-refreshes every 5s). Click an entry for details.
          </p>
        </div>
        <button onClick={load} className="text-xs text-[#16A34A] hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <Card className="p-5 text-sm text-[#94A3B8]">Loading...</Card>
      ) : logs.length === 0 ? (
        <Card className="p-5 text-sm text-[#94A3B8]">No messages yet.</Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const badge = SENDER_BADGE[log.senderType] ?? SENDER_BADGE.customer
            return (
              <Card key={log.id} className="hover:border-[#CBD5E1] hover:shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setOpenId(log.id)}
                  className="w-full text-left px-4 py-3 flex gap-4 items-start cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                >
                  <div className="shrink-0 pt-0.5">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#0F172A]">
                        {log.contactName || log.contactPhone || log.contactId}
                      </span>
                      {log.contactPhone && log.contactName && (
                        <span className="text-xs text-[#94A3B8]">{log.contactPhone}</span>
                      )}
                      {log.status === 'failed' && <Badge variant="red" size="sm">Failed</Badge>}
                      {log.status === 'processing' && <Badge variant="yellow" size="sm">Sending</Badge>}
                      {log.messageType !== 'text' && <Badge variant="gray" size="sm">{log.messageType}</Badge>}
                    </div>

                    {log.message && <p className="text-sm text-[#334155] break-words">{log.message}</p>}
                    {log.error && <p className="text-xs text-[#DC2626] break-words mt-0.5">{log.error}</p>}
                  </div>

                  <div className="shrink-0 text-xs text-[#94A3B8] whitespace-nowrap pt-0.5">
                    {formatTime(log.createdAt)}
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {openId && <DetailDrawer messageId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function DetailDrawer({
  messageId,
  onClose,
  onChanged,
}: {
  messageId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<MessageDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/${messageId}`)
    if (!res.ok) return setError('Could not load this entry.')
    setDetail(await res.json())
  }, [messageId])

  useEffect(() => {
    // The state update lands after the fetch resolves, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Escape closes, matching every other overlay in the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function retry() {
    if (!detail?.invocation) return
    setRetrying(true)
    const res = await fetch(`/api/tools/invocations/${detail.invocation.id}/retry`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setRetrying(false)
    toast(res.ok ? 'Synced to sheet' : (body.error ?? 'Retry failed'), res.ok ? 'success' : 'error')
    if (res.ok) {
      load()
      onChanged()
    }
  }

  const badge = detail ? (SENDER_BADGE[detail.senderType] ?? SENDER_BADGE.customer) : null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative flex flex-col w-full max-w-md bg-white shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6EAF0] sticky top-0 bg-white z-10">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F172A]">Event details</p>
            {detail && (
              <p className="text-xs text-[#94A3B8] mt-0.5">{formatTime(detail.createdAt)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <p className="p-5 text-sm text-[#DC2626]">{error}</p>
        ) : !detail ? (
          <p className="p-5 text-sm text-[#94A3B8]">Loading...</p>
        ) : (
          <div className="p-5 space-y-6">
            {/* What went wrong, first — it is the reason anyone opens this. */}
            {detail.error ? (
              <Section title="Error">
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
                  <p className="text-sm text-[#991B1B] break-words whitespace-pre-wrap">{detail.error}</p>
                </div>
              </Section>
            ) : (
              <Section title="Error">
                <p className="text-sm text-[#94A3B8]">None — this event completed cleanly.</p>
              </Section>
            )}

            {detail.message && (
              <Section title={detail.messageType === 'tool' ? 'Event' : 'Message'}>
                <p className="text-sm text-[#334155] break-words whitespace-pre-wrap">{detail.message}</p>
              </Section>
            )}

            {detail.messageType === 'tool' && (
              <Section title="Tool call">
                {detail.invocation ? (
                  <InvocationDetail
                    invocation={detail.invocation}
                    retrying={retrying}
                    onRetry={retry}
                  />
                ) : (
                  <p className="text-sm text-[#94A3B8]">
                    Nothing was captured — the AI called this tool before it had every required
                    detail, so it asked the customer for the rest instead.
                  </p>
                )}
              </Section>
            )}

            <Section title="Delivery">
              <Rows
                rows={[
                  ['Status', detail.status],
                  ['Direction', detail.direction],
                  ['Sender', detail.senderType],
                  ['Type', detail.messageType],
                  ['Provider', detail.provider],
                  ['Provider message ID', detail.providerMessageId ?? '—'],
                ]}
              />
            </Section>

            <Section title="Contact">
              <Rows
                rows={[
                  ['Name', detail.contactName ?? '—'],
                  ['Phone', detail.contactPhone ?? '—'],
                  ['Conversation mode', detail.conversationMode ?? '—'],
                  ['Conversation status', detail.conversationStatus ?? '—'],
                ]}
              />
            </Section>

            <Section title="Identifiers">
              <Rows
                mono
                rows={[
                  ['Message ID', detail.id],
                  ['Conversation ID', detail.conversationId],
                  ['Contact ID', detail.contactId],
                ]}
              />
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function InvocationDetail({
  invocation,
  retrying,
  onRetry,
}: {
  invocation: Invocation
  retrying: boolean
  onRetry: () => void
}) {
  const entries = Object.entries(invocation.args)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {invocation.toolName && <Badge variant="gray">{invocation.toolName}</Badge>}
        <Badge variant={invocation.status === 'synced' ? 'green' : invocation.status === 'failed' ? 'red' : 'yellow'}>
          {invocation.status}
        </Badge>
        {invocation.sheetTab && <Badge variant="blue">{invocation.sheetTab}</Badge>}
      </div>

      {invocation.error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
          <p className="text-xs font-medium text-[#991B1B] mb-1">Sheet write failed</p>
          <p className="text-sm text-[#991B1B] break-words whitespace-pre-wrap">{invocation.error}</p>
          <p className="text-xs text-[#991B1B] opacity-80 mt-2">
            The details below are saved here. Fix the tool&apos;s configuration, then retry.
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[#475569] mb-1.5">Captured</p>
        {entries.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Nothing.</p>
        ) : (
          <Rows rows={entries.map(([k, v]) => [k, String(v) || '—'])} />
        )}
      </div>

      <Rows
        rows={[
          ['Captured at', formatTime(invocation.createdAt)],
          ['Synced at', invocation.syncedAt ? formatTime(invocation.syncedAt) : '—'],
        ]}
      />

      <div className="flex items-center gap-3 pt-1">
        {invocation.status === 'failed' && (
          <Button size="sm" onClick={onRetry} loading={retrying}>
            Retry sync
          </Button>
        )}
        {invocation.spreadsheetUrl && (
          <a
            href={invocation.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#16A34A] hover:underline"
          >
            Open sheet →
          </a>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Rows({ rows, mono }: { rows: [string, string][]; mono?: boolean }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 text-sm">
          <dt className="text-[#94A3B8] shrink-0 w-40">{label}</dt>
          <dd className={`text-[#334155] break-all min-w-0 ${mono ? 'font-mono text-xs pt-0.5' : ''}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

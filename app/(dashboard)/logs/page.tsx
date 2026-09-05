'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Badge } from '@/components/ui'

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
          <p className="text-sm text-[#475569] mt-0.5">Everything sent and received (auto-refreshes every 5s)</p>
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
              <Card key={log.id} className="px-4 py-3 flex gap-4 items-start">
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
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

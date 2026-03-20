'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Badge } from '@/components/ui'

interface MessageLog {
  id: string
  direction: 'incoming' | 'outgoing'
  message: string
  createdAt: string
  contactId: string
  contactName: string | null
  contactPhone: string | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
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
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Message Logs</h1>
          <p className="text-sm text-[#475569] mt-0.5">Incoming messages and AI replies (auto-refreshes every 5s)</p>
        </div>
        <button
          onClick={load}
          className="text-xs text-[#16A34A] hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <Card className="p-5 text-sm text-[#94A3B8]">Loading...</Card>
      ) : logs.length === 0 ? (
        <Card className="p-5 text-sm text-[#94A3B8]">No messages yet.</Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="px-4 py-3 flex gap-4 items-start">
              {/* Direction badge */}
              <div className="shrink-0 pt-0.5">
                {log.direction === 'incoming' ? (
                  <Badge variant="blue">IN</Badge>
                ) : (
                  <Badge variant="green">AI</Badge>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-[#0F172A]">
                    {log.contactName || log.contactPhone || log.contactId}
                  </span>
                  {log.contactPhone && log.contactName && (
                    <span className="text-xs text-[#94A3B8]">{log.contactPhone}</span>
                  )}
                </div>
                <p className="text-sm text-[#334155] break-words">{log.message}</p>
              </div>

              {/* Time */}
              <div className="shrink-0 text-xs text-[#94A3B8] whitespace-nowrap pt-0.5">
                {formatTime(log.createdAt)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

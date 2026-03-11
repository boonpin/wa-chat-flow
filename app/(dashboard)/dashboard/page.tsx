'use client'

import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [status, setStatus] = useState<string>('loading')
  const [contactCount, setContactCount] = useState<number>(0)
  const [botCount, setBotCount] = useState<number>(0)

  useEffect(() => {
    fetch('/api/wa/status').then(r => r.json()).then(d => setStatus(d.status))
    fetch('/api/contacts').then(r => r.json()).then(d => setContactCount(d.length))
    fetch('/api/bots').then(r => r.json()).then(d => setBotCount(d.length))
  }, [])

  const statusColor = status === 'connected' ? 'text-green-600' : status === 'waiting_qr' ? 'text-yellow-600' : 'text-gray-400'
  const statusLabel = status === 'connected' ? 'Connected' : status === 'waiting_qr' ? 'Waiting QR' : status === 'offline' ? 'Offline' : '...'

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">WhatsApp Status</div>
          <div className={`text-xl font-bold ${statusColor}`}>{statusLabel}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Total Contacts</div>
          <div className="text-xl font-bold text-gray-900">{contactCount}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">AI Bots</div>
          <div className="text-xl font-bold text-gray-900">{botCount}</div>
        </div>
      </div>
    </div>
  )
}

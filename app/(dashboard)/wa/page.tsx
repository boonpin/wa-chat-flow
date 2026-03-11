'use client'

import { useEffect, useState } from 'react'

export default function WAPage() {
  const [status, setStatus] = useState<string>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchStatus() {
    const r = await fetch('/api/wa/status')
    const d = await r.json()
    setStatus(d.status)
  }

  async function fetchQR() {
    const r = await fetch('/api/wa/qr')
    if (r.ok) {
      const d = await r.json()
      setQr(d.qr)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => {
      fetchStatus()
      if (status === 'waiting_qr') fetchQR()
    }, 5000)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (status === 'waiting_qr') fetchQR()
  }, [status])

  async function handleConnect() {
    setLoading(true)
    await fetch('/api/wa/connect', { method: 'POST' })
    // Poll rapidly after connecting until status changes from offline
    let attempts = 0
    const poll = setInterval(async () => {
      const r = await fetch('/api/wa/status')
      const d = await r.json()
      setStatus(d.status)
      attempts++
      if (d.status !== 'offline' || attempts >= 20) {
        clearInterval(poll)
        setLoading(false)
      }
    }, 1500)
  }

  async function handleLogout() {
    setLoading(true)
    await fetch('/api/wa/logout', { method: 'POST' })
    setStatus('offline')
    setQr(null)
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">WhatsApp</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
        <div className="mb-4">
          <span className="text-sm text-gray-500">Status: </span>
          <span className={`font-semibold ${status === 'connected' ? 'text-green-600' :
              status === 'waiting_qr' ? 'text-yellow-600' : 'text-gray-400'
            }`}>
            {status === 'connected' ? '● Connected' :
              status === 'waiting_qr' ? '● Waiting for QR Scan' : '● Offline'}
          </span>
        </div>

        {status === 'waiting_qr' && qr && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">Scan this QR code with your WhatsApp app:</p>
            <div className="border border-gray-200 rounded-lg p-2 inline-block">
              <img src={qr} alt="QR Code" width={200} height={200} />
            </div>
          </div>
        )}

        {status === 'waiting_qr' && !qr && (
          <div className="mb-4">
            <p className="text-sm text-gray-500">Generating QR code...</p>
            <p className="text-xs text-gray-400 mt-1">This may take up to 30 seconds on first launch.</p>
          </div>
        )}

        {status === 'offline' && (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Login WhatsApp'}
          </button>
        )}

        {status === 'connected' && (
          <button
            onClick={handleLogout}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging out...' : 'Logout WhatsApp'}
          </button>
        )}
      </div>
    </div>
  )
}

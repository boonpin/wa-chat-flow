'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Card, useToast } from '@/components/ui'

type WaStatus = 'offline' | 'waiting_qr' | 'connected' | 'loading'

const STEPS = [
  { id: 1, label: 'Connect', desc: 'Start the WhatsApp client' },
  { id: 2, label: 'Scan QR', desc: 'Scan with your phone' },
  { id: 3, label: 'Connected', desc: 'Ready to receive messages' },
]

function stepFromStatus(status: WaStatus): number {
  if (status === 'offline') return 1
  if (status === 'waiting_qr') return 2
  if (status === 'connected') return 3
  return 1
}

export default function WAPage() {
  const [status, setStatus] = useState<WaStatus>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function fetchStatus() {
    const r = await fetch('/api/wa/status')
    const d = await r.json()
    setStatus(d.status)
    return d.status
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
    const interval = setInterval(async () => {
      const s = await fetchStatus()
      if (s === 'waiting_qr') fetchQR()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (status === 'waiting_qr') fetchQR()
  }, [status])

  async function handleConnect() {
    setLoading(true)
    await fetch('/api/wa/connect', { method: 'POST' })
    let attempts = 0
    const poll = setInterval(async () => {
      const s = await fetchStatus()
      attempts++
      if (s !== 'offline' || attempts >= 20) {
        clearInterval(poll)
        setLoading(false)
      }
    }, 1500)
  }

  async function handleLogout() {
    if (!confirm('Disconnect WhatsApp? This will stop all auto-replies.')) return
    setLoading(true)
    await fetch('/api/wa/logout', { method: 'POST' })
    setStatus('offline')
    setQr(null)
    setLoading(false)
    toast('WhatsApp disconnected')
  }

  const step = status === 'loading' ? 1 : stepFromStatus(status)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">WhatsApp</h1>
        <p className="text-sm text-[#475569] mt-0.5">Connect your WhatsApp account to start receiving messages</p>
      </div>

      {/* Stepper */}
      <Card className="p-6 mb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    done ? 'bg-[#16A34A] text-white' :
                    active ? 'bg-[#0F172A] text-white' :
                    'bg-[#F1F5F9] text-[#94A3B8]'
                  }`}>
                    {done ? (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : s.id}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-xs font-medium ${active ? 'text-[#0F172A]' : done ? 'text-[#16A34A]' : 'text-[#94A3B8]'}`}>{s.label}</p>
                    <p className="text-[10px] text-[#94A3B8]">{s.desc}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 mb-7 ${done ? 'bg-[#16A34A]' : 'bg-[#E6EAF0]'}`} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Main action card */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-3 p-6">
          {/* Status */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-medium text-[#0F172A]">Connection Status</p>
            {status === 'connected' && <Badge variant="green" dot>Connected</Badge>}
            {status === 'waiting_qr' && <Badge variant="yellow" dot>Waiting for scan</Badge>}
            {(status === 'offline' || status === 'loading') && <Badge variant="gray" dot>Offline</Badge>}
          </div>

          {/* Step 1: Offline */}
          {(status === 'offline' || status === 'loading') && (
            <div>
              <p className="text-sm text-[#475569] mb-5">
                Click the button below to initialize the WhatsApp client and generate a QR code.
              </p>
              <Button onClick={handleConnect} loading={loading} disabled={status === 'loading'}>
                {loading ? 'Starting...' : 'Connect WhatsApp'}
              </Button>
            </div>
          )}

          {/* Step 2: Waiting QR */}
          {status === 'waiting_qr' && (
            <div>
              {qr ? (
                <div>
                  <p className="text-sm text-[#475569] mb-4">
                    Open WhatsApp on your phone → tap <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan this QR code.
                  </p>
                  <div className="inline-block border-2 border-[#E6EAF0] rounded-xl p-3 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="WhatsApp QR Code" width={200} height={200} className="block" />
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-3">QR code refreshes automatically every 60 seconds</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-10 h-10 border-2 border-[#16A34A] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#475569]">Generating QR code...</p>
                  <p className="text-xs text-[#94A3B8]">This may take up to 30 seconds on first launch</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Connected */}
          {status === 'connected' && (
            <div>
              <div className="flex items-center gap-3 mb-5 p-3 bg-[#F0FDF4] rounded-xl">
                <div className="w-9 h-9 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#166534]">WhatsApp is connected</p>
                  <p className="text-xs text-[#4ADE80] opacity-80">Auto replies are active</p>
                </div>
              </div>
              <Button variant="danger" onClick={handleLogout} loading={loading} size="sm">
                Disconnect
              </Button>
            </div>
          )}
        </Card>

        {/* Troubleshooting */}
        <Card className="col-span-2 p-5">
          <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-4">Troubleshooting</p>
          <ul className="space-y-3">
            {[
              'Make sure WhatsApp is installed on your phone',
              'Use a stable internet connection',
              'QR code expires after 60s — refresh if needed',
              'Only one device can be linked at a time',
              'If stuck, try disconnecting and reconnecting',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-[#475569]">{i + 1}</span>
                </div>
                <p className="text-xs text-[#475569] leading-relaxed">{tip}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

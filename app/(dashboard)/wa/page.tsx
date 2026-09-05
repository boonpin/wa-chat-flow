'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge, Button, Card, useToast } from '@/components/ui'

type WAStatus = 'offline' | 'starting' | 'waiting_qr' | 'connected' | 'failed'

type WASession = {
  id: string
  sessionName: string
  status: WAStatus
  lastConnectedAt: string | null
}

function StatusBadge({ status }: { status: WAStatus }) {
  if (status === 'connected') return <Badge variant="green" dot>Connected</Badge>
  if (status === 'waiting_qr') return <Badge variant="yellow" dot>Waiting for scan</Badge>
  if (status === 'starting') return <Badge variant="yellow" dot>Starting</Badge>
  if (status === 'failed') return <Badge variant="red" dot>Failed</Badge>
  return <Badge variant="gray" dot>Offline</Badge>
}

function SessionCard({
  session,
  onRefresh,
}: {
  session: WASession
  onRefresh: () => void
}) {
  const [status, setStatus] = useState<WAStatus>(session.status)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(session.sessionName)
  const [savingName, setSavingName] = useState(false)
  const { toast } = useToast()

  const fetchStatus = useCallback(async () => {
    const r = await fetch(`/api/wa/status?sessionId=${session.id}`)
    const d = await r.json()
    setStatus(d.status)
    return d.status as WAStatus
  }, [session.id])

  const fetchQR = useCallback(async () => {
    const r = await fetch(`/api/wa/qr?sessionId=${session.id}`)
    if (r.ok) {
      const d = await r.json()
      setQr(d.qr)
    }
  }, [session.id])

  useEffect(() => {
    fetchStatus()
    // WAHA rotates the pairing code, so refetch it on every poll while scanning.
    const interval = setInterval(async () => {
      const s = await fetchStatus()
      if (s === 'waiting_qr') fetchQR()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchQR])

  useEffect(() => {
    if (status === 'waiting_qr') fetchQR()
  }, [status, fetchQR])

  async function handleConnect() {
    setLoading(true)
    const r = await fetch('/api/wa/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    })

    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      toast(data.error || 'Could not reach the WhatsApp gateway', 'error')
      setLoading(false)
      return
    }

    let attempts = 0
    const poll = setInterval(async () => {
      const s = await fetchStatus()
      attempts++
      if (['waiting_qr', 'connected', 'failed'].includes(s) || attempts >= 20) {
        clearInterval(poll)
        setLoading(false)
      }
    }, 1500)
  }

  async function handleLogout() {
    if (!confirm(`Disconnect "${session.sessionName}"? This will stop auto-replies for this number.`)) return
    setLoading(true)
    await fetch('/api/wa/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    })
    setStatus('offline')
    setQr(null)
    setLoading(false)
    toast(`"${session.sessionName}" disconnected`)
  }

  async function handleSaveName() {
    const name = nameInput.trim()
    if (!name || name === session.sessionName) { setEditingName(false); return }
    setSavingName(true)
    await fetch(`/api/wa/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSavingName(false)
    setEditingName(false)
    toast('Name updated')
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${session.sessionName}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/wa/sessions/${session.id}`, { method: 'DELETE' })
    toast(`"${session.sessionName}" removed`)
    onRefresh()
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-[#E6EAF0] rounded-lg px-2 py-1 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(session.sessionName) } }}
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="text-[11px] font-medium text-[#16A34A] hover:underline disabled:opacity-50"
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingName(false); setNameInput(session.sessionName) }}
                className="text-[11px] text-[#94A3B8] hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="text-sm font-semibold text-[#0F172A] truncate">{nameInput}</p>
              <button
                onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94A3B8] hover:text-[#475569]"
                title="Edit name"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
          {session.lastConnectedAt && (
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Last connected: {new Date(session.lastConnectedAt).toLocaleString()}
            </p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* QR Code area */}
      {status === 'waiting_qr' && (
        <div className="mt-4">
          {qr ? (
            <div>
              <p className="text-xs text-[#475569] mb-3">
                Open WhatsApp → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan this code.
              </p>
              <div className="inline-block border-2 border-[#E6EAF0] rounded-xl p-3 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code" width={160} height={160} className="block" />
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2">Refreshes automatically every 60s</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-4 h-4 border-2 border-[#16A34A] border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-xs text-[#475569]">Generating QR code…</p>
            </div>
          )}
        </div>
      )}

      {/* Connected confirmation */}
      {status === 'connected' && (
        <div className="flex items-center gap-2 mt-4 p-2.5 bg-[#F0FDF4] rounded-lg">
          <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-xs font-medium text-[#166534]">Auto replies active</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {(status === 'offline' || status === 'failed') && (
          <Button size="sm" onClick={handleConnect} loading={loading}>
            {loading ? 'Starting…' : status === 'failed' ? 'Reconnect' : 'Connect'}
          </Button>
        )}
        {(status === 'waiting_qr' || status === 'starting') && (
          <Button size="sm" variant="secondary" onClick={handleLogout} loading={loading}>
            Cancel
          </Button>
        )}
        {status === 'connected' && (
          <Button size="sm" variant="danger" onClick={handleLogout} loading={loading}>
            Disconnect
          </Button>
        )}
        {(status === 'offline' || status === 'failed') && (
          <Button size="sm" variant="secondary" onClick={handleDelete} loading={deleting}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function WAPage() {
  const [sessions, setSessions] = useState<WASession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const fetchSessions = useCallback(async () => {
    const r = await fetch('/api/wa/sessions')
    if (r.ok) {
      const data = await r.json()
      setSessions(data)
    }
    setLoadingSessions(false)
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/wa/sessions')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!active) return
        setSessions(Array.isArray(data) ? data : [])
        setLoadingSessions(false)
      })
    return () => { active = false }
  }, [])

  async function handleAddSession() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const r = await fetch('/api/wa/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (r.ok) {
      toast(`"${name}" added`)
      setNewName('')
      setAdding(false)
      await fetchSessions()
    } else {
      toast('Failed to add session')
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">WhatsApp Numbers</h1>
          <p className="text-sm text-[#475569] mt-0.5">Connect and manage multiple WhatsApp accounts</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add Number
          </Button>
        )}
      </div>

      {/* Add session form */}
      {adding && (
        <Card className="p-5 mb-5">
          <p className="text-sm font-medium text-[#0F172A] mb-3">New WhatsApp Number</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-[#E6EAF0] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
              placeholder="e.g. Sales, Support, Personal"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSession()}
              autoFocus
            />
            <Button size="sm" onClick={handleAddSession} loading={saving} disabled={!newName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setNewName('') }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Session list */}
      {loadingSessions ? (
        <div className="flex items-center gap-2 text-sm text-[#475569] py-10 justify-center">
          <div className="w-4 h-4 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-[#475569]">No WhatsApp numbers added yet.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Click <strong>+ Add Number</strong> to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onRefresh={fetchSessions} />
          ))}
        </div>
      )}

      {/* Tips */}
      {sessions.length > 0 && (
        <Card className="p-5 mt-6">
          <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-3">Tips</p>
          <ul className="space-y-2">
            {[
              'Each WhatsApp number needs its own QR code scan',
              'You can connect multiple numbers simultaneously',
              'Sessions run in the WAHA gateway and survive app restarts',
              'Removing a number logs it out and deletes its session data',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-[#475569]">{i + 1}</span>
                </div>
                <p className="text-xs text-[#475569]">{tip}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

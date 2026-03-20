'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, Button, Badge, SectionHeader, useToast } from '@/components/ui'

type CampaignStatus = 'draft' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed'
type RecipientStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

interface Campaign {
  id: string
  name: string
  messageTemplate: string
  status: CampaignStatus
  waSessionName: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  delaySeconds: number
  createdAt: string
  updatedAt: string
}

interface Recipient {
  id: string
  phone: string
  name: string | null
  status: RecipientStatus
  error: string | null
  sentAt: string | null
}

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, { variant: 'gray' | 'blue' | 'yellow' | 'green' | 'red'; label: string }> = {
    draft: { variant: 'gray', label: 'Draft' },
    sending: { variant: 'blue', label: 'Sending' },
    paused: { variant: 'yellow', label: 'Paused' },
    completed: { variant: 'green', label: 'Completed' },
    cancelled: { variant: 'gray', label: 'Cancelled' },
    failed: { variant: 'red', label: 'Failed' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant} dot>{label}</Badge>
}

function recipientBadge(status: RecipientStatus) {
  const map: Record<RecipientStatus, { variant: 'gray' | 'blue' | 'green' | 'red' | 'yellow'; label: string }> = {
    pending: { variant: 'gray', label: 'Pending' },
    sending: { variant: 'blue', label: 'Sending' },
    sent: { variant: 'green', label: 'Sent' },
    failed: { variant: 'red', label: 'Failed' },
    skipped: { variant: 'yellow', label: 'Skipped' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/blast/campaign/${id}?page=${page}`)
    if (!res.ok) { router.push('/blast'); return }
    const data = await res.json()
    setCampaign(data.campaign)
    setRecipients(data.recipients)
    setLoading(false)
  }, [id, page, router])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!campaign) return
    if (!['sending', 'paused'].includes(campaign.status)) return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [campaign, load])

  async function handleAction(action: 'start' | 'pause' | 'resume' | 'cancel') {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/blast/campaign/${id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Action failed', 'error'); return }
      toast(`Campaign ${action}ed`, 'success')
      load()
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-sm text-[#94A3B8]">Loading…</div>
      </div>
    )
  }

  if (!campaign) return null

  const processed = campaign.sentCount + campaign.failedCount
  const pct = campaign.totalRecipients > 0 ? Math.round((processed / campaign.totalRecipients) * 100) : 0
  const pending = campaign.totalRecipients - processed

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/blast" className="text-sm text-[#475569] hover:text-[#0F172A] flex items-center gap-1 mb-3">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Campaigns
        </Link>
        <SectionHeader
          title={campaign.name}
          description={`${campaign.waSessionName ?? 'Unknown session'} · ${campaign.delaySeconds}s delay`}
          action={
            <div className="flex items-center gap-2">
              {statusBadge(campaign.status)}
              {campaign.status === 'draft' && (
                <Button loading={actionLoading} onClick={() => handleAction('start')}>Start</Button>
              )}
              {campaign.status === 'sending' && (
                <Button variant="secondary" loading={actionLoading} onClick={() => handleAction('pause')}>Pause</Button>
              )}
              {campaign.status === 'paused' && (
                <Button loading={actionLoading} onClick={() => handleAction('resume')}>Resume</Button>
              )}
              {['sending', 'paused', 'draft'].includes(campaign.status) && (
                <Button variant="danger" loading={actionLoading} onClick={() => handleAction('cancel')}>Cancel</Button>
              )}
            </div>
          }
        />
      </div>

      {/* Error / warning banners */}
      {campaign.status === 'failed' && (
        <div className="mb-6 flex items-start gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-5 py-4">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-[#991B1B]">Campaign failed</p>
            <p className="text-sm text-[#DC2626] mt-0.5">An unexpected error stopped the campaign. Check the server console for details. You can retry by resuming from the paused state or creating a new campaign for the remaining recipients.</p>
          </div>
        </div>
      )}
      {campaign.status === 'paused' && campaign.failedCount > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-5 py-4">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-[#92400E]">Campaign auto-paused due to send errors</p>
            <p className="text-sm text-[#B45309] mt-0.5">
              {campaign.failedCount} message{campaign.failedCount !== 1 ? 's' : ''} failed. This usually means the WhatsApp session is disconnected or the browser has crashed.
              Please check the <strong>WhatsApp</strong> page and reconnect the session, then resume this campaign.
            </p>
          </div>
        </div>
      )}
      {campaign.status === 'sending' && campaign.failedCount > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-4">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3B82F6" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-sm text-[#1D4ED8]">
            <span className="font-semibold">{campaign.failedCount} failed</span> so far. Check the recipients table below for error details. The campaign will auto-pause if failures keep occurring.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: campaign.totalRecipients, color: 'text-[#0F172A]' },
          { label: 'Sent', value: campaign.sentCount, color: 'text-[#16A34A]' },
          { label: 'Failed', value: campaign.failedCount, color: 'text-[#DC2626]' },
          { label: 'Pending', value: pending, color: 'text-[#94A3B8]' },
        ].map(stat => (
          <Card key={stat.label} className="p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-[#475569] mt-0.5">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#0F172A]">Progress</span>
          <span className="text-sm text-[#475569]">{pct}%</span>
        </div>
        <div className="w-full bg-[#E6EAF0] rounded-full h-2.5">
          <div
            className="bg-[#16A34A] h-2.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-[#94A3B8] mt-2">{processed} of {campaign.totalRecipients} processed</p>
      </Card>

      {/* Message template */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Message Template</h3>
        <pre className="text-sm text-[#475569] whitespace-pre-wrap font-sans">{campaign.messageTemplate}</pre>
      </Card>

      {/* Recipients table */}
      <Card>
        <div className="px-5 py-3 border-b border-[#E6EAF0] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Recipients</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-xs text-[#475569]">Page {page}</span>
            <Button variant="ghost" size="sm" disabled={recipients.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E6EAF0] text-left">
              <th className="px-5 py-3 font-medium text-[#475569]">Phone</th>
              <th className="px-5 py-3 font-medium text-[#475569]">Name</th>
              <th className="px-5 py-3 font-medium text-[#475569]">Status</th>
              <th className="px-5 py-3 font-medium text-[#475569]">Sent At</th>
              <th className="px-5 py-3 font-medium text-[#475569]">Error</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map(r => (
              <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                <td className="px-5 py-3 font-mono text-[#0F172A]">{r.phone}</td>
                <td className="px-5 py-3 text-[#475569]">{r.name ?? '—'}</td>
                <td className="px-5 py-3">{recipientBadge(r.status)}</td>
                <td className="px-5 py-3 text-[#475569]">
                  {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                </td>
                <td className="px-5 py-3 text-xs max-w-[240px]" title={r.error ?? ''}>
                  {r.error ? (
                    <span className="text-[#DC2626] truncate block" title={r.error}>{r.error}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

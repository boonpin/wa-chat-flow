'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Button, Badge, SectionHeader, EmptyState, useToast } from '@/components/ui'

type CampaignStatus = 'draft' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed'

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  waSessionName: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
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

export default function BlastPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchCampaigns = async () => {
    const res = await fetch('/api/blast/campaign')
    if (res.ok) setCampaigns(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const res = await fetch('/api/blast/campaign')
      if (res.ok && !cancelled) setCampaigns(await res.json())
      if (!cancelled) setLoading(false)
    }
    load()
    const interval = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  async function handleAction(id: string, action: 'start' | 'pause' | 'resume' | 'cancel') {
    const res = await fetch(`/api/blast/campaign/${id}/${action}`, { method: 'POST' })
    if (res.ok) {
      toast(`Campaign ${action}ed`, 'success')
      fetchCampaigns()
    } else {
      const data = await res.json().catch(() => ({}))
      toast(data.error ?? 'Action failed', 'error')
    }
  }

  return (
    <div className="p-8">
      <SectionHeader
        title="Campaign Blast"
        description="Send bulk messages to your contacts"
        action={
          <Link href="/blast/create">
            <Button>New Campaign</Button>
          </Link>
        }
      />

      <Card>
        {loading ? (
          <div className="p-8 text-sm text-[#94A3B8] text-center">Loading…</div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="📢"
            title="No campaigns yet"
            description="Create your first blast campaign to send messages to multiple contacts."
            action={
              <Link href="/blast/create">
                <Button>New Campaign</Button>
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EAF0] text-left">
                <th className="px-5 py-3 font-medium text-[#475569]">Name</th>
                <th className="px-5 py-3 font-medium text-[#475569]">Status</th>
                <th className="px-5 py-3 font-medium text-[#475569]">Session</th>
                <th className="px-5 py-3 font-medium text-[#475569]">Progress</th>
                <th className="px-5 py-3 font-medium text-[#475569]">Created</th>
                <th className="px-5 py-3 font-medium text-[#475569]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pct = c.totalRecipients > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalRecipients) * 100) : 0
                return (
                  <tr key={c.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                      <Link href={`/blast/${c.id}`} className="hover:text-[#16A34A]">{c.name}</Link>
                    </td>
                    <td className="px-5 py-3.5">{statusBadge(c.status)}</td>
                    <td className="px-5 py-3.5 text-[#475569]">{c.waSessionName ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-[#E6EAF0] rounded-full h-1.5">
                          <div className="bg-[#16A34A] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#475569] whitespace-nowrap">
                          {c.sentCount + c.failedCount}/{c.totalRecipients}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#475569]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/blast/${c.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        {c.status === 'draft' && (
                          <Button variant="primary" size="sm" onClick={() => handleAction(c.id, 'start')}>Start</Button>
                        )}
                        {c.status === 'sending' && (
                          <Button variant="secondary" size="sm" onClick={() => handleAction(c.id, 'pause')}>Pause</Button>
                        )}
                        {c.status === 'paused' && (
                          <Button variant="primary" size="sm" onClick={() => handleAction(c.id, 'resume')}>Resume</Button>
                        )}
                        {['sending', 'paused', 'draft'].includes(c.status) && (
                          <Button variant="danger" size="sm" onClick={() => handleAction(c.id, 'cancel')}>Cancel</Button>
                        )}
                      </div>
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

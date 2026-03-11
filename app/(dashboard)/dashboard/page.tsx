'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge, Card, Skeleton } from '@/components/ui'

interface DashboardData {
  waStatus: string
  contactCount: number
  botCount: number
  autoReplyEnabled: boolean
  defaultBotId: string | null
}

function KpiCard({ label, value, sub, loading }: { label: string; value: React.ReactNode; sub?: string; loading?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-2">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <div className="text-3xl font-bold text-[#0F172A] leading-none mb-1">{value}</div>
      )}
      {sub && <p className="text-xs text-[#94A3B8]">{sub}</p>}
    </Card>
  )
}

function WaStatusBadge({ status }: { status: string }) {
  if (status === 'connected') return <Badge variant="green" dot>Connected</Badge>
  if (status === 'waiting_qr') return <Badge variant="yellow" dot>Waiting QR</Badge>
  return <Badge variant="gray" dot>Offline</Badge>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    async function load() {
      const [ws, cs, bs, ss] = await Promise.all([
        fetch('/api/wa/status').then(r => r.json()),
        fetch('/api/contacts').then(r => r.json()),
        fetch('/api/bots').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
      setData({
        waStatus: ws.status,
        contactCount: Array.isArray(cs) ? cs.length : 0,
        botCount: Array.isArray(bs) ? bs.length : 0,
        autoReplyEnabled: ss.autoReplyEnabled,
        defaultBotId: ss.defaultBotId,
      })
    }
    load()
  }, [])

  const loading = !data

  // Alerts
  const alerts: { message: string; href: string }[] = []
  if (data && data.waStatus !== 'connected') alerts.push({ message: 'WhatsApp is not connected', href: '/wa' })
  if (data && !data.autoReplyEnabled) alerts.push({ message: 'Auto Reply is disabled', href: '/settings' })
  if (data && data.botCount === 0) alerts.push({ message: 'No AI bots configured', href: '/bots' })
  if (data && data.botCount > 0 && !data.defaultBotId) alerts.push({ message: 'No default bot selected', href: '/settings' })

  return (
    <div className="p-8 max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Overview</h1>
        <p className="text-sm text-[#475569] mt-0.5">System health and key metrics at a glance</p>
      </div>

      {/* Status strip */}
      <Card className="px-5 py-3.5 mb-6 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#475569]">WhatsApp</span>
          {loading ? <Skeleton className="h-5 w-20" /> : <WaStatusBadge status={data.waStatus} />}
        </div>
        <div className="w-px h-4 bg-[#E6EAF0]" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#475569]">Auto Reply</span>
          {loading ? <Skeleton className="h-5 w-16" /> : (
            <Badge variant={data.autoReplyEnabled ? 'green' : 'gray'} dot>
              {data.autoReplyEnabled ? 'ON' : 'OFF'}
            </Badge>
          )}
        </div>
        <div className="w-px h-4 bg-[#E6EAF0]" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#475569]">Default Bot</span>
          {loading ? <Skeleton className="h-5 w-16" /> : (
            <Badge variant={data.defaultBotId ? 'green' : 'yellow'} dot>
              {data.defaultBotId ? 'Set' : 'Not set'}
            </Badge>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Total Contacts"
          value={data?.contactCount ?? '—'}
          sub="WhatsApp contacts"
          loading={loading}
        />
        <KpiCard
          label="AI Bots"
          value={data?.botCount ?? '—'}
          sub="Configured bots"
          loading={loading}
        />
        <Card className="p-5">
          <p className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-2">WhatsApp</p>
          {loading ? <Skeleton className="h-8 w-24" /> : (
            <div className="mt-1"><WaStatusBadge status={data.waStatus} /></div>
          )}
          {!loading && data.waStatus !== 'connected' && (
            <Link href="/wa" className="text-xs text-[#16A34A] hover:underline mt-2 inline-block">
              Connect now →
            </Link>
          )}
        </Card>
      </div>

      {/* Needs attention */}
      {!loading && alerts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E6EAF0]">
            <p className="text-sm font-medium text-[#0F172A]">Needs attention</p>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {alerts.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                  <span className="text-sm text-[#475569]">{a.message}</span>
                </div>
                <span className="text-xs text-[#16A34A] opacity-0 group-hover:opacity-100 transition-opacity">Fix →</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {!loading && alerts.length === 0 && (
        <Card className="px-5 py-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Everything looks good</p>
            <p className="text-xs text-[#475569]">System is running normally</p>
          </div>
        </Card>
      )}
    </div>
  )
}

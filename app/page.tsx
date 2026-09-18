'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStartPage } from '@/lib/settings/start-page'
export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getStartPage())
  }, [router])
  return <p className="p-6 text-sm text-ink-muted">Opening your workspace…</p>
}

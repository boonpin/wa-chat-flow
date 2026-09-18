'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageBody, Skeleton } from '@/components/ui'

export default function SettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(window.location.hash === '#auto-reply' ? '/automation/replies' : '/bots')
  }, [router])
  return (
    <PageBody width="content">
      <Skeleton className="h-40 w-full" />
    </PageBody>
  )
}

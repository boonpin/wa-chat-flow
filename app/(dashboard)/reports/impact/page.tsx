import { Suspense } from 'react'
import { PageBody, Skeleton } from '@/components/ui'
import { ImpactReportPage } from './report-page'

export default function ImpactPage() {
  return (
    <Suspense
      fallback={
        <PageBody width="content">
          <Skeleton className="h-24 w-full" />
          <div className="mt-6 space-y-6">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </PageBody>
      }
    >
      <ImpactReportPage />
    </Suspense>
  )
}


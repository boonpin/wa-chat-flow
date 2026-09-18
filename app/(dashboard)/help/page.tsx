import type { Metadata } from 'next'
import { PageBody, PageHeader } from '@/components/ui'
import { HelpTasks } from '@/components/help-tasks'

export const metadata: Metadata = { title: 'Using the app — Help' }
export default function HelpPage() {
  return (
    <PageBody width="content">
      <PageHeader
        title="Using the app"
        description="Handle enquiries, take over from AI and understand your time and costs."
      />
      <div className="space-y-6">
        <HelpTasks section="using" />
      </div>
    </PageBody>
  )
}

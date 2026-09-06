'use client'

import { PageBody, PageHeader } from '@/components/ui'
import { ProviderForm } from '../provider-form'

export default function NewAiProviderPage() {
  return (
    <PageBody width="form">
      <PageHeader
        title="Add AI provider"
        description="Point the app at an AI account, then pick the model it should run."
        back={{ href: '/ai-providers', label: 'AI providers' }}
      />
      <ProviderForm provider={null} />
    </PageBody>
  )
}

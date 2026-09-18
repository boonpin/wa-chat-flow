import type { Metadata } from 'next'
import { PageBody, PageHeader, Panel, PanelHeader } from '@/components/ui'
import { HelpTasks } from '@/components/help-tasks'
import { SettingsLinks } from '@/components/settings-links'

export const metadata: Metadata = { title: 'Setup & troubleshooting — Help' }
export default function SetupHelpPage() {
  return (
    <PageBody width="content">
      <PageHeader
        title="Setup & troubleshooting"
        description="Get automatic replies running, connect your sheets and resolve connection problems."
      />
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Setup guides" />
          <SettingsLinks
            items={[
              {
                href: '/help/access',
                label: 'Access and setup support',
                detail: 'Sign-in, administrator access, backups and system limits.',
              },
              {
                href: '/help/google-sheets',
                label: 'Connect a Google Sheet',
                detail: 'Deploy the sheet connection and link it to a collection setup.',
              },
            ]}
          />
        </Panel>
        <HelpTasks section="setup" />
      </div>
    </PageBody>
  )
}

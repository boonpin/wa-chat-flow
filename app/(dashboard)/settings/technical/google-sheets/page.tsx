import { PageBody, PageHeader, Panel, LinkButton } from '@/components/ui'
import { ToolSettingsList } from '@/components/tool-settings-list'

export default function GoogleSheetsSettingsPage() {
  return (
    <PageBody width="content">
      <PageHeader
        title="Google Sheets"
        description="Connect a sheet for each type of customer details your agents collect."
        actions={
          <LinkButton href="/settings/technical/google-sheets/new" variant="primary">
            Create collection setup
          </LinkButton>
        }
      />
      <div className="mb-5">
        <LinkButton href="/help/google-sheets" variant="secondary">
          Read the connection guide
        </LinkButton>
      </div>
      <Panel>
        <ToolSettingsList basePath="/settings/technical/google-sheets" />
      </Panel>
    </PageBody>
  )
}

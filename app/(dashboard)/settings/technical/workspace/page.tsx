'use client'

import { useSyncExternalStore } from 'react'
import { PageBody, PageHeader, Panel, PanelBody, Select } from '@/components/ui'
import { getStartPage, setStartPage, subscribeStartPage } from '@/lib/settings/start-page'

export default function WorkspacePreferencesPage() {
  const startPage = useSyncExternalStore(subscribeStartPage, getStartPage, () => '/inbox')
  return (
    <PageBody width="form">
      <PageHeader
        title="Workspace preferences"
        description="Choose where you start when opening the app. This preference is saved in this browser."
      />
      <Panel>
        <PanelBody>
          <Select
            label="Start page"
            value={startPage}
            onChange={(event) => setStartPage(event.target.value)}
          >
            <option value="/inbox">Inbox — customer enquiries</option>
            <option value="/dashboard">Dashboard — time and costs</option>
          </Select>
        </PanelBody>
      </Panel>
    </PageBody>
  )
}

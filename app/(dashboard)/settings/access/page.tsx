import type { Metadata } from 'next'
import {
  Banner,
  KeyValues,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from '@/components/ui'

export const metadata: Metadata = { title: 'Access and setup' }

/**
 * Reference, deliberately read-only. There is no account, password or gateway
 * configuration API, so this page explains where those things actually live
 * instead of offering inputs that would not save anything.
 */
export default function AccessPage() {
  return (
    <PageBody width="content">
      <PageHeader
        title="Access and setup"
        description="Who can sign in, and the parts of the system that are configured outside this dashboard."
        back={{ href: '/settings', label: 'Settings' }}
      />

      <div className="space-y-5">
        <Banner tone="info" title="These are administrator tasks">
          Accounts and gateway settings are configured on the server, not in this dashboard. There
          is no account API, so nothing on this page is editable here — showing a form that cannot
          save would be worse than showing none.
        </Banner>

        <Panel>
          <PanelHeader
            title="Sign-in accounts"
            description="One administrator account is created when the system is set up."
          />
          <PanelBody className="space-y-3 text-sm leading-5 text-ink-muted">
            <p>
              The account is created by running the seeding script with an email and password
              supplied through environment variables. Re-running it resets that account’s password.
            </p>
            <p>
              There is no self-service password reset and no invitation flow. Someone with server
              access has to run the script. If you are locked out, that is who to ask.
            </p>
            <p className="text-ink">
              There are no default credentials. Any documentation or screenshot suggesting otherwise
              is out of date.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="WhatsApp gateway"
            description="The service that holds the actual WhatsApp connections."
          />
          <PanelBody className="space-y-3 text-sm leading-5 text-ink-muted">
            <p>
              The gateway runs and is deployed separately from this app, with its own configuration
              and its own lifecycle. The two share one secret, an API key set on both sides.
            </p>
            <p>
              The gateway has two independent logins: browser access to its own dashboard, and an
              API key for its REST interface. Being able to open one does not grant the other.
            </p>
            <p>
              When the gateway cannot be reached, this dashboard shows the last status it reported
              and labels it as unavailable rather than guessing.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Limits worth knowing"
            description="Current behaviour, so nothing on screen is mistaken for a complete archive."
          />
          <PanelBody>
            <KeyValues
              rows={[
                ['Conversation list', 'Shows the 100 most recent conversations, newest activity first.'],
                ['Conversation transcript', 'Shows the most recent 200 messages in a conversation.'],
                ['AI memory', 'A bot sees the last 20 text messages of the conversation it is answering.'],
                ['Captures', 'The Captures list shows recent captures, not a lifetime total.'],
                ['Activity', 'Fully paginated. It is the complete record of messages and events.'],
                ['Stored credentials', 'API keys and sheet credentials are write-only and are never shown again.'],
              ]}
            />
          </PanelBody>
        </Panel>
      </div>
    </PageBody>
  )
}

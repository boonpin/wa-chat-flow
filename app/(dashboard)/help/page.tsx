import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, PageBody, PageHeader, Panel, PanelHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Help' }

/**
 * Task help, not a feature tour. Each entry names something an operator is
 * actually trying to do, and admin-only reference is kept separate under
 * Settings → Access and setup.
 */
const ARTICLES = [
  {
    href: '/help/google-sheets',
    title: 'Connect a Google Sheet to a tool',
    summary:
      'Copy the Apps Script into your sheet, deploy it as a web app and paste the /exec URL into a tool.',
  },
]

const TASKS: { title: string; steps: { text: string; href?: string }[] }[] = [
  {
    title: 'Start replying automatically',
    steps: [
      { text: 'Create an AI bot and write its instructions.', href: '/bots/new' },
      { text: 'Connect a WhatsApp number and scan the QR code.', href: '/channels/whatsapp' },
      { text: 'Enable AI replies for the workspace.', href: '/automation/replies' },
      { text: 'Message the number from another phone and read the reply in Inbox.', href: '/inbox' },
    ],
  },
  {
    title: 'Take over a conversation from the AI',
    steps: [
      { text: 'Open the conversation in Inbox.', href: '/inbox' },
      { text: 'Choose “Use human replies”. The AI stops answering this customer.' },
      { text: 'Reply in the composer. This also becomes the customer’s default for future threads.' },
    ],
  },
  {
    title: 'Recover a lead that did not reach the sheet',
    steps: [
      { text: 'Open Tools → Captures and find the capture.', href: '/tools?view=captures' },
      { text: 'Read whether it says “Not submitted” (setup problem) or “Sync failed” (rejected request).' },
      { text: 'Fix the sheet setup if needed, then retry the sync. The details were never lost.' },
    ],
  },
  {
    title: 'Repair a number that stopped receiving messages',
    steps: [
      { text: 'Open WhatsApp channels and find the number.', href: '/channels/whatsapp' },
      { text: 'Connect it again and scan the QR code from the business phone.' },
      { text: 'A status here is what the gateway last reported, not a live guarantee.' },
    ],
  },
]

export default function HelpPage() {
  return (
    <PageBody width="content">
      <PageHeader title="Help" description="Short answers to the things people actually do here." />

      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Guides" />
          <ul>
            {ARTICLES.map((article) => (
              <li key={article.href}>
                <Link
                  href={article.href}
                  className="flex items-start gap-4 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{article.title}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
                      {article.summary}
                    </span>
                  </span>
                  <span className="mt-0.5 shrink-0 text-ink-soft">
                    <ChevronRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {TASKS.map((task) => (
          <Panel key={task.title}>
            <PanelHeader title={task.title} />
            <ol className="space-y-3 p-4 md:p-5">
              {task.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-inset text-xs font-semibold text-ink-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-sm leading-5 text-ink">
                    {step.text}{' '}
                    {step.href && (
                      <Link href={step.href} className="font-medium text-action hover:underline">
                        Open
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </PageBody>
  )
}

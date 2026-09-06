'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Banner,
  BotIcon,
  ChevronRight,
  ContactsIcon,
  HelpIcon,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ReplySettingsIcon,
  SettingsIcon,
  ToolIcon,
  WhatsAppIcon,
} from '@/components/ui'

/**
 * A hub, not a second editor. Every setting has exactly one owner, and this
 * page's job is to say which one — duplicating a form here is how two screens
 * end up disagreeing about the same value.
 */
const OWNERS: {
  href: string
  title: string
  what: string
  icon: React.ReactNode
  highlight?: boolean
}[] = [
  {
    href: '/automation/replies',
    title: 'Reply settings',
    what: 'Whether the AI may answer at all, and which bot answers when nothing more specific applies.',
    icon: <ReplySettingsIcon size={18} />,
    highlight: true,
  },
  {
    href: '/bots',
    title: 'AI bots',
    what: 'Instructions, provider, model and API key for each bot, and which tools it may use.',
    icon: <BotIcon size={18} />,
  },
  {
    href: '/tools',
    title: 'Tools',
    what: 'What each tool captures, and the Google Sheet credentials it writes with.',
    icon: <ToolIcon size={18} />,
  },
  {
    href: '/channels/whatsapp',
    title: 'WhatsApp channels',
    what: 'Connecting, renaming, disconnecting and removing the numbers your business uses.',
    icon: <WhatsAppIcon size={18} />,
  },
  {
    href: '/contacts',
    title: 'Contacts',
    what: 'Per-customer reply mode and default bot.',
    icon: <ContactsIcon size={18} />,
  },
  {
    href: '/settings/access',
    title: 'Access and setup',
    what: 'Sign-in accounts, gateway configuration and the limits worth knowing about.',
    icon: <SettingsIcon size={18} />,
  },
]

export default function SettingsPage() {
  const router = useRouter()

  // /settings#auto-reply was the old bookmark for the automation form, which
  // now lives at its own route.
  useEffect(() => {
    if (window.location.hash === '#auto-reply') router.replace('/automation/replies')
  }, [router])

  return (
    <PageBody width="content">
      <PageHeader
        title="Settings"
        description="Where each piece of configuration lives, and what it affects."
      />

      <Banner tone="info" title="Reply settings moved" className="mb-5">
        Global AI permission and the default bot now live under{' '}
        <Link href="/automation/replies" className="font-semibold underline underline-offset-2">
          Automation → Reply settings
        </Link>
        , next to the bots and tools they control.
      </Banner>

      <Panel className="mb-5">
        <PanelHeader title="Configuration" description="Each setting has one owner. Follow the link to change it." />
        <ul>
          {OWNERS.map((owner) => (
            <li key={owner.href}>
              <Link
                href={owner.href}
                className="flex items-start gap-3 border-b border-line-soft px-4 py-4 transition-colors last:border-0 hover:bg-hover md:px-5"
              >
                <span className="mt-0.5 shrink-0 text-ink-soft">{owner.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{owner.title}</span>
                    {owner.highlight && <Badge variant="info">Moved here</Badge>}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-ink-muted">{owner.what}</span>
                </span>
                <span className="mt-0.5 shrink-0 text-ink-soft">
                  <ChevronRight size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Getting help" />
        <PanelBody>
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-md border border-line bg-inset/60 p-3 hover:bg-hover"
          >
            <span className="text-ink-soft">
              <HelpIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Task guides</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                Connecting a sheet, taking over a conversation, recovering a lead.
              </span>
            </span>
            <ChevronRight size={16} />
          </Link>
        </PanelBody>
      </Panel>
    </PageBody>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
  ActivityIcon,
  BotIcon,
  Button,
  CampaignIcon,
  ContactsIcon,
  Drawer,
  HelpIcon,
  InboxIcon,
  MenuIcon,
  OverviewIcon,
  ReplySettingsIcon,
  SettingsIcon,
  SignOutIcon,
  ToastProvider,
  ToolIcon,
  WhatsAppIcon,
  request,
  useToast,
} from '@/components/ui'
import {
  WorkspaceStatusProvider,
  countConnected,
  useWorkspaceStatus,
} from '@/components/workspace-status'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
  /** Legacy routes that should still light this item up while they redirect. */
  aliases?: string[]
}

/**
 * Three daily destinations lead. Automation children are visible rather than
 * hidden behind a parent page, because opening a bot should not cost an extra
 * click. WhatsApp channels stays in reach: repairing a connection is urgent
 * when it happens.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Work',
    items: [
      { href: '/dashboard', label: 'Overview', icon: <OverviewIcon /> },
      { href: '/inbox', label: 'Inbox', icon: <InboxIcon /> },
      { href: '/contacts', label: 'Contacts', icon: <ContactsIcon /> },
    ],
  },
  {
    label: 'Automation',
    items: [
      { href: '/bots', label: 'AI bots', icon: <BotIcon /> },
      { href: '/tools', label: 'Tools', icon: <ToolIcon /> },
      { href: '/automation/replies', label: 'Reply settings', icon: <ReplySettingsIcon /> },
      { href: '/campaigns', label: 'Campaigns', icon: <CampaignIcon />, aliases: ['/blast'] },
    ],
  },
  {
    label: 'WhatsApp',
    items: [
      { href: '/channels/whatsapp', label: 'WhatsApp channels', icon: <WhatsAppIcon />, aliases: ['/wa'] },
    ],
  },
  {
    label: 'Utility',
    items: [
      { href: '/activity', label: 'Activity', icon: <ActivityIcon />, aliases: ['/logs'] },
      { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
      { href: '/help', label: 'Help', icon: <HelpIcon /> },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

function isActive(item: NavItem, pathname: string): boolean {
  const paths = [item.href, ...(item.aliases ?? [])]
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function currentLabel(pathname: string): string {
  // Longest match wins, so /automation/replies does not resolve to /automation.
  const match = [...ALL_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActive(item, pathname))
  return match?.label ?? 'WA Robot'
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <p className="px-3 pb-1.5 text-xs font-medium text-ink-soft">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-11 items-center gap-2.5 rounded-md px-3 text-sm
                      transition-colors duration-[--duration-control] md:h-10 ${
                        active
                          ? 'bg-selected font-semibold text-ink'
                          : 'font-medium text-ink-muted hover:bg-hover hover:text-ink'
                      }`}
                  >
                    <span className={active ? 'text-action' : 'text-ink-soft'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * A summary that links to repair — never a master switch. One connected number
 * does not mean every number is fine, so the count is explicit.
 */
function ConnectionSummary() {
  const { status, loading, error } = useWorkspaceStatus()

  if (loading) {
    return <div className="anim-pulse mx-3 h-14 rounded-md bg-inset" aria-hidden="true" />
  }

  if (error || !status) {
    return (
      <Link
        href="/channels/whatsapp"
        className="mx-3 block rounded-md border border-line px-3 py-2.5 text-xs text-ink-muted hover:bg-hover"
      >
        <span className="font-medium text-warning">Status unavailable.</span> Open WhatsApp channels
      </Link>
    )
  }

  const total = status.channels.length
  const connected = countConnected(status.channels)
  const aiOn = status.settings.autoReplyEnabled
  const needsAttention = total === 0 || connected < total

  return (
    <Link
      href={needsAttention ? '/channels/whatsapp' : '/automation/replies'}
      className="mx-3 block rounded-md border border-line bg-panel px-3 py-2.5 transition-colors hover:bg-hover"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            connected > 0 ? 'bg-success' : 'bg-warning'
          }`}
          aria-hidden="true"
        />
        {total === 0
          ? 'No numbers connected'
          : `${connected} of ${total} numbers reported connected`}
      </span>
      <span className="mt-1 block text-xs text-ink-soft">
        AI replies {aiOn ? 'enabled' : 'paused'}
      </span>
    </Link>
  )
}

function SignOutButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await request('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch {
      setPending(false)
      toast('Could not sign out. Try again.', 'error')
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} pending={pending} pendingLabel="Signing out…" className="w-full justify-start">
      <SignOutIcon size={15} />
      Sign out
    </Button>
  )
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-action">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
      </span>
      <span className="text-sm font-semibold text-ink">WA Robot</span>
    </Link>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // The drawer records which route it was opened on, so navigating anywhere
  // closes it by definition — no effect, and no chance of it being left over
  // the page after a route change.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const navOpen = openedAt === pathname
  const setNavOpen = (next: boolean) => setOpenedAt(next ? pathname : null)

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-md bg-action px-4 py-2 text-sm font-semibold text-on-action
          focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
      >
        Skip to content
      </a>

      {/* Desktop navigation: same canvas as the page, separated by one quiet line. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--nav-width)] flex-col border-r border-line bg-canvas md:flex">
        <div className="px-5 py-4">
          <Brand />
        </div>
        <NavLinks pathname={pathname} />
        <div className="space-y-2 border-t border-line py-3">
          <ConnectionSummary />
          <div className="px-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Phone and small tablet: a header that keeps the full content width. */}
      <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-2 border-b border-line bg-canvas/95 px-3 backdrop-blur md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setNavOpen(true)} aria-expanded={navOpen}>
          <MenuIcon size={18} />
          <span className="sr-only">Open navigation</span>
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {currentLabel(pathname)}
        </span>
        <Brand />
      </header>

      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        side="left"
        width="nav"
        title="Navigation"
      >
        <div className="-m-4 flex h-full flex-col md:-m-5">
          <NavLinks pathname={pathname} onNavigate={() => setNavOpen(false)} />
          <div className="space-y-2 border-t border-line py-3">
            <ConnectionSummary />
            <div className="px-3">
              <SignOutButton />
            </div>
          </div>
        </div>
      </Drawer>

      <main id="main" className="min-w-0 md:pl-[var(--nav-width)]">
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WorkspaceStatusProvider>
        <Shell>{children}</Shell>
      </WorkspaceStatusProvider>
    </ToastProvider>
  )
}

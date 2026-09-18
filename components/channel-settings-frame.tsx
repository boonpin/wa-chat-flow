'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  CHANNEL_SECTIONS,
  getChannelSection,
  getSettingsSection,
} from '@/lib/settings/navigation'

/** Channel subsection navigation stays inside the content container. */
export function ChannelSettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (getSettingsSection(pathname)?.key !== 'channels') return children
  const current = getChannelSection(pathname)
  return (
    <div className="grid max-w-[1440px] gap-5 p-4 md:p-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
      <aside className="min-w-0 border-b border-line pb-4 lg:border-r lg:border-b-0 lg:pr-4 lg:pb-0">
        <p className="mb-3 text-xs font-semibold text-ink-muted">Channels</p>
        <nav aria-label="Channel sections">
          <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {CHANNEL_SECTIONS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={current?.key === item.key ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-md border-l-2 px-3 py-2 text-sm transition-colors md:min-h-10 ${current?.key === item.key ? 'border-action bg-selected font-semibold text-action' : 'border-transparent text-ink-muted hover:bg-hover hover:text-ink'}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/help/setup" className="mt-4 inline-block text-sm text-action underline">
          Setup & troubleshooting help
        </Link>
      </aside>
      <div className="min-w-0 [&>div]:p-0">{children}</div>
    </div>
  )
}

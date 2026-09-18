'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RouteTabs } from '@/components/ui'

export function HelpNavigation() {
  const pathname = usePathname()
  if (pathname !== '/help' && !pathname.startsWith('/help/')) return null
  const setup =
    pathname === '/help/setup' ||
    pathname.startsWith('/help/access') ||
    pathname.startsWith('/help/google-sheets')
  return (
    <div className="max-w-[1200px] px-4 pt-4 md:px-6 md:pt-6">
      <nav aria-label="Help breadcrumb" className="mb-3 text-sm text-ink-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/help" className="font-semibold text-action hover:underline">
              Help
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>{setup ? 'Setup & troubleshooting' : 'Using the app'}</li>
        </ol>
      </nav>
      <RouteTabs
        label="Help sections"
        wrap
        current={setup ? 'setup' : 'using'}
        items={[
          { key: 'using', href: '/help', label: 'Using the app' },
          { key: 'setup', href: '/help/setup', label: 'Setup & troubleshooting' },
        ]}
      />
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RouteTabs } from '@/components/ui'
import { getChannelSection, getSettingsSection, SETTINGS_SECTIONS } from '@/lib/settings/navigation'

/** Content-level navigation, shared by Settings and its existing module routes. */
export function SettingsNavigation() {
  const pathname = usePathname()
  const section = getSettingsSection(pathname)
  if (!section) return null
  const subsection = section.key === 'channels' ? getChannelSection(pathname) : null
  return (
    <div className="max-w-[1200px] px-4 pt-4 md:px-6 md:pt-6">
      <nav aria-label="Settings breadcrumb" className="mb-3 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/settings" className="font-semibold text-action hover:underline">
              Settings
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          {subsection ? (
            <>
              <li>
                <Link href={section.href} className="text-action hover:underline">
                  {section.label}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>{subsection.label}</li>
            </>
          ) : (
            <li>{section.label}</li>
          )}
        </ol>
      </nav>
      <RouteTabs
        label="Settings sections"
        wrap
        current={section.key}
        items={SETTINGS_SECTIONS.map(({ key, href, label }) => ({ key, href, label }))}
      />
    </div>
  )
}

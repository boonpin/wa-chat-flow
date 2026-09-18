import Link from 'next/link'
import { ChevronRight } from '@/components/ui'

export function SettingsLinks({
  items,
}: {
  items: ReadonlyArray<{ href: string; label: string; detail: string }>
}) {
  return (
    <ul>
      {items.map(({ href, label, detail }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex items-start gap-3 border-b border-line-soft px-4 py-4 last:border-0 hover:bg-hover md:px-5"
          >
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-sm text-ink-muted">{detail}</span>
            </div>
            <ChevronRight size={16} className="mt-1 text-ink-soft" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

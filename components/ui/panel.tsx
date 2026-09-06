import type { ReactNode } from 'react'

/**
 * A panel is a meaningful content group, not a wrapper for every label. It sits
 * quietly in the page: a fine border and the paper-white surface, no lift. Only
 * things that genuinely float above the page get a shadow.
 */
export function Panel({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={`rounded-lg border border-line bg-panel ${className}`}>{children}</Tag>
  )
}

export function PanelHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3 md:px-5 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm leading-5 text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function PanelBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 md:p-5 ${className}`}>{children}</div>
}

/**
 * Label/value pairs. Values wrap rather than widening the page, and identifiers
 * are the only thing that gets a monospace face.
 */
export function KeyValues({
  rows,
  mono = false,
  className = '',
}: {
  rows: [string, ReactNode][]
  mono?: boolean
  className?: string
}) {
  return (
    <dl className={`space-y-2 ${className}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-sm text-ink-soft sm:w-44">{label}</dt>
          <dd
            className={`min-w-0 text-sm break-words text-ink ${
              mono ? 'font-mono text-xs leading-5' : ''
            }`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Technical detail that is available but never in the way. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-line-soft bg-inset/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-ink-muted hover:text-ink">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform duration-[--duration-control] ease-out group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {summary}
      </summary>
      <div className="border-t border-line-soft px-3 py-3">{children}</div>
    </details>
  )
}

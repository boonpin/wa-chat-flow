import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from './icons'

/**
 * Every page has exactly one h1, an optional one-sentence description and at
 * most one primary action. Title and actions wrap rather than colliding on a
 * narrow viewport.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
  /** Status that belongs to the page as a whole, e.g. the reply status line. */
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={`mb-6 ${className}`}>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          {back.label}
        </Link>
      )}
      {/* Below sm the title owns the full width and actions drop beneath it —
          sharing the row squeezes the description into a column of single words. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
        <div className="min-w-0 sm:flex-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-ink md:text-title">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-[65ch] text-sm leading-5 text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  )
}

/** Standard page inset: 16px on a phone, 24px from tablet up. */
export function PageBody({
  children,
  width = 'wide',
  className = '',
}: {
  children: ReactNode
  /** form: a single column of decisions. content: reading width. wide: tables. */
  width?: 'form' | 'content' | 'wide' | 'full'
  className?: string
}) {
  const max = {
    form: 'max-w-[760px]',
    content: 'max-w-[1200px]',
    wide: 'max-w-[1440px]',
    full: '',
  }[width]
  return <div className={`p-4 md:p-6 ${max} ${className}`}>{children}</div>
}

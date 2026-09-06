'use client'

import type { ReactNode } from 'react'
import { Button } from './button'
import { ChevronLeft, ChevronRight, SearchIcon } from './icons'

/**
 * Horizontal overflow is contained here and never allowed to widen the
 * document. The wrapper is the only thing that scrolls sideways.
 */
export function TableScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`w-full overflow-x-auto ${className}`}>{children}</div>
}

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
}

export function Th({
  children,
  className = '',
  numeric = false,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-line bg-inset/70 px-4 py-2.5 text-sm font-medium text-ink-muted
        ${numeric ? 'text-right' : 'text-left'} ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  numeric = false,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={`border-b border-line-soft px-4 py-3 align-middle text-ink
        ${numeric ? 'text-right tabular-nums' : ''} ${className}`}
      {...props}
    >
      {children}
    </td>
  )
}

/** Filled state, empty state and error state all live in the same row slot. */
export function TableMessage({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-0">
        {children}
      </td>
    </tr>
  )
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  label: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">
        <SearchIcon size={15} />
      </span>
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder ?? label}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-[var(--input-border)]/70 bg-inset pr-3 pl-9
          text-base text-ink transition-colors placeholder:text-ink-soft hover:border-[var(--input-border)]
          md:h-10 md:text-sm"
      />
    </div>
  )
}

export function TableToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
  )
}

/**
 * Counts say what they actually cover. A capped list says "recent"; it never
 * presents the first 100 rows as a lifetime total.
 */
export function ResultCount({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-soft tabular-nums">{children}</p>
}

export function Pagination({
  page,
  lastPage,
  total,
  pageSize,
  onPage,
  onPageSize,
  pageSizes = [25, 50, 100],
  scopeNote,
}: {
  page: number
  lastPage: number
  total: number
  pageSize: number
  onPage: (next: number) => void
  onPageSize?: (next: number) => void
  pageSizes?: number[]
  scopeNote?: string
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-inset/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-ink-muted tabular-nums">
          {total === 0 ? 'No entries' : `Showing ${first}–${last} of ${total}`}
          {scopeNote && <span className="text-ink-soft"> · {scopeNote}</span>}
        </p>
        {onPageSize && (
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="h-8 cursor-pointer rounded-md border border-[var(--input-border)]/70 bg-panel px-2 text-xs text-ink-muted"
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} />
          Previous
        </Button>
        <span className="px-1 text-xs text-ink-muted tabular-nums">
          Page {page} of {lastPage}
        </span>
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= lastPage}>
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

/**
 * Bulk changes are deliberate: the bar names the scope and count, and nothing
 * happens until Apply. Select-all covers exactly the rows currently listed.
 */
export function BulkActionBar({
  count,
  scope,
  onClear,
  children,
}: {
  count: number
  /** What the selection is drawn from, e.g. "of 42 matching contacts". */
  scope: string
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="anim-slide-up mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border
        border-line bg-panel px-3 py-2.5 shadow-raised"
    >
      <p className="text-sm font-semibold text-ink tabular-nums">
        {count} selected
        <span className="ml-1.5 font-normal text-ink-soft">{scope}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto cursor-pointer rounded-sm text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        Clear selection
      </button>
    </div>
  )
}

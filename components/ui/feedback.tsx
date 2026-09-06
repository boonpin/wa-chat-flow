'use client'

import type { ReactNode } from 'react'
import { AlertCircleIcon, AlertTriangleIcon, CheckIcon, InfoIcon, RefreshIcon } from './icons'
import { Button } from './button'

type Tone = 'info' | 'warning' | 'danger' | 'success'

const TONE: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-info-bg text-info border-info/20', icon: <InfoIcon size={16} /> },
  warning: { box: 'bg-warning-bg text-warning border-warning/20', icon: <AlertTriangleIcon size={16} /> },
  danger: { box: 'bg-danger-bg text-danger border-danger/20', icon: <AlertCircleIcon size={16} /> },
  success: { box: 'bg-success-bg text-success border-success/20', icon: <CheckIcon size={16} /> },
}

/**
 * A persistent explanation of a condition that is still true. Banners state the
 * impact and offer the next action; they are never used for a transient result,
 * and an unresolved failure is never dismissible.
 */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: Tone
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const t = TONE[tone]
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${t.box} ${className}`}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-sm leading-5 opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

/**
 * A failed request, stated as what happened, what it means for stored data, and
 * what to do next. Never "Something went wrong".
 */
export function ErrorState({
  title,
  detail,
  onRetry,
  retrying,
  className = '',
}: {
  title: string
  detail?: ReactNode
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`} role="alert">
      <span className="text-danger">
        <AlertCircleIcon size={22} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {detail && <p className="mx-auto mt-1 max-w-[46ch] text-sm leading-5 text-ink-muted">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} pending={retrying} pendingLabel="Retrying…">
          <RefreshIcon size={14} />
          Try again
        </Button>
      )}
    </div>
  )
}

/**
 * Empty states distinguish four different nothings: first use, finished work, a
 * search that matched nothing, and data that could not be loaded. Only the
 * first two ever suggest a next action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}>
      {icon && <span className="text-ink-soft">{icon}</span>}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-[48ch] text-sm leading-5 text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`anim-pulse rounded-md bg-inset ${className}`} aria-hidden="true" />
}

/**
 * First load reserves the shape of the real rows so nothing jumps when data
 * arrives. A *refresh* never renders this — last-good content stays on screen.
 */
export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-px ${className}`} aria-busy="true" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Shown when a background refresh failed but the last successful data is still
 * on screen. Saying so is the whole point — silence would let stale rows pass
 * as current.
 */
export function StaleNotice({ at, onRetry }: { at: Date | null; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
      <AlertTriangleIcon size={13} />
      <span className="font-medium">Updates paused.</span>
      <span className="opacity-90">
        Showing data loaded{' '}
        {at ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto cursor-pointer rounded-sm font-semibold underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  )
}

/** A field-level or form-level error message, linked to what it describes. */
export function InlineError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs leading-4 text-danger">
      <span className="mt-px shrink-0">
        <AlertCircleIcon size={12} />
      </span>
      {children}
    </p>
  )
}

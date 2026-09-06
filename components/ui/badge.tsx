import type { ReactNode } from 'react'

/**
 * Badge variants describe *meaning*, not colour. "ai" and "human" are their own
 * variants precisely because AI mode is not a success and human mode is not a
 * warning — a green pill for both would erase the distinction the operator
 * needs most.
 */
export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'ai'
  | 'human'

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-inset text-ink-muted',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  ai: 'bg-ai-bg text-ai',
  human: 'bg-human-bg text-human',
}

const DOTS: Record<BadgeVariant, string> = {
  neutral: 'bg-ink-soft',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  ai: 'bg-ai',
  human: 'bg-human',
}

/**
 * Non-interactive by design: a badge must never look like something you can
 * press. The dot is decorative — the text alone carries the state, so colour is
 * never the only signal.
 */
export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  icon,
  className = '',
}: {
  children: ReactNode
  variant?: BadgeVariant
  dot?: boolean
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs
        font-medium leading-4 whitespace-nowrap ${VARIANTS[variant]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[variant]}`} aria-hidden="true" />}
      {icon}
      {children}
    </span>
  )
}

/**
 * Channel identity. A connection gets a neutral icon and its name — never a
 * colour picked by hashing its id, which would make "Sales" look successful and
 * "Support" look broken for no reason at all.
 */
export function ChannelTag({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-inset px-2 py-0.5
        text-xs font-medium leading-4 text-ink-muted ${className}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
      <span className="truncate">{name}</span>
    </span>
  )
}

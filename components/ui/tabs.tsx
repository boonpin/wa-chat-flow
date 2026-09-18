'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Subpage navigation. These are real links, so they open in a new tab, appear
 * in history and survive a reload — a route is not a widget.
 */
export function RouteTabs({
  items,
  current,
  className = '',
  label = 'Sections',
  wrap = false,
}: {
  label?: string
  wrap?: boolean
  items: { href: string; label: ReactNode; key: string }[]
  current: string
  className?: string
}) {
  return (
    <nav
      className={`-mb-px flex gap-1 ${wrap ? 'flex-wrap' : 'overflow-x-auto'} border-b border-line ${className}`}
      aria-label={label}
    >
      {items.map((item) => {
        const active = item.key === current
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 md:min-h-10 text-sm whitespace-nowrap transition-colors
              duration-[--duration-control] ${
                active
                  ? 'border-action font-semibold text-action'
                  : 'border-transparent font-medium text-ink-muted hover:text-ink'
              }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * A filter, not a route. It is a named radio group so a screen reader hears
 * what is being filtered, and the selected option is not signalled by colour
 * alone — it also carries weight and a background.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-line bg-panel p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              const index = options.findIndex((item) => item.value === option.value)
              const direction = ['ArrowRight', 'ArrowDown'].includes(e.key)
                ? 1
                : ['ArrowLeft', 'ArrowUp'].includes(e.key)
                  ? -1
                  : 0
              if (!direction && e.key !== 'Home' && e.key !== 'End') return
              e.preventDefault()
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? options.length - 1
                    : (index + direction + options.length) % options.length
              onChange(options[next].value)
              e.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('button')
                [next]?.focus()
            }}
            onClick={() => onChange(option.value)}
            className={`h-11 cursor-pointer rounded-[6px] px-3 text-[13px] transition-colors
              duration-[--duration-control] md:h-10 ${
                active
                  ? 'bg-selected font-semibold text-ink'
                  : 'font-medium text-ink-muted hover:bg-hover hover:text-ink'
              }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

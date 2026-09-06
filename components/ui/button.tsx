'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { Spinner } from './icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-action text-on-action hover:bg-action-hover active:bg-action-pressed shadow-raised',
  secondary:
    'bg-panel text-ink border border-line-strong/60 hover:bg-hover active:bg-selected',
  ghost: 'text-ink-muted hover:bg-hover hover:text-ink active:bg-selected',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90 shadow-raised',
}

/** 32px is only safe inside a row that already offers a 44px target. */
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 gap-2',
  lg: 'h-11 px-5 gap-2',
}

const BASE =
  'inline-flex items-center justify-center rounded-md text-sm font-semibold whitespace-nowrap ' +
  'transition-[background-color,color,transform,box-shadow] duration-[--duration-control] ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none ' +
  'cursor-pointer disabled:cursor-not-allowed'

interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  /** Blocks repeat submits and names what is happening, e.g. "Saving…". */
  pending?: boolean
  pendingLabel?: string
  /** Inside a modal, take focus when it opens — see useModalDialog. */
  initialFocus?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  pending = false,
  pendingLabel,
  initialFocus,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-initial-focus={initialFocus ? 'true' : undefined}
      {...props}
    >
      {pending && <Spinner size={size === 'sm' ? 13 : 15} />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}

/**
 * A link that looks like a button. Links navigate and buttons act — this is
 * never used to trigger a mutation, and a Button is never nested in an anchor.
 */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </Link>
  )
}

/**
 * Icon-only control. `label` is mandatory: it becomes both the accessible name
 * and the hover/focus tooltip, so no close or send button is ever unlabelled.
 */
export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  children,
  pending,
  disabled,
  type = 'button',
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  label: string
  size?: 'sm' | 'md'
  variant?: Variant
  pending?: boolean
  children: ReactNode
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${BASE} ${size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {pending ? <Spinner size={15} /> : children}
    </button>
  )
}

/** A text action that is genuinely an action, not navigation. */
export function TextButton({
  className = '',
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={`text-[13px] font-medium text-action hover:text-action-hover hover:underline
        underline-offset-2 disabled:opacity-45 disabled:no-underline cursor-pointer
        disabled:cursor-not-allowed rounded-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

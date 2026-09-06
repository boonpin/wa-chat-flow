'use client'

import { useId, type ComponentProps, type ReactNode } from 'react'
import { Spinner } from './icons'

const CONTROL =
  'w-full rounded-md border bg-inset px-3 text-sm text-ink transition-[border-color,box-shadow] ' +
  'duration-[--duration-control] ease-out placeholder:text-ink-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

/** 44px on touch, 40px on a pointer. Input text stays 16px on phones so iOS
 *  does not zoom the viewport when the field is focused. */
const HEIGHT = 'h-11 text-base md:h-10 md:text-sm'

function shell(invalid?: boolean) {
  return invalid
    ? `${CONTROL} border-[var(--input-error-border)]`
    : `${CONTROL} border-[var(--input-border)]/70 hover:border-[var(--input-border)]`
}

interface FieldShellProps {
  label: string
  /** Hide the label visually only where an adjacent heading already names the
   *  control — the label element itself is always rendered and associated. */
  hideLabel?: boolean
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}

export function Field({
  label,
  hideLabel,
  hint,
  error,
  required,
  children,
  className = '',
}: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className={
          hideLabel
            ? 'sr-only'
            : 'block text-sm font-medium text-ink'
        }
      >
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-xs leading-4 text-ink-muted">
          {hint}
        </p>
      )}
      <div className="mt-1">{children({ id, describedBy, invalid: !!error })}</div>
      {error && (
        <p id={errorId} className="mt-1 flex items-start gap-1 text-xs leading-4 text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type FieldMeta = Pick<FieldShellProps, 'label' | 'hideLabel' | 'hint' | 'error' | 'className'>

export function Input({
  label,
  hideLabel,
  hint,
  error,
  className,
  required,
  ...props
}: FieldMeta & ComponentProps<'input'>) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${shell(invalid)} ${HEIGHT}`}
          {...props}
        />
      )}
    </Field>
  )
}

export function Textarea({
  label,
  hideLabel,
  hint,
  error,
  className,
  required,
  rows = 4,
  ...props
}: FieldMeta & ComponentProps<'textarea'>) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${shell(invalid)} resize-y py-2 text-base leading-6 md:text-sm md:leading-5`}
          {...props}
        />
      )}
    </Field>
  )
}

/**
 * A native select, styled. It is replaced by nothing: the platform control
 * already gives keyboard support, typeahead and a usable mobile picker, and no
 * visual novelty is worth losing those.
 */
export function Select({
  label,
  hideLabel,
  hint,
  error,
  className,
  required,
  children,
  ...props
}: FieldMeta & ComponentProps<'select'>) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${shell(invalid)} ${HEIGHT} cursor-pointer appearance-none pr-9`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2343564C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
          {...props}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

/**
 * Write-only credential. The stored value is never retrieved, so the field
 * shows whether one exists *outside* the input and treats blank as "keep".
 */
export function SecretField({
  label,
  stored,
  storedLabel = 'Stored',
  emptyLabel = 'Not set',
  hint,
  ...props
}: FieldMeta & ComponentProps<'input'> & {
  stored: boolean
  storedLabel?: string
  emptyLabel?: string
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${
            stored ? 'bg-success-bg text-success' : 'bg-inset text-ink-muted'
          }`}
        >
          {stored ? storedLabel : emptyLabel}
        </span>
      </div>
      <Input
        label={label}
        hideLabel
        type="password"
        autoComplete="off"
        hint={stored ? (hint ?? 'Leave blank to keep the stored value.') : hint}
        {...props}
      />
    </div>
  )
}

/**
 * Switch. `description` is folded into the accessible name so a screen reader
 * hears which record it belongs to, and `disabled` is real disabled semantics
 * rather than a dimmed div that still responds to clicks.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  pending,
  size = 'md',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Full accessible name, e.g. "AI replies for Amina Yusof". */
  label: string
  description?: string
  disabled?: boolean
  pending?: boolean
  size?: 'sm' | 'md'
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const knob = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'
  const travel = size === 'sm' ? (checked ? 'translate-x-4.5' : 'translate-x-0.5') : checked ? 'translate-x-5.5' : 'translate-x-0.5'

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={undefined}
        title={description}
        disabled={disabled || pending}
        onClick={() => onChange(!checked)}
        className={`${track} relative inline-flex items-center rounded-full
          transition-colors duration-[--duration-control] ease-out
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-action' : 'bg-line-strong/60'} cursor-pointer`}
      >
        <span
          className={`${knob} ${travel} inline-block rounded-full bg-white shadow-raised
            transition-transform duration-[--duration-control] ease-out`}
        />
      </button>
      {pending && (
        <span className="pointer-events-none absolute -right-5 text-ink-soft">
          <Spinner size={12} />
        </span>
      )}
    </span>
  )
}

/**
 * A single choice among a few, where each option needs a sentence of its own to
 * be chosen correctly — a policy, not a preference. Native radios inside one
 * fieldset, so arrow keys, the accessible name and the grouping all come for
 * free; the card is only paint on top of them.
 */
export function RadioCards<T extends string>({
  legend,
  hideLegend,
  value,
  onChange,
  options,
  disabled,
  className = '',
}: {
  /** Full accessible name for the group, e.g. "How much the AI answers". */
  legend: string
  /** Hide it visually only where an adjacent heading already says the same. */
  hideLegend?: boolean
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string; detail?: ReactNode; badge?: ReactNode }[]
  disabled?: boolean
  className?: string
}) {
  const name = useId()

  return (
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`} disabled={disabled}>
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-sm font-medium text-ink'}>
        {legend}
      </legend>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors
                duration-[--duration-control] ease-out
                ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                ${selected ? 'border-action bg-selected' : `border-line ${disabled ? '' : 'hover:bg-hover'}`}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-action-primary)]
                  disabled:cursor-not-allowed"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {option.label}
                  {option.badge}
                </span>
                {option.detail && (
                  <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
                    {option.detail}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
  className = '',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  indeterminate?: boolean
  className?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked
      }}
      onChange={(e) => onChange(e.target.checked)}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-[var(--color-action-primary)]
        disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  )
}

/**
 * Groups related fields under one scope sentence. The sentence is the point:
 * every form section says what its settings affect before you change them.
 */
export function FormSection({
  title,
  scope,
  children,
  action,
}: {
  title: string
  scope?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {scope && <p className="mt-0.5 text-sm leading-5 text-ink-muted">{scope}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

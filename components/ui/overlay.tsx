'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { Button, IconButton } from './button'

/**
 * Overlays are built on the native <dialog> element rather than a hand-rolled
 * div. `showModal()` gives focus containment, Escape, focus restoration and top
 * layer placement from the platform — behaviour that takes days to reproduce
 * correctly and is wrong in most hand-written versions. Only the scroll lock
 * and the backdrop click are ours.
 */
function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      returnFocusTo.current = document.activeElement as HTMLElement | null
      el.showModal()
      // showModal() focuses the first focusable descendant. Where the safe
      // choice is not the first one — Cancel on a destructive confirmation —
      // the caller marks it, and that marker wins.
      el.querySelector<HTMLElement>('[data-initial-focus="true"]')?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  /**
   * The <dialog> element restores focus on close() by itself, but only while it
   * is still in the document. A parent that unmounts the whole overlay in the
   * same tick would drop focus on the floor, so restore it explicitly too.
   */
  useEffect(() => {
    if (!open) return
    return () => {
      const target = returnFocusTo.current
      if (target && document.contains(target)) target.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Escape fires `cancel`; the browser would close the element on its own, so
  // route it through the caller instead to keep React state authoritative.
  const onCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault()
      onClose()
    },
    [onClose]
  )

  return { ref, onCancel }
}

const DIALOG_RESET =
  'm-0 max-h-none max-w-none border-0 bg-transparent p-0 text-ink outline-none ' +
  'backdrop:bg-[var(--color-overlay-scrim)] open:flex'

/**
 * Inspect a record without losing the list behind it. 440px for standard
 * detail, 560px when the content is genuinely rich. Full screen on a phone.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'standard',
  side = 'right',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'standard' | 'wide' | 'nav'
  side?: 'left' | 'right'
}) {
  const { ref, onCancel } = useModalDialog(open, onClose)

  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-label={title}
      className={`${DIALOG_RESET} h-dvh max-h-dvh w-dvw ${side === 'left' ? 'justify-start' : 'justify-end'}`}
    >
      {open && (
      <div
        className={`flex h-dvh w-full flex-col bg-overlay shadow-dialog
          ${side === 'left' ? 'anim-fade' : 'anim-drawer'}
          ${width === 'nav' ? 'max-w-[280px]' : width === 'wide' ? 'sm:max-w-[560px]' : 'sm:max-w-[440px]'}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3 md:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <div className="mt-0.5 text-xs text-ink-soft">{description}</div>}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-4 py-3 md:px-5">{footer}</div>
        )}
      </div>
      )}
    </dialog>
  )
}

/** One focused confirmation or one short task. Nothing else belongs here. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'narrow',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'narrow' | 'form'
}) {
  const { ref, onCancel } = useModalDialog(open, onClose)

  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-label={title}
      className={`${DIALOG_RESET} h-dvh max-h-dvh w-dvw items-end justify-center sm:items-center`}
    >
      {open && (
      <div
        className={`anim-dialog flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-t-xl bg-overlay
          shadow-dialog sm:rounded-xl ${size === 'form' ? 'sm:max-w-[640px]' : 'sm:max-w-[440px]'}`}
      >
        <div className="shrink-0 px-5 pt-5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && (
            <div className="mt-1 text-sm leading-5 text-ink-muted">{description}</div>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">{children}</div>}
        <div className="flex shrink-0 flex-wrap justify-end gap-2 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </div>
      )}
    </dialog>
  )
}

/**
 * Destructive confirmation. Focus starts on Cancel, so Enter on a dialog the
 * operator did not expect cannot delete anything.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  pending = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel?: string
  destructive?: boolean
  pending?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending} initialFocus={destructive}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            pending={pending}
            pendingLabel={pendingLabel}
            initialFocus={!destructive}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

/**
 * Confirmation state for one destructive target, so a page does not need four
 * separate booleans to ask "are you sure" about four different rows.
 */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (action: (value: T) => Promise<void>) => {
      if (target === null) return
      setPending(true)
      try {
        await action(target)
        setTarget(null)
      } finally {
        setPending(false)
      }
    },
    [target]
  )

  return {
    target,
    pending,
    open: target !== null,
    ask: setTarget,
    cancel: () => !pending && setTarget(null),
    run,
  }
}

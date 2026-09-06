'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircleIcon, AlertTriangleIcon, CheckIcon, CloseIcon } from './icons'

type ToastTone = 'success' | 'error' | 'warning'

interface ToastRecord {
  id: string
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  /** Success auto-dismisses. Errors and actionable warnings stay until dismissed. */
  toast: (message: string, tone?: ToastTone, action?: ToastRecord['action']) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastApi>({ toast: () => {}, dismiss: () => {} })

const MAX_VISIBLE = 3
const SUCCESS_MS = 5000

const TONE: Record<ToastTone, { box: string; icon: ReactNode }> = {
  success: { box: 'border-success/25 bg-success-bg text-success', icon: <CheckIcon size={15} /> },
  error: { box: 'border-danger/25 bg-danger-bg text-danger', icon: <AlertCircleIcon size={15} /> },
  warning: { box: 'border-warning/25 bg-warning-bg text-warning', icon: <AlertTriangleIcon size={15} /> },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastApi['toast']>((message, tone = 'success', action) => {
    const id = Math.random().toString(36).slice(2)
    setItems((list) => {
      // Repeated identical messages — a poll failing every 5s — collapse into one.
      const withoutDuplicate = list.filter((t) => t.message !== message)
      return [...withoutDuplicate, { id, message, tone, action }].slice(-MAX_VISIBLE)
    })
    if (tone === 'success') {
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), SUCCESS_MS)
    }
  }, [])

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // Announced once when it changes; it never steals focus and never
        // re-reads content the operator is already reading.
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex flex-col items-center gap-2 p-4
          pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-end sm:p-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-slide-up pointer-events-auto flex w-full max-w-[420px] items-start gap-2.5
              rounded-lg border px-3.5 py-3 shadow-popover ${TONE[t.tone].box}`}
          >
            <span className="mt-0.5 shrink-0">{TONE[t.tone].icon}</span>
            <p className="min-w-0 flex-1 text-sm leading-5 font-medium break-words">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="shrink-0 cursor-pointer rounded-sm text-[13px] font-semibold underline underline-offset-2"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 opacity-60 hover:opacity-100"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

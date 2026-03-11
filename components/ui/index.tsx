'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-[#E6EAF0] ${className}`}>
      {children}
    </div>
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
  children: React.ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-sm',
    secondary: 'bg-white border border-[#E6EAF0] text-[#0F172A] hover:bg-[#F6F8FB]',
    danger: 'bg-[#DC2626] hover:bg-red-700 text-white',
    ghost: 'text-[#475569] hover:bg-[#F6F8FB] hover:text-[#0F172A]',
  }
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue'

export function Badge({ children, variant = 'gray', dot, size }: { children: React.ReactNode; variant?: BadgeVariant; dot?: boolean; size?: 'sm' }) {
  const variants = {
    green: 'bg-[#DCFCE7] text-[#166534]',
    yellow: 'bg-[#FEF3C7] text-[#92400E]',
    red: 'bg-[#FEE2E2] text-[#991B1B]',
    gray: 'bg-[#F1F5F9] text-[#475569]',
    blue: 'bg-blue-50 text-blue-700',
  }
  const dots = {
    green: 'bg-[#16A34A]',
    yellow: 'bg-[#D97706]',
    red: 'bg-[#DC2626]',
    gray: 'bg-[#94A3B8]',
    blue: 'bg-blue-500',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />}
      {children}
    </span>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 ${
        checked ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-[#0F172A]">{label}</label>}
      {hint && <p className="text-xs text-[#475569]">{hint}</p>}
      <input
        className={`w-full border rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent transition-shadow ${
          error ? 'border-[#DC2626]' : 'border-[#E6EAF0]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export function Textarea({ label, hint, className = '', ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-[#0F172A]">{label}</label>}
      {hint && <p className="text-xs text-[#475569]">{hint}</p>}
      <textarea
        className={`w-full border border-[#E6EAF0] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent resize-none transition-shadow ${className}`}
        {...props}
      />
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
}

export function Select({ label, hint, className = '', children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-[#0F172A]">{label}</label>}
      {hint && <p className="text-xs text-[#475569]">{hint}</p>}
      <select
        className={`w-full border border-[#E6EAF0] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent transition-shadow appearance-none bg-white cursor-pointer ${className}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E6EAF0] rounded-lg ${className}`} />
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(message: string, type: ToastType = 'success') {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[240px] transition-all animate-in slide-in-from-bottom-2 ${
              t.type === 'success' ? 'bg-[#0F172A] text-white' :
              t.type === 'error' ? 'bg-[#DC2626] text-white' :
              'bg-[#D97706] text-white'
            }`}
          >
            {t.type === 'success' && <span className="text-[#4ADE80]">✓</span>}
            {t.type === 'error' && <span>✕</span>}
            {t.type === 'warning' && <span>⚠</span>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-4xl mb-4 opacity-40">{icon}</div>}
      <p className="font-medium text-[#0F172A] mb-1">{title}</p>
      {description && <p className="text-sm text-[#475569] mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">{title}</h1>
        {description && <p className="text-sm text-[#475569] mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Status Strip Item ───────────────────────────────────────────────────────
export function StatusItem({ label, value, variant }: { label: string; value: string; variant: BadgeVariant }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#475569]">{label}</span>
      <Badge variant={variant} dot>{value}</Badge>
    </div>
  )
}

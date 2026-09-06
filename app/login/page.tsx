'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button, HttpError, Input, request } from '@/components/ui'
import { AlertCircleIcon } from '@/components/ui'

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Only a same-origin path is ever restored, so the parameter cannot be used
  // to bounce someone to another site after they authenticate.
  const raw = params.get('next')
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      router.push(next)
    } catch (err) {
      setError(
        err instanceof HttpError && err.status === 0
          ? 'Could not sign in. Check your connection and try again.'
          : 'Incorrect email or password.'
      )
      // The password is cleared, the email is not — retyping both punishes a typo.
      setPassword('')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-action">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
            </svg>
          </span>
          <h1 className="text-title font-semibold tracking-[-0.02em] text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Answer WhatsApp customers with AI assistance.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-xl border border-line bg-panel p-6 shadow-raised"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2.5 text-sm text-danger" role="alert">
              <span className="mt-0.5 shrink-0">
                <AlertCircleIcon size={15} />
              </span>
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <div>
            <Input
              label="Password"
              type={reveal ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="mt-1.5 cursor-pointer rounded-sm text-xs font-medium text-ink-muted hover:text-ink"
            >
              {reveal ? 'Hide password' : 'Show password'}
            </button>
          </div>

          <Button type="submit" size="lg" pending={pending} pendingLabel="Signing in…" className="w-full">
            Sign in
          </Button>
        </form>

        {/* No reset link: there is no password-reset endpoint, and a dead link
            in the one place someone is already locked out is worse than none. */}
        <p className="mt-4 text-center text-sm text-ink-muted">
          Need access? Contact your administrator.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <SignInForm />
    </Suspense>
  )
}

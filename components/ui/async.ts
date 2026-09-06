'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/**
 * One HTTP convention for the whole dashboard. Every non-OK response becomes an
 * error with the server's own message where there is one — the old habit of
 * `.then(r => r.json())` turned a 500 into an empty list and a failure into a
 * page that looked merely empty.
 */
export async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch {
    throw new HttpError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (res.status === 401) {
    throw new HttpError(401, 'Your session has expired. Sign in to continue.')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new HttpError(res.status, body?.error ?? `Request failed (${res.status}).`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

export interface AsyncData<T> {
  data: T | null
  /** First load only. A refresh keeps the last good data on screen instead. */
  loading: boolean
  refreshing: boolean
  /** Set when the *first* load failed and there is nothing to show. */
  error: string | null
  /** Set when a refresh failed but last-good data is still displayed. */
  stale: string | null
  loadedAt: Date | null
  refresh: () => void
  setData: (updater: (current: T) => T) => void
}

/**
 * Loading / loaded / refreshing / failed / stale, with stale-response guards so
 * a slow first request cannot overwrite a newer one, and last-good retention so
 * a dropped poll never blanks a screen the operator is reading.
 */
export function useAsyncData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { pollMs?: number; enabled?: boolean } = {}
): AsyncData<T> {
  const { pollMs, enabled = true } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  const sequence = useRef(0)
  const hasData = useRef(false)
  const inFlight = useRef<AbortController | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  const execute = useCallback(
    async (isRefresh: boolean) => {
      const ticket = ++sequence.current
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller

      if (isRefresh) setRefreshing(true)
      else if (!hasData.current) setLoading(true)

      try {
        const result = await run(controller.signal)
        if (ticket !== sequence.current) return
        hasData.current = true
        setData(result)
        setError(null)
        setStale(null)
        setLoadedAt(new Date())
      } catch (e) {
        if (ticket !== sequence.current || controller.signal.aborted) return
        const message = errorMessage(e, 'Could not load this data.')
        if (hasData.current) setStale(message)
        else setError(message)
      } finally {
        if (ticket === sequence.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [run]
  )

  useEffect(() => {
    if (!enabled) return
    hasData.current = false
    execute(false)
    // Captured here so the cleanup reads the refs this effect owned, not
    // whatever they point at by the time it runs.
    const ticketRef = sequence
    const flightRef = inFlight
    return () => {
      ticketRef.current++
      flightRef.current?.abort()
    }
  }, [execute, enabled])

  useEffect(() => {
    if (!enabled || !pollMs) return
    const id = setInterval(() => execute(true), pollMs)
    return () => clearInterval(id)
  }, [execute, enabled, pollMs])

  const refresh = useCallback(() => {
    execute(hasData.current)
  }, [execute])

  const patch = useCallback((updater: (current: T) => T) => {
    setData((current) => (current === null ? current : updater(current)))
  }, [])

  return { data, loading, refreshing, error, stale, loadedAt, refresh, setData: patch }
}

/**
 * Per-action pending state keyed by record id, so one row's spinner never
 * disables the whole table and a double click cannot fire twice.
 */
export function usePendingSet() {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  // The ref is the guard, the state is only for rendering: a state updater can
  // run twice, and a duplicate submit must be rejected synchronously.
  const active = useRef(new Set<string>())

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    if (active.current.has(key)) return
    active.current.add(key)
    setPending(new Set(active.current))
    try {
      await action()
    } finally {
      active.current.delete(key)
      setPending(new Set(active.current))
    }
  }, [])

  return { isPending: (key: string) => pending.has(key), run, any: pending.size > 0 }
}

/**
 * Time is shown twice, never once: a short relative label for scanning, and the
 * full timestamp in the element's `dateTime` and title so it is reachable
 * without hovering. Detail views print the full form outright.
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fullTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(date, today)) return 'Today'
  if (same(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

/** Contact identity falls back to the number, never to "Unknown" alone. */
export function contactLabel(name: string | null | undefined, phone: string | null | undefined): string {
  return name?.trim() || phone || 'Unknown contact'
}

export function initial(name: string | null | undefined, phone: string | null | undefined): string {
  const source = name?.trim() || phone || '?'
  return source.charAt(0).toUpperCase()
}

export function plural(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`)
}

/**
 * Token counts, which run from three digits to eight.
 *
 * Exact below a hundred thousand, where the difference between 40,000 and
 * 41,500 is something an operator reads; compact above it, where it is not.
 */
export function tokenCount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n < 100_000
    ? n.toLocaleString('en-US')
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

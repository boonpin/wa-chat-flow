/**
 * How the AI batches a customer's messages before answering.
 *
 * WhatsApp is a medium people type in bursts: "hi", "im interested", "whats the
 * price" is one question asked in three messages, seconds apart. Answering each
 * one as it lands produces three replies that each saw a different, partial
 * conversation — and three chances to fire the same tool. So an inbound message
 * opens a window instead of a reply: the AI waits for the customer to stop
 * typing, then answers everything said in that window once.
 *
 *   windowSeconds  — quiet time after the last message before answering. Each
 *                    new message restarts it. Zero restores one reply per
 *                    message, which is the escape hatch, not the default.
 *   maxWaitSeconds — ceiling on that wait, measured from the *first* unanswered
 *                    message. Someone typing continuously must still be
 *                    answered, and this is what stops the window sliding
 *                    forever.
 *
 * Pure data: no database import, so the dashboard and the reply scheduler read
 * the same definitions.
 */

export interface ReplyTiming {
  windowSeconds: number
  maxWaitSeconds: number
}

export const REPLY_TIMING_DEFAULTS: ReplyTiming = { windowSeconds: 8, maxWaitSeconds: 45 }

export const REPLY_WINDOW_BOUNDS = { min: 0, max: 120 } as const
export const REPLY_MAX_WAIT_BOUNDS = { min: 5, max: 600 } as const

/**
 * Forces a stored or submitted pair into a usable shape.
 *
 * A ceiling below the window would answer before the window ever elapsed,
 * making the window silently meaningless, so the ceiling is raised to meet it
 * rather than the window being lowered — the operator asked for that much quiet
 * time, and the ceiling is only ever a backstop.
 */
export function normalizeReplyTiming(input: Partial<ReplyTiming> | null | undefined): ReplyTiming {
  const windowSeconds = clamp(
    input?.windowSeconds ?? REPLY_TIMING_DEFAULTS.windowSeconds,
    REPLY_WINDOW_BOUNDS
  )
  const maxWaitSeconds = Math.max(
    clamp(input?.maxWaitSeconds ?? REPLY_TIMING_DEFAULTS.maxWaitSeconds, REPLY_MAX_WAIT_BOUNDS),
    windowSeconds
  )
  return { windowSeconds, maxWaitSeconds }
}

export function isReplyTimingValue(value: unknown, bounds: { min: number; max: number }): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= bounds.min && value <= bounds.max
}

/** True when batching is switched off and every message gets its own reply. */
export function repliesPerMessage(timing: ReplyTiming): boolean {
  return timing.windowSeconds <= 0
}

/** One line describing the effect, for the settings page and its saved-state panel. */
export function describeReplyTiming(timing: ReplyTiming): string {
  if (repliesPerMessage(timing)) {
    return 'Every message is answered on its own, as soon as it arrives.'
  }
  return `Waits ${timing.windowSeconds}s after the customer stops typing, then answers everything at once — never holding longer than ${timing.maxWaitSeconds}s.`
}

function clamp(value: number, bounds: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return bounds.min
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}

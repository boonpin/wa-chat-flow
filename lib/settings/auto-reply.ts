/**
 * How much of the workspace the AI is allowed to answer.
 *
 * The distinction that matters is *when a conversation started*, not who the
 * customer is:
 *
 *   all      — every conversation set to AI replies is answered, and a thread
 *              opened by a new message inherits the customer's AI default.
 *   existing — a damper, not a stop. Threads already running on AI keep
 *              running; anything that opens from here on starts on human
 *              replies and stays there until an operator says otherwise.
 *   off      — nothing is answered automatically. Messages still arrive and
 *              can still be answered by hand.
 *
 * Pure data: no database import, so the dashboard and the message handler read
 * the same definitions.
 */
export type AutoReplyMode = 'all' | 'existing' | 'off'

/** Most permissive first — this is also the order the settings page renders. */
export const AUTO_REPLY_MODES = ['all', 'existing', 'off'] as const

export function isAutoReplyMode(value: unknown): value is AutoReplyMode {
  return typeof value === 'string' && (AUTO_REPLY_MODES as readonly string[]).includes(value)
}

/** True when a thread that is *already* on AI replies may still be answered. */
export function repliesToExisting(mode: AutoReplyMode): boolean {
  return mode !== 'off'
}

/** True when a thread opening right now may start on AI replies. */
export function repliesToNew(mode: AutoReplyMode): boolean {
  return mode === 'all'
}

export const AUTO_REPLY_MODE_COPY: Record<
  AutoReplyMode,
  { label: string; short: string; detail: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  all: {
    label: 'Fully automatic',
    short: 'fully automatic',
    detail:
      'New conversations start on AI replies when the customer allows it, and conversations already on AI keep being answered.',
    tone: 'success',
  },
  existing: {
    label: 'Existing conversations only',
    short: 'existing conversations only',
    detail:
      'Conversations already on AI replies keep being answered. Anything that opens from now on starts on human replies, so nobody new is answered automatically.',
    tone: 'warning',
  },
  off: {
    label: 'Off',
    short: 'off',
    detail:
      'No conversation is answered automatically, even one set to AI replies. Messages still arrive and you can still reply by hand.',
    tone: 'neutral',
  },
}

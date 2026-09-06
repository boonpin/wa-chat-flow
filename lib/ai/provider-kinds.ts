/**
 * The vendors an AI provider row can point at.
 *
 * Deliberately free of SDK imports: the dashboard imports these labels, and
 * pulling `lib/ai/providers/*` into a client bundle would drag both vendor SDKs
 * with it. The translators live behind `lib/ai/providers/`.
 */

export const PROVIDER_KINDS = ['openai', 'gemini'] as const

export type ProviderKind = (typeof PROVIDER_KINDS)[number]

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

/** The environment variable a provider falls back to when it stores no key. */
export const PROVIDER_ENV_KEYS: Record<ProviderKind, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return typeof value === 'string' && (PROVIDER_KINDS as readonly string[]).includes(value)
}

/** Falls back to the raw value so an unknown kind is still readable on screen. */
export function providerLabel(kind: string): string {
  return isProviderKind(kind) ? PROVIDER_LABELS[kind] : kind
}

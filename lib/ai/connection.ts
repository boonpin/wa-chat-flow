import { db } from '@/lib/db'
import { aiProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { aiKeys } from '@/lib/config'
import { PROVIDER_ENV_KEYS, isProviderKind, type ProviderKind } from './provider-kinds'
import type { Bot } from './types'

/**
 * Turns a bot into the account its calls are made — and billed — against.
 *
 * A bot no longer carries a vendor, a key or a model: it points at an
 * `ai_providers` row that holds all three. That indirection is what lets every
 * API call name the account it spent tokens on, and what keeps a key stored
 * once instead of copied onto every bot that uses it.
 */

export type AIProvider = typeof aiProviders.$inferSelect

export interface BotConnection {
  providerId: string
  providerName: string
  kind: ProviderKind
  model: string
  apiKey: string
}

export function getAiProvider(id: string): AIProvider | undefined {
  return db.select().from(aiProviders).where(eq(aiProviders.id, id)).get()
}

export function listAiProviders(): AIProvider[] {
  return db.select().from(aiProviders).all()
}

/**
 * The key a provider signs its calls with.
 *
 * A stored key wins; without one the server-wide environment key for that
 * vendor is used, which is how a single-tenant deployment can run with no keys
 * in the database at all. Empty string means neither exists.
 */
export function resolveProviderKey(provider: Pick<AIProvider, 'kind' | 'apiKey'>): string {
  if (provider.apiKey) return provider.apiKey
  return isProviderKind(provider.kind) ? aiKeys[provider.kind] : ''
}

/**
 * Throws rather than falling back to a guess: answering a customer on a
 * different account than the operator configured — or on a hardcoded default
 * model — is worse than a visible failure in the thread.
 */
export function resolveConnection(bot: Bot): BotConnection {
  if (!bot.providerId) {
    throw new Error(`Bot "${bot.name}" has no AI provider selected. Pick one under AI providers.`)
  }

  const provider = getAiProvider(bot.providerId)
  if (!provider) {
    throw new Error(
      `Bot "${bot.name}" points at an AI provider that no longer exists. Pick another one.`
    )
  }
  if (!provider.enabled) {
    throw new Error(`AI provider "${provider.name}" is turned off.`)
  }
  if (!isProviderKind(provider.kind)) {
    throw new Error(`AI provider "${provider.name}" uses an unknown vendor: ${provider.kind}`)
  }

  const apiKey = resolveProviderKey(provider)
  if (!apiKey) {
    throw new Error(
      `No API key for AI provider "${provider.name}" ` +
        `(store one on the provider or set ${PROVIDER_ENV_KEYS[provider.kind]}).`
    )
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    kind: provider.kind,
    model: provider.model,
    apiKey,
  }
}

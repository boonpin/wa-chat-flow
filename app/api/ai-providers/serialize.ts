import { db } from '@/lib/db'
import { aiBots, aiUsage, type aiProviders } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { PROVIDER_KINDS, isProviderKind } from '@/lib/ai/provider-kinds'

type AIProvider = typeof aiProviders.$inferSelect

export interface ProviderUsage {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * The API key never leaves the server — same rule as a bot's key or a tool's
 * sink credentials. The client learns only that one is stored, so a key cannot
 * be read back out of the dashboard.
 */
export function toPublicProvider(provider: AIProvider) {
  const { apiKey, ...rest } = provider
  return {
    ...rest,
    hasApiKey: !!apiKey,
    botCount: countBots(provider.id),
    usage: usageFor(provider.id),
  }
}

function countBots(providerId: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(aiBots)
    .where(eq(aiBots.providerId, providerId))
    .get()
  return row?.n ?? 0
}

/** All-time totals. Cheap on the index, and the only number an operator asks for first. */
export function usageFor(providerId: string): ProviderUsage {
  const row = db
    .select({
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
    })
    .from(aiUsage)
    .where(eq(aiUsage.providerId, providerId))
    .get()

  return {
    calls: row?.calls ?? 0,
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: row?.outputTokens ?? 0,
    totalTokens: row?.totalTokens ?? 0,
  }
}

export interface ProviderInput {
  name?: string
  kind?: string
  /** Undefined means "leave unchanged"; null means "clear it". */
  apiKey?: string | null
  model?: string
  imageModel?: string | null
  imageEnabled?: boolean
  voiceModel?: string | null
  voiceEnabled?: boolean
  enabled?: boolean
}

export interface ProviderInputResult {
  input: ProviderInput
  error?: string
}

/** Whitelists the fields a client may set, so nothing else can be injected. */
export function readProviderInput(body: Record<string, unknown>): ProviderInputResult {
  const input: ProviderInput = {}

  if (typeof body.name === 'string') input.name = body.name.trim()

  if (typeof body.kind === 'string') {
    // Rejected rather than ignored: a silently dropped vendor would leave the
    // row pointing at the wrong SDK the next time a reply is attempted.
    if (!isProviderKind(body.kind)) {
      return { input, error: `kind must be one of: ${PROVIDER_KINDS.join(', ')}` }
    }
    input.kind = body.kind
  }

  if (typeof body.model === 'string') input.model = body.model.trim()
  if (typeof body.enabled === 'boolean') input.enabled = body.enabled

  if (typeof body.imageModel === 'string') input.imageModel = body.imageModel.trim() || null
  if (typeof body.voiceModel === 'string') input.voiceModel = body.voiceModel.trim() || null
  if (typeof body.imageEnabled === 'boolean') input.imageEnabled = body.imageEnabled
  if (typeof body.voiceEnabled === 'boolean') input.voiceEnabled = body.voiceEnabled

  // A capability switched on with no model is the failure this check exists to
  // prevent: it reads as working in the dashboard and turns into a customer
  // being told their photo cannot be read. Refused at the door instead.
  if (input.imageEnabled && input.imageModel === null) {
    return { input, error: 'Choose a model for reading images, or turn image reading off.' }
  }
  if (input.voiceEnabled && input.voiceModel === null) {
    return { input, error: 'Choose a model for voice notes, or turn voice notes off.' }
  }

  // A blank key from the edit form means "keep what is stored".
  if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 0) {
    input.apiKey = body.apiKey.trim()
  } else if (body.apiKey === null) {
    input.apiKey = null
  }

  return { input }
}

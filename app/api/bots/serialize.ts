import type { aiBots } from '@/lib/db/schema'

type Bot = typeof aiBots.$inferSelect

const PROVIDERS = ['openai', 'gemini']
const HANDLER_TYPES = ['direct', 'external_agent']

/**
 * The stored API key never leaves the server — the client only learns whether
 * one is set, so an existing key cannot be read back out of the dashboard.
 */
export function toPublicBot(bot: Bot) {
  const { apiKey, ...rest } = bot
  return { ...rest, hasApiKey: !!apiKey }
}

export interface BotInput {
  name?: string
  provider?: string
  /** Undefined means "leave unchanged"; empty string means "clear it". */
  apiKey?: string | null
  model?: string
  prompt?: string
  handlerType?: string
  enabled?: boolean
  isDefault?: boolean
}

/** Whitelists the fields a client may set, so nothing else can be injected. */
export function readBotInput(body: Record<string, unknown>): BotInput {
  const input: BotInput = {}

  if (typeof body.name === 'string') input.name = body.name
  if (typeof body.provider === 'string' && PROVIDERS.includes(body.provider)) {
    input.provider = body.provider
  }
  if (typeof body.model === 'string') input.model = body.model
  if (typeof body.prompt === 'string') input.prompt = body.prompt
  if (typeof body.handlerType === 'string' && HANDLER_TYPES.includes(body.handlerType)) {
    input.handlerType = body.handlerType
  }
  if (typeof body.enabled === 'boolean') input.enabled = body.enabled
  if (typeof body.isDefault === 'boolean') input.isDefault = body.isDefault

  // A blank key from the edit form means "keep what is stored".
  if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 0) {
    input.apiKey = body.apiKey.trim()
  } else if (body.apiKey === null) {
    input.apiKey = null
  }

  return input
}

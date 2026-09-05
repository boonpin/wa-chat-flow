import { db } from '@/lib/db'
import { botTools, type aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type Bot = typeof aiBots.$inferSelect

const PROVIDERS = ['openai', 'gemini']
const HANDLER_TYPES = ['direct', 'external_agent']

/**
 * The stored API key never leaves the server — the client only learns whether
 * one is set, so an existing key cannot be read back out of the dashboard.
 */
export function toPublicBot(bot: Bot) {
  const { apiKey, ...rest } = bot
  return { ...rest, hasApiKey: !!apiKey, toolIds: listToolIds(bot.id) }
}

function listToolIds(botId: string): string[] {
  return db
    .select({ toolId: botTools.toolId })
    .from(botTools)
    .where(eq(botTools.botId, botId))
    .all()
    .map((r) => r.toolId)
}

/**
 * Replaces a bot's tool assignments wholesale.
 *
 * Kept out of `readBotInput` because it writes a different table — the caller
 * applies it after the bot row itself is in place.
 */
export function setBotTools(botId: string, toolIds: string[]): void {
  db.delete(botTools).where(eq(botTools.botId, botId)).run()
  for (const toolId of new Set(toolIds)) {
    db.insert(botTools).values({ botId, toolId }).run()
  }
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
  /** Undefined means "leave assignments alone"; an array replaces them wholesale. */
  toolIds?: string[]
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

  if (Array.isArray(body.toolIds)) {
    input.toolIds = body.toolIds.filter((id): id is string => typeof id === 'string')
  }

  // A blank key from the edit form means "keep what is stored".
  if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 0) {
    input.apiKey = body.apiKey.trim()
  } else if (body.apiKey === null) {
    input.apiKey = null
  }

  return input
}

import { db } from '@/lib/db'
import { aiProviders, botTools, type aiBots } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type Bot = typeof aiBots.$inferSelect

const HANDLER_TYPES = ['direct', 'external_agent']

/**
 * A bot no longer carries a vendor, a key or a model — its AI provider does.
 * The provider's vendor and model are folded in here so the dashboard can
 * describe a bot in one request, but the key itself never leaves the server.
 */
export function toPublicBot(bot: Bot) {
  const provider = bot.providerId
    ? db.select().from(aiProviders).where(eq(aiProviders.id, bot.providerId)).get()
    : undefined

  return {
    ...bot,
    /** Null when the provider row was deleted out from under the bot. */
    providerName: provider?.name ?? null,
    provider: provider?.kind ?? null,
    model: provider?.model ?? null,
    providerEnabled: provider?.enabled ?? null,
    hasApiKey: !!provider?.apiKey,
    toolIds: listToolIds(bot.id),
  }
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
  /** The AI provider row this bot answers through. */
  providerId?: string
  prompt?: string
  handlerType?: string
  enabled?: boolean
  isDefault?: boolean
  /** Undefined means "leave assignments alone"; an array replaces them wholesale. */
  toolIds?: string[]
}

export interface BotInputResult {
  input: BotInput
  error?: string
}

/** Whitelists the fields a client may set, so nothing else can be injected. */
export function readBotInput(body: Record<string, unknown>): BotInputResult {
  const input: BotInput = {}

  if (typeof body.name === 'string') input.name = body.name
  if (typeof body.prompt === 'string') input.prompt = body.prompt
  if (typeof body.handlerType === 'string' && HANDLER_TYPES.includes(body.handlerType)) {
    input.handlerType = body.handlerType
  }
  if (typeof body.enabled === 'boolean') input.enabled = body.enabled
  if (typeof body.isDefault === 'boolean') input.isDefault = body.isDefault

  if (Array.isArray(body.toolIds)) {
    input.toolIds = body.toolIds.filter((id): id is string => typeof id === 'string')
  }

  // Checked here rather than at reply time: a bot saved against a provider that
  // does not exist would only fail once a customer was already waiting.
  if (typeof body.providerId === 'string' && body.providerId) {
    const provider = db.select().from(aiProviders).where(eq(aiProviders.id, body.providerId)).get()
    if (!provider) return { input, error: 'The selected AI provider no longer exists' }
    input.providerId = body.providerId
  }

  return { input }
}

import { DirectAIHandler } from './direct-handler'
import type { AIHandler, Bot } from './types'

const directHandler = new DirectAIHandler()

/**
 * Resolves the handler a bot should run through.
 *
 * `direct` is the only implementation today. When the Agent Runtime lands, add
 * an `external_agent` branch here — nothing upstream of this function changes.
 */
export function resolveHandler(bot: Bot): AIHandler {
  switch (bot.handlerType) {
    case 'direct':
      return directHandler
    case 'external_agent':
      throw new Error(
        `Bot "${bot.name}" is set to external_agent, but no Agent Runtime is configured yet.`
      )
    default:
      return directHandler
  }
}

export type { AIHandler, AIInput, AIOutput, Bot, ChatTurn } from './types'

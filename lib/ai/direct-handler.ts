import { generate as generateOpenAI } from './providers/openai'
import { generate as generateGemini } from './providers/gemini'
import type { AIHandler, AIInput, AIOutput } from './types'

/**
 * Calls an LLM provider directly with the bot prompt plus recent conversation
 * history. No knowledge base, no retrieval — the bot prompt is the whole
 * business context, which is what an SME actually maintains.
 */
export class DirectAIHandler implements AIHandler {
  async reply(input: AIInput): Promise<AIOutput> {
    switch (input.bot.provider) {
      case 'openai':
        return { text: await generateOpenAI(input) }
      case 'gemini':
        return { text: await generateGemini(input) }
      default:
        throw new Error(`Unknown AI provider: ${input.bot.provider}`)
    }
  }
}

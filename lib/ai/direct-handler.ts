import * as openai from './providers/openai'
import * as gemini from './providers/gemini'
import type { ProviderRequest, ProviderResponse, ProviderTurn } from './providers/types'
import type { AIHandler, AIInput, AIOutput } from './types'
import { executeTool } from '@/lib/tools/runner'
import type { ToolContext, ToolRun } from '@/lib/tools/types'

/**
 * Calls an LLM provider directly with the bot prompt plus recent conversation
 * history. No knowledge base, no retrieval — the bot prompt is the whole
 * business context, which is what an SME actually maintains.
 *
 * When the bot has tools attached, this also owns the tool loop: ask the model,
 * run whatever it asked for, feed the results back, ask again. Providers stay
 * dumb translators; the loop lives here so both behave identically.
 */

/**
 * How many times the model may call tools before we insist on a text answer.
 *
 * A customer is waiting on every round, and a model stuck on a failing tool
 * would otherwise loop until the request times out. Three is enough for the
 * realistic case — capture, read the error, capture again.
 */
const MAX_TOOL_ROUNDS = 3

interface Provider {
  generate(req: ProviderRequest): Promise<ProviderResponse>
  resolveApiKey(input: AIInput): string
}

const PROVIDERS: Record<string, Provider> = { openai, gemini }

export class DirectAIHandler implements AIHandler {
  async reply(input: AIInput): Promise<AIOutput> {
    const provider = PROVIDERS[input.bot.provider]
    if (!provider) throw new Error(`Unknown AI provider: ${input.bot.provider}`)

    const turns: ProviderTurn[] = [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content }) as ProviderTurn),
      { role: 'user', content: input.message },
    ]

    const base = {
      prompt: input.bot.prompt,
      model: input.bot.model,
      apiKey: provider.resolveApiKey(input),
      ...(input.tools?.length ? { tools: input.tools } : {}),
    }

    const runs: ToolRun[] = []

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // On the final round, drop the tools entirely: the model has spent its
      // budget and must now answer the customer in words.
      const exhausted = round === MAX_TOOL_ROUNDS
      const response = await provider.generate({
        ...base,
        turns,
        ...(exhausted ? { tools: undefined } : {}),
      })

      if (response.kind === 'text') return { text: response.text, toolRuns: runs }

      turns.push({ role: 'assistant_tool_calls', calls: response.calls })

      for (const call of response.calls) {
        const result = await executeTool(call, toToolContext(input))
        runs.push({ call, result })
        turns.push({
          role: 'tool_result',
          callId: call.id,
          name: call.name,
          content: result.ok ? result.message : `Error: ${result.error}`,
        })
      }
    }

    // Unreachable: the last round runs without tools, so it must return text.
    return { text: '', toolRuns: runs }
  }
}

function toToolContext(input: AIInput): ToolContext {
  return {
    conversationId: input.conversationId,
    contactId: input.contactId,
    contact: input.contact,
  }
}

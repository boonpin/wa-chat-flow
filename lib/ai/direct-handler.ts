import { getProviderModule } from './providers'
import type { ProviderResponse, ProviderTurn } from './providers/types'
import { resolveConnection, type BotConnection } from './connection'
import { ZERO_USAGE, addUsage, recordUsage } from './usage'
import type { AIHandler, AIInput, AIOutput } from './types'
import { executeTool } from '@/lib/tools/runner'
import type { ToolContext, ToolRun } from '@/lib/tools/types'

/**
 * Calls an LLM provider directly with the bot prompt plus recent conversation
 * history. No knowledge base, no retrieval — the bot prompt is the whole
 * business context, which is what an SME actually maintains.
 *
 * The vendor, key and model all come from the bot's AI provider row, resolved
 * once per reply (`resolveConnection`) so every round of the loop bills the
 * same account and the ledger has something to attribute tokens to.
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

export class DirectAIHandler implements AIHandler {
  async reply(input: AIInput): Promise<AIOutput> {
    const connection = resolveConnection(input.bot)
    const provider = getProviderModule(connection.kind)

    const turns: ProviderTurn[] = [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content }) as ProviderTurn),
      { role: 'user', content: input.message },
    ]

    const base = {
      prompt: input.bot.prompt,
      model: connection.model,
      apiKey: connection.apiKey,
      ...(input.tools?.length ? { tools: input.tools } : {}),
    }

    const runs: ToolRun[] = []
    let usage = ZERO_USAGE

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // On the final round, drop the tools entirely: the model has spent its
      // budget and must now answer the customer in words.
      const exhausted = round === MAX_TOOL_ROUNDS
      const response = await this.call(
        () => provider.generate({ ...base, turns, ...(exhausted ? { tools: undefined } : {}) }),
        { connection, input, round }
      )

      usage = addUsage(usage, response.usage)

      if (response.kind === 'text') {
        return { text: response.text, toolRuns: runs, usage, connection }
      }

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
    return { text: '', toolRuns: runs, usage, connection }
  }

  /**
   * One API call, always leaving a ledger row behind.
   *
   * The failure path records too: a call that was rejected still tells the
   * operator which account and model the bot is failing on, and a rate limit
   * looks nothing like a bad key in the log.
   */
  private async call(
    send: () => Promise<ProviderResponse>,
    meta: { connection: BotConnection; input: AIInput; round: number }
  ): Promise<ProviderResponse> {
    const startedAt = Date.now()
    const base = {
      connection: meta.connection,
      botId: meta.input.bot.id,
      conversationId: meta.input.conversationId,
      round: meta.round,
    }

    try {
      const response = await send()
      const id = recordUsage({ ...base, usage: response.usage, latencyMs: Date.now() - startedAt })
      if (id) meta.input.usageSink?.push(id)
      return response
    } catch (err) {
      // Collected too: the failed round is still linked to the reply it was
      // part of, so a thread that eventually answered shows what it cost to.
      const id = recordUsage({
        ...base,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      })
      if (id) meta.input.usageSink?.push(id)
      throw err
    }
  }
}

function toToolContext(input: AIInput): ToolContext {
  return {
    conversationId: input.conversationId,
    contactId: input.contactId,
    contact: input.contact,
  }
}

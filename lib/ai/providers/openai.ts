import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { aiKeys } from '@/lib/config'
import type { ProviderRequest, ProviderResponse, ProviderTurn } from './types'
import type { ToolDefinition } from '@/lib/tools/types'
import type { AIInput } from '../types'

export function resolveApiKey(input: AIInput): string {
  const apiKey = input.bot.apiKey || aiKeys.openai
  if (!apiKey) {
    throw new Error('No OpenAI API key configured (set OPENAI_API_KEY or store one on the bot)')
  }
  return apiKey
}

export async function generate(req: ProviderRequest): Promise<ProviderResponse> {
  const client = new OpenAI({ apiKey: req.apiKey })

  const response = await client.chat.completions.create({
    model: req.model || 'gpt-4o-mini',
    messages: [{ role: 'system', content: req.prompt }, ...req.turns.flatMap(toMessages)],
    ...(req.tools?.length ? { tools: req.tools.map(toTool) } : {}),
  })

  const choice = response.choices[0]?.message
  const calls = choice?.tool_calls ?? []

  if (calls.length > 0) {
    return {
      kind: 'tool_calls',
      calls: calls.flatMap((call) =>
        call.type === 'function'
          ? [{ id: call.id, name: call.function.name, args: parseArgs(call.function.arguments) }]
          : []
      ),
    }
  }

  return { kind: 'text', text: choice?.content?.trim() || '' }
}

function toTool(tool: ToolDefinition): ChatCompletionTool {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }
}

function toMessages(turn: ProviderTurn): ChatCompletionMessageParam[] {
  switch (turn.role) {
    case 'user':
      return [{ role: 'user', content: turn.content }]
    case 'assistant':
      return [{ role: 'assistant', content: turn.content }]
    case 'assistant_tool_calls':
      return [
        {
          role: 'assistant',
          content: null,
          tool_calls: turn.calls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: JSON.stringify(call.args) },
          })),
        },
      ]
    case 'tool_result':
      return [{ role: 'tool', tool_call_id: turn.callId, content: turn.content }]
  }
}

/** A model can emit malformed JSON arguments; validation downstream catches it. */
function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

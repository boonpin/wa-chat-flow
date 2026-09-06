import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ModelChoice, ProviderRequest, ProviderResponse, ProviderTurn, TokenUsage } from './types'
import type { ToolDefinition } from '@/lib/tools/types'

export async function generate(req: ProviderRequest): Promise<ProviderResponse> {
  const client = new OpenAI({ apiKey: req.apiKey })

  const response = await client.chat.completions.create({
    model: req.model || 'gpt-4o-mini',
    messages: [{ role: 'system', content: req.prompt }, ...req.turns.flatMap(toMessages)],
    ...(req.tools?.length ? { tools: req.tools.map(toTool) } : {}),
  })

  const choice = response.choices[0]?.message
  const calls = choice?.tool_calls ?? []

  const usage = toUsage(response.usage)

  if (calls.length > 0) {
    return {
      kind: 'tool_calls',
      usage,
      calls: calls.flatMap((call) =>
        call.type === 'function'
          ? [{ id: call.id, name: call.function.name, args: parseArgs(call.function.arguments) }]
          : []
      ),
    }
  }

  return { kind: 'text', usage, text: choice?.content?.trim() || '' }
}

/**
 * The models this key can reach, filtered to the ones worth offering.
 *
 * `/v1/models` returns the whole catalogue — embeddings, speech, images — and a
 * dropdown of those would be a list of ways to break the bot. The filter is a
 * denylist rather than an allowlist so a model released tomorrow still shows up.
 */
export async function listModels(apiKey: string): Promise<ModelChoice[]> {
  const client = new OpenAI({ apiKey })
  const page = await client.models.list()

  return page.data
    .map((model) => model.id)
    .filter(isChatModel)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id }))
}

const NON_CHAT = [
  'embedding',
  'whisper',
  'tts',
  'dall-e',
  'moderation',
  'audio',
  'image',
  'realtime',
  'transcribe',
  'search',
  'sora',
  'codex',
  'babbage',
  'davinci',
]

function isChatModel(id: string): boolean {
  return !NON_CHAT.some((fragment) => id.includes(fragment))
}

function toUsage(usage: OpenAI.Completions.CompletionUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
  }
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

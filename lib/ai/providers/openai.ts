import OpenAI, { toFile } from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type {
  DescribeRequest,
  DescribeResponse,
  ModelCapability,
  ModelChoice,
  ProviderRequest,
  ProviderResponse,
  ProviderTurn,
  TokenUsage,
} from './types'
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
 * Describes images in one call.
 *
 * Images ride as `data:` URIs, which the API accepts as a first-class input.
 * Nothing is uploaded anywhere and no URL is published — the customer's photo
 * goes straight from our disk into the request body.
 */
export async function describeImages(req: DescribeRequest): Promise<DescribeResponse> {
  const client = new OpenAI({ apiKey: req.apiKey })

  const response = await client.chat.completions.create({
    model: req.model,
    messages: [
      { role: 'system', content: req.prompt },
      {
        role: 'user',
        content: [
          ...(req.text ? [{ type: 'text' as const, text: `Caption: ${req.text}` }] : []),
          ...req.media.map((part) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${part.mimeType};base64,${part.data}` },
          })),
        ],
      },
    ],
  })

  return {
    text: response.choices[0]?.message?.content?.trim() || '',
    usage: toUsage(response.usage),
  }
}

/**
 * Transcribes a voice note through the dedicated speech endpoint.
 *
 * Deliberately not a chat call with audio attached: this route is cheaper, is
 * built for the job, and returns the words rather than an interpretation of
 * them. The cost is that it reports no token counts — the ledger row lands with
 * zeroes and `status = 'ok'`, which is a successful call that simply cannot be
 * priced from tokens, not a call that did nothing.
 */
export async function transcribeAudio(req: DescribeRequest): Promise<DescribeResponse> {
  const client = new OpenAI({ apiKey: req.apiKey })
  const part = req.media[0]
  if (!part) return { text: '' }

  const file = await toFile(Buffer.from(part.data, 'base64'), `voice.${extensionFor(part.mimeType)}`, {
    type: part.mimeType,
  })

  const result = await client.audio.transcriptions.create({ file, model: req.model })
  return { text: (result.text ?? '').trim() }
}

/**
 * The models this key can reach, filtered to the ones worth offering.
 *
 * `/v1/models` returns the whole catalogue — embeddings, speech, images — and a
 * dropdown of those would be a list of ways to break the bot. The chat filter is
 * a denylist rather than an allowlist so a model released tomorrow still shows
 * up; the speech filter has to be an allowlist, because "can this transcribe?"
 * is not something an id reliably says.
 *
 * Images share the chat list: seeing is something OpenAI's conversational
 * models do, not a separate class of model.
 */
export async function listModels(
  apiKey: string,
  capability: ModelCapability = 'text'
): Promise<ModelChoice[]> {
  const client = new OpenAI({ apiKey })
  const page = await client.models.list()

  const matches = capability === 'voice' ? isSpeechModel : isChatModel

  return page.data
    .map((model) => model.id)
    .filter(matches)
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

function isSpeechModel(id: string): boolean {
  return id.includes('whisper') || id.includes('transcribe')
}

/**
 * The speech endpoint rejects a file whose name has no extension it recognises,
 * and WhatsApp voice notes arrive as `audio/ogg; codecs=opus`.
 */
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/flac': 'flac',
}

function extensionFor(mimeType: string): string {
  return AUDIO_EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()] ?? 'ogg'
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

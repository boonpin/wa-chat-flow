import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type Schema,
} from '@google/generative-ai'
import type { ModelChoice, ProviderRequest, ProviderResponse, ProviderTurn, TokenUsage } from './types'
import type { JsonSchemaProperty, ToolDefinition } from '@/lib/tools/types'

export async function generate(req: ProviderRequest): Promise<ProviderResponse> {
  const genAI = new GoogleGenerativeAI(req.apiKey)
  const model = genAI.getGenerativeModel({
    model: req.model || 'gemini-1.5-flash',
    systemInstruction: req.prompt,
    ...(req.tools?.length
      ? { tools: [{ functionDeclarations: req.tools.map(toFunctionDeclaration) }] }
      : {}),
  })

  // Gemini requires the conversation to start with a user turn.
  const contents = trimToUserStart(req.turns.map(toContent))

  const result = await model.generateContent({ contents })
  const calls = result.response.functionCalls() ?? []
  const usage = toUsage(result.response.usageMetadata)

  if (calls.length > 0) {
    return {
      kind: 'tool_calls',
      usage,
      calls: calls.map((call, i) => ({
        // Gemini has no call ids, but the loop and the OpenAI format both need
        // one, so mint a deterministic one per round.
        id: `${call.name}_${i}`,
        name: call.name,
        args: (call.args ?? {}) as Record<string, unknown>,
      })),
    }
  }

  return { kind: 'text', usage, text: result.response.text().trim() }
}

/**
 * The models this key can reach that can actually hold a conversation.
 *
 * Plain `fetch` rather than the SDK: `@google/generative-ai` exposes no model
 * listing, and this file is already the only one allowed to know Gemini's wire
 * format. Embedding and vision-only models are excluded by asking Google which
 * ones support `generateContent` rather than by guessing from the name.
 */
export async function listModels(apiKey: string): Promise<ModelChoice[]> {
  const models: ModelChoice[] = []
  let pageToken: string | undefined

  // The list is paginated at 50 by default and there are more than 50 models.
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    const body = (await response.json().catch(() => ({}))) as GeminiModelList

    if (!response.ok) {
      throw new Error(body.error?.message || `Google returned HTTP ${response.status}`)
    }

    for (const model of body.models ?? []) {
      if (!model.supportedGenerationMethods?.includes('generateContent')) continue
      // Google returns "models/gemini-2.0-flash"; the SDK wants the bare id.
      const id = model.name.replace(/^models\//, '')
      models.push({ id, label: model.displayName ? `${model.displayName} (${id})` : id })
    }

    pageToken = body.nextPageToken
  } while (pageToken)

  return models.sort((a, b) => a.id.localeCompare(b.id))
}

interface GeminiModelList {
  models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]
  nextPageToken?: string
  error?: { message?: string }
}

function toUsage(
  metadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined
): TokenUsage | undefined {
  if (!metadata) return undefined
  const inputTokens = metadata.promptTokenCount ?? 0
  const outputTokens = metadata.candidatesTokenCount ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: metadata.totalTokenCount ?? inputTokens + outputTokens,
  }
}

function toContent(turn: ProviderTurn): Content {
  switch (turn.role) {
    case 'user':
      return { role: 'user', parts: [{ text: turn.content }] }
    case 'assistant':
      return { role: 'model', parts: [{ text: turn.content }] }
    case 'assistant_tool_calls':
      return {
        role: 'model',
        parts: turn.calls.map((call) => ({
          functionCall: { name: call.name, args: call.args },
        })),
      }
    case 'tool_result':
      // Tool results are a 'function' role in Gemini, not 'user'.
      return {
        role: 'function',
        parts: [{ functionResponse: { name: turn.name, response: { result: turn.content } } }],
      }
  }
}

function toFunctionDeclaration(tool: ToolDefinition): FunctionDeclaration {
  const properties: Record<string, Schema> = {}
  for (const [name, property] of Object.entries(tool.parameters.properties)) {
    properties[name] = toSchema(property)
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties,
      required: tool.parameters.required,
    } as FunctionDeclarationSchema,
  }
}

function toSchema(property: JsonSchemaProperty): Schema {
  return {
    type: property.type === 'number' ? SchemaType.NUMBER : SchemaType.STRING,
    ...(property.description ? { description: property.description } : {}),
    ...(property.enum ? { format: 'enum', enum: property.enum } : {}),
  } as Schema
}

/**
 * Drops leading model turns. History that begins mid-exchange — the first
 * customer message having scrolled out of the window — is rejected outright by
 * Gemini, so trim rather than let the call fail.
 */
function trimToUserStart(contents: Content[]): Content[] {
  const firstUser = contents.findIndex((c) => c.role === 'user')
  return firstUser === -1 ? [] : contents.slice(firstUser)
}

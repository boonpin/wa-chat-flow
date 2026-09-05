import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type Schema,
} from '@google/generative-ai'
import { aiKeys } from '@/lib/config'
import type { ProviderRequest, ProviderResponse, ProviderTurn } from './types'
import type { JsonSchemaProperty, ToolDefinition } from '@/lib/tools/types'
import type { AIInput } from '../types'

export function resolveApiKey(input: AIInput): string {
  const apiKey = input.bot.apiKey || aiKeys.gemini
  if (!apiKey) {
    throw new Error('No Gemini API key configured (set GEMINI_API_KEY or store one on the bot)')
  }
  return apiKey
}

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

  if (calls.length > 0) {
    return {
      kind: 'tool_calls',
      calls: calls.map((call, i) => ({
        // Gemini has no call ids, but the loop and the OpenAI format both need
        // one, so mint a deterministic one per round.
        id: `${call.name}_${i}`,
        name: call.name,
        args: (call.args ?? {}) as Record<string, unknown>,
      })),
    }
  }

  return { kind: 'text', text: result.response.text().trim() }
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

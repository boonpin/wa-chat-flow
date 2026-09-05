import type { ToolCall, ToolDefinition } from '@/lib/tools/types'

/**
 * The neutral message list a provider is asked to complete.
 *
 * Plain history (`ChatTurn`) is not enough once tools are in play: a tool round
 * has to feed the assistant's *call* and the tool's *result* back into the next
 * request, and both providers insist on seeing them in order. This is that
 * shape, and each provider translates it to its own wire format.
 */
export type ProviderTurn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'assistant_tool_calls'; calls: ToolCall[] }
  | { role: 'tool_result'; callId: string; name: string; content: string }

export interface ProviderRequest {
  /** System prompt. */
  prompt: string
  model: string
  apiKey: string
  turns: ProviderTurn[]
  /** Omitted entirely when the bot has no tools, so behaviour is unchanged. */
  tools?: ToolDefinition[]
}

/**
 * Either the model answered, or it wants tools run first. Never both — both
 * SDKs can technically return text alongside calls, but mixing them would send
 * the customer a half-answer, so providers drop text when calls are present.
 */
export type ProviderResponse =
  | { kind: 'text'; text: string }
  | { kind: 'tool_calls'; calls: ToolCall[] }

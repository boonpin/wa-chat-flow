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
 * What one API call cost, as the vendor reported it.
 *
 * `totalTokens` is carried separately rather than summed: vendors count
 * reasoning and cached tokens that never appear in the input/output split, and
 * a bill reconciles against their number, not ours.
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * Either the model answered, or it wants tools run first. Never both — both
 * SDKs can technically return text alongside calls, but mixing them would send
 * the customer a half-answer, so providers drop text when calls are present.
 *
 * `usage` rides along on both: every call is billed, including the ones that
 * only asked for a tool. It is optional because a vendor can omit the block,
 * and a missing count must not cost us the reply.
 */
export type ProviderResponse = ({ kind: 'text'; text: string } | { kind: 'tool_calls'; calls: ToolCall[] }) & {
  usage?: TokenUsage
}

/** One entry of a vendor's model list, as offered in the provider form. */
export interface ModelChoice {
  id: string
  /** Human-facing name where the vendor supplies one; otherwise the id. */
  label: string
}

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

/**
 * Which job a model is being picked for. The three lists differ: a vendor's
 * chat models cannot transcribe audio, and its transcription models cannot hold
 * a conversation, so one catalogue filtered one way would offer an operator a
 * menu of ways to break the bot.
 *
 * Defined in `provider-kinds` so the dashboard can name one without importing
 * anything that would pull a vendor SDK into the browser.
 */
export type { ModelCapability } from '../provider-kinds'

/**
 * One attachment, ready to hand to a vendor.
 *
 * Bytes rather than a URL, always. Both vendors accept inline base64, and the
 * alternative — publishing a customer's bank statement to somewhere a third
 * party can fetch it — is a worse answer to an easier problem.
 */
export interface MediaPart {
  mimeType: string
  /** base64, without a `data:` prefix. */
  data: string
}

/**
 * A request to turn attachments into words, so the text model can read them.
 *
 * Not a `ProviderRequest`: there is no history, no tools and no conversation —
 * this is one question about one set of files, and keeping it separate stops
 * the reply path's shape from leaking into it.
 */
export interface DescribeRequest {
  prompt: string
  model: string
  apiKey: string
  media: MediaPart[]
  /** The caption the customer sent with it, when there was one. */
  text?: string
}

export interface DescribeResponse {
  text: string
  /**
   * Optional because not every route reports it — a transcription endpoint
   * bills by audio duration and returns no token counts at all, which is why
   * the ledger has to tolerate a row of zeroes that is not a failure.
   */
  usage?: TokenUsage
}

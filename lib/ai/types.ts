import type { aiBots } from '@/lib/db/schema'
import type { ToolDefinition, ToolRun } from '@/lib/tools/types'
import type { TokenUsage } from './providers/types'
import type { BotConnection } from './connection'
import type { Channel } from '@/lib/channel/types'

export type Bot = typeof aiBots.$inferSelect

/** One turn of remembered conversation. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AIInput {
  bot: Bot
  /** Oldest → newest. Excludes the message currently being answered. */
  history: ChatTurn[]
  /** The message to reply to. */
  message: string
  contact: { name: string | null; phone: string }
  /**
   * The surface this reply is going to. The handler tells the model, so the
   * answer is shaped for a phone screen before anything has to reformat it.
   */
  channel?: Channel
  /**
   * Whether anything in this conversation reached the model as an attachment
   * note rather than as typed words.
   *
   * It gates the paragraph explaining the `[Photo] …` convention. Sent only
   * when it applies, because a bot that never sees an image should not be
   * carrying instructions about images in every prompt — and a model told about
   * a notation it never encounters is a model liable to invent one.
   */
  hasMedia?: boolean
  conversationId: string
  contactId: string
  /** Tools this bot may call. Omitted or empty = plain completion, as before. */
  tools?: ToolDefinition[]
  /**
   * Where the handler records the ledger rows it writes, appended as it goes.
   *
   * A collector rather than a return value because a reply that throws still
   * spent tokens, and the caller still writes a message row for the failure —
   * so the ids have to survive the exception to be linked to it.
   */
  usageSink?: string[]
}

export interface AIOutput {
  text: string
  /** What the model ran and how each went, so the caller can leave an audit trail. */
  toolRuns?: ToolRun[]
  /**
   * Tokens across every API call this reply took. The per-call rows are already
   * in `ai_usage` — this is the summary, for logging the cost of one answer.
   */
  usage?: TokenUsage
  /** Which AI account answered. Absent for a handler that does not call an LLM. */
  connection?: BotConnection
}

/**
 * Anything that can produce a reply. `DirectAIHandler` calls an LLM straight;
 * a future `AgentRuntimeHandler` will forward to the Agent Runtime with its own
 * RAG, tools and memory. Swapping one for the other is a bot setting.
 */
export interface AIHandler {
  reply(input: AIInput): Promise<AIOutput>
}

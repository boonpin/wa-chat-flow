import type { aiBots } from '@/lib/db/schema'
import type { ToolDefinition, ToolRun } from '@/lib/tools/types'

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
  conversationId: string
  contactId: string
  /** Tools this bot may call. Omitted or empty = plain completion, as before. */
  tools?: ToolDefinition[]
}

export interface AIOutput {
  text: string
  /** What the model ran and how each went, so the caller can leave an audit trail. */
  toolRuns?: ToolRun[]
}

/**
 * Anything that can produce a reply. `DirectAIHandler` calls an LLM straight;
 * a future `AgentRuntimeHandler` will forward to the Agent Runtime with its own
 * RAG, tools and memory. Swapping one for the other is a bot setting.
 */
export interface AIHandler {
  reply(input: AIInput): Promise<AIOutput>
}

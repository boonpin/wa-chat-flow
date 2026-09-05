import { listMessages } from '@/lib/conversation/service'
import type { ChatTurn } from './types'

/** How many prior messages the bot remembers. Keeps prompts small and cheap. */
export const HISTORY_LIMIT = 20

/**
 * Builds conversation memory from stored messages.
 *
 * Only delivered text counts: failed sends and non-text media would otherwise
 * teach the model that it said things the customer never saw.
 */
export function buildHistory(conversationId: string, excludeMessageId?: string): ChatTurn[] {
  return listMessages(conversationId, HISTORY_LIMIT + 1)
    .filter((m) => m.id !== excludeMessageId)
    .filter((m) => m.messageType === 'text' && m.content.trim().length > 0)
    .filter((m) => m.direction === 'incoming' || m.status === 'sent')
    .slice(-HISTORY_LIMIT)
    .map((m) => ({
      role: m.direction === 'incoming' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))
}

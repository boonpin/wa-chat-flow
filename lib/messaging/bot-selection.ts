import { db } from '@/lib/db'
import { aiBots } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { Bot } from '@/lib/ai/types'

/**
 * Picks the bot that should answer, most specific binding first:
 * conversation → contact → system default → the bot flagged as default.
 * Disabled bots are never selected.
 */
export function selectBot(input: {
  conversationBotId?: string | null
  contactBotId?: string | null
  settingsDefaultBotId?: string | null
}): Bot | null {
  for (const id of [input.conversationBotId, input.contactBotId, input.settingsDefaultBotId]) {
    if (!id) continue
    const bot = db
      .select()
      .from(aiBots)
      .where(and(eq(aiBots.id, id), eq(aiBots.enabled, true)))
      .get()
    if (bot) return bot
  }

  return (
    db
      .select()
      .from(aiBots)
      .where(and(eq(aiBots.isDefault, true), eq(aiBots.enabled, true)))
      .get() ?? null
  )
}

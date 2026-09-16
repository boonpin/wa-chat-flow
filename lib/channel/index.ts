import { whatsAppFormatter } from './whatsapp'
import type { Channel, ChannelFormatter } from './types'

/**
 * The single place the application resolves how a reply is written for the
 * surface it is going to.
 *
 * Total by construction rather than falling back on a default: adding a channel
 * to the `Channel` union fails the build here until someone has written its
 * formatter, which is better than silently delivering Markdown to it.
 */
const FORMATTERS: Record<Channel, ChannelFormatter> = {
  whatsapp: whatsAppFormatter,
}

/**
 * Rewrites model-authored Markdown into `channel`'s markup.
 *
 * Never throws. A formatter is cosmetic in the same way `setTyping` is — losing
 * the conversion is a reply that reads badly, while throwing is a reply the
 * customer never gets, so a broken rule falls back to the text it was handed.
 */
export function formatForChannel(channel: Channel, text: string): string {
  try {
    // A reply that is nothing but a horizontal rule would otherwise flatten to
    // an empty body, which the transport rejects outright.
    return FORMATTERS[channel].render(text) || text
  } catch (err) {
    console.warn(`[channel] Could not format for ${channel}:`, err instanceof Error ? err.message : err)
    return text
  }
}

/**
 * The line appended to a bot's prompt so the model writes for `channel` in the
 * first place.
 *
 * `formatForChannel` is the guarantee and this is the damper: a model told it
 * is on WhatsApp mostly stops reaching for tables, and the rows that never get
 * written never have to be flattened.
 */
export function channelGuidance(channel: Channel): string {
  return FORMATTERS[channel].guidance
}

export type { Channel, ChannelFormatter } from './types'

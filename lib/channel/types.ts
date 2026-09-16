/**
 * The surface a message is rendered on.
 *
 * This is not the same thing as the vendor that carries it. Swapping WAHA for
 * the Meta Cloud API changes the transport and keeps WhatsApp's markup; adding
 * Telegram would change the markup while the transport question stays open. So
 * `WhatsAppProvider.name` (the vendor, and the namespace the deduplication
 * index is keyed on) and `WhatsAppProvider.channel` are deliberately separate.
 */
export type Channel = 'whatsapp'

/**
 * Rewrites one model-authored reply into a channel's own markup.
 *
 * `WhatsAppFormatter` is the only implementation today. A channel that renders
 * real Markdown would implement this as the identity function — the point of
 * the seam is that nothing upstream has to know which it got.
 */
export interface ChannelFormatter {
  render(markdown: string): string

  /**
   * The line appended to a bot's prompt so the model aims at this channel in
   * the first place. `render` is the guarantee; this is what keeps a model from
   * reaching for a three-column table before the guarantee has to earn its keep.
   */
  readonly guidance: string
}

/**
 * Normalizes a phone number to bare digits (no +, spaces or punctuation).
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Converts a bare phone number to a WhatsApp chat id. */
export function toChatId(phone: string): string {
  const digits = normalizePhone(phone)
  return `${digits}@c.us`
}

/** Extracts the bare phone number from a WhatsApp chat id. */
export function fromChatId(chatId: string): string {
  return normalizePhone(chatId.split('@')[0] ?? '')
}

/** Group chats are ignored throughout the app. */
export function isGroupChat(chatId: string): boolean {
  return chatId.endsWith('@g.us')
}

/**
 * True for a one-to-one chat addressed directly by phone number.
 */
export function isIndividualChat(chatId: string): boolean {
  return chatId.endsWith('@c.us')
}

/**
 * True for WhatsApp's linked-identity addressing.
 *
 * A `@lid` chat id is a real person, but its digits are an opaque identifier —
 * NOT a phone number. Using them as one stores a bogus contact and sends
 * replies into the void, so a LID must be resolved to its phone number before
 * the message is processed.
 */
export function isLidChat(chatId: string): boolean {
  return chatId.endsWith('@lid')
}

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

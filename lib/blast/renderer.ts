/**
 * Renders a message template by replacing {{variable}} placeholders.
 * Missing variables are left as-is.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`
  })
}

/**
 * Normalizes a phone number to the format required by whatsapp-web.js.
 * Strips non-digit characters, returns bare number (caller appends @c.us).
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

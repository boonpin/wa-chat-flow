/**
 * Renders a message template by replacing {{variable}} placeholders.
 * Missing variables are left as-is.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`
  })
}

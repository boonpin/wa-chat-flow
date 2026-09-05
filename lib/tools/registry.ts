import { db } from '@/lib/db'
import { botTools, tools } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { JsonSchemaProperty, ToolDefinition, ToolField, ToolRow } from './types'

/**
 * Turns configured tool rows into the definitions an LLM can be handed.
 *
 * This is the only module the AI layer imports. Nothing upstream knows that a
 * tool is a database row, that its sink is Apps Script, or that its arguments
 * came from an SME-edited field list.
 */

/** Tools a bot is allowed to call. Empty means the bot behaves exactly as before. */
export function listToolsForBot(botId: string): ToolRow[] {
  return db
    .select({ tool: tools })
    .from(botTools)
    .innerJoin(tools, eq(botTools.toolId, tools.id))
    .where(and(eq(botTools.botId, botId), eq(tools.enabled, true)))
    .all()
    .map((r) => r.tool)
}

export function resolveTools(botId: string): ToolDefinition[] {
  return listToolsForBot(botId).map(toDefinition)
}

export function getTool(id: string): ToolRow | undefined {
  return db.select().from(tools).where(eq(tools.id, id)).get()
}

export function getToolByName(name: string): ToolRow | undefined {
  return db.select().from(tools).where(eq(tools.name, name)).get()
}

/** Stored `fields` is JSON text. Bad JSON degrades to no fields, never a crash. */
export function parseFields(raw: string): ToolField[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ToolField[]) : []
  } catch {
    return []
  }
}

/** Config row → the JSON Schema function definition the model sees. */
export function toDefinition(tool: ToolRow): ToolDefinition {
  const fields = parseFields(tool.fields)
  const properties: Record<string, JsonSchemaProperty> = {}

  for (const field of fields) {
    const property: JsonSchemaProperty = {
      type: field.type === 'number' ? 'number' : 'string',
    }
    if (field.description) property.description = field.description
    if (field.type === 'enum' && field.options?.length) property.enum = field.options
    properties[field.name] = property
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required: fields.filter((f) => f.required).map((f) => f.name),
    },
  }
}

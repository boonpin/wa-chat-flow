import type { tools } from '@/lib/db/schema'
import type { ToolField } from '@/lib/tools/types'

type Tool = typeof tools.$inferSelect

const KINDS = ['sheet_capture']
const SINK_TYPES = ['apps_script']
const FIELD_TYPES = ['string', 'number', 'enum']

/** LLM function names must be a safe identifier — both providers reject the rest. */
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/

/**
 * The Apps Script URL and its shared token are write-only, exactly like a bot
 * API key: together they are the credential that can write to the sheet, so
 * neither is ever sent to the browser.
 */
export function toPublicTool(tool: Tool) {
  const { sinkUrl, sinkSecret, fields, ...rest } = tool
  return {
    ...rest,
    hasSinkUrl: !!sinkUrl,
    hasSinkSecret: !!sinkSecret,
    fields: parseFields(fields),
  }
}

function parseFields(raw: string): ToolField[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export interface ToolInput {
  name?: string
  kind?: string
  description?: string
  sinkType?: string
  /** Undefined means "leave unchanged"; null means "clear it". */
  sinkUrl?: string | null
  sinkSecret?: string | null
  spreadsheetUrl?: string
  sheetTab?: string
  fields?: string
  enabled?: boolean
}

export interface ToolInputResult {
  input: ToolInput
  error?: string
}

/** Whitelists the fields a client may set, so nothing else can be injected. */
export function readToolInput(body: Record<string, unknown>): ToolInputResult {
  const input: ToolInput = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!NAME_PATTERN.test(name)) {
      return {
        input,
        error:
          'name must be lowercase letters, digits and underscores, starting with a letter ' +
          '(e.g. capture_sales_lead)',
      }
    }
    input.name = name
  }

  if (typeof body.kind === 'string' && KINDS.includes(body.kind)) input.kind = body.kind
  if (typeof body.description === 'string') input.description = body.description.trim()
  if (typeof body.sinkType === 'string' && SINK_TYPES.includes(body.sinkType)) {
    input.sinkType = body.sinkType
  }
  if (typeof body.spreadsheetUrl === 'string') input.spreadsheetUrl = body.spreadsheetUrl.trim()
  if (typeof body.sheetTab === 'string' && body.sheetTab.trim()) {
    input.sheetTab = body.sheetTab.trim()
  }
  if (typeof body.enabled === 'boolean') input.enabled = body.enabled

  // Blank from the edit form means "keep what is stored" — same rule as bot keys.
  if (typeof body.sinkUrl === 'string' && body.sinkUrl.trim()) {
    const url = body.sinkUrl.trim()
    if (!/^https:\/\/script\.google\.com\//.test(url)) {
      return { input, error: 'sinkUrl must be a https://script.google.com/... deployment URL' }
    }
    input.sinkUrl = url
  } else if (body.sinkUrl === null) {
    input.sinkUrl = null
  }

  if (typeof body.sinkSecret === 'string' && body.sinkSecret.trim()) {
    input.sinkSecret = body.sinkSecret.trim()
  } else if (body.sinkSecret === null) {
    input.sinkSecret = null
  }

  if (Array.isArray(body.fields)) {
    const validated = validateFields(body.fields)
    if (validated.error) return { input, error: validated.error }
    input.fields = JSON.stringify(validated.fields)
  }

  return { input }
}

function validateFields(raw: unknown[]): { fields: ToolField[]; error?: string } {
  const fields: ToolField[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return { fields, error: 'Each field must be an object' }
    const f = item as Record<string, unknown>

    const name = typeof f.name === 'string' ? f.name.trim() : ''
    if (!NAME_PATTERN.test(name)) {
      return { fields, error: `Field key "${name}" must be lowercase letters, digits and underscores` }
    }
    if (seen.has(name)) return { fields, error: `Duplicate field key: ${name}` }
    seen.add(name)

    const type = typeof f.type === 'string' && FIELD_TYPES.includes(f.type) ? f.type : 'string'
    const options = Array.isArray(f.options)
      ? f.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
      : undefined

    if (type === 'enum' && (!options || options.length === 0)) {
      return { fields, error: `Field "${name}" is an enum but has no options` }
    }

    fields.push({
      name,
      label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : name,
      type: type as ToolField['type'],
      required: f.required === true,
      ...(typeof f.description === 'string' && f.description.trim()
        ? { description: f.description.trim() }
        : {}),
      ...(options?.length ? { options } : {}),
    })
  }

  return { fields }
}

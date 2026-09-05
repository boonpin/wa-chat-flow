import type { tools as toolsTable } from '@/lib/db/schema'

export type ToolRow = typeof toolsTable.$inferSelect

/** Field types an SME can configure. Maps onto JSON Schema for the model. */
export type ToolFieldType = 'string' | 'number' | 'enum'

/**
 * One column of a capture form.
 *
 * A field does three jobs at once: it becomes a property in the JSON Schema the
 * model sees, it is validated server-side before anything is written, and its
 * position fixes the column order in the sheet. Renaming `name` after rows exist
 * will shift columns, so treat it as a stable key.
 */
export interface ToolField {
  /** Machine key. Also the JSON Schema property name. */
  name: string
  /** Column header written to the sheet. */
  label: string
  type: ToolFieldType
  required: boolean
  /** Guidance for the model, e.g. "the product or plan they asked about". */
  description?: string
  /** Allowed values when `type` is 'enum'. */
  options?: string[]
}

/** A tool as the LLM sees it. Providers translate this to their own wire format. */
export interface ToolDefinition {
  name: string
  description: string
  /** JSON Schema (draft-07 subset) describing the arguments. */
  parameters: {
    type: 'object'
    properties: Record<string, JsonSchemaProperty>
    required: string[]
  }
}

export interface JsonSchemaProperty {
  type: 'string' | 'number'
  description?: string
  enum?: string[]
}

/** Everything a tool needs to know about where it was called from. */
export interface ToolContext {
  conversationId: string
  contactId: string
  contact: { name: string | null; phone: string }
}

/**
 * The result handed back to the model.
 *
 * A failure is *not* an exception — it is a normal result the model reads and
 * reacts to. A missing required field comes back as `ok: false` with a message
 * telling the model what to ask the customer for, which is what turns the tool
 * loop into a natural slot-filling conversation with no form-flow code.
 */
export type ToolResult =
  | {
      ok: true
      /** The only field the model sees. */
      message: string
      /** The `tool_invocations` row this wrote, when one was written. */
      invocationId?: string
      /**
       * Set when the details were saved locally but the sheet write failed.
       * Deliberately kept out of `message`: the model must not re-ask the
       * customer for details we already hold. The operator sees it in the log.
       */
      syncError?: string
    }
  | { ok: false; error: string }

/** One tool call and how it went, for the caller's audit trail. */
export interface ToolRun {
  call: ToolCall
  result: ToolResult
}

/** A tool call the model asked for, normalised across providers. */
export interface ToolCall {
  /** Provider-side id, echoed back with the result. Gemini has none; we mint one. */
  id: string
  name: string
  args: Record<string, unknown>
}

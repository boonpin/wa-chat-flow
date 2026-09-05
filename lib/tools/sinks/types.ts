import type { ToolRow } from '../types'

/** One row bound for a sheet, already validated and ordered. */
export interface CaptureRow {
  /** Column header → value, in field order. */
  values: Record<string, string>
  /** Upsert key. A customer who repeats themselves updates one row, not five. */
  conversationId: string
  contactName: string | null
  contactPhone: string
  capturedAt: string
}

export interface SinkResult {
  ok: boolean
  error?: string
  /**
   * Whether a request actually left the app.
   *
   * False means nothing was transmitted at all — a tool with no URL configured,
   * say. That is a different thing from a request that was sent and rejected,
   * and the log has to be able to tell an operator which one happened.
   */
  submitted: boolean
  /**
   * Exactly what was transmitted, with credentials removed.
   *
   * The sink returns this rather than the runner building it, because the wire
   * format is the sink's business — a future Sheets-API sink would send
   * something else entirely and this stays honest about whatever it was.
   */
  payload?: Record<string, unknown>
}

/**
 * Writes a captured row somewhere durable.
 *
 * `AppsScriptSink` is the only implementation today. A service-account sink
 * calling the Sheets API directly slots in behind this same interface — the
 * tool layer never learns which one it got.
 */
export interface CaptureSink {
  append(tool: ToolRow, row: CaptureRow): Promise<SinkResult>
}

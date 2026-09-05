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

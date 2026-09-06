'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Badge,
  Banner,
  Button,
  CaptureStatusBadge,
  Disclosure,
  ExternalLinkIcon,
  KeyValues,
  LinkButton,
  contactLabel,
  errorMessage,
  fullTimestamp,
  request,
  useToast,
} from '@/components/ui'

/**
 * `args` and `payload` are not the same data. `args` is what the model passed,
 * keyed by field name; `payload` is what the sink actually transmitted, keyed
 * by sheet column label. A null payload means nothing ever left the app.
 */
export interface Invocation {
  id: string
  toolId?: string | null
  toolName: string | null
  sheetTab: string | null
  spreadsheetUrl?: string | null
  conversationId?: string | null
  contactId?: string | null
  contactName?: string | null
  contactPhone?: string | null
  args: Record<string, unknown>
  payload: { values?: Record<string, string> } | null
  status: string
  error: string | null
  createdAt: string
  syncedAt?: string | null
}

export function CaptureDetail({
  invocation,
  onSynced,
  showContact = true,
}: {
  invocation: Invocation
  onSynced?: () => void
  showContact?: boolean
}) {
  const { toast } = useToast()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const notSubmitted = invocation.status === 'not_submitted'
  const failed = invocation.status === 'failed'
  const pending = invocation.status === 'pending'
  const synced = invocation.status === 'synced'

  const captured = Object.entries(invocation.payload?.values ?? {})
  const rawArgs = Object.entries(invocation.args ?? {})

  async function retry() {
    setRetrying(true)
    setRetryError(null)
    try {
      await request(`/api/tools/invocations/${invocation.id}/retry`, { method: 'POST' })
      toast('Synced to the sheet.')
      onSynced?.()
    } catch (e) {
      setRetryError(errorMessage(e, 'The retry did not go through.'))
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <CaptureStatusBadge status={invocation.status} />
        {invocation.toolName && <Badge variant="neutral">{invocation.toolName}</Badge>}
        {invocation.sheetTab && <Badge variant="info">{invocation.sheetTab}</Badge>}
      </div>

      {/* What is safely stored comes first — it is the fact that decides whether
          anyone needs to contact the customer again. */}
      <div>
        <h3 className="text-sm font-semibold text-ink">
          {captured.length > 0 ? 'Details saved in WA Robot' : 'What the AI collected'}
        </h3>
        <p className="mt-0.5 mb-2 text-xs text-ink-soft">
          {synced
            ? 'These details are stored here and were written to the sheet.'
            : 'These details are stored here. Nothing is lost while the sheet is out of sync.'}
        </p>
        {captured.length > 0 ? (
          <KeyValues rows={captured.map(([label, value]) => [label, value || '—'])} />
        ) : rawArgs.length > 0 ? (
          <KeyValues rows={rawArgs.map(([key, value]) => [key, String(value) || '—'])} />
        ) : (
          <p className="text-sm text-ink-muted">
            Nothing was captured — the AI called the tool before it had every required detail, so it
            asked the customer for the rest instead.
          </p>
        )}
      </div>

      {notSubmitted && (
        <Banner tone="warning" title="Sheet setup needs attention">
          Nothing was sent to Google Sheets.{invocation.error ? ` ${invocation.error}` : ''} Fix the
          tool’s connection, then retry.
        </Banner>
      )}

      {failed && (
        <Banner tone="danger" title="Sheet sync failed">
          A request was sent and rejected.{invocation.error ? ` ${invocation.error}` : ''} The
          details above are still saved here.
        </Banner>
      )}

      {pending && (
        <Banner tone="info" title="Sync in progress">
          This capture has not reported a result yet. Wait a moment before retrying — a retry can
          write a second row.
        </Banner>
      )}

      {retryError && (
        <Banner tone="danger" title="Retry did not go through">
          {retryError} Nothing else has changed.
        </Banner>
      )}

      <KeyValues
        rows={[
          ...(showContact
            ? ([['Customer', contactLabel(invocation.contactName, invocation.contactPhone)]] as [
                string,
                string,
              ][])
            : []),
          ['Captured at', fullTimestamp(invocation.createdAt)],
          ['Synced at', invocation.syncedAt ? fullTimestamp(invocation.syncedAt) : 'Not synced'],
        ]}
      />

      {/* Available when the sheet columns are not what you expected, out of the
          way when they are. */}
      <Disclosure summary="What the AI passed, before column mapping">
        {rawArgs.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing.</p>
        ) : (
          <KeyValues rows={rawArgs.map(([k, v]) => [k, String(v) || '—'])} mono />
        )}
        <p className="mt-2 text-xs leading-4 text-ink-soft">
          Field keys as the model supplied them. The sheet also receives Captured At, Contact Name,
          Phone and Conversation ID.
        </p>
      </Disclosure>

      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        {/* Order matters: a capture that was never submitted needs the setup
            fixed before a retry can possibly succeed, so that link leads. */}
        {!synced && invocation.toolId && (
          <LinkButton
            href={`/tools/${invocation.toolId}`}
            size="sm"
            variant={notSubmitted ? 'primary' : 'secondary'}
          >
            Review sheet setup
          </LinkButton>
        )}
        {!synced && (
          <Button
            size="sm"
            variant={notSubmitted ? 'secondary' : 'primary'}
            onClick={retry}
            pending={retrying}
            pendingLabel="Retrying…"
          >
            Retry sync
          </Button>
        )}
        {invocation.spreadsheetUrl && (
          <a
            href={invocation.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-action hover:underline"
          >
            Open sheet
            <ExternalLinkIcon size={13} />
          </a>
        )}
        {invocation.conversationId && (
          <Link
            href={`/inbox?c=${invocation.conversationId}`}
            className="text-[13px] font-medium text-action hover:underline"
          >
            Open conversation
          </Link>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Drawer,
  Input,
  Spinner,
  errorMessage,
  request,
  type ChannelStatus,
} from '@/components/ui'

type Step =
  | { step: 'name' }
  | { step: 'starting'; sessionId: string; name: string }
  | { step: 'scan'; sessionId: string; name: string; qr: string | null }
  | { step: 'connected'; name: string }
  | { step: 'failed'; sessionId: string; name: string; error: string }

const POLL_MS = 3000
/** WAHA can take a while to hand back a code; stop guessing after ~2 minutes. */
const MAX_POLLS = 40

/**
 * Naming and connecting are one continuous task. The old flow saved a
 * disconnected record and then made the operator find a separate Connect
 * button, which is why half-set-up numbers accumulated.
 *
 * A record created here survives a failure: closing the drawer leaves the
 * number in the list, ready to retry.
 */
export function ConnectDrawer({
  open,
  existing,
  onClose,
  onChanged,
}: {
  open: boolean
  /** Set when repairing a number that already exists. */
  existing: { id: string; sessionName: string } | null
  onClose: () => void
  onChanged: () => void
}) {
  const [state, setState] = useState<Step>({ step: 'name' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const polls = useRef(0)

  useEffect(() => {
    if (!open) return
    polls.current = 0
    setError(null)
    if (existing) {
      setName(existing.sessionName)
      setState({ step: 'starting', sessionId: existing.id, name: existing.sessionName })
    } else {
      setName('')
      setState({ step: 'name' })
    }
  }, [open, existing])

  // Start the connection as soon as we have a session to start.
  useEffect(() => {
    if (state.step !== 'starting') return
    let cancelled = false
    ;(async () => {
      try {
        await request('/api/wa/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId }),
        })
      } catch (e) {
        if (cancelled) return
        setState({
          step: 'failed',
          sessionId: state.sessionId,
          name: state.name,
          error: errorMessage(e, 'Could not reach the WhatsApp gateway.'),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state])

  // Poll status, and refetch the QR each time: WAHA rotates the pairing code.
  useEffect(() => {
    if (state.step !== 'starting' && state.step !== 'scan') return
    const sessionId = state.sessionId

    const tick = async () => {
      polls.current += 1
      try {
        const { status } = await request<{ status: ChannelStatus }>(
          `/api/wa/status?sessionId=${sessionId}`
        )
        onChanged()

        if (status === 'connected') {
          setState({ step: 'connected', name: state.name })
          return
        }
        if (status === 'failed') {
          setState({
            step: 'failed',
            sessionId,
            name: state.name,
            error: 'WhatsApp rejected the connection. Try connecting again.',
          })
          return
        }
        if (status === 'waiting_qr') {
          const { qr } = await request<{ qr: string | null }>(`/api/wa/qr?sessionId=${sessionId}`)
          setState({ step: 'scan', sessionId, name: state.name, qr })
          return
        }
        if (polls.current >= MAX_POLLS) {
          setState({
            step: 'failed',
            sessionId,
            name: state.name,
            error: 'The gateway did not produce a QR code in time.',
          })
        }
      } catch {
        // A dropped poll is not a failed connection: keep waiting and say so.
        if (polls.current >= MAX_POLLS) {
          setState({
            step: 'failed',
            sessionId,
            name: state.name,
            error: 'The connection status could not be checked.',
          })
        }
      }
    }

    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
    // `state.step` and the session are what matter; re-running on every QR
    // refresh would restart the interval on each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step === 'starting' || state.step === 'scan' ? state.sessionId : null, state.step === 'starting'])

  async function createAndConnect() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give this number a name you will recognise, like “Sales”.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await request<{ id: string; sessionName: string }>('/api/wa/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      onChanged()
      setState({ step: 'starting', sessionId: created.id, name: created.sessionName })
    } catch (e) {
      setError(errorMessage(e, 'The number could not be added.'))
    } finally {
      setBusy(false)
    }
  }

  async function cancelScan(sessionId: string) {
    setBusy(true)
    try {
      await request('/api/wa/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch {
      // Nothing to recover: the row stays in the list either way.
    } finally {
      setBusy(false)
      onChanged()
      onClose()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={existing ? `Reconnect “${existing.sessionName}”` : 'Connect a WhatsApp number'}
      description="Scanning links this number to WA Robot, the same way WhatsApp Web works."
    >
      {state.step === 'name' && (
        <div className="space-y-4">
          <Input
            label="Name this number"
            required
            value={name}
            error={error ?? undefined}
            onChange={(e) => setName(e.target.value)}
            hint="For your reference across the app, e.g. Sales, Support, Front desk."
            placeholder="Sales"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createAndConnect()
              }
            }}
          />
          <Banner tone="info" title="You will need the phone in your hand">
            WhatsApp shows a QR code here that you scan from the business phone, so keep this screen
            on a second screen if you are reading this on the phone itself.
          </Banner>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={createAndConnect} pending={busy} pendingLabel="Adding…">
              Add and connect
            </Button>
          </div>
        </div>
      )}

      {state.step === 'starting' && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Spinner size={22} />
          <p className="text-sm font-medium text-ink">Starting “{state.name}”…</p>
          <p className="max-w-[36ch] text-sm text-ink-muted">
            Waiting for the gateway to produce a QR code. This usually takes a few seconds.
          </p>
        </div>
      )}

      {state.step === 'scan' && (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm leading-5 text-ink-muted">
            <li>1. Open WhatsApp on the phone for this number.</li>
            <li>
              2. Go to <strong className="text-ink">Linked devices → Link a device</strong>.
            </li>
            <li>3. Point the camera at the code below.</li>
          </ol>

          <div className="flex justify-center">
            {state.qr ? (
              <div className="rounded-lg border border-line bg-panel p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.qr} alt="QR code to link this WhatsApp number" width={200} height={200} className="block" />
              </div>
            ) : (
              <div className="flex h-[224px] w-[224px] items-center justify-center rounded-lg border border-line bg-inset">
                <Spinner size={20} />
              </div>
            )}
          </div>

          <p className="text-center text-xs text-ink-soft">
            The code refreshes on its own. Keep this open until it says connected.
          </p>

          <div className="flex justify-between gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => cancelScan(state.sessionId)} pending={busy}>
              Cancel connection
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Continue in the background
            </Button>
          </div>
        </div>
      )}

      {state.step === 'connected' && (
        <div className="space-y-4">
          <Banner tone="success" title={`“${state.name}” is connected`}>
            Messages sent to this number will now arrive in Inbox.
          </Banner>
          {/* Connecting a number proves the number is linked. It says nothing
              about whether AI replies are enabled or a bot exists. */}
          <p className="text-sm leading-5 text-ink-muted">
            This does not switch on automatic replies. Whether the AI answers still depends on your
            reply settings, the conversation’s mode and an available bot.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}

      {state.step === 'failed' && (
        <div className="space-y-4">
          <Banner tone="danger" title="The connection did not complete">
            {state.error} “{state.name}” is saved in your list, so you can try again without
            re-entering anything.
          </Banner>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                polls.current = 0
                setState({ step: 'starting', sessionId: state.sessionId, name: state.name })
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}

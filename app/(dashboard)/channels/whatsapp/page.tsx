'use client'

import { useCallback, useState } from 'react'
import {
  Banner,
  Button,
  ChannelStatusBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageBody,
  PageHeader,
  Panel,
  PanelHeader,
  PlusIcon,
  SkeletonRows,
  StaleNotice,
  WhatsAppIcon,
  errorMessage,
  fullTimestamp,
  plural,
  request,
  useAsyncData,
  usePendingSet,
  useToast,
  EditIcon,
  type ChannelStatus,
} from '@/components/ui'
import { useWorkspaceStatus } from '@/components/workspace-status'
import { ConnectDrawer } from './connect-drawer'

interface Channel {
  id: string
  sessionName: string
  status: ChannelStatus
  lastConnectedAt: string | null
}

const POLL_MS = 5000

function ChannelRow({
  channel,
  onConnect,
  onDisconnect,
  onRemove,
  onRename,
  pending,
}: {
  channel: Channel
  onConnect: () => void
  onDisconnect: () => void
  onRemove: () => void
  onRename: (name: string) => Promise<void>
  pending: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(channel.sessionName)
  const [saving, setSaving] = useState(false)

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === channel.sessionName) {
      setEditing(false)
      setName(channel.sessionName)
      return
    }
    setSaving(true)
    await onRename(trimmed)
    setSaving(false)
    setEditing(false)
  }

  const connected = channel.status === 'connected'
  const scanning = channel.status === 'waiting_qr' || channel.status === 'starting'

  return (
    <li className="border-b border-line-soft px-4 py-4 last:border-0 md:px-5">
      {/* Below sm the two halves stack: sharing the row squeezed the channel
          name down to a couple of characters and broke it mid-word. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                label={`Name for ${channel.sessionName}`}
                hideLabel
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveName()
                  }
                  if (e.key === 'Escape') {
                    setEditing(false)
                    setName(channel.sessionName)
                  }
                }}
                className="w-56"
              />
              <Button size="sm" onClick={saveName} pending={saving} pendingLabel="Saving…">
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setName(channel.sessionName)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-ink">{channel.sessionName}</h3>
              {/* Always visible, never hover-only: a rename you cannot find is
                  a rename that does not exist on a touch screen. */}
              <IconButton label={`Rename ${channel.sessionName}`} size="sm" onClick={() => setEditing(true)}>
                <EditIcon size={14} />
              </IconButton>
            </div>
          )}

          <p className="mt-1 text-sm text-ink-muted">
            {channel.lastConnectedAt
              ? `Last connected ${fullTimestamp(channel.lastConnectedAt)}`
              : 'Has not connected yet'}
          </p>

          {scanning && (
            <p className="mt-1 text-sm text-warning">
              Waiting for a QR code scan. Open the connection panel to see the code.
            </p>
          )}
          {channel.status === 'failed' && (
            <p className="mt-1 text-sm text-danger">
              This number stopped working. Messages sent to it are not arriving.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <ChannelStatusBadge status={channel.status} />
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {(channel.status === 'offline' || channel.status === 'failed' || channel.status === 'unknown') && (
              <Button size="sm" onClick={onConnect}>
                {channel.status === 'failed' ? 'Reconnect' : 'Connect'}
              </Button>
            )}
            {scanning && (
              <Button size="sm" onClick={onConnect}>
                Show QR code
              </Button>
            )}
            {(connected || scanning) && (
              <Button size="sm" variant="secondary" onClick={onDisconnect} pending={pending}>
                Disconnect
              </Button>
            )}
            {(channel.status === 'offline' || channel.status === 'failed') && (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export default function WhatsAppChannelsPage() {
  const { toast } = useToast()
  const workspace = useWorkspaceStatus()
  const pending = usePendingSet()

  const [connecting, setConnecting] = useState<{ id: string; sessionName: string } | null | 'new'>(
    null
  )
  const [confirmDisconnect, setConfirmDisconnect] = useState<Channel | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<Channel | null>(null)
  const [actionPending, setActionPending] = useState(false)

  const load = useCallback(
    (signal: AbortSignal) => request<Channel[]>('/api/wa/sessions', { signal }),
    []
  )
  const { data, loading, error, stale, loadedAt, refresh } = useAsyncData(load, [load], {
    pollMs: POLL_MS,
  })

  const channels = data ?? []
  const connected = channels.filter((c) => c.status === 'connected').length

  function refreshAll() {
    refresh()
    workspace.refresh()
  }

  async function rename(channel: Channel, name: string) {
    try {
      await request(`/api/wa/sessions/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      toast(`Renamed to “${name}”.`)
      refreshAll()
    } catch (e) {
      toast(errorMessage(e, 'The name was not saved.'), 'error')
    }
  }

  async function disconnect(channel: Channel) {
    setActionPending(true)
    try {
      await request('/api/wa/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: channel.id }),
      })
      toast(`“${channel.sessionName}” disconnected. Messages to it will stop arriving.`)
      setConfirmDisconnect(null)
      refreshAll()
    } catch (e) {
      toast(errorMessage(e, 'The number was not disconnected.'), 'error')
    } finally {
      setActionPending(false)
    }
  }

  async function remove(channel: Channel) {
    setActionPending(true)
    try {
      await request(`/api/wa/sessions/${channel.id}`, { method: 'DELETE' })
      toast(`“${channel.sessionName}” removed.`)
      setConfirmRemove(null)
      refreshAll()
    } catch (e) {
      toast(errorMessage(e, 'The number was not removed.'), 'error')
    } finally {
      setActionPending(false)
    }
  }

  return (
    <PageBody width="content">
      <PageHeader
        title="WhatsApp channels"
        description="Connect the WhatsApp numbers your business uses. A channel here is one connected number — it is not WhatsApp’s broadcast Channels feature."
        actions={
          <Button onClick={() => setConnecting('new')}>
            <PlusIcon size={15} />
            Connect number
          </Button>
        }
      />

      {stale && (
        <div className="mb-4">
          <StaleNotice at={loadedAt} onRetry={refresh} />
        </div>
      )}

      <Panel className="mb-5">
        <PanelHeader
          title={
            channels.length === 0
              ? 'No numbers yet'
              : `${connected} of ${channels.length} ${plural(channels.length, 'number')} reported connected`
          }
          description={
            loadedAt
              ? `Status last checked at ${loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This is what the gateway reported, not a live guarantee.`
              : undefined
          }
        />

        {loading && !data ? (
          <SkeletonRows rows={2} />
        ) : error ? (
          <ErrorState
            title="Could not load your numbers"
            detail="Connections have not been changed — only this page failed to load."
            onRetry={refresh}
          />
        ) : channels.length === 0 ? (
          <EmptyState
            icon={<WhatsAppIcon size={22} />}
            title="Connect your first WhatsApp number"
            description="Scan a QR code from the business phone, the same way WhatsApp Web works."
            action={
              <Button size="sm" onClick={() => setConnecting('new')}>
                Connect number
              </Button>
            }
          />
        ) : (
          <ul>
            {channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                pending={pending.isPending(channel.id) || actionPending}
                onConnect={() => setConnecting({ id: channel.id, sessionName: channel.sessionName })}
                onDisconnect={() => setConfirmDisconnect(channel)}
                onRemove={() => setConfirmRemove(channel)}
                onRename={(name) => rename(channel, name)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Connection is one dimension of readiness, and this page owns only that
          one. Nothing here claims replies are working. */}
      <Banner tone="info" title="Connecting a number is not the same as replying automatically">
        A connected number receives messages. Whether the AI answers them also depends on your reply
        settings, each conversation’s mode and an available bot.
      </Banner>

      <div className="mt-5 space-y-2 text-sm leading-5 text-ink-muted">
        <p className="font-semibold text-ink">Worth knowing</p>
        <p>Each number needs its own scan, and several numbers can be connected at once.</p>
        <p>
          Connections live in the WhatsApp gateway and survive an app restart. Removing a number logs
          it out and deletes its session data; the conversations and contacts it produced are kept.
        </p>
        <p>
          A status here is what the gateway last reported. When the gateway cannot be reached, the
          last known status is shown and labelled as unavailable rather than guessed.
        </p>
      </div>

      <ConnectDrawer
        open={connecting !== null}
        existing={connecting === 'new' || connecting === null ? null : connecting}
        onClose={() => {
          setConnecting(null)
          refreshAll()
        }}
        onChanged={refreshAll}
      />

      <ConfirmDialog
        open={confirmDisconnect !== null}
        onClose={() => !actionPending && setConfirmDisconnect(null)}
        onConfirm={() => confirmDisconnect && disconnect(confirmDisconnect)}
        pending={actionPending}
        title={`Disconnect “${confirmDisconnect?.sessionName ?? ''}”?`}
        description="Messages sent to this number will stop arriving until you connect it again. Existing conversations and contacts are kept."
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        destructive
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => !actionPending && setConfirmRemove(null)}
        onConfirm={() => confirmRemove && remove(confirmRemove)}
        pending={actionPending}
        title={`Remove “${confirmRemove?.sessionName ?? ''}”?`}
        description="This deletes the number's session data. Conversations and contacts it produced are kept, and you can add the number again later. This cannot be undone."
        confirmLabel="Remove number"
        pendingLabel="Removing…"
        destructive
      />
    </PageBody>
  )
}

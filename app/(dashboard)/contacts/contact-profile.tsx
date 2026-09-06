'use client'

import { useCallback, useState } from 'react'
import {
  Badge,
  Banner,
  ChannelTag,
  Drawer,
  ErrorState,
  KeyValues,
  LinkButton,
  ModeBadge,
  Select,
  Skeleton,
  Switch,
  contactLabel,
  errorMessage,
  request,
  useAsyncData,
  useToast,
} from '@/components/ui'
import { Transcript, type TranscriptMessage } from '@/components/transcript'
import type { BotSummary } from '@/components/workspace-status'

export interface Contact {
  id: string
  phoneNumber: string
  name: string | null
  aiEnabled: boolean
  aiBotId: string | null
  waSessionId: string | null
  waSessionName: string | null
}

interface MessagePage {
  rows: {
    id: string
    conversationId: string
    direction: 'incoming' | 'outgoing'
    senderType: TranscriptMessage['senderType']
    messageType: string
    message: string
    status: TranscriptMessage['status']
    error: string | null
    createdAt: string
  }[]
  total: number
  page: number
  pageSize: number
  lastPage: number
}

interface ConversationRef {
  id: string
  contactId: string
  status: 'open' | 'resolved'
  mode: 'auto' | 'human'
  botId: string | null
}

const HISTORY_PAGE = 50

/**
 * The customer's profile. It reads history and links to the conversation — it
 * does not offer a second place to send a message. One composer, in Inbox,
 * means one set of rules about who the sender is and what happens on failure.
 */
export function ContactProfile({
  contact,
  bots,
  onClose,
  onUpdated,
}: {
  contact: Contact
  bots: BotSummary[]
  onClose: () => void
  onUpdated: (patch: Partial<Contact>) => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState<'ai' | 'bot' | null>(null)

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [history, conversations] = await Promise.all([
        request<MessagePage>(
          `/api/messages?contactId=${contact.id}&pageSize=${HISTORY_PAGE}`,
          { signal }
        ),
        request<ConversationRef[]>(
          `/api/conversations?search=${encodeURIComponent(contact.phoneNumber)}`,
          { signal }
        ),
      ])
      return {
        history,
        conversations: conversations.filter((c) => c.contactId === contact.id),
      }
    },
    [contact.id, contact.phoneNumber]
  )
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const messages: TranscriptMessage[] = (data?.history.rows ?? [])
    .map((row) => ({
      id: row.id,
      direction: row.direction,
      senderType: row.senderType,
      messageType: row.messageType,
      content: row.message,
      status: row.status,
      error: row.error,
      createdAt: row.createdAt,
    }))
    .reverse()

  const openConversation = data?.conversations.find((c) => c.status === 'open') ?? null
  const latestConversation = openConversation ?? data?.conversations[0] ?? null
  const assignedBot = bots.find((b) => b.id === contact.aiBotId) ?? null
  const conversationBot = latestConversation?.botId
    ? (bots.find((b) => b.id === latestConversation.botId) ?? null)
    : null

  async function save(patch: Partial<Contact>, kind: 'ai' | 'bot', success: string) {
    setSaving(kind)
    try {
      await request(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onUpdated(patch)
      toast(success)
      refresh()
    } catch (e) {
      toast(errorMessage(e, 'The change was not saved. Nothing has been altered.'), 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={contactLabel(contact.name, contact.phoneNumber)}
      description={contact.phoneNumber}
      width="wide"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {contact.waSessionName ? (
            <ChannelTag name={contact.waSessionName} />
          ) : (
            <Badge variant="neutral">No channel recorded</Badge>
          )}
          <ModeBadge mode={contact.aiEnabled ? 'auto' : 'human'} />
        </div>

        {/* Two different scopes, side by side, because the API applies them to
            two different things and conflating them was the old bug. */}
        <section>
          <h3 className="text-sm font-semibold text-ink">Who replies to this customer</h3>
          <div className="mt-3 space-y-4 rounded-md border border-line bg-inset/60 p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">AI replies</p>
                <p className="mt-0.5 text-sm leading-5 text-ink-muted">
                  Applies to this customer’s open conversation now, and to every conversation they
                  start in future.
                </p>
              </div>
              <Switch
                checked={contact.aiEnabled}
                pending={saving === 'ai'}
                onChange={(v) =>
                  save(
                    { aiEnabled: v },
                    'ai',
                    v
                      ? 'The AI will answer this customer.'
                      : 'You will answer this customer. The AI stays out.'
                  )
                }
                label={`AI replies for ${contactLabel(contact.name, contact.phoneNumber)}`}
              />
            </div>

            <div className="border-t border-line-soft pt-4">
              <Select
                label="Default bot"
                hint="Used for this customer’s future conversations. It does not change a bot already chosen for an open conversation."
                value={contact.aiBotId ?? ''}
                disabled={saving === 'bot'}
                onChange={(e) =>
                  save(
                    { aiBotId: e.target.value || null },
                    'bot',
                    'Default bot updated for this customer.'
                  )
                }
              >
                <option value="">Use the workspace default</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id} disabled={!bot.enabled}>
                    {bot.name}
                    {bot.enabled ? '' : ' (turned off)'}
                  </option>
                ))}
              </Select>

              {conversationBot && conversationBot.id !== contact.aiBotId && (
                <Banner tone="info" title="This customer’s open conversation uses another bot" className="mt-3">
                  “{conversationBot.name}” is set on the conversation itself and keeps answering it.
                  {assignedBot ? ` “${assignedBot.name}” applies to new conversations.` : ''}
                </Banner>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Message history</h3>
            {latestConversation && (
              <LinkButton href={`/inbox?c=${latestConversation.id}`} size="sm" variant="secondary">
                {openConversation ? 'Open conversation' : 'Open last conversation'}
              </LinkButton>
            )}
          </div>

          {loading && !data ? (
            <Skeleton className="mt-3 h-48 w-full" />
          ) : error ? (
            <ErrorState
              title="Could not load this customer’s messages"
              detail="Nothing has been changed."
              onRetry={refresh}
            />
          ) : (
            <>
              <div className="mt-3 flex h-[22rem] flex-col overflow-hidden rounded-md border border-line">
                <Transcript
                  messages={messages}
                  emptyLabel="No messages recorded for this customer yet."
                />
              </div>
              <p className="mt-2 text-xs leading-4 text-ink-soft">
                {data && data.history.total > messages.length
                  ? `Showing the ${messages.length} most recent of ${data.history.total} messages. Older messages are in Activity.`
                  : `${messages.length} ${messages.length === 1 ? 'message' : 'messages'} recorded.`}{' '}
                Replies are sent from Inbox.
              </p>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Record</h3>
          <KeyValues
            rows={[
              ['Phone number', contact.phoneNumber],
              ['Name', contact.name ?? 'Not provided by WhatsApp'],
              ['Received on', contact.waSessionName ?? 'Not recorded'],
              [
                'Conversations',
                data ? String(data.conversations.length) : '—',
              ],
            ]}
          />
        </section>
      </div>
    </Drawer>
  )
}

'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BulkActionBar,
  Button,
  ChannelTag,
  Checkbox,
  ContactsIcon,
  EmptyState,
  ErrorState,
  LinkButton,
  ModeBadge,
  PageBody,
  PageHeader,
  Panel,
  ResultCount,
  SearchInput,
  SegmentedControl,
  Skeleton,
  SkeletonRows,
  Switch,
  Table,
  TableScroll,
  TableToolbar,
  Td,
  Th,
  contactLabel,
  errorMessage,
  initial,
  plural,
  request,
  useAsyncData,
  usePendingSet,
  useToast,
} from '@/components/ui'
import { useWorkspaceStatus } from '@/components/workspace-status'
import { ContactProfile, type Contact } from './contact-profile'

type ReplyFilter = 'all' | 'ai' | 'human'
const DEFAULT_BOT = '__default__'

function ContactsWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()
  const { status } = useWorkspaceStatus()
  const bots = status?.bots ?? []

  const [search, setSearch] = useState('')
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [bulkBot, setBulkBot] = useState('')
  const [bulkPending, setBulkPending] = useState(false)
  const rowPending = usePendingSet()

  const openId = params.get('contact')

  const load = useCallback(
    (signal: AbortSignal) => request<Contact[]>('/api/contacts', { signal }),
    []
  )
  const { data, loading, error, refresh, setData } = useAsyncData(load, [load])

  const contacts = useMemo(() => data ?? [], [data])
  const channels = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of contacts) {
      if (c.waSessionId && c.waSessionName) map.set(c.waSessionId, c.waSessionName)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (q && !(c.name ?? '').toLowerCase().includes(q) && !c.phoneNumber.includes(q)) return false
      if (replyFilter === 'ai' && !c.aiEnabled) return false
      if (replyFilter === 'human' && c.aiEnabled) return false
      if (channelFilter !== 'all' && c.waSessionId !== channelFilter) return false
      return true
    })
  }, [contacts, search, replyFilter, channelFilter])

  const openContact = contacts.find((c) => c.id === openId) ?? null
  const filtersActive = !!search.trim() || replyFilter !== 'all' || channelFilter !== 'all'

  // Selection is scoped to what is currently listed, so "select all" can never
  // silently include rows the operator cannot see.
  const visibleSelected = filtered.filter((c) => selected.has(c.id))
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length

  function patchContact(id: string, patch: Partial<Contact>) {
    setData((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function saveContact(id: string, patch: Partial<Contact>, success: string) {
    await rowPending.run(id, async () => {
      try {
        await request(`/api/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        patchContact(id, patch)
        toast(success)
      } catch (e) {
        toast(errorMessage(e, 'The change was not saved.'), 'error')
      }
    })
  }

  /**
   * Bulk changes report what actually happened. Rows that failed stay selected
   * so they can be retried without hunting for them again.
   */
  async function applyBulk(patch: Partial<Contact>, describe: (n: number) => string) {
    const ids = visibleSelected.map((c) => c.id)
    if (ids.length === 0) return
    setBulkPending(true)

    const failed: string[] = []
    for (const id of ids) {
      try {
        await request(`/api/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        patchContact(id, patch)
      } catch {
        failed.push(id)
      }
    }

    setBulkPending(false)
    setSelected(new Set(failed))

    const succeeded = ids.length - failed.length
    if (failed.length === 0) {
      toast(describe(succeeded))
    } else {
      toast(
        `${describe(succeeded)} ${failed.length} ${plural(failed.length, 'contact')} could not be updated and ${failed.length === 1 ? 'is' : 'are'} still selected.`,
        'error'
      )
    }
  }

  return (
    <PageBody width="wide">
      <PageHeader
        title="Contacts"
        description="Customers are added automatically when they message one of your numbers."
      />

      <TableToolbar className="mb-4">
        <SearchInput
          className="w-full sm:w-72"
          value={search}
          onChange={setSearch}
          label="Search contacts by name or number"
          placeholder="Search name or number"
        />
        <SegmentedControl
          label="Who replies"
          value={replyFilter}
          onChange={setReplyFilter}
          options={[
            { value: 'all', label: 'Anyone' },
            { value: 'ai', label: 'AI' },
            { value: 'human', label: 'Human' },
          ]}
        />
        {channels.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Received on
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 cursor-pointer rounded-md border border-[var(--input-border)]/70 bg-inset px-2 text-sm text-ink"
            >
              <option value="all">Any number</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setReplyFilter('all')
              setChannelFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
        <ResultCount>
          {filtered.length === contacts.length
            ? `${contacts.length} ${plural(contacts.length, 'contact')}`
            : `${filtered.length} of ${contacts.length} ${plural(contacts.length, 'contact')}`}
        </ResultCount>
      </TableToolbar>

      {visibleSelected.length > 0 && (
        <BulkActionBar
          count={visibleSelected.length}
          scope={`of ${filtered.length} listed ${plural(filtered.length, 'contact')}`}
          onClear={() => setSelected(new Set())}
        >
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkPending}
            onClick={() =>
              applyBulk({ aiEnabled: true }, (n) => `AI replies enabled for ${n} ${plural(n, 'contact')}.`)
            }
          >
            Use AI replies
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkPending}
            onClick={() =>
              applyBulk({ aiEnabled: false }, (n) => `AI replies turned off for ${n} ${plural(n, 'contact')}.`)
            }
          >
            Use human replies
          </Button>
          {bots.length > 0 && (
            <span className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="sr-only">Bot to assign</span>
                <select
                  value={bulkBot}
                  onChange={(e) => setBulkBot(e.target.value)}
                  className="h-8 cursor-pointer rounded-md border border-[var(--input-border)]/70 bg-inset px-2 text-[13px] text-ink"
                >
                  <option value="">Choose a bot…</option>
                  {/* A distinct sentinel: "use the workspace default" is a real
                      choice, not the same value as "nothing picked yet". */}
                  <option value={DEFAULT_BOT}>Workspace default</option>
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                size="sm"
                disabled={!bulkBot || bulkPending}
                pending={bulkPending}
                pendingLabel="Applying…"
                onClick={() => {
                  const botId = bulkBot === DEFAULT_BOT ? null : bulkBot
                  const name = botId ? bots.find((b) => b.id === botId)?.name : 'the workspace default'
                  applyBulk({ aiBotId: botId }, (n) => `${n} ${plural(n, 'contact')} now default to ${name}.`)
                  setBulkBot('')
                }}
              >
                Apply
              </Button>
            </span>
          )}
        </BulkActionBar>
      )}

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState
            title="Could not load contacts"
            detail="Your saved contacts have not been changed."
            onRetry={refresh}
          />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<ContactsIcon size={22} />}
            title="Your customers will appear here"
            description="Contacts are added when you receive WhatsApp messages."
            action={
              <LinkButton href="/channels/whatsapp" variant="secondary" size="sm">
                View WhatsApp channels
              </LinkButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching contacts"
            description="Try another name or number, or clear your filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setReplyFilter('all')
                  setChannelFilter('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Phone: stacked records. A contained side-scroll would put the
                two controls this page exists for — who replies, and which bot
                — off the edge of the screen. */}
            <ul className="divide-y divide-line-soft md:hidden">
              {filtered.map((contact) => {
                const pending = rowPending.isPending(contact.id)
                const isSelected = selected.has(contact.id)
                const who = contactLabel(contact.name, contact.phoneNumber)
                return (
                  <li key={contact.id} className={`p-4 ${isSelected ? 'bg-selected/50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        label={`Select ${who}`}
                        className="mt-1"
                        checked={isSelected}
                        onChange={(next) =>
                          setSelected((current) => {
                            const set = new Set(current)
                            if (next) set.add(contact.id)
                            else set.delete(contact.id)
                            return set
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            router.replace(`/contacts?contact=${contact.id}`, { scroll: false })
                          }
                          className="cursor-pointer rounded-sm text-left text-base font-medium text-ink"
                        >
                          {who}
                        </button>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                          <span className="tabular-nums">{contact.phoneNumber}</span>
                          {contact.waSessionName && <ChannelTag name={contact.waSessionName} />}
                        </p>

                        <div className="mt-3 flex items-center gap-2.5">
                          <Switch
                            checked={contact.aiEnabled}
                            pending={pending}
                            onChange={(v) =>
                              saveContact(
                                contact.id,
                                { aiEnabled: v },
                                v ? `The AI will answer ${who}.` : `You will answer ${who}.`
                              )
                            }
                            label={`AI replies for ${who}`}
                          />
                          <ModeBadge mode={contact.aiEnabled ? 'auto' : 'human'} />
                        </div>

                        <label className="mt-3 block">
                          <span className="text-xs text-ink-soft">Default bot</span>
                          <select
                            value={contact.aiBotId ?? ''}
                            disabled={pending}
                            aria-label={`Default bot for ${who}`}
                            onChange={(e) =>
                              saveContact(
                                contact.id,
                                { aiBotId: e.target.value || null },
                                'Default bot updated for this customer.'
                              )
                            }
                            className="mt-1 h-11 w-full cursor-pointer rounded-md border border-[var(--input-border)]/70 bg-inset px-2 text-base text-ink disabled:opacity-60"
                          >
                            <option value="">Workspace default</option>
                            {bots.map((bot) => (
                              <option key={bot.id} value={bot.id} disabled={!bot.enabled}>
                                {bot.name}
                                {bot.enabled ? '' : ' (off)'}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="hidden md:block">
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <Checkbox
                      label={`Select all ${filtered.length} listed contacts`}
                      checked={allVisibleSelected}
                      indeterminate={visibleSelected.length > 0}
                      onChange={(next) =>
                        setSelected(next ? new Set(filtered.map((c) => c.id)) : new Set())
                      }
                    />
                  </Th>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  {channels.length > 0 && <Th>Received on</Th>}
                  <Th>Replies</Th>
                  <Th>Default bot</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => {
                  const pending = rowPending.isPending(contact.id)
                  const isSelected = selected.has(contact.id)
                  return (
                    <tr key={contact.id} className={isSelected ? 'bg-selected/50' : 'hover:bg-hover'}>
                      <Td>
                        <Checkbox
                          label={`Select ${contactLabel(contact.name, contact.phoneNumber)}`}
                          checked={isSelected}
                          onChange={(next) =>
                            setSelected((current) => {
                              const set = new Set(current)
                              if (next) set.add(contact.id)
                              else set.delete(contact.id)
                              return set
                            })
                          }
                        />
                      </Td>
                      <Td>
                        {/* A real button, so the row opens from the keyboard as
                            well as the mouse. */}
                        <button
                          type="button"
                          onClick={() => router.replace(`/contacts?contact=${contact.id}`, { scroll: false })}
                          className="flex cursor-pointer items-center gap-3 rounded-sm text-left"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inset text-xs font-semibold text-ink-muted"
                            aria-hidden="true"
                          >
                            {initial(contact.name, contact.phoneNumber)}
                          </span>
                          <span className="text-sm font-medium text-ink hover:underline">
                            {contactLabel(contact.name, contact.phoneNumber)}
                          </span>
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted tabular-nums">
                        {contact.phoneNumber}
                      </Td>
                      {channels.length > 0 && (
                        <Td>
                          {contact.waSessionName ? (
                            <ChannelTag name={contact.waSessionName} />
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </Td>
                      )}
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <Switch
                            size="sm"
                            checked={contact.aiEnabled}
                            pending={pending}
                            onChange={(v) =>
                              saveContact(
                                contact.id,
                                { aiEnabled: v },
                                v
                                  ? `The AI will answer ${contactLabel(contact.name, contact.phoneNumber)}.`
                                  : `You will answer ${contactLabel(contact.name, contact.phoneNumber)}.`
                              )
                            }
                            label={`AI replies for ${contactLabel(contact.name, contact.phoneNumber)}`}
                          />
                          <ModeBadge mode={contact.aiEnabled ? 'auto' : 'human'} />
                        </span>
                      </Td>
                      <Td>
                        <select
                          value={contact.aiBotId ?? ''}
                          disabled={pending}
                          aria-label={`Default bot for ${contactLabel(contact.name, contact.phoneNumber)}`}
                          onChange={(e) =>
                            saveContact(
                              contact.id,
                              { aiBotId: e.target.value || null },
                              'Default bot updated for this customer.'
                            )
                          }
                          className="h-9 max-w-[12rem] cursor-pointer rounded-md border border-[var(--input-border)]/70 bg-inset px-2 text-sm text-ink disabled:opacity-60"
                        >
                          <option value="">Workspace default</option>
                          {bots.map((bot) => (
                            <option key={bot.id} value={bot.id} disabled={!bot.enabled}>
                              {bot.name}
                              {bot.enabled ? '' : ' (off)'}
                            </option>
                          ))}
                        </select>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableScroll>
            </div>
          </>
        )}
      </Panel>

      <p className="mt-4 max-w-[65ch] text-xs leading-4 text-ink-soft">
        Turning AI replies on or off here also applies to the customer’s open conversation. Choosing
        a default bot applies to their future conversations — a bot already chosen for an open
        conversation keeps answering it.
      </p>

      {openContact && (
        <ContactProfile
          contact={openContact}
          bots={bots}
          onClose={() => router.replace('/contacts', { scroll: false })}
          onUpdated={(patch) => patchContact(openContact.id, patch)}
        />
      )}
    </PageBody>
  )
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<PageBody width="wide"><Skeleton className="h-96 w-full" /></PageBody>}>
      <ContactsWorkspace />
    </Suspense>
  )
}

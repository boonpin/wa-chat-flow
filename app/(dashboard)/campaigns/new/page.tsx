'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Banner,
  Button,
  ChannelStatusBadge,
  Checkbox,
  ErrorState,
  FormSection,
  Input,
  KeyValues,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  SearchInput,
  Select,
  Skeleton,
  Textarea,
  contactLabel,
  errorMessage,
  plural,
  request,
  useAsyncData,
  useToast,
  type ChannelStatus,
} from '@/components/ui'
import { renderTemplate } from '@/lib/blast/renderer'

interface Channel {
  id: string
  sessionName: string
  status: ChannelStatus
}

interface Contact {
  id: string
  phoneNumber: string
  name: string | null
}

type Audience = 'contacts' | 'manual'

export default function NewCampaignPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [channelId, setChannelId] = useState('')
  const [delaySeconds, setDelaySeconds] = useState('3')
  const [audience, setAudience] = useState<Audience>('contacts')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [manual, setManual] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    const [channels, contacts] = await Promise.all([
      request<Channel[]>('/api/wa/sessions', { signal }),
      request<Contact[]>('/api/contacts', { signal }),
    ])
    return { channels, contacts }
  }, [])
  const { data, loading, error, refresh } = useAsyncData(load, [load])

  const channels = data?.channels ?? []
  const contacts = useMemo(() => data?.contacts ?? [], [data])
  const channel = channels.find((c) => c.id === channelId) ?? null

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) => (c.name ?? '').toLowerCase().includes(q) || c.phoneNumber.includes(q)
    )
  }, [contacts, search])

  const manualLines = manual
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const recipients = useMemo(() => {
    if (audience === 'contacts') {
      return contacts
        .filter((c) => selected.has(c.id))
        .map((c) => ({ phone: c.phoneNumber, name: c.name ?? undefined }))
    }
    return manualLines.map((line) => {
      const [phone, ...rest] = line.split(',')
      return { phone: phone.trim(), name: rest.join(',').trim() || undefined }
    })
  }, [audience, contacts, selected, manualLines])

  const sample = recipients[0]
  const preview = template
    ? renderTemplate(template, {
        name: sample?.name ?? 'John',
        phone: sample?.phone ?? '601234567890',
      })
    : ''

  const delay = Number(delaySeconds) || 3
  const estimatedMinutes = Math.round((recipients.length * delay) / 60)

  async function saveDraft() {
    setSaveError(null)
    if (!name.trim()) return setSaveError('Give the campaign a name so you can find it later.')
    if (!channelId) return setSaveError('Choose which number the campaign sends from.')
    if (!template.trim()) return setSaveError('Write the message that will be sent.')
    if (recipients.length === 0) return setSaveError('Add at least one recipient.')

    setSaving(true)
    try {
      const created = await request<{ id: string }>('/api/blast/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          messageTemplate: template.trim(),
          waSessionId: channelId,
          delaySeconds: delay,
          recipients,
        }),
      })
      toast('Draft saved. Nothing has been sent yet.')
      router.push(`/campaigns/${created.id}`)
    } catch (e) {
      setSaveError(errorMessage(e, 'The draft was not saved. Everything you typed is still here.'))
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <PageBody width="form">
        <Skeleton className="h-96 w-full" />
      </PageBody>
    )
  }

  if (error) {
    return (
      <PageBody width="form">
        <Panel>
          <ErrorState title="Could not open the campaign editor" detail={error} onRetry={refresh} />
        </Panel>
      </PageBody>
    )
  }

  return (
    <PageBody width="form">
      <PageHeader
        title="Create campaign"
        description="Saving creates a draft. Sending is a separate, confirmed step."
        back={{ href: '/campaigns', label: 'Campaigns' }}
      />

      <div className="space-y-5">
        {saveError && (
          <Banner tone="danger" title="Draft not saved">
            {saveError}
          </Banner>
        )}

        <FormSection title="Who it comes from" scope="Recipients see this number as the sender.">
          <Input
            label="Campaign name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="For your reference only. Customers never see it."
            placeholder="May promotion"
          />
          <Select
            label="Send from"
            required
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          >
            <option value="">Choose a number…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sessionName}
              </option>
            ))}
          </Select>
          {channel && channel.status !== 'connected' && (
            <Banner tone="warning" title={`“${channel.sessionName}” is not reported connected`}>
              You can still save this draft, but sending will fail until the number is connected.{' '}
              <Link href="/channels/whatsapp" className="font-semibold underline underline-offset-2">
                Open WhatsApp channels
              </Link>
            </Banner>
          )}
          {channels.length === 0 && (
            <Banner tone="warning" title="No numbers to send from">
              Connect a WhatsApp number before creating a campaign.{' '}
              <Link href="/channels/whatsapp" className="font-semibold underline underline-offset-2">
                Connect a number
              </Link>
            </Banner>
          )}
        </FormSection>

        <FormSection title="What it says" scope="The same message goes to everyone, with the placeholders filled in per recipient.">
          <Textarea
            label="Message"
            required
            rows={6}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            hint="Use {{name}} and {{phone}} to personalise it. A recipient with no name gets an empty placeholder."
            placeholder="Hello {{name}}, we have a special offer for you this month."
          />
          {preview && (
            <div>
              <p className="mb-1 text-sm font-medium text-ink">
                Preview{sample ? ` for ${sample.name ?? sample.phone}` : ' (sample details)'}
              </p>
              <div className="rounded-md border border-line bg-inset px-3 py-2.5 text-sm leading-5 whitespace-pre-wrap text-ink">
                {preview}
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="Who receives it" scope="Duplicate numbers are removed automatically when the draft is saved.">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={audience === 'contacts' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAudience('contacts')}
            >
              From contacts
            </Button>
            <Button
              type="button"
              variant={audience === 'manual' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAudience('manual')}
            >
              Type numbers
            </Button>
          </div>

          {audience === 'contacts' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  className="min-w-0 flex-1"
                  value={search}
                  onChange={setSearch}
                  label="Search contacts"
                  placeholder="Search name or number"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelected(new Set(filteredContacts.map((c) => c.id)))}
                >
                  Select {filteredContacts.length} listed
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-line">
                {filteredContacts.length === 0 ? (
                  <p className="p-4 text-center text-sm text-ink-muted">
                    {contacts.length === 0 ? 'No contacts yet.' : 'No contacts match your search.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {filteredContacts.map((contact) => (
                      <li key={contact.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-hover">
                          <Checkbox
                            label={`Include ${contactLabel(contact.name, contact.phoneNumber)}`}
                            checked={selected.has(contact.id)}
                            onChange={(next) =>
                              setSelected((current) => {
                                const set = new Set(current)
                                if (next) set.add(contact.id)
                                else set.delete(contact.id)
                                return set
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {contactLabel(contact.name, contact.phoneNumber)}
                          </span>
                          <span className="shrink-0 text-xs text-ink-soft tabular-nums">
                            {contact.phoneNumber}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <Textarea
              label="Phone numbers"
              rows={8}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              hint="One per line. Either just the number, or number,Name — for example 601234567890,Jane Doe"
              placeholder={'601234567890\n601987654321,Jane Doe'}
            />
          )}
        </FormSection>

        <FormSection title="Sending options" scope="A gap between messages reduces the chance WhatsApp treats the run as spam.">
          <Input
            label="Delay between messages (seconds)"
            type="number"
            min={1}
            max={60}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            hint="Minimum 1 second. Shorter delays increase the risk of the number being blocked."
          />
        </FormSection>

        {/* Review before anything is created, so the choices are visible in one
            place rather than scattered up the form. */}
        <Panel>
          <PanelHeader title="Review" description="Check this before saving the draft." />
          <PanelBody>
            <KeyValues
              rows={[
                ['Campaign name', name.trim() || <span className="text-warning">Not set</span>],
                [
                  'Sent from',
                  channel ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {channel.sessionName}
                      <ChannelStatusBadge status={channel.status} />
                    </span>
                  ) : (
                    <span className="text-warning">Not chosen</span>
                  ),
                ],
                [
                  'Recipients',
                  recipients.length > 0 ? (
                    <span>
                      {recipients.length} {plural(recipients.length, 'recipient')}
                      {recipients.length > 0 && (
                        <span className="block text-xs text-ink-soft">
                          First: {recipients[0].name ?? recipients[0].phone}
                          {recipients.length > 1 && `, and ${recipients.length - 1} more`}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-warning">None selected</span>
                  ),
                ],
                [
                  'Sending behaviour',
                  <span key="delay">
                    One message every {delay} {plural(delay, 'second')}
                    {recipients.length > 1 && estimatedMinutes >= 1 && (
                      <span className="block text-xs text-ink-soft">
                        Roughly {estimatedMinutes} {plural(estimatedMinutes, 'minute')} from start to
                        finish if nothing fails.
                      </span>
                    )}
                  </span>,
                ],
              ]}
            />
            <Banner tone="info" title="Saving does not send" className="mt-4">
              This creates a draft. You confirm the send on the campaign page afterwards.
            </Banner>
          </PanelBody>
        </Panel>

        <Panel className="flex flex-wrap items-center justify-end gap-2 p-4">
          <Button variant="secondary" onClick={() => router.push('/campaigns')}>
            Cancel
          </Button>
          <Button onClick={saveDraft} pending={saving} pendingLabel="Saving…">
            Save draft
          </Button>
        </Panel>
      </div>
    </PageBody>
  )
}

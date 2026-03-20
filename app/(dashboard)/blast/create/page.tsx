'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input, Textarea, Select, SectionHeader, useToast } from '@/components/ui'
import { renderTemplate } from '@/lib/blast/renderer'

interface WASession {
  id: string
  sessionName: string
  status: string
}

interface Contact {
  id: string
  phoneNumber: string
  name: string | null
}

export default function CreateCampaignPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [waSessionId, setWaSessionId] = useState('')
  const [delaySeconds, setDelaySeconds] = useState('3')
  const [audienceTab, setAudienceTab] = useState<'contacts' | 'manual'>('contacts')

  const [sessions, setSessions] = useState<WASession[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [manualPhones, setManualPhones] = useState('')
  const [contactSearch, setContactSearch] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/wa/sessions').then(r => r.json()).then(setSessions).catch(() => {})
    fetch('/api/contacts').then(r => r.json()).then(setContacts).catch(() => {})
  }, [])

  function toggleContact(id: string) {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    const filtered = contacts.filter(c =>
      !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phoneNumber.includes(contactSearch)
    )
    setSelectedContacts(new Set(filtered.map(c => c.id)))
  }

  function clearAll() {
    setSelectedContacts(new Set())
  }

  function buildRecipients() {
    if (audienceTab === 'contacts') {
      return contacts
        .filter(c => selectedContacts.has(c.id))
        .map(c => ({ phone: c.phoneNumber, name: c.name ?? undefined }))
    }
    // Manual: each line is "phone" or "phone,Name"
    return manualPhones
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [phone, ...nameParts] = line.split(',')
        return { phone: phone.trim(), name: nameParts.join(',').trim() || undefined }
      })
  }

  const previewVars = { name: 'John', phone: '601234567890' }
  const preview = messageTemplate ? renderTemplate(messageTemplate, previewVars) : ''

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phoneNumber.includes(contactSearch)
  )

  async function handleSubmit() {
    if (!name.trim()) { toast('Campaign name is required', 'error'); return }
    if (!messageTemplate.trim()) { toast('Message template is required', 'error'); return }
    if (!waSessionId) { toast('Select a WhatsApp session', 'error'); return }

    const recipients = buildRecipients()
    if (recipients.length === 0) { toast('Add at least one recipient', 'error'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/blast/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, messageTemplate, waSessionId, delaySeconds: Number(delaySeconds), recipients }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Failed to create campaign', 'error'); return }
      toast('Campaign created', 'success')
      router.push(`/blast/${data.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  const recipientCount = audienceTab === 'contacts'
    ? selectedContacts.size
    : manualPhones.split('\n').filter(l => l.trim()).length

  return (
    <div className="p-8 max-w-3xl">
      <SectionHeader
        title="New Campaign"
        description="Set up your blast campaign"
      />

      <div className="space-y-5">
        {/* Campaign Details */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Campaign Details</h2>
          <Input
            label="Campaign Name"
            placeholder="e.g. Promo May 2026"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Select
            label="WhatsApp Session"
            value={waSessionId}
            onChange={e => setWaSessionId(e.target.value)}
          >
            <option value="">— Select session —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.sessionName} ({s.status})
              </option>
            ))}
          </Select>
          <Input
            label="Delay between messages (seconds)"
            hint="Minimum 1 second. Lower values increase ban risk."
            type="number"
            min={1}
            max={60}
            value={delaySeconds}
            onChange={e => setDelaySeconds(e.target.value)}
          />
        </Card>

        {/* Message Template */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Message Template</h2>
          <Textarea
            label="Template"
            hint="Use {{name}}, {{phone}} as variables"
            placeholder="Hello {{name}}, we have a special offer for you!"
            rows={5}
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value)}
          />
          {preview && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#475569]">Preview (sample data)</p>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3 text-sm text-[#0F172A] whitespace-pre-wrap">
                {preview}
              </div>
            </div>
          )}
        </Card>

        {/* Audience */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Audience</h2>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#E6EAF0]">
            {(['contacts', 'manual'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setAudienceTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  audienceTab === tab
                    ? 'border-b-2 border-[#16A34A] text-[#16A34A] -mb-px'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {tab === 'contacts' ? 'From Contacts' : 'Manual Entry'}
              </button>
            ))}
          </div>

          {audienceTab === 'contacts' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search contacts…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="flex-1 border border-[#E6EAF0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                />
                <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-[#E6EAF0] rounded-lg divide-y divide-[#F1F5F9]">
                {filteredContacts.length === 0 ? (
                  <p className="p-4 text-sm text-[#94A3B8] text-center">No contacts found</p>
                ) : (
                  filteredContacts.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        className="accent-[#16A34A] w-4 h-4"
                      />
                      <span className="text-sm text-[#0F172A]">{c.name ?? c.phoneNumber}</span>
                      <span className="text-xs text-[#94A3B8] ml-auto">{c.phoneNumber}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Textarea
              label="Phone numbers"
              hint="One per line. Format: phone or phone,Name (e.g. 601234567890,John)"
              placeholder={"601234567890\n601987654321,Jane Doe"}
              rows={8}
              value={manualPhones}
              onChange={e => setManualPhones(e.target.value)}
            />
          )}

          {recipientCount > 0 && (
            <p className="text-xs text-[#475569]">
              <span className="font-semibold text-[#16A34A]">{recipientCount}</span> recipient{recipientCount !== 1 ? 's' : ''} selected
            </p>
          )}
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button loading={submitting} onClick={handleSubmit}>
            Create Campaign
          </Button>
        </div>
      </div>
    </div>
  )
}

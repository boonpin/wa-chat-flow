'use client'

import { useEffect, useState } from 'react'

interface Bot {
  id: string
  name: string
}

interface Contact {
  id: string
  phoneNumber: string
  name: string | null
  aiEnabled: boolean
  aiBotId: string | null
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bots, setBots] = useState<Bot[]>([])

  async function fetchData() {
    const [cr, br] = await Promise.all([fetch('/api/contacts'), fetch('/api/bots')])
    setContacts(await cr.json())
    setBots(await br.json())
  }

  useEffect(() => { fetchData() }, [])

  async function updateContact(id: string, data: Partial<Contact>) {
    await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchData()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contacts</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No contacts yet. Contacts will appear when WhatsApp messages are received.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Phone</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">AI Reply</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Assigned Bot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{contact.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateContact(contact.id, { aiEnabled: !contact.aiEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        contact.aiEnabled ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                        contact.aiEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={contact.aiBotId || ''}
                      onChange={e => updateContact(contact.id, { aiBotId: e.target.value || null })}
                      className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="">Default Bot</option>
                      {bots.map(bot => (
                        <option key={bot.id} value={bot.id}>{bot.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

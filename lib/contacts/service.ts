import { db } from '@/lib/db'
import { contacts, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { repliesToNew, type AutoReplyMode } from '@/lib/settings/auto-reply'

export type Contact = typeof contacts.$inferSelect

/**
 * Looks up a contact by phone number, creating it on first contact.
 *
 * A new contact is set to AI replies only while the workspace is fully
 * automatic. Under `existing` the whole point is that nobody new is answered
 * automatically, so a first-time customer arrives with AI off — the same as
 * when auto-reply is off entirely.
 */
export function findOrCreateContact(input: {
  phone: string
  name?: string
  waSessionId?: string
}): Contact {
  const existing = db.select().from(contacts).where(eq(contacts.phoneNumber, input.phone)).get()
  const now = new Date().toISOString()

  if (existing) {
    // Backfill details we did not know when the contact was first created.
    const patch: Partial<Contact> = {}
    if (!existing.name && input.name) patch.name = input.name
    if (!existing.waSessionId && input.waSessionId) patch.waSessionId = input.waSessionId

    if (Object.keys(patch).length > 0) {
      db.update(contacts)
        .set({ ...patch, updatedAt: now })
        .where(eq(contacts.id, existing.id))
        .run()
      return { ...existing, ...patch }
    }
    return existing
  }

  const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()

  const contact: Contact = {
    id: uuidv4(),
    phoneNumber: input.phone,
    name: input.name ?? input.phone,
    aiEnabled: repliesToNew((settings?.autoReplyMode ?? 'off') as AutoReplyMode),
    aiBotId: null,
    waSessionId: input.waSessionId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(contacts).values(contact).run()
  return contact
}

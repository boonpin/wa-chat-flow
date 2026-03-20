import { Client, LocalAuth } from 'whatsapp-web.js'
import { db } from '@/lib/db'
import { contacts, systemSettings, aiBots, messages, waSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateAIReply } from '@/lib/ai/engine'
import { v4 as uuidv4 } from 'uuid'

type WAStatus = 'offline' | 'waiting_qr' | 'connected'

// Use globalThis to survive Next.js hot reloads in dev mode
declare global {
  var __waClients: Map<string, Client>
  var __waQrCodes: Map<string, string | null>
  var __waStatuses: Map<string, WAStatus>
  var __waInitializing: Set<string>
}

globalThis.__waClients ??= new Map()
globalThis.__waQrCodes ??= new Map()
globalThis.__waStatuses ??= new Map()
globalThis.__waInitializing ??= new Set()

export function getWAStatus(sessionId: string): WAStatus {
  return globalThis.__waStatuses.get(sessionId) ?? 'offline'
}

export function getQRCode(sessionId: string): string | null {
  return globalThis.__waQrCodes.get(sessionId) ?? null
}

export function getClient(sessionId: string): Client | undefined {
  return globalThis.__waClients.get(sessionId)
}

export async function initWhatsappClient(sessionId: string) {
  if (globalThis.__waClients.has(sessionId) || globalThis.__waInitializing.has(sessionId)) return

  globalThis.__waInitializing.add(sessionId)

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: './storage/data/wa-sessions',
    }),
    webVersionCache: {
      type: 'local',
      path: './storage/data/.wwebjs_cache',
    },
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })

  globalThis.__waClients.set(sessionId, client)

  client.on('qr', (qr) => {
    globalThis.__waQrCodes.set(sessionId, qr)
    globalThis.__waStatuses.set(sessionId, 'waiting_qr')
    updateSessionStatus(sessionId, 'waiting_qr')
  })

  client.on('ready', () => {
    globalThis.__waStatuses.set(sessionId, 'connected')
    globalThis.__waQrCodes.set(sessionId, null)
    globalThis.__waInitializing.delete(sessionId)
    updateSessionStatus(sessionId, 'connected')
  })

  client.on('disconnected', () => {
    globalThis.__waStatuses.set(sessionId, 'offline')
    globalThis.__waQrCodes.set(sessionId, null)
    globalThis.__waClients.delete(sessionId)
    globalThis.__waInitializing.delete(sessionId)
    updateSessionStatus(sessionId, 'offline')
  })

  client.on('message', async (msg) => {
    if (msg.fromMe) return
    if (msg.from.endsWith('@g.us')) return

    const phone = msg.from.replace('@c.us', '')

    // Check system auto reply first so new contacts inherit the setting
    const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()

    // Get or create contact
    let contact = db.select().from(contacts).where(eq(contacts.phoneNumber, phone)).get()

    if (!contact) {
      const waContact = await msg.getContact()
      const now = new Date().toISOString()
      const newContact = {
        id: uuidv4(),
        phoneNumber: phone,
        name: waContact.pushname || waContact.name || phone,
        aiEnabled: settings?.autoReplyEnabled ?? false,
        aiBotId: null,
        waSessionId: sessionId,
        createdAt: now,
        updatedAt: now,
      }
      db.insert(contacts).values(newContact).run()
      contact = newContact
    }

    console.log(`[WA] [IN]  ${contact.name || phone}: ${msg.body}`)

    // Log incoming message
    db.insert(messages).values({
      id: uuidv4(),
      contactId: contact.id,
      direction: 'incoming',
      message: msg.body,
      createdAt: new Date().toISOString(),
    }).run()

    if (!settings?.autoReplyEnabled) return

    // Check contact ai enabled
    if (!contact.aiEnabled) return

    // Get bot
    let bot = null
    if (contact.aiBotId) {
      bot = db.select().from(aiBots).where(eq(aiBots.id, contact.aiBotId)).get()
    }
    if (!bot && settings.defaultBotId) {
      bot = db.select().from(aiBots).where(eq(aiBots.id, settings.defaultBotId)).get()
    }
    if (!bot) {
      bot = db.select().from(aiBots).where(eq(aiBots.isDefault, true)).get()
    }
    if (!bot) return

    try {
      const reply = await generateAIReply(bot, msg.body)
      const activeClient = globalThis.__waClients.get(sessionId)
      if (activeClient) {
        await activeClient.sendMessage(msg.from, reply)
      }

      console.log(`[WA] [AI]  ${contact.name || phone}: ${reply}`)

      // Log outgoing message
      db.insert(messages).values({
        id: uuidv4(),
        contactId: contact.id,
        direction: 'outgoing',
        message: reply,
        createdAt: new Date().toISOString(),
      }).run()
    } catch (err) {
      console.error('AI reply error:', err)
    }
  })

  try {
    await client.initialize()
    console.log(`WhatsApp client initialized: ${sessionId}`)
  } catch (err) {
    console.error(`WhatsApp client init error (${sessionId}):`, err)
    globalThis.__waClients.delete(sessionId)
    globalThis.__waInitializing.delete(sessionId)
  }
}

function updateSessionStatus(sessionId: string, newStatus: string) {
  const existing = db.select().from(waSessions).where(eq(waSessions.id, sessionId)).get()
  const now = new Date().toISOString()
  if (existing) {
    db.update(waSessions)
      .set({ status: newStatus, lastConnectedAt: newStatus === 'connected' ? now : existing.lastConnectedAt })
      .where(eq(waSessions.id, sessionId))
      .run()
  } else {
    db.insert(waSessions).values({
      id: sessionId,
      sessionName: sessionId,
      status: newStatus,
      lastConnectedAt: newStatus === 'connected' ? now : null,
    }).run()
  }
}

export async function logoutWhatsapp(sessionId: string) {
  const client = globalThis.__waClients.get(sessionId)
  if (client) {
    try {
      await client.logout()
    } catch {
      // ignore logout errors
    }
    try {
      await client.destroy()
    } catch {
      // ignore destroy errors
    }
    globalThis.__waClients.delete(sessionId)
    globalThis.__waStatuses.set(sessionId, 'offline')
    globalThis.__waQrCodes.set(sessionId, null)
    globalThis.__waInitializing.delete(sessionId)
    updateSessionStatus(sessionId, 'offline')
  }
}

// Initialize all sessions stored in the DB at server startup
export async function initAllSessions() {
  const sessions = db.select().from(waSessions).all()
  for (const session of sessions) {
    initWhatsappClient(session.id).catch(console.error)
  }
}

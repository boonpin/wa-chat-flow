import { Client, LocalAuth } from 'whatsapp-web.js'
import { db } from '@/lib/db'
import { contacts, systemSettings, aiBots, messages, waSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateAIReply } from '@/lib/ai/engine'
import { v4 as uuidv4 } from 'uuid'

// Use globalThis to survive Next.js hot reloads in dev mode
declare global {
  // eslint-disable-next-line no-var
  var __waClient: Client | null
  // eslint-disable-next-line no-var
  var __waQrCode: string | null
  // eslint-disable-next-line no-var
  var __waStatus: 'offline' | 'waiting_qr' | 'connected'
  // eslint-disable-next-line no-var
  var __waInitializing: boolean
}

globalThis.__waClient ??= null
globalThis.__waQrCode ??= null
globalThis.__waStatus ??= 'offline'
globalThis.__waInitializing ??= false

export function getWAStatus() {
  return globalThis.__waStatus
}

export function getQRCode() {
  return globalThis.__waQrCode
}

export function getClient() {
  return globalThis.__waClient
}

export async function initWhatsappClient() {
  if (globalThis.__waClient || globalThis.__waInitializing) return

  globalThis.__waInitializing = true

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './data/wa-sessions' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })

  globalThis.__waClient = client

  client.on('qr', (qr) => {
    globalThis.__waQrCode = qr
    globalThis.__waStatus = 'waiting_qr'
    updateSessionStatus('waiting_qr')
  })

  client.on('ready', () => {
    globalThis.__waStatus = 'connected'
    globalThis.__waQrCode = null
    globalThis.__waInitializing = false
    updateSessionStatus('connected')
  })

  client.on('disconnected', () => {
    globalThis.__waStatus = 'offline'
    globalThis.__waQrCode = null
    globalThis.__waClient = null
    globalThis.__waInitializing = false
    updateSessionStatus('offline')
  })

  client.on('message', async (msg) => {
    if (msg.fromMe) return
    if (msg.from.endsWith('@g.us')) return

    const phone = msg.from.replace('@c.us', '')

    // Get or create contact
    let contact = db.select().from(contacts).where(eq(contacts.phoneNumber, phone)).get()

    if (!contact) {
      const waContact = await msg.getContact()
      const now = new Date().toISOString()
      const newContact = {
        id: uuidv4(),
        phoneNumber: phone,
        name: waContact.pushname || waContact.name || phone,
        aiEnabled: false,
        aiBotId: null,
        createdAt: now,
        updatedAt: now,
      }
      db.insert(contacts).values(newContact).run()
      contact = newContact
    }

    // Log incoming message
    db.insert(messages).values({
      id: uuidv4(),
      contactId: contact.id,
      direction: 'incoming',
      message: msg.body,
      createdAt: new Date().toISOString(),
    }).run()

    // Check system auto reply
    const settings = db.select().from(systemSettings).where(eq(systemSettings.id, 'default')).get()
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
      await globalThis.__waClient!.sendMessage(msg.from, reply)

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
    console.log('WhatsApp client initialized')
  } catch (err) {
    console.error('WhatsApp client init error:', err)
    globalThis.__waClient = null
    globalThis.__waInitializing = false
  }
}

function updateSessionStatus(newStatus: string) {
  const existing = db.select().from(waSessions).where(eq(waSessions.id, 'main')).get()
  const now = new Date().toISOString()
  if (existing) {
    db.update(waSessions)
      .set({ status: newStatus, lastConnectedAt: newStatus === 'connected' ? now : existing.lastConnectedAt })
      .where(eq(waSessions.id, 'main'))
      .run()
  } else {
    db.insert(waSessions).values({
      id: 'main',
      sessionName: 'main',
      status: newStatus,
      lastConnectedAt: newStatus === 'connected' ? now : null,
    }).run()
  }
}

export async function logoutWhatsapp() {
  const client = globalThis.__waClient
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
    globalThis.__waClient = null
    globalThis.__waStatus = 'offline'
    globalThis.__waQrCode = null
    globalThis.__waInitializing = false
    updateSessionStatus('offline')
  }
}

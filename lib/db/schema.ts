import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
})

export const aiBots = sqliteTable('ai_bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(), // openai | gemini
  apiKey: text('api_key').notNull(),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const waSessions = sqliteTable('wa_sessions', {
  id: text('id').primaryKey(),
  sessionName: text('session_name').notNull(),
  status: text('status').notNull().default('offline'), // offline | waiting_qr | connected
  lastConnectedAt: text('last_connected_at'),
})

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  phoneNumber: text('phone_number').notNull().unique(),
  name: text('name'),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(false),
  aiBotId: text('ai_bot_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(),
  autoReplyEnabled: integer('auto_reply_enabled', { mode: 'boolean' }).notNull().default(false),
  defaultBotId: text('default_bot_id'),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull(),
  direction: text('direction').notNull(), // incoming | outgoing
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
})

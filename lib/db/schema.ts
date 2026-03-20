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
  waSessionId: text('wa_session_id'),
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

export const blastCampaigns = sqliteTable('blast_campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  messageTemplate: text('message_template').notNull(),
  waSessionId: text('wa_session_id').notNull(),
  status: text('status').notNull().default('draft'), // draft | sending | paused | completed | cancelled | failed
  totalRecipients: integer('total_recipients').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  delaySeconds: integer('delay_seconds').notNull().default(3),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const blastRecipients = sqliteTable('blast_recipients', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull(),
  phone: text('phone').notNull(),
  name: text('name'),
  variables: text('variables'), // JSON string
  status: text('status').notNull().default('pending'), // pending | sending | sent | failed | skipped
  providerMessageId: text('provider_message_id'),
  error: text('error'),
  sentAt: text('sent_at'),
})

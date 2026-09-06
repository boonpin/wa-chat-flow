import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
})

/**
 * One AI account: which vendor, the key that bills to it, and the model to run.
 *
 * A bot points at a provider rather than carrying its own key, so the key is
 * configured once, the model is picked from what that key can actually reach
 * (see `listModels` in lib/ai/providers/), and every API call has an account to
 * attribute its tokens to — which is what `ai_usage` records.
 */
export const aiProviders = sqliteTable('ai_providers', {
  id: text('id').primaryKey(),
  /** Operator-facing label, e.g. "OpenAI — production". Free text. */
  name: text('name').notNull(),
  /** Which SDK translates the call: openai | gemini. */
  kind: text('kind').notNull(),
  /** Optional. Falls back to OPENAI_API_KEY / GEMINI_API_KEY from the env. */
  apiKey: text('api_key'),
  /** Model id, chosen from the vendor's own model list. */
  model: text('model').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const aiBots = sqliteTable('ai_bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /**
   * The AI account this bot answers through — vendor, key and model all come
   * from that row (see `ai_providers`). Null only for a bot whose provider was
   * deleted, which `resolveConnection` reports rather than silently guessing.
   */
  providerId: text('provider_id'),
  prompt: text('prompt').notNull(),
  /** direct = call the LLM straight; external_agent = hand off to Agent Runtime. */
  handlerType: text('handler_type').notNull().default('direct'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const waSessions = sqliteTable('wa_sessions', {
  id: text('id').primaryKey(),
  sessionName: text('session_name').notNull(),
  /** Transport that backs this session. Only 'waha' today. */
  provider: text('provider').notNull().default('waha'),
  status: text('status').notNull().default('offline'), // offline | starting | waiting_qr | connected | failed
  lastConnectedAt: text('last_connected_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    phoneNumber: text('phone_number').notNull().unique(),
    name: text('name'),
    /** Default auto-reply mode applied to newly opened conversations. */
    aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(false),
    aiBotId: text('ai_bot_id'),
    waSessionId: text('wa_session_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_contacts_wa_session').on(t.waSessionId)]
)

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id').notNull(),
    waSessionId: text('wa_session_id'),
    botId: text('bot_id'),
    /** auto = AI replies; human = operator handles it. */
    mode: text('mode').notNull().default('human'),
    status: text('status').notNull().default('open'), // open | resolved
    lastMessageAt: text('last_message_at'),
    /**
     * When the debounced AI reply for this thread is due, or null when none is
     * owed. Persisted rather than kept in the timer alone so a restart during
     * the hold window can pick the reply back up — see
     * lib/messaging/reply-scheduler.ts.
     */
    autoReplyDueAt: text('auto_reply_due_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_conversations_contact').on(t.contactId),
    index('idx_conversations_status').on(t.status, t.lastMessageAt),
    index('idx_conversations_open').on(t.contactId, t.status),
    index('idx_conversations_reply_due').on(t.autoReplyDueAt),
  ]
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    /** Denormalised for cheap contact-scoped queries. */
    contactId: text('contact_id').notNull(),
    provider: text('provider').notNull().default('waha'),
    /** Provider-side id. Used to deduplicate repeated webhook deliveries. */
    providerMessageId: text('provider_message_id'),
    direction: text('direction').notNull(), // incoming | outgoing
    senderType: text('sender_type').notNull(), // customer | ai | human | system
    messageType: text('message_type').notNull().default('text'), // text | image | audio | document | unknown
    content: text('content').notNull().default(''),
    status: text('status').notNull().default('received'), // received | processing | sent | failed
    error: text('error'),
    /** Set on `message_type = 'tool'` rows, linking to what the call actually captured. */
    toolInvocationId: text('tool_invocation_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_messages_conversation').on(t.conversationId, t.createdAt),
    index('idx_messages_contact').on(t.contactId, t.createdAt),
    uniqueIndex('idx_messages_provider_message_id').on(t.provider, t.providerMessageId),
  ]
)

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(),
  /**
   * How much of the workspace the AI answers: `all`, `existing` or `off`.
   * See lib/settings/auto-reply.ts — `existing` is the damper that keeps
   * running threads on AI while opening every new one on human replies.
   */
  autoReplyMode: text('auto_reply_mode').notNull().default('off'),
  defaultBotId: text('default_bot_id'),
  /**
   * How long to wait for the customer to stop typing before answering, and the
   * hard ceiling on that wait. See lib/settings/reply-timing.ts — a window of
   * zero restores one reply per message.
   */
  replyWindowSeconds: integer('reply_window_seconds').notNull().default(8),
  replyMaxWaitSeconds: integer('reply_max_wait_seconds').notNull().default(45),
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

export const blastRecipients = sqliteTable(
  'blast_recipients',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').notNull(),
    phone: text('phone').notNull(),
    name: text('name'),
    variables: text('variables'), // JSON string
    status: text('status').notNull().default('pending'), // pending | sending | sent | failed | skipped
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    sentAt: text('sent_at'),
  },
  (t) => [index('idx_blast_recipients_campaign_status').on(t.campaignId, t.status)]
)

/**
 * A capability the AI can invoke mid-conversation. `sheet_capture` — the only
 * kind today — collects a configurable set of fields from the customer and
 * appends them to a Google Sheet. Sales and support are two rows here, not two
 * code paths: `fields` drives the schema the model sees, the server-side
 * validation, and the sheet column order all at once.
 */
export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),
  /** The function name the LLM sees. Must match /^[a-z][a-z0-9_]*$/. */
  name: text('name').notNull().unique(),
  kind: text('kind').notNull().default('sheet_capture'),
  /** Shown to the model. This *is* the routing logic — it decides sales vs support. */
  description: text('description').notNull(),
  /** Transport that writes the row. Only 'apps_script' today. */
  sinkType: text('sink_type').notNull().default('apps_script'),
  /** Apps Script /exec URL. A bearer secret — never returned to the client. */
  sinkUrl: text('sink_url'),
  /** Shared token echoed in the POST body, so the URL alone cannot write. */
  sinkSecret: text('sink_secret'),
  /** The human-facing sheet link. Display only; writes go through sinkUrl. */
  spreadsheetUrl: text('spreadsheet_url'),
  /** Tab within the spreadsheet, e.g. "Leads" or "Support". */
  sheetTab: text('sheet_tab').notNull().default('Sheet1'),
  /** JSON array of ToolField — see lib/tools/types.ts. */
  fields: text('fields').notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/** Which tools a bot may call. A bot with no rows here behaves exactly as before. */
export const botTools = sqliteTable(
  'bot_tools',
  {
    botId: text('bot_id').notNull(),
    toolId: text('tool_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.botId, t.toolId] }),
    index('idx_bot_tools_bot').on(t.botId),
  ]
)

/**
 * Every capture attempt, written *before* the sink is called.
 *
 * Same reasoning as outgoing messages: if Google is unreachable or the script
 * is misconfigured, the lead is still on disk and visibly failed, rather than
 * silently lost. This table is also the retry queue.
 */
export const toolInvocations = sqliteTable(
  'tool_invocations',
  {
    id: text('id').primaryKey(),
    toolId: text('tool_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    contactId: text('contact_id').notNull(),
    /** JSON object of validated field values, keyed by field name. */
    args: text('args').notNull(),
    /**
     * JSON of exactly what was transmitted to the sink, credentials removed.
     * Null when nothing was sent. Differs from `args`: the sink sends column
     * labels plus contact and conversation columns, not the raw field keys.
     */
    payload: text('payload'),
    status: text('status').notNull().default('pending'), // pending | synced | failed | not_submitted
    error: text('error'),
    createdAt: text('created_at').notNull(),
    syncedAt: text('synced_at'),
  },
  (t) => [
    index('idx_tool_invocations_conversation').on(t.conversationId, t.createdAt),
    index('idx_tool_invocations_status').on(t.status, t.createdAt),
  ]
)

/**
 * One row per API call to a model provider, written whether the call succeeded
 * or not.
 *
 * A single reply can be several calls — the tool loop asks again after every
 * round — so this is not one row per message. `kind` and `model` are snapshots
 * rather than joins: what the call actually cost stays true after the provider
 * row is edited or the bot is repointed at another account.
 */
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: text('id').primaryKey(),
    /** Null once the provider row is gone; the snapshot columns still read. */
    providerId: text('provider_id'),
    botId: text('bot_id'),
    conversationId: text('conversation_id'),
    /**
     * The reply these tokens paid for, stamped on *after* the message is sent —
     * the call happens before the message row exists. Null is normal and means
     * one of two things: the reply failed before it was sent, or the call was a
     * tool round whose message never materialised. Several rows share one id
     * when the model needed more than one round.
     */
    messageId: text('message_id'),
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** As the vendor reported it — not always input + output. */
    totalTokens: integer('total_tokens').notNull().default(0),
    /** Which round of the tool loop this call was; 0 is the first ask. */
    round: integer('round').notNull().default(0),
    status: text('status').notNull().default('ok'), // ok | failed
    error: text('error'),
    latencyMs: integer('latency_ms'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_ai_usage_provider').on(t.providerId, t.createdAt),
    index('idx_ai_usage_bot').on(t.botId, t.createdAt),
    index('idx_ai_usage_conversation').on(t.conversationId, t.createdAt),
    index('idx_ai_usage_message').on(t.messageId),
  ]
)

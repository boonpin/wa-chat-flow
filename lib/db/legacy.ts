import type Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * One-time upgrade for databases created before Drizzle migrations existed.
 *
 * Those databases were built by raw `CREATE TABLE` / `ALTER TABLE` statements at
 * application startup, so they have no `__drizzle_migrations` bookkeeping table.
 * Running migration 0000 against them would fail ("table already exists"), so we
 * instead reshape them in place to match the 0000 schema and then stamp 0000 as
 * applied. From that point on the normal Drizzle migrator takes over.
 *
 * Returns true if a legacy database was upgraded.
 */
export function baselineLegacyDatabase(sqlite: Database.Database, migrationsFolder: string): boolean {
  if (!tableExists(sqlite, 'users')) return false // fresh database — let 0000 create everything
  if (tableExists(sqlite, '__drizzle_migrations')) return false // already on Drizzle

  console.log('[db] Legacy database detected — upgrading to the conversation schema…')

  sqlite.pragma('foreign_keys = OFF')
  sqlite.transaction(() => {
    upgradeAiBots(sqlite)
    upgradeWaSessions(sqlite)
    upgradeContacts(sqlite)
    createConversationsAndMessages(sqlite)
    createRemainingIndexes(sqlite)
  })()
  sqlite.pragma('foreign_keys = ON')

  stampBaseline(sqlite, migrationsFolder)
  console.log('[db] Legacy upgrade complete.')
  return true
}

function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = ?`)
    .get(name)
  return !!row
}

function columnNames(sqlite: Database.Database, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
}

function upgradeAiBots(sqlite: Database.Database) {
  // api_key becomes nullable (env fallback) and handler_type / enabled are added.
  sqlite.exec(`
    CREATE TABLE ai_bots__new (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      provider text NOT NULL,
      api_key text,
      model text NOT NULL,
      prompt text NOT NULL,
      handler_type text DEFAULT 'direct' NOT NULL,
      enabled integer DEFAULT true NOT NULL,
      is_default integer DEFAULT false NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
    INSERT INTO ai_bots__new (id, name, provider, api_key, model, prompt, handler_type, enabled, is_default, created_at, updated_at)
      SELECT id, name, provider, api_key, model, prompt, 'direct', 1, is_default, created_at, updated_at FROM ai_bots;
    DROP TABLE ai_bots;
    ALTER TABLE ai_bots__new RENAME TO ai_bots;
  `)
}

function upgradeWaSessions(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE wa_sessions__new (
      id text PRIMARY KEY NOT NULL,
      session_name text NOT NULL,
      provider text DEFAULT 'waha' NOT NULL,
      status text DEFAULT 'offline' NOT NULL,
      last_connected_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
    INSERT INTO wa_sessions__new (id, session_name, provider, status, last_connected_at, created_at, updated_at)
      SELECT id, session_name, 'waha', 'offline', last_connected_at,
             COALESCE(last_connected_at, datetime('now')), datetime('now')
      FROM wa_sessions;
    DROP TABLE wa_sessions;
    ALTER TABLE wa_sessions__new RENAME TO wa_sessions;
  `)
}

function upgradeContacts(sqlite: Database.Database) {
  // wa_session_id may or may not exist depending on how far the old ALTER chain ran.
  const hasWaSessionId = columnNames(sqlite, 'contacts').includes('wa_session_id')
  sqlite.exec(`
    CREATE TABLE contacts__new (
      id text PRIMARY KEY NOT NULL,
      phone_number text NOT NULL,
      name text,
      ai_enabled integer DEFAULT false NOT NULL,
      ai_bot_id text,
      wa_session_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
    INSERT INTO contacts__new (id, phone_number, name, ai_enabled, ai_bot_id, wa_session_id, created_at, updated_at)
      SELECT id, phone_number, name, ai_enabled, ai_bot_id, ${hasWaSessionId ? 'wa_session_id' : 'NULL'}, created_at, updated_at
      FROM contacts;
    DROP TABLE contacts;
    ALTER TABLE contacts__new RENAME TO contacts;
    CREATE UNIQUE INDEX contacts_phone_number_unique ON contacts (phone_number);
    CREATE INDEX idx_contacts_wa_session ON contacts (wa_session_id);
  `)
}

function createConversationsAndMessages(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE conversations (
      id text PRIMARY KEY NOT NULL,
      contact_id text NOT NULL,
      wa_session_id text,
      bot_id text,
      mode text DEFAULT 'human' NOT NULL,
      status text DEFAULT 'open' NOT NULL,
      last_message_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    -- One open conversation per contact that already has message history.
    INSERT INTO conversations (id, contact_id, wa_session_id, bot_id, mode, status, last_message_at, created_at, updated_at)
      SELECT
        lower(hex(randomblob(16))),
        c.id,
        c.wa_session_id,
        c.ai_bot_id,
        CASE WHEN c.ai_enabled = 1 THEN 'auto' ELSE 'human' END,
        'open',
        (SELECT MAX(m.created_at) FROM messages m WHERE m.contact_id = c.id),
        c.created_at,
        c.updated_at
      FROM contacts c
      WHERE EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = c.id);

    CREATE TABLE messages__new (
      id text PRIMARY KEY NOT NULL,
      conversation_id text NOT NULL,
      contact_id text NOT NULL,
      provider text DEFAULT 'waha' NOT NULL,
      provider_message_id text,
      direction text NOT NULL,
      sender_type text NOT NULL,
      message_type text DEFAULT 'text' NOT NULL,
      content text DEFAULT '' NOT NULL,
      status text DEFAULT 'received' NOT NULL,
      error text,
      created_at text NOT NULL
    );

    INSERT INTO messages__new (id, conversation_id, contact_id, provider, provider_message_id, direction, sender_type, message_type, content, status, created_at)
      SELECT
        m.id,
        conv.id,
        m.contact_id,
        'waha',
        NULL,
        m.direction,
        CASE WHEN m.direction = 'incoming' THEN 'customer' ELSE 'ai' END,
        'text',
        m.message,
        CASE WHEN m.direction = 'incoming' THEN 'received' ELSE 'sent' END,
        m.created_at
      FROM messages m
      JOIN conversations conv ON conv.contact_id = m.contact_id;

    DROP TABLE messages;
    ALTER TABLE messages__new RENAME TO messages;
  `)
}

function createRemainingIndexes(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations (contact_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status, last_message_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_open ON conversations (contact_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages (provider, provider_message_id);
    CREATE INDEX IF NOT EXISTS idx_blast_recipients_campaign_status ON blast_recipients (campaign_id, status);
  `)
}

/**
 * Records migration 0000 as already applied, using the same bookkeeping shape
 * Drizzle's better-sqlite3 migrator uses.
 */
function stampBaseline(sqlite: Database.Database, migrationsFolder: string) {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
  ) as { entries: { tag: string; when: number }[] }

  const first = journal.entries[0]
  if (!first) return

  const sql = fs.readFileSync(path.join(migrationsFolder, `${first.tag}.sql`), 'utf8')
  const hash = crypto.createHash('sha256').update(sql).digest('hex')

  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  )`)
  sqlite
    .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run(hash, first.when)
}

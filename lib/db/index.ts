import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

function createDb() {
  const dataDir = path.join(process.cwd(), 'storage', 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const sqlite = new Database(path.join(dataDir, 'app.db'))
  sqlite.pragma('journal_mode = WAL')

  const db = drizzle(sqlite, { schema })

  // Initialize tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wa_sessions (
      id TEXT PRIMARY KEY,
      session_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      last_connected_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL UNIQUE,
      name TEXT,
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      ai_bot_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      auto_reply_enabled INTEGER NOT NULL DEFAULT 0,
      default_bot_id TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blast_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      message_template TEXT NOT NULL,
      wa_session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_recipients INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      delay_seconds INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blast_recipients (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT,
      variables TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_message_id TEXT,
      error TEXT,
      sent_at TEXT
    );
  `)

  // Migrations for new columns
  try { sqlite.exec(`ALTER TABLE contacts ADD COLUMN wa_session_id TEXT`) } catch { /* already exists */ }

  // Seed default settings
  const existingSettings = sqlite.prepare('SELECT id FROM system_settings WHERE id = ?').get('default')
  if (!existingSettings) {
    sqlite.prepare('INSERT INTO system_settings (id, auto_reply_enabled, default_bot_id) VALUES (?, 0, NULL)').run('default')
  }

  // Seed default admin user (admin@admin.com / admin123)
  const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get('admin@admin.com')
  if (!existingUser) {
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync('admin123', 10)
    const { v4: uuidv4 } = require('uuid')
    sqlite.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      uuidv4(),
      'admin@admin.com',
      hash,
      new Date().toISOString()
    )
  }

  return db
}

let _db: ReturnType<typeof createDb> | null = null

export function getDb() {
  if (!_db) {
    _db = createDb()
  }
  return _db
}

// Proxy object for backwards compatibility - accessing any property initializes the db
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop]
  },
})

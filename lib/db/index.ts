import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'
import { baselineLegacyDatabase } from './legacy'
import { adminBootstrap, dataDir } from '@/lib/config'

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle')

function createDb() {
  const dir = path.isAbsolute(dataDir) ? dataDir : path.join(process.cwd(), dataDir)
  fs.mkdirSync(dir, { recursive: true })

  const sqlite = new Database(path.join(dir, 'app.db'))

  // ─── SQLite hardening ───────────────────────────────────────────────────────
  // WAL keeps readers from blocking the webhook writer; busy_timeout absorbs the
  // brief lock contention that comes with concurrent request handlers.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')

  // ─── Schema ─────────────────────────────────────────────────────────────────
  baselineLegacyDatabase(sqlite, MIGRATIONS_FOLDER)

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  seedDefaults(sqlite)

  return db
}

function seedDefaults(sqlite: Database.Database) {
  const existingSettings = sqlite.prepare('SELECT id FROM system_settings WHERE id = ?').get('default')
  if (!existingSettings) {
    sqlite
      .prepare('INSERT INTO system_settings (id, auto_reply_enabled, default_bot_id) VALUES (?, 0, NULL)')
      .run('default')
  }

  // Bootstrap admin comes from the environment. With no ADMIN_PASSWORD set, no
  // account is created — run `pnpm seed` to create one interactively instead.
  const { email, password } = adminBootstrap
  if (!email || !password) {
    const anyUser = sqlite.prepare('SELECT id FROM users LIMIT 1').get()
    if (!anyUser) {
      console.warn(
        '[db] No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are unset. ' +
          'Set them in .env or run `pnpm seed` to create the first account.'
      )
    }
    return
  }

  const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (!existingUser) {
    sqlite
      .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), email, bcrypt.hashSync(password, 10), new Date().toISOString())
    console.log(`[db] Created bootstrap admin user: ${email}`)
  }
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

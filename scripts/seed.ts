/**
 * Creates or resets the admin account.
 *
 * Credentials come from the environment — nothing is hardcoded:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' pnpm seed
 */
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { getDb } from '../lib/db'
import { dataDir } from '../lib/config'

const email = process.env.ADMIN_EMAIL?.trim()
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running the seed, e.g.')
  console.error("  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' pnpm seed")
  process.exit(1)
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

// Ensure the schema exists before writing to it.
getDb()

const dir = path.isAbsolute(dataDir) ? dataDir : path.join(process.cwd(), dataDir)
const sqlite = new Database(path.join(dir, 'app.db'))

const hash = bcrypt.hashSync(password, 10)
const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)

if (existing) {
  sqlite.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email)
  console.log(`✓ Password updated for "${email}"`)
} else {
  sqlite
    .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), email, hash, new Date().toISOString())
  console.log(`✓ Created user "${email}"`)
}

sqlite.close()

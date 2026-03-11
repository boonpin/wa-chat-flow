import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const sqlite = new Database(path.join(dataDir, 'app.db'))

const email = 'admin'
const password = 'admin'

const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
if (existing) {
  console.log(`User "${email}" already exists, updating password...`)
  const hash = bcrypt.hashSync(password, 10)
  sqlite.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email)
  console.log(`✓ Password updated for "${email}"`)
} else {
  const hash = bcrypt.hashSync(password, 10)
  sqlite.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    uuidv4(),
    email,
    hash,
    new Date().toISOString()
  )
  console.log(`✓ Created user "${email}" with password "${password}"`)
}

sqlite.close()

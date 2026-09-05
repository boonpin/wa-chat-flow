/**
 * Backs up everything that cannot be rebuilt from the repository:
 *   - the SQLite database (contacts, conversations, messages, campaigns)
 *   - WAHA's session storage (the WhatsApp logins themselves)
 *
 * Run daily, e.g. from cron:
 *   0 3 * * *  cd /srv/wa-chat-flow && pnpm backup >> storage/backups/backup.log 2>&1
 */
import Database from 'better-sqlite3'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { dataDir } from '../lib/config'

const RETAIN_DAYS = Number(process.env.BACKUP_RETAIN_DAYS || 7)
const backupRoot = process.env.BACKUP_DIR || path.join('storage', 'backups')
const wahaDir = process.env.WAHA_STORAGE_DIR || path.join('storage', 'waha')

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
fs.mkdirSync(backupRoot, { recursive: true })

async function main() {
  // ─── Database ───────────────────────────────────────────────────────────────
  // SQLite's online backup API is safe to run against a live, WAL-mode database
  // — unlike copying the file, which can capture a torn write.
  const dbPath = path.join(path.isAbsolute(dataDir) ? dataDir : path.resolve(dataDir), 'app.db')

  if (fs.existsSync(dbPath)) {
    const target = path.join(backupRoot, `app-${stamp}.db`)
    const source = new Database(dbPath, { readonly: true })
    await source.backup(target)
    source.close()
    console.log(`✓ Database → ${target}`)
  } else {
    console.warn(`! No database found at ${dbPath}`)
  }

  // ─── WAHA sessions ──────────────────────────────────────────────────────────
  if (fs.existsSync(wahaDir)) {
    const target = path.join(backupRoot, `waha-${stamp}.tar.gz`)
    execFileSync('tar', ['-czf', target, '-C', path.dirname(wahaDir), path.basename(wahaDir)])
    console.log(`✓ WAHA sessions → ${target}`)
  } else {
    console.warn(`! No WAHA storage found at ${wahaDir}`)
  }

  prune()
}

/** Keeps the most recent RETAIN_DAYS days of backups. */
function prune() {
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000
  let removed = 0

  for (const name of fs.readdirSync(backupRoot)) {
    if (!/^(app-.*\.db|waha-.*\.tar\.gz)$/.test(name)) continue
    const file = path.join(backupRoot, name)
    if (fs.statSync(file).mtimeMs < cutoff) {
      fs.unlinkSync(file)
      removed++
    }
  }

  if (removed > 0) console.log(`✓ Pruned ${removed} backup(s) older than ${RETAIN_DAYS} days`)
}

main().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})

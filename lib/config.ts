/**
 * Centralised environment configuration.
 *
 * Everything secret lives here and comes from the environment — nothing is
 * hardcoded and nothing is committed. Import from this module rather than
 * reading `process.env` directly so that validation happens in one place.
 */

const isProduction = process.env.NODE_ENV === 'production'

function required(name: string, value: string | undefined): string {
  if (!value) {
    if (isProduction) {
      throw new Error(`Missing required environment variable: ${name}`)
    }
    return ''
  }
  return value
}

// ─── App ──────────────────────────────────────────────────────────────────────
export const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** Where the SQLite database and other runtime state live. */
export const dataDir = process.env.DATA_DIR || 'storage/data'

// ─── Auth ─────────────────────────────────────────────────────────────────────
const devJwtSecret = 'dev-only-insecure-secret-do-not-use-in-production'

export const jwtSecret = isProduction
  ? required('JWT_SECRET', process.env.JWT_SECRET)
  : process.env.JWT_SECRET || devJwtSecret

export const adminBootstrap = {
  email: process.env.ADMIN_EMAIL?.trim() || '',
  password: process.env.ADMIN_PASSWORD || '',
}

// ─── WAHA ─────────────────────────────────────────────────────────────────────
export const waha = {
  baseUrl: (process.env.WAHA_BASE_URL || 'http://localhost:3001').replace(/\/+$/, ''),
  apiKey: process.env.WAHA_API_KEY || '',
  /** HMAC key WAHA uses to sign webhook deliveries. Empty = signature check off. */
  webhookHmacKey: process.env.WAHA_WEBHOOK_HMAC_KEY || '',
  /**
   * URL WAHA posts events to. Must be reachable *from the WAHA container*,
   * which inside Docker Compose is the internal service name rather than the
   * public APP_URL — hence the explicit override.
   */
  get webhookUrl() {
    return process.env.WAHA_WEBHOOK_URL || `${appUrl}/api/webhooks/waha`
  },
}

// ─── AI provider fallbacks ────────────────────────────────────────────────────
export const aiKeys = {
  openai: process.env.OPENAI_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
}

export { isProduction }

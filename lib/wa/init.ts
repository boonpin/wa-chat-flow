// This file is imported in the app to trigger WA client initialization
let initialized = false

export async function ensureWAInit() {
  if (initialized) return
  initialized = true
  const { initAllSessions } = await import('./client')
  initAllSessions().catch(console.error)
}

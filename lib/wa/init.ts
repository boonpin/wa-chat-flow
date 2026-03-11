// This file is imported in the app to trigger WA client initialization
let initialized = false

export async function ensureWAInit() {
  if (initialized) return
  initialized = true
  const { initWhatsappClient } = await import('./client')
  initWhatsappClient().catch(console.error)
}

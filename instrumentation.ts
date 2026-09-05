export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Re-apply webhook configuration to known sessions so a restart (or a changed
  // APP_URL) does not leave the gateway posting events into the void.
  const { syncSessionsOnBoot } = await import('./lib/wa/sessions')
  syncSessionsOnBoot().catch((err) => {
    console.error('[boot] WhatsApp session sync failed:', err)
  })
}

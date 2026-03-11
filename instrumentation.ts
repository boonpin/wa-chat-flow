export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initWhatsappClient } = await import('./lib/wa/client')
    initWhatsappClient().catch(console.error)
  }
}

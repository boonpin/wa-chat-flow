export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initAllSessions } = await import('./lib/wa/client')
    initAllSessions().catch(console.error)
  }
}

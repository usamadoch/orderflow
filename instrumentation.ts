export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { getMarketStorageAdapter } = await import('@/lib/db/storageAdapter')
      const adapter = getMarketStorageAdapter()
      await adapter.init()
      console.log('[DB] TimescaleDB storage adapter initialized')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[DB] Could not connect to TimescaleDB during startup (offline/unreachable):', message)
    }
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getMarketDbDriver, getMarketStorageAdapter } = await import('@/lib/db/storageAdapter')
    const adapter = getMarketStorageAdapter()
    await adapter.init()

    if (getMarketDbDriver() === 'libsql') {
      const { startCleanupJob } = await import('@/lib/db/cleanupJob')
      startCleanupJob()
      console.log('[DB] libSQL database initialized, cleanup job started')
      return
    }

    console.log('[DB] MongoDB storage adapter initialized')
  }
}

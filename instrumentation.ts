export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getMarketStorageAdapter } = await import('@/lib/db/storageAdapter')
    const adapter = getMarketStorageAdapter()
    await adapter.init()
    console.log('[DB] TimescaleDB storage adapter initialized')
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDatabase } = await import('@/lib/db/database')
    const { startCleanupJob } = await import('@/lib/db/cleanupJob')
    await initDatabase()
    startCleanupJob()
    console.log('[DB] Database initialized, cleanup job started')
  }
}

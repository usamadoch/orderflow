import { DB_CONFIG, deleteOldData } from './database'

let cleanupStarted = false
let cleanupInterval: ReturnType<typeof setInterval> | null = null

export function startCleanupJob() {
  if (cleanupStarted) return

  cleanupStarted = true

  const runCleanup = async () => {
    try {
      const deleted = await deleteOldData(DB_CONFIG.retentionHours)
      if (deleted > 0) {
        console.log(`[Cleanup] Removed ${deleted} rows older than ${DB_CONFIG.retentionHours}h`)
      }
    } catch (err) {
      console.error('[Cleanup] Failed:', err)
    }
  }

  void runCleanup()

  cleanupInterval = setInterval(
    runCleanup,
    DB_CONFIG.cleanupIntervalMinutes * 60 * 1000,
  )
  cleanupInterval.unref?.()

  console.log(
    `[Cleanup] Job started - runs every ${DB_CONFIG.cleanupIntervalMinutes}m, retention: ${DB_CONFIG.retentionHours}h`,
  )
}

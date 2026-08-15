import { DB_CONFIG, deleteOldData } from './database'

let cleanupStarted = false
let cleanupInterval: ReturnType<typeof setInterval> | null = null

export function startCleanupJob() {
  console.log('[Cleanup] Background cleanup job is disabled. Historical data is retained indefinitely.')
}

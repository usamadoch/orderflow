import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

// Reuse constants and logic from the collector
const SYMBOL = 'BTCUSDT'
const MAX_DB_SIZE_BYTES = 450 * 1024 * 1024 // 450 MB

const COLLECTIONS = {
  footprint: 'footprint_cells_ts',
  profile: 'profile_rows_ts',
}

loadLocalEnvFiles()

const config = {
  mongoUri: process.env.MONGODB_URI ?? '',
  mongoDbName: process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? 'orderflow',
  enableWrites: process.env.COLLECTOR_ENABLE_WRITES === 'true',
}

if (!config.mongoUri) {
  console.error('MONGODB_URI is required.')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(config.mongoUri)
  await client.connect()
  const db = client.db(config.mongoDbName)
  
  console.log(`Connected to MongoDB: ${config.mongoDbName}`)

  // Find the oldest record to know where to start backfilling
  const oldestFootprint = await db.collection(COLLECTIONS.footprint)
    .find({})
    .sort({ time: 1 })
    .limit(1)
    .toArray()
  
  let currentEndTime = oldestFootprint.length > 0 
    ? oldestFootprint[0].time.getTime() 
    : Date.now()

  console.log(`Starting backfill backwards from: ${new Date(currentEndTime).toISOString()}`)

  while (true) {
    // 1. Check database size
    const stats = await db.command({ dbStats: 1 })
    const dbSize = stats.dataSize || 0
    
    console.log(`Current DB Data Size: ${(dbSize / 1024 / 1024).toFixed(2)} MB / 450 MB`)

    if (dbSize > MAX_DB_SIZE_BYTES) {
      console.log('Database has reached the 450MB limit. Backfill complete.')
      break
    }

    // 2. Fetch 1 hour of history going backwards
    const currentStartTime = currentEndTime - (60 * 60 * 1000) // 1 hour window
    console.log(`Fetching window: ${new Date(currentStartTime).toISOString()} to ${new Date(currentEndTime).toISOString()}`)
    
    await fetchAndProcessTrades(currentStartTime, currentEndTime, db)
    
    // Step back for the next iteration
    currentEndTime = currentStartTime
    
    // Small delay to avoid Binance REST rate limits
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  await client.close()
}

async function fetchAndProcessTrades(startTime, endTime, db) {
  // In a full implementation, this would:
  // 1. Call GET /api/v3/aggTrades?symbol=BTCUSDT&startTime=X&endTime=Y
  // 2. Map trades to the internal footprint/profile format
  // 3. Insert into the MongoDB collections
  // Note: Since this is an implementation plan phase, the logic is stubbed
  // to be fully integrated with `btcusdtCollector.mjs` aggregation helpers.
  console.log(`[Stub] Fetched and inserted trades for window.`)
}

function loadLocalEnvFiles() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..', '..')
  const envPaths = [
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env'),
  ]

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue
    const contents = readFileSync(envPath, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const sep = trimmed.indexOf('=')
      if (sep <= 0) continue
      const key = trimmed.slice(0, sep).trim()
      if (!key || process.env[key] !== undefined) continue
      let value = trimmed.slice(sep + 1).trim()
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      process.env[key] = value
    }
  }
}

main().catch(console.error)

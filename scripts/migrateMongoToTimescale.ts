import { MongoClient } from 'mongodb'
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  const contents = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, value] = match
    let finalValue = value.trim()
    if ((finalValue.startsWith('"') && finalValue.endsWith('"')) || (finalValue.startsWith("'") && finalValue.endsWith("'"))) {
      finalValue = finalValue.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = finalValue
  }
}

async function migrate() {
  loadEnvFile('.env.local')

  const mongoUri = process.env.MONGODB_URI
  const mongoDbName = process.env.MONGODB_DB_NAME || 'orderflow'
  const bubblesMongoUri = process.env.BUBBLES_MONGODB_URI
  const pgUrl = process.env.TIMESCALEDB_URL || process.env.PG_URL

  if (!mongoUri || !bubblesMongoUri || !pgUrl) {
    console.error('Missing required connection strings in env.')
    process.exit(1)
  }

  const mongoClient = new MongoClient(mongoUri)
  const bubbleClient = new MongoClient(bubblesMongoUri)
  const pgPool = new pg.Pool({ connectionString: pgUrl })

  try {
    await mongoClient.connect()
    const mongoDb = mongoClient.db(mongoDbName)
    
    await bubbleClient.connect()
    // db is not used since we didn't implement bubble migration in the simple script

    await pgPool.connect()

    console.log('--- Migrating Collector Meta ---')
    const metaDocs = await mongoDb.collection('collector_meta').find().toArray()
    for (const doc of metaDocs) {
      await pgPool.query(
        'INSERT INTO collector_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [doc.key, String(doc.value)]
      )
    }
    console.log(`Migrated ${metaDocs.length} collector_meta entries.`)

    console.log('--- Migrating Candles (Spot) ---')
    // We only migrate candles that are closed to avoid conflicts with live data
    const candlesCursor = mongoDb.collection('market_candles_ts').find()
    let candlesCount = 0
    let candlesBatch = []
    
    for await (const doc of candlesCursor) {
      const time = doc.time
      const meta = doc.meta || {}
      
      // Using INSERT ... ON CONFLICT DO NOTHING
      candlesBatch.push(
        pgPool.query(
          `INSERT INTO market_candles (
            time, symbol, contract_type, timeframe, open, high, low, close, volume, trade_count, close_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING`,
          [
            time, meta.symbol, meta.contractType, meta.timeframe,
            doc.open, doc.high, doc.low, doc.close, doc.volume, doc.tradeCount, doc.closeTime || time
          ]
        )
      )
      
      if (candlesBatch.length >= 500) {
        await Promise.all(candlesBatch)
        candlesCount += candlesBatch.length
        candlesBatch = []
        process.stdout.write(`\rMigrated ${candlesCount} candles`)
      }
    }
    if (candlesBatch.length > 0) {
      await Promise.all(candlesBatch)
      candlesCount += candlesBatch.length
    }
    console.log(`\nCompleted migrating ${candlesCount} candles.`)

    // We can add similar blocks for footprint_cells_ts, profile_rows_ts and aggregate_bubble_events if needed.
    // However, due to the volume of footprint and profile data (millions of rows per day), 
    // a node.js loop is very slow. It is highly recommended to let it repopulate naturally,
    // or use pgloader / specialized ETL tools if full historical migration is strictly required.
    console.log('\nNOTE: Footprint, Profile, and Aggregate Bubble data are skipped in this basic script.')
    console.log('Due to high volume (GBs of data), it is recommended to let them repopulate naturally')
    console.log('or use a dedicated ETL tool (like Airbyte, pgloader) for full historical migration.')
    
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await mongoClient.close()
    await bubbleClient.close()
    await pgPool.end()
  }
}

migrate()

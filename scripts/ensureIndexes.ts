const fs = require('node:fs') as typeof import('node:fs')
const path = require('node:path') as typeof import('node:path')
const { MongoClient } = require('mongodb') as typeof import('mongodb')

type Db = import('mongodb').Db
type Collection = import('mongodb').Collection
type CreateIndexesOptions = import('mongodb').CreateIndexesOptions
type IndexKey = Record<string, 1 | -1>

const MARKET_COLLECTIONS = {
  candles: 'market_candles_ts',
  footprintCells: 'footprint_cells_ts',
  profileRows: 'profile_rows_ts',
  collectorMeta: 'collector_meta',
} as const

const AGGREGATE_BUBBLE_COLLECTION = 'aggregate_bubble_events'
const DEFAULT_RETENTION_DAYS = 7

const MARKET_INDEXES: Array<{
  collectionName: string
  name: string
  key: IndexKey
  options?: CreateIndexesOptions
}> = [
  {
    collectionName: MARKET_COLLECTIONS.candles,
    name: 'idx_market_candles_source_time',
    key: {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.timeframe': 1,
      time: 1,
    },
    options: { background: true },
  },
  {
    collectionName: MARKET_COLLECTIONS.footprintCells,
    name: 'idx_footprint_cells_source_time_price',
    key: {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.bucketSize': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    options: { background: true },
  },
  {
    collectionName: MARKET_COLLECTIONS.profileRows,
    name: 'idx_profile_rows_source_time_price',
    key: {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.baseBucketSizeKey': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    options: { background: true },
  },
  {
    collectionName: MARKET_COLLECTIONS.collectorMeta,
    name: 'idx_collector_meta_key',
    key: { key: 1 },
    options: { unique: true, background: true },
  },
]

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  const contents = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getRetentionSeconds() {
  const days = getPositiveNumberEnv('MARKET_DATA_RETENTION_DAYS', DEFAULT_RETENTION_DAYS)
  return Math.floor(days * 24 * 60 * 60)
}

function sameIndexKey(left: unknown, right: IndexKey) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getComparableIndexKey(index: { key?: unknown; originalSpec?: { key?: unknown } }) {
  return index.originalSpec?.key ?? index.key
}

function hasCompatibleIndexOptions(
  index: { unique?: boolean },
  options: CreateIndexesOptions,
) {
  return options.unique !== true || index.unique === true
}

async function assertExistingCollection(db: Db, collectionName: string) {
  const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray()
  if (collections.length === 0) {
    throw new Error(
      `${collectionName} does not exist. Initialize MongoDB storage first so time-series collections are created with the correct options.`,
    )
  }
}

async function ensureIndex(
  collection: Collection,
  key: IndexKey,
  options: CreateIndexesOptions & { name: string },
) {
  const indexes = await collection.indexes()
  const existing = indexes.find((index) => index.name === options.name)

  if (
    existing
    && sameIndexKey(getComparableIndexKey(existing), key)
    && hasCompatibleIndexOptions(existing, options)
  ) {
    console.log(`ensured ${collection.collectionName}.${options.name}`)
    return
  }

  if (existing) {
    await collection.dropIndex(options.name)
  }

  await collection.createIndex(key, options)
  console.log(`ensured ${collection.collectionName}.${options.name}`)
}

async function ensureMarketIndexes() {
  const client = new MongoClient(getRequiredEnv('MONGODB_URI'))

  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME || 'orderflow')

    for (const index of MARKET_INDEXES) {
      await assertExistingCollection(db, index.collectionName)
      await ensureIndex(
        db.collection(index.collectionName),
        index.key,
        { name: index.name, ...index.options },
      )
    }
  } finally {
    await client.close()
  }
}

async function ensureAggregateBubbleIndexes() {
  const client = new MongoClient(getRequiredEnv('BUBBLES_MONGODB_URI'))

  try {
    await client.connect()
    const db = client.db(getRequiredEnv('BUBBLES_MONGODB_DB_NAME'))
    const existing = await db.listCollections({ name: AGGREGATE_BUBBLE_COLLECTION }).toArray()

    if (existing.length === 0) {
      await db.createCollection(AGGREGATE_BUBBLE_COLLECTION)
    } else if (existing[0].type === 'timeseries') {
      throw new Error(`${AGGREGATE_BUBBLE_COLLECTION} must be a regular MongoDB collection`)
    }

    const collection = db.collection(AGGREGATE_BUBBLE_COLLECTION)

    await ensureIndex(
      collection,
      { symbol: 1, contractType: 1, aggregateTradeId: 1 },
      { unique: true, name: 'uniq_aggregate_bubbles_source_id', background: true },
    )
    await ensureIndex(
      collection,
      { symbol: 1, contractType: 1, eventTime: 1, aggregateTradeId: 1 },
      { name: 'idx_aggregate_bubbles_restore', background: true },
    )

    const ttlName = 'ttl_aggregate_bubbles_event_time'
    const retentionSeconds = getRetentionSeconds()
    const indexes = await collection.indexes()
    const existingTtl = indexes.find((index) => index.name === ttlName)

    if (existingTtl && existingTtl.expireAfterSeconds !== retentionSeconds) {
      await collection.dropIndex(ttlName)
    }

    await collection.createIndex(
      { eventTime: 1 },
      { expireAfterSeconds: retentionSeconds, name: ttlName, background: true },
    )
    console.log(`ensured ${collection.collectionName}.${ttlName}`)
  } finally {
    await client.close()
  }
}

async function main() {
  loadEnvFile('.env.local')

  // Re-run this script whenever a collection is added or a query pattern changes significantly.
  await ensureMarketIndexes()
  await ensureAggregateBubbleIndexes()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

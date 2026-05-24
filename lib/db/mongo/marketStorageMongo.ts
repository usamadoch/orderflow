import type { Collection, Db } from 'mongodb'
import { getMongoDb, verifyMongoConnection } from './client'
import type {
  StoreBaseFootprintInput,
  StoreClosedCandleInput,
  StoreFineProfileRowsInput,
  MarketStorageAdapter,
} from '../storageAdapter'
import type { CandleRow, FineProfileRow, FootprintCellRow } from '../database'
import { ALLOWED_SYMBOLS, ALLOWED_TIMEFRAMES, FINE_PROFILE_STORAGE_TIMEFRAME } from '../../config/markets'

export const MONGO_MARKET_COLLECTIONS = {
  candles: 'market_candles_ts',
  footprintCells: 'footprint_cells_ts',
  profileRows: 'profile_rows_ts',
  collectorMeta: 'collector_meta',
  rawTrades: 'raw_trades_ts',
} as const

const DEFAULT_MONGO_RETENTION_DAYS = 7
const TIME_FIELD = 'time'
const META_FIELD = 'meta'
const CANDLE_QUERY_INDEX = 'idx_market_candles_source_time'
const FOOTPRINT_QUERY_INDEX = 'idx_footprint_cells_source_time_price'
const PROFILE_QUERY_INDEX = 'idx_profile_rows_source_time_price'
const COLLECTOR_META_KEY_INDEX = 'idx_collector_meta_key'
const BASE_FOOTPRINT_TIMEFRAME = '1m'
const BASE_FOOTPRINT_BUCKET_SIZE = 5

const MONGO_RETENTION_SECONDS = getMongoRetentionSeconds()

interface MongoCandleDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    timeframe: string
  }
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: Date
  timeSec: number
  openTimeSec: number
  closeTimeSec: number
  storedAt: Date
}

interface MongoFootprintDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    dataSourceMode: string
    timeframe: string
    bucketSize: number
  }
  candleTimeSec: number
  bucketPrice: string
  bucketPriceKey: string
  bidVol: string
  askVol: string
  totalVol: string
  delta: string
  storedAt: Date
}

interface MongoProfileRowDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    dataSourceMode: string
    timeframe: string
    baseBucketSizeKey: string
  }
  candleTimeSec: number
  baseBucketSize: string
  bucketPrice: string
  bucketPriceKey: string
  bidVol: string
  askVol: string
  totalVol: string
  tradeCount: number
  storedAt: Date
}

interface MongoCollectorMetaDocument {
  key: string
  value: string
  updatedAt: Date
}

interface MongoCollectionInfoWithOptions {
  type?: string
  options?: {
    timeseries?: {
      timeField?: string
      metaField?: string
    }
  }
}

let candleCollectionInitPromise: Promise<void> | null = null
let footprintCollectionInitPromise: Promise<void> | null = null
let profileCollectionInitPromise: Promise<void> | null = null
let collectorMetaInitPromise: Promise<void> | null = null

function getMongoRetentionSeconds() {
  const days = Number(process.env.MARKET_DATA_RETENTION_DAYS ?? DEFAULT_MONGO_RETENTION_DAYS)
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_MONGO_RETENTION_DAYS

  return Math.floor(safeDays * 24 * 60 * 60)
}

function notImplemented(methodName: string): never {
  throw new Error(
    `MongoDB market storage method "${methodName}" is not migrated in this task. This migration only covers candles, footprint cells, and fine profile rows.`,
  )
}

function toStoredNumber(value: number) {
  return Number.isFinite(value) ? String(value) : '0'
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toDateFromSeconds(seconds: number) {
  return new Date(seconds * 1000)
}

function toStoredAtSeconds(date: Date | undefined) {
  return date ? Math.floor(date.getTime() / 1000) : Math.floor(Date.now() / 1000)
}

function toNumberKey(value: number) {
  if (!Number.isFinite(value)) return '0'

  const fixed = value.toFixed(12).replace(/\.?0+$/, '')
  return fixed === '-0' || fixed === '' ? '0' : fixed
}

function getFootprintIdentityKey(document: MongoFootprintDocument) {
  return `${document.candleTimeSec}:${document.bucketPriceKey}`
}

function getProfileIdentityKey(document: MongoProfileRowDocument) {
  return `${document.candleTimeSec}:${document.bucketPriceKey}`
}

function toCandleDocument(input: StoreClosedCandleInput): MongoCandleDocument {
  const openTimeSec = input.candle.time
  const closeTimeSec = input.candle.time

  return {
    time: toDateFromSeconds(openTimeSec),
    meta: {
      symbol: input.symbol,
      contractType: input.contractType,
      timeframe: input.timeframe,
    },
    open: toStoredNumber(input.candle.open),
    high: toStoredNumber(input.candle.high),
    low: toStoredNumber(input.candle.low),
    close: toStoredNumber(input.candle.close),
    volume: toStoredNumber(input.candle.volume),
    closeTime: toDateFromSeconds(closeTimeSec),
    timeSec: openTimeSec,
    openTimeSec,
    closeTimeSec,
    storedAt: new Date(),
  }
}

function toFootprintDocuments(input: StoreBaseFootprintInput): MongoFootprintDocument[] {
  const time = toDateFromSeconds(input.candleTime)
  const storedAt = new Date()

  return input.cells
    .filter((cell) =>
      Number.isFinite(cell.bucketPrice)
      && Number.isFinite(cell.bidVol)
      && Number.isFinite(cell.askVol)
      && cell.bidVol + cell.askVol > 0,
    )
    .map((cell) => {
      const bidVol = cell.bidVol
      const askVol = cell.askVol
      const totalVol = bidVol + askVol
      const delta = askVol - bidVol

      return {
        time,
        meta: {
          symbol: input.symbol,
          contractType: input.contractType,
          dataSourceMode: input.dataSourceMode,
          timeframe: BASE_FOOTPRINT_TIMEFRAME,
          bucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
        },
        candleTimeSec: input.candleTime,
        bucketPrice: toStoredNumber(cell.bucketPrice),
        bucketPriceKey: toNumberKey(cell.bucketPrice),
        bidVol: toStoredNumber(bidVol),
        askVol: toStoredNumber(askVol),
        totalVol: toStoredNumber(totalVol),
        delta: toStoredNumber(delta),
        storedAt,
      }
    })
}

function toProfileDocuments(input: StoreFineProfileRowsInput): MongoProfileRowDocument[] {
  const storedAt = new Date()
  const timeframe = input.timeframe || FINE_PROFILE_STORAGE_TIMEFRAME

  return input.rows
    .filter((row) =>
      Number.isFinite(row.candleTime)
      && row.baseBucketSize > 0
      && Number.isFinite(row.bucketPrice)
      && row.totalVol > 0
      && row.tradeCount > 0,
    )
    .map((row) => {
      const baseBucketSizeKey = toNumberKey(row.baseBucketSize)

      return {
        time: toDateFromSeconds(row.candleTime),
        meta: {
          symbol: input.symbol,
          contractType: input.contractType,
          dataSourceMode: input.dataSourceMode,
          timeframe,
          baseBucketSizeKey,
        },
        candleTimeSec: row.candleTime,
        baseBucketSize: toStoredNumber(row.baseBucketSize),
        bucketPrice: toStoredNumber(row.bucketPrice),
        bucketPriceKey: toNumberKey(row.bucketPrice),
        bidVol: toStoredNumber(row.bidVol),
        askVol: toStoredNumber(row.askVol),
        totalVol: toStoredNumber(row.totalVol),
        tradeCount: Math.max(0, Math.floor(row.tradeCount)),
        storedAt,
      }
    })
}

function toCandleRow(document: MongoCandleDocument): CandleRow {
  return {
    id: 0,
    symbol: document.meta.symbol,
    timeframe: document.meta.timeframe,
    open_time: document.openTimeSec ?? document.timeSec,
    open: toNumber(document.open),
    high: toNumber(document.high),
    low: toNumber(document.low),
    close: toNumber(document.close),
    volume: toNumber(document.volume),
    close_time: document.closeTimeSec ?? document.timeSec,
    stored_at: toStoredAtSeconds(document.storedAt),
  }
}

function toFootprintCellRow(document: MongoFootprintDocument): FootprintCellRow {
  return {
    id: 0,
    symbol: document.meta.symbol,
    contract_type: document.meta.contractType,
    data_source_mode: document.meta.dataSourceMode,
    timeframe: document.meta.timeframe,
    candle_time: document.candleTimeSec,
    bucket_price: toNumber(document.bucketPrice),
    bucket_size: document.meta.bucketSize,
    bid_vol: toNumber(document.bidVol),
    ask_vol: toNumber(document.askVol),
    delta: toNumber(document.delta),
    stored_at: toStoredAtSeconds(document.storedAt),
  }
}

function toFineProfileRow(document: MongoProfileRowDocument): FineProfileRow {
  return {
    id: 0,
    symbol: document.meta.symbol,
    contract_type: document.meta.contractType,
    data_source_mode: document.meta.dataSourceMode,
    timeframe: document.meta.timeframe,
    candle_time: document.candleTimeSec,
    base_bucket_size: toNumber(document.baseBucketSize),
    bucket_price: toNumber(document.bucketPrice),
    bid_vol: toNumber(document.bidVol),
    ask_vol: toNumber(document.askVol),
    total_vol: toNumber(document.totalVol),
    trade_count: document.tradeCount,
    stored_at: toStoredAtSeconds(document.storedAt),
  }
}

function sortFootprintRows(rows: FootprintCellRow[]) {
  return rows.sort((a, b) => a.candle_time - b.candle_time || a.bucket_price - b.bucket_price)
}

function sortFineProfileRows(rows: FineProfileRow[]) {
  return rows.sort((a, b) => a.candle_time - b.candle_time || a.bucket_price - b.bucket_price)
}

async function getCandleCollection(): Promise<Collection<MongoCandleDocument>> {
  await ensureCandleCollection()
  const db = await getMongoDb()
  return db.collection<MongoCandleDocument>(MONGO_MARKET_COLLECTIONS.candles)
}

async function getFootprintCollection(): Promise<Collection<MongoFootprintDocument>> {
  await ensureFootprintCollection()
  const db = await getMongoDb()
  return db.collection<MongoFootprintDocument>(MONGO_MARKET_COLLECTIONS.footprintCells)
}

async function getProfileCollection(): Promise<Collection<MongoProfileRowDocument>> {
  await ensureProfileCollection()
  const db = await getMongoDb()
  return db.collection<MongoProfileRowDocument>(MONGO_MARKET_COLLECTIONS.profileRows)
}

async function getCollectorMetaCollection(): Promise<Collection<MongoCollectorMetaDocument>> {
  await ensureCollectorMetaCollection()
  const db = await getMongoDb()
  return db.collection<MongoCollectorMetaDocument>(MONGO_MARKET_COLLECTIONS.collectorMeta)
}

async function ensureCandleCollection() {
  if (!candleCollectionInitPromise) {
    candleCollectionInitPromise = initCandleCollection()
  }

  return candleCollectionInitPromise
}

async function ensureFootprintCollection() {
  if (!footprintCollectionInitPromise) {
    footprintCollectionInitPromise = initFootprintCollection()
  }

  return footprintCollectionInitPromise
}

async function ensureProfileCollection() {
  if (!profileCollectionInitPromise) {
    profileCollectionInitPromise = initProfileCollection()
  }

  return profileCollectionInitPromise
}

async function ensureCollectorMetaCollection() {
  if (!collectorMetaInitPromise) {
    collectorMetaInitPromise = initCollectorMetaCollection()
  }

  return collectorMetaInitPromise
}

async function initCandleCollection() {
  const db = await getMongoDb()
  await ensureTimeSeriesCollection(db, MONGO_MARKET_COLLECTIONS.candles)

  const collection = db.collection<MongoCandleDocument>(MONGO_MARKET_COLLECTIONS.candles)
  await collection.createIndex(
    {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.timeframe': 1,
      time: 1,
    },
    { name: CANDLE_QUERY_INDEX },
  )

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MongoDB] Candle collection ready: ${MONGO_MARKET_COLLECTIONS.candles}`)
  }
}

async function initFootprintCollection() {
  const db = await getMongoDb()
  await ensureTimeSeriesCollection(db, MONGO_MARKET_COLLECTIONS.footprintCells)

  const collection = db.collection<MongoFootprintDocument>(MONGO_MARKET_COLLECTIONS.footprintCells)
  await collection.createIndex(
    {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.bucketSize': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    { name: FOOTPRINT_QUERY_INDEX },
  )

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MongoDB] Footprint collection ready: ${MONGO_MARKET_COLLECTIONS.footprintCells}`)
  }
}

async function initProfileCollection() {
  const db = await getMongoDb()
  await ensureTimeSeriesCollection(db, MONGO_MARKET_COLLECTIONS.profileRows)

  const collection = db.collection<MongoProfileRowDocument>(MONGO_MARKET_COLLECTIONS.profileRows)
  await collection.createIndex(
    {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.baseBucketSizeKey': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    { name: PROFILE_QUERY_INDEX },
  )

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MongoDB] Profile rows collection ready: ${MONGO_MARKET_COLLECTIONS.profileRows}`)
  }
}

async function initCollectorMetaCollection() {
  const db = await getMongoDb()
  const collection = db.collection<MongoCollectorMetaDocument>(MONGO_MARKET_COLLECTIONS.collectorMeta)

  await collection.createIndex({ key: 1 }, { unique: true, name: COLLECTOR_META_KEY_INDEX })
  await collection.updateOne(
    { key: 'retention_seconds' },
    {
      $set: {
        key: 'retention_seconds',
        value: String(MONGO_RETENTION_SECONDS),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
  await collection.updateOne(
    { key: 'market_db_driver' },
    {
      $set: {
        key: 'market_db_driver',
        value: 'mongodb',
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
  await collection.updateOne(
    { key: 'collector_started' },
    {
      $setOnInsert: {
        key: 'collector_started',
        value: new Date().toISOString(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
}

async function ensureTimeSeriesCollection(db: Db, name: string) {
  const existing = await findCollectionInfo(db, name)

  if (!existing) {
    await db.createCollection(name, {
      timeseries: {
        timeField: TIME_FIELD,
        metaField: META_FIELD,
        granularity: 'seconds',
      },
      expireAfterSeconds: MONGO_RETENTION_SECONDS,
    })
    return
  }

  validateTimeSeriesCollection(name, existing)
  await setTimeSeriesRetention(db, name)
}

async function findCollectionInfo(db: Db, name: string) {
  const collections = await db.listCollections({ name }).toArray()
  return (collections[0] as MongoCollectionInfoWithOptions | undefined) ?? null
}

function validateTimeSeriesCollection(name: string, collectionInfo: Awaited<ReturnType<typeof findCollectionInfo>>) {
  if (!collectionInfo) return

  if (collectionInfo.type !== 'timeseries') {
    throw new Error(`${name} exists but is not a MongoDB time-series collection`)
  }

  const timeseries = collectionInfo.options?.timeseries
  if (
    timeseries?.timeField !== TIME_FIELD
    || timeseries?.metaField !== META_FIELD
  ) {
    throw new Error(
      `${name} exists with incompatible time-series options; expected timeField="${TIME_FIELD}" and metaField="${META_FIELD}"`,
    )
  }
}

async function setTimeSeriesRetention(db: Db, name: string) {
  try {
    await db.command({ collMod: name, expireAfterSeconds: MONGO_RETENTION_SECONDS })
  } catch (error) {
    console.warn(`[MongoDB] Could not update TTL for ${name}; existing collection options remain in effect.`, error)
  }
}

function getCandleIdentity(document: MongoCandleDocument) {
  return {
    'meta.symbol': document.meta.symbol,
    'meta.contractType': document.meta.contractType,
    'meta.timeframe': document.meta.timeframe,
    time: document.time,
  }
}

async function insertMissingFootprintDocuments(documents: MongoFootprintDocument[]) {
  if (documents.length === 0) return 0

  const collection = await getFootprintCollection()
  const first = documents[0]
  const existing = await collection
    .find({
      'meta.symbol': first.meta.symbol,
      'meta.contractType': first.meta.contractType,
      'meta.dataSourceMode': first.meta.dataSourceMode,
      'meta.timeframe': first.meta.timeframe,
      'meta.bucketSize': first.meta.bucketSize,
      time: first.time,
      bucketPriceKey: { $in: documents.map((document) => document.bucketPriceKey) },
    })
    .project({ candleTimeSec: 1, bucketPriceKey: 1 })
    .toArray()
  const existingKeys = new Set(existing.map((document) => (
    `${Number(document.candleTimeSec)}:${String(document.bucketPriceKey)}`
  )))
  const missing = documents.filter((document) => !existingKeys.has(getFootprintIdentityKey(document)))

  if (missing.length > 0) {
    await collection.insertMany(missing, { ordered: false })
  }

  return missing.length
}

async function insertMissingProfileDocuments(documents: MongoProfileRowDocument[]) {
  if (documents.length === 0) return 0

  const collection = await getProfileCollection()
  let inserted = 0
  const grouped = new Map<string, MongoProfileRowDocument[]>()

  for (const document of documents) {
    const key = document.meta.baseBucketSizeKey
    const group = grouped.get(key) ?? []
    group.push(document)
    grouped.set(key, group)
  }

  for (const group of grouped.values()) {
    const first = group[0]
    const candleTimes = group.map((document) => document.candleTimeSec)
    const minTime = Math.min(...candleTimes)
    const maxTime = Math.max(...candleTimes)
    const existing = await collection
      .find({
        'meta.symbol': first.meta.symbol,
        'meta.contractType': first.meta.contractType,
        'meta.dataSourceMode': first.meta.dataSourceMode,
        'meta.timeframe': first.meta.timeframe,
        'meta.baseBucketSizeKey': first.meta.baseBucketSizeKey,
        time: {
          $gte: toDateFromSeconds(minTime),
          $lte: toDateFromSeconds(maxTime),
        },
        bucketPriceKey: { $in: group.map((document) => document.bucketPriceKey) },
      })
      .project({ candleTimeSec: 1, bucketPriceKey: 1 })
      .toArray()
    const existingKeys = new Set(existing.map((document) => (
      `${Number(document.candleTimeSec)}:${String(document.bucketPriceKey)}`
    )))
    const missing = group.filter((document) => !existingKeys.has(getProfileIdentityKey(document)))

    if (missing.length > 0) {
      await collection.insertMany(missing, { ordered: false })
      inserted += missing.length
    }
  }

  return inserted
}

async function updateCollectorMeta(key: string, value: string) {
  const collection = await getCollectorMetaCollection()
  await collection.updateOne(
    { key },
    {
      $set: {
        key,
        value,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
}

export const mongoMarketStorageAdapter: MarketStorageAdapter = {
  driver: 'mongodb',

  async init() {
    const result = await verifyMongoConnection()
    await Promise.all([
      ensureCandleCollection(),
      ensureFootprintCollection(),
      ensureProfileCollection(),
      ensureCollectorMetaCollection(),
    ])

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MongoDB] Connected to database "${result.dbName}"`)
    }
  },

  async getStatus() {
    await verifyMongoConnection()
    await Promise.all([
      ensureCandleCollection(),
      ensureFootprintCollection(),
      ensureProfileCollection(),
      ensureCollectorMetaCollection(),
    ])
    const collection = await getCandleCollection()
    const latest = await collection
      .find({})
      .sort({ storedAt: -1 })
      .limit(1)
      .next()
    const candleCounts: Record<string, number> = {}

    await Promise.all(
      ALLOWED_SYMBOLS.flatMap((symbol) =>
        ALLOWED_TIMEFRAMES.map(async (timeframe) => {
          candleCounts[`${symbol}_${timeframe}`] = await collection.countDocuments({
            'meta.symbol': symbol,
            'meta.timeframe': timeframe,
          })
        }),
      ),
    )

    return {
      retentionSeconds: MONGO_RETENTION_SECONDS,
      dbSizeMb: null,
      lastStored: latest?.storedAt.toISOString() ?? null,
      candleCounts,
    }
  },

  async storeClosedCandle(input) {
    if (!input.candle.isClosed) return

    const collection = await getCandleCollection()
    const document = toCandleDocument(input)
    const existing = await collection.findOne(getCandleIdentity(document), {
      projection: { _id: 1 },
    })

    if (existing) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[MongoDB] Candle write skipped; source-scoped candle already exists', {
          symbol: input.symbol,
          contractType: input.contractType,
          timeframe: input.timeframe,
          time: input.candle.time,
        })
      }
      return
    }

    await collection.insertOne(document)
    await updateCollectorMeta('last_candle_stored', document.storedAt.toISOString())

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[MongoDB] Candle written', {
        symbol: input.symbol,
        contractType: input.contractType,
        timeframe: input.timeframe,
        time: input.candle.time,
      })
    }
  },

  async storeBaseFootprint(input) {
    const documents = toFootprintDocuments(input)
    const inserted = await insertMissingFootprintDocuments(documents)

    if (inserted > 0) {
      await updateCollectorMeta('last_footprint_stored', new Date().toISOString())
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[MongoDB] Base footprint rows written', {
        symbol: input.symbol,
        contractType: input.contractType,
        dataSourceMode: input.dataSourceMode,
        candleTime: input.candleTime,
        rowsReceived: input.cells.length,
        rowsInserted: inserted,
        rowsSkipped: documents.length - inserted,
      })
    }
  },

  async storeFineProfileRows(input) {
    const documents = toProfileDocuments(input)
    const inserted = await insertMissingProfileDocuments(documents)

    if (inserted > 0) {
      await updateCollectorMeta('last_profile_rows_stored', new Date().toISOString())
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[MongoDB] Fine profile rows written', {
        symbol: input.symbol,
        contractType: input.contractType,
        dataSourceMode: input.dataSourceMode,
        timeframe: input.timeframe,
        rowsReceived: input.rows.length,
        rowsInserted: inserted,
        rowsSkipped: documents.length - inserted,
      })
    }
  },

  async storeRawTrades() {
    notImplemented('storeRawTrades')
  },

  async getCandles(symbol, contractType, timeframe, sinceUnixSeconds = 0, limit = 1000) {
    const collection = await getCandleCollection()
    const boundedLimit = Math.max(1, Math.min(limit, 1000))
    const baseFilter = {
      'meta.symbol': symbol,
      'meta.contractType': contractType,
      'meta.timeframe': timeframe,
    }

    if (sinceUnixSeconds <= 0) {
      const rows = await collection
        .find(baseFilter)
        .sort({ time: -1 })
        .limit(boundedLimit)
        .toArray()
      const ordered = rows.reverse().map(toCandleRow)

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[MongoDB] Candles restored', {
          symbol,
          contractType,
          timeframe,
          rows: ordered.length,
        })
      }

      return ordered
    }

    const rows = await collection
      .find({
        ...baseFilter,
        time: { $gt: toDateFromSeconds(sinceUnixSeconds) },
      })
      .sort({ time: 1 })
      .limit(boundedLimit)
      .toArray()
    const ordered = rows.map(toCandleRow)

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[MongoDB] Candles restored since cursor', {
        symbol,
        contractType,
        timeframe,
        sinceUnixSeconds,
        rows: ordered.length,
      })
    }

    return ordered
  },

  async getFootprintCells(symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize = BASE_FOOTPRINT_BUCKET_SIZE) {
    const collection = await getFootprintCollection()
    const rows = await collection
      .find({
        'meta.symbol': symbol,
        'meta.contractType': contractType,
        'meta.dataSourceMode': dataSourceMode,
        'meta.timeframe': timeframe,
        'meta.bucketSize': bucketSize,
        time: toDateFromSeconds(candleTime),
      })
      .sort({ bucketPriceKey: 1 })
      .toArray()

    return sortFootprintRows(rows.map(toFootprintCellRow))
  },

  async getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize) {
    const collection = await getFootprintCollection()
    const rows = await collection
      .find({
        'meta.symbol': symbol,
        'meta.contractType': contractType,
        'meta.dataSourceMode': dataSourceMode,
        'meta.timeframe': timeframe,
        'meta.bucketSize': bucketSize,
        time: {
          $gte: toDateFromSeconds(startTime),
          $lt: toDateFromSeconds(endTime),
        },
      })
      .sort({ time: 1, bucketPriceKey: 1 })
      .toArray()

    return sortFootprintRows(rows.map(toFootprintCellRow))
  },

  async getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize) {
    const collection = await getProfileCollection()
    const rows = await collection
      .find({
        'meta.symbol': symbol,
        'meta.contractType': contractType,
        'meta.dataSourceMode': dataSourceMode,
        'meta.timeframe': timeframe,
        'meta.baseBucketSizeKey': toNumberKey(baseBucketSize),
        time: {
          $gte: toDateFromSeconds(startTime),
          $lt: toDateFromSeconds(endTime),
        },
      })
      .sort({ time: 1, bucketPriceKey: 1 })
      .toArray()

    return sortFineProfileRows(rows.map(toFineProfileRow))
  },

  async getRawTrades() {
    notImplemented('getRawTrades')
  },

  async getCollectorMeta() {
    const collection = await getCollectorMetaCollection()
    const rows = await collection.find({}).toArray()

    return rows.reduce<Record<string, string>>((meta, row) => {
      meta[row.key] = row.value
      return meta
    }, {})
  },

  async getCandleCount(symbol, timeframe) {
    const collection = await getCandleCollection()
    return collection.countDocuments({
      'meta.symbol': symbol,
      'meta.timeframe': timeframe,
    })
  },

  async getDatabaseSizeMb() {
    return null
  },
}

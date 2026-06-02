import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import { MongoClient } from 'mongodb'

const SYMBOL = 'BTCUSDT'
const BASE_TIMEFRAME = '1m'
const BASE_TIMEFRAME_SECONDS = 60
const FOOTPRINT_BUCKET_SIZE = 5
const MIN_PROFILE_BASE_BUCKET_SIZE = 1.5
const DEFAULT_TICK_SIZE = 0.5
const DEFAULT_RETENTION_DAYS = 7
const DEFAULT_FLUSH_INTERVAL_MS = 1000
const DEFAULT_STATUS_INTERVAL_MS = 30000
const DEFAULT_MAX_DEDUPE_KEYS = 100000
const DEFAULT_RECONNECT_MIN_MS = 1000
const DEFAULT_RECONNECT_MAX_MS = 30000
const DEFAULT_HEARTBEAT_MS = 30000

const COLLECTIONS = {
  footprint: 'footprint_cells_ts',
  profile: 'profile_rows_ts',
  collectorMeta: 'collector_meta',
}

const SOURCES = ['spot', 'futures']
const TARGETS = [
  { contractType: 'spot', dataSourceMode: 'spot', activeSources: ['spot'] },
  { contractType: 'spot', dataSourceMode: 'futures', activeSources: ['futures'] },
  { contractType: 'spot', dataSourceMode: 'both', activeSources: ['spot', 'futures'] },
  { contractType: 'futures', dataSourceMode: 'spot', activeSources: ['spot'] },
  { contractType: 'futures', dataSourceMode: 'futures', activeSources: ['futures'] },
  { contractType: 'futures', dataSourceMode: 'both', activeSources: ['spot', 'futures'] },
]

loadLocalEnvFiles()

const config = loadConfig()
const logger = createLogger(config.logLevel)
process.stdout.on('error', handlePipeError)
process.stderr.on('error', handlePipeError)
const metrics = {
  tradesReceived: { spot: 0, futures: 0 },
  tradesAccepted: 0,
  tradesSkippedDuplicate: 0,
  tradesSkippedMissingReference: 0,
  slicesPersisted: 0,
  footprintRowsInserted: 0,
  footprintRowsSkipped: 0,
  profileRowsInserted: 0,
  profileRowsSkipped: 0,
  writeFailures: 0,
}

let mongoClient = null
let mongoDb = null
let shuttingDown = false
let persistPromise = null

const priceReferences = {
  spot: null,
  futures: null,
}

let runtimes = []
const streamClients = []

main().catch((error) => {
  logger.error('collector fatal error', { error: getErrorMessage(error) })
  process.exitCode = 1
})

async function main() {
  assertRuntimeSupport()
  await initMongo()
  runtimes = TARGETS.map((target) => createRuntime(target))

  logger.info('active aggregation identities', {
    symbol: SYMBOL,
    identities: runtimes.map((runtime) => runtime.identity),
    footprintBucketSize: FOOTPRINT_BUCKET_SIZE,
    profileBaseBucketSize: config.profileBaseBucketSize,
    writesEnabled: config.enableWrites,
    dryRun: config.dryRun,
  })

  if (!config.enableWrites || config.dryRun) {
    logger.warn('collector is not writing to mongodb', {
      writesEnabled: config.enableWrites,
      dryRun: config.dryRun,
      requiredEnv: 'Set COLLECTOR_ENABLE_WRITES=true and COLLECTOR_DRY_RUN=false to persist rows.',
    })
  }

  streamClients.push(createBinanceStreamClient('spot'))
  streamClients.push(createBinanceStreamClient('futures'))
  streamClients.forEach((client) => client.connect())

  const flushTimer = setInterval(() => {
    void requestPersist('interval')
  }, config.flushIntervalMs)

  const statusTimer = setInterval(() => {
    logStatus().catch((error) => {
      logger.warn('status update failed', { error: getErrorMessage(error) })
    })
  }, config.statusIntervalMs)

  process.once('SIGINT', () => {
    void shutdown('SIGINT', flushTimer, statusTimer)
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM', flushTimer, statusTimer)
  })

  if (config.exitAfterMs > 0) {
    setTimeout(() => {
      void shutdown('COLLECTOR_EXIT_AFTER_MS', flushTimer, statusTimer)
    }, config.exitAfterMs)
  }
}

function loadConfig() {
  const tickSize = getNumberEnv('COLLECTOR_TICK_SIZE', DEFAULT_TICK_SIZE)

  return {
    mongoUri: process.env.MONGODB_URI ?? '',
    mongoDbName: process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? 'orderflow',
    retentionSeconds: Math.floor(getNumberEnv('MARKET_DATA_RETENTION_DAYS', DEFAULT_RETENTION_DAYS) * 24 * 60 * 60),
    flushIntervalMs: getIntegerEnv('COLLECTOR_FLUSH_INTERVAL_MS', DEFAULT_FLUSH_INTERVAL_MS),
    statusIntervalMs: getIntegerEnv('COLLECTOR_STATUS_INTERVAL_MS', DEFAULT_STATUS_INTERVAL_MS),
    maxDedupeKeys: getIntegerEnv('COLLECTOR_MAX_DEDUPE_KEYS', DEFAULT_MAX_DEDUPE_KEYS),
    reconnectMinMs: getIntegerEnv('COLLECTOR_RECONNECT_MIN_MS', DEFAULT_RECONNECT_MIN_MS),
    reconnectMaxMs: getIntegerEnv('COLLECTOR_RECONNECT_MAX_MS', DEFAULT_RECONNECT_MAX_MS),
    heartbeatMs: getIntegerEnv('COLLECTOR_HEARTBEAT_MS', DEFAULT_HEARTBEAT_MS),
    exitAfterMs: getIntegerEnv('COLLECTOR_EXIT_AFTER_MS', 0),
    tickSize,
    profileBaseBucketSize: Math.max(MIN_PROFILE_BASE_BUCKET_SIZE, tickSize),
    enableWrites: process.env.COLLECTOR_ENABLE_WRITES === 'true',
    dryRun: process.env.COLLECTOR_DRY_RUN === 'true',
    logLevel: process.env.COLLECTOR_LOG_LEVEL === 'debug' ? 'debug' : 'info',
    logFormat: process.env.COLLECTOR_LOG_FORMAT === 'json' ? 'json' : 'pretty',
  }
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
    loadEnvFile(envPath)
  }
}

function loadEnvFile(envPath) {
  const contents = readFileSync(envPath, 'utf8')
  const lines = contents.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function assertRuntimeSupport() {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required for the BTCUSDT collector')
  }

  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is unavailable. Run this collector with Node.js 22+ or a Node runtime that provides WebSocket.')
  }
}

async function initMongo() {
  mongoClient = new MongoClient(config.mongoUri)
  await mongoClient.connect()
  mongoDb = mongoClient.db(config.mongoDbName)
  await mongoDb.command({ ping: 1 })
  await ensureCollections()
  logger.info('mongodb connected', {
    dbName: mongoDb.databaseName,
    footprintCollection: COLLECTIONS.footprint,
    profileCollection: COLLECTIONS.profile,
  })
}

async function ensureCollections() {
  await ensureTimeSeriesCollection(COLLECTIONS.footprint)
  await ensureTimeSeriesCollection(COLLECTIONS.profile)
  await mongoDb.collection(COLLECTIONS.footprint).createIndex(
    {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.bucketSize': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    { name: 'idx_footprint_cells_source_time_price' },
  )
  await mongoDb.collection(COLLECTIONS.profile).createIndex(
    {
      'meta.symbol': 1,
      'meta.contractType': 1,
      'meta.dataSourceMode': 1,
      'meta.timeframe': 1,
      'meta.baseBucketSizeKey': 1,
      time: 1,
      bucketPriceKey: 1,
    },
    { name: 'idx_profile_rows_source_time_price' },
  )
  await mongoDb.collection(COLLECTIONS.collectorMeta).createIndex(
    { key: 1 },
    { unique: true, name: 'idx_collector_meta_key' },
  )
}

async function ensureTimeSeriesCollection(name) {
  const existing = await mongoDb.listCollections({ name }).toArray()

  if (existing.length === 0) {
    await mongoDb.createCollection(name, {
      timeseries: {
        timeField: 'time',
        metaField: 'meta',
        granularity: 'seconds',
      },
      expireAfterSeconds: config.retentionSeconds,
    })
    return
  }

  if (existing[0].type !== 'timeseries') {
    throw new Error(`${name} exists but is not a MongoDB time-series collection`)
  }

  try {
    await mongoDb.command({ collMod: name, expireAfterSeconds: config.retentionSeconds })
  } catch (error) {
    logger.warn('could not update collection retention', { collection: name, error: getErrorMessage(error) })
  }
}

function createRuntime(target) {
  const identity = `${SYMBOL}:${target.contractType}:${target.dataSourceMode}:${BASE_TIMEFRAME}`

  return {
    symbol: SYMBOL,
    contractType: target.contractType,
    dataSourceMode: target.dataSourceMode,
    activeSources: target.activeSources,
    identity,
    profileBaseBucketSize: config.profileBaseBucketSize,
    firstFullyCoveredBaseTimeBySource: { spot: null, futures: null },
    latestBaseTimeBySource: { spot: null, futures: null },
    processedTradeKeys: new BoundedSet(config.maxDedupeKeys),
    persistedSlices: new BoundedSet(config.maxDedupeKeys),
    footprintSlices: new Map(),
    profileSlices: new Map(),
  }
}

function createBinanceStreamClient(source) {
  const lowerSymbol = SYMBOL.toLowerCase()
  const baseUrl = source === 'spot'
    ? 'wss://stream.binance.com:9443/stream'
    : 'wss://fstream.binance.com/market/stream'
  const streams = [`${lowerSymbol}@aggTrade`, `${lowerSymbol}@kline_1m`]
  const url = `${baseUrl}?streams=${streams.join('/')}`
  let ws = null
  let reconnectAttempts = 0
  let reconnectTimer = null
  let heartbeatTimer = null

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const connect = () => {
    if (shuttingDown) return
    clearTimers()
    ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttempts = 0
      logger.info('stream connected', { source, streams })
      heartbeatTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        try {
          ws.ping?.()
        } catch {
          // Browser-compatible WebSocket implementations do not expose ping.
        }
      }, config.heartbeatMs)
    }

    ws.onmessage = (event) => {
      handleStreamMessage(source, String(event.data)).catch((error) => {
        logger.error('stream message handling failed', { source, error: getErrorMessage(error) })
      })
    }

    ws.onerror = (event) => {
      logger.error('stream error', { source, error: describeWebSocketEvent(event) })
    }

    ws.onclose = (event) => {
      clearTimers()
      if (shuttingDown) return
      logger.warn('stream closed', { source, code: event.code, reason: event.reason })
      markSourceGap(source)
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    reconnectAttempts += 1
    const delay = Math.min(
      config.reconnectMaxMs,
      config.reconnectMinMs * 2 ** Math.min(reconnectAttempts - 1, 10),
    )
    logger.warn('stream reconnect scheduled', { source, attempt: reconnectAttempts, delayMs: delay })
    reconnectTimer = setTimeout(connect, delay)
  }

  const close = () => {
    clearTimers()
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }

  return { connect, close }
}

async function handleStreamMessage(source, raw) {
  const parsed = JSON.parse(raw)
  const stream = parsed.stream
  const data = parsed.data
  if (!stream || !data) return

  if (stream.includes('@kline_1m')) {
    const close = Number(data.k?.c)
    if (Number.isFinite(close) && close > 0) {
      priceReferences[source] = close
      logger.debug('contract price reference updated', { source, price: close })
    }
    return
  }

  if (!stream.includes('@aggTrade')) return

  const trade = {
    source,
    id: Number.isFinite(Number(data.a)) ? Number(data.a) : undefined,
    time: Number(data.T),
    price: Number(data.p),
    quantity: Number(data.q),
    isBuyerMaker: Boolean(data.m),
  }

  if (!isValidTrade(trade)) return

  metrics.tradesReceived[source] += 1
  for (const runtime of runtimes) {
    if (!runtime.activeSources.includes(source)) continue
    ingestTrade(runtime, trade)
  }
}

function ingestTrade(runtime, trade) {
  const tradeKey = getTradeKey(trade)
  if (runtime.processedTradeKeys.has(tradeKey)) {
    metrics.tradesSkippedDuplicate += 1
    return
  }
  runtime.processedTradeKeys.add(tradeKey)

  const alignedPrice = getAlignedPrice(runtime.contractType, trade)
  if (!Number.isFinite(alignedPrice)) {
    metrics.tradesSkippedMissingReference += 1
    return
  }

  const baseTime = getBaseTimeForTradeMs(trade.time)
  if (runtime.firstFullyCoveredBaseTimeBySource[trade.source] === null) {
    runtime.firstFullyCoveredBaseTimeBySource[trade.source] = baseTime + BASE_TIMEFRAME_SECONDS
  }
  runtime.latestBaseTimeBySource[trade.source] = Math.max(
    runtime.latestBaseTimeBySource[trade.source] ?? baseTime,
    baseTime,
  )

  aggregateFootprint(runtime, baseTime, alignedPrice, trade)
  aggregateProfile(runtime, baseTime, alignedPrice, trade)
  metrics.tradesAccepted += 1
}

function getAlignedPrice(contractType, trade) {
  if (trade.source === contractType) return trade.price
  return priceReferences[contractType]
}

function aggregateFootprint(runtime, baseTime, price, trade) {
  const bucketPrice = normalizePriceToBucket(price, FOOTPRINT_BUCKET_SIZE)
  const candleRows = runtime.footprintSlices.get(baseTime) ?? new Map()
  const row = candleRows.get(bucketPrice) ?? { bucketPrice, bidVol: 0, askVol: 0 }

  if (trade.isBuyerMaker) {
    row.bidVol += trade.quantity
  } else {
    row.askVol += trade.quantity
  }

  candleRows.set(bucketPrice, row)
  runtime.footprintSlices.set(baseTime, candleRows)
}

function aggregateProfile(runtime, baseTime, price, trade) {
  const baseBucketSize = runtime.profileBaseBucketSize
  const bucketPrice = normalizePriceToBucket(price, baseBucketSize)
  const candleRows = runtime.profileSlices.get(baseTime) ?? new Map()
  const row = candleRows.get(bucketPrice) ?? {
    candleTime: baseTime,
    baseBucketSize,
    bucketPrice,
    bidVol: 0,
    askVol: 0,
    totalVol: 0,
    tradeCount: 0,
  }

  if (trade.isBuyerMaker) {
    row.bidVol += trade.quantity
  } else {
    row.askVol += trade.quantity
  }

  row.totalVol += trade.quantity
  row.tradeCount += 1
  candleRows.set(bucketPrice, row)
  runtime.profileSlices.set(baseTime, candleRows)
}

async function persistAllEligibleSlices(reason) {
  if (shuttingDown && reason !== 'shutdown') return

  for (const runtime of runtimes) {
    await persistRuntimeEligibleSlices(runtime, reason)
  }
}

async function requestPersist(reason) {
  if (persistPromise) return persistPromise

  persistPromise = persistAllEligibleSlices(reason)
    .catch((error) => {
      metrics.writeFailures += 1
      logger.error('flush failed', { reason, error: getErrorMessage(error) })
    })
    .finally(() => {
      persistPromise = null
    })

  return persistPromise
}

async function persistRuntimeEligibleSlices(runtime, reason) {
  const coverageStart = getCoverageStart(runtime)
  const closedBeforeTime = getClosedBeforeTime(runtime)
  const sliceTimes = getSortedSliceTimes(runtime)

  if (sliceTimes.length === 0) return

  if (coverageStart === null || closedBeforeTime === null) {
    return
  }

  for (const sliceTime of sliceTimes) {
    if (sliceTime < coverageStart) {
      deleteSlice(runtime, sliceTime)
      continue
    }

    if (sliceTime >= closedBeforeTime) {
      continue
    }

    const persistedKey = `${runtime.identity}:${sliceTime}`
    if (runtime.persistedSlices.has(persistedKey)) {
      deleteSlice(runtime, sliceTime)
      continue
    }

    const footprintRows = Array.from(runtime.footprintSlices.get(sliceTime)?.values() ?? [])
    const profileRows = Array.from(runtime.profileSlices.get(sliceTime)?.values() ?? [])

    if (footprintRows.length === 0 && profileRows.length === 0) {
      deleteSlice(runtime, sliceTime)
      continue
    }

    try {
      const result = await writeClosedSlice(runtime, sliceTime, footprintRows, profileRows)
      runtime.persistedSlices.add(persistedKey)
      deleteSlice(runtime, sliceTime)
      metrics.slicesPersisted += 1
      metrics.footprintRowsInserted += result.footprint.inserted
      metrics.footprintRowsSkipped += result.footprint.skipped
      metrics.profileRowsInserted += result.profile.inserted
      metrics.profileRowsSkipped += result.profile.skipped
      logger.info('closed 1m slice persisted', {
        reason,
        identity: runtime.identity,
        candleTime: sliceTime,
        footprintRowsWritten: result.footprint.inserted,
        footprintRowsSkipped: result.footprint.skipped,
        profileRowsWritten: result.profile.inserted,
        profileRowsSkipped: result.profile.skipped,
        baseBucketSize: runtime.profileBaseBucketSize,
      })
    } catch (error) {
      metrics.writeFailures += 1
      logger.error('closed 1m slice persist failed', {
        identity: runtime.identity,
        candleTime: sliceTime,
        error: getErrorMessage(error),
      })
      return
    }
  }
}

async function writeClosedSlice(runtime, sliceTime, footprintRows, profileRows) {
  const footprintDocuments = toFootprintDocuments(runtime, sliceTime, footprintRows)
  const profileDocuments = toProfileDocuments(runtime, sliceTime, profileRows)

  if (config.dryRun || !config.enableWrites) {
    logger.info('dry-run closed slice write', {
      identity: runtime.identity,
      candleTime: sliceTime,
      footprintRows: footprintDocuments.length,
      profileRows: profileDocuments.length,
      writesEnabled: config.enableWrites,
      dryRun: config.dryRun,
    })
    return {
      footprint: { inserted: 0, skipped: footprintDocuments.length },
      profile: { inserted: 0, skipped: profileDocuments.length },
    }
  }

  const footprint = await insertMissingFootprintDocuments(footprintDocuments)
  const profile = await insertMissingProfileDocuments(profileDocuments)

  const now = new Date().toISOString()
  await updateCollectorMeta({
    last_collector_heartbeat: now,
    collector_symbol: SYMBOL,
    collector_profile_base_bucket_size: String(runtime.profileBaseBucketSize),
    last_footprint_stored: footprint.inserted > 0 ? now : undefined,
    last_profile_rows_stored: profile.inserted > 0 ? now : undefined,
  })

  return { footprint, profile }
}

function toFootprintDocuments(runtime, sliceTime, rows) {
  const time = new Date(sliceTime * 1000)
  const storedAt = new Date()

  return rows
    .filter((row) => (
      Number.isFinite(row.bucketPrice)
      && Number.isFinite(row.bidVol)
      && Number.isFinite(row.askVol)
      && row.bidVol + row.askVol > 0
    ))
    .map((row) => {
      const totalVol = row.bidVol + row.askVol
      const delta = row.askVol - row.bidVol

      return {
        time,
        meta: {
          symbol: runtime.symbol,
          contractType: runtime.contractType,
          dataSourceMode: runtime.dataSourceMode,
          timeframe: BASE_TIMEFRAME,
          bucketSize: FOOTPRINT_BUCKET_SIZE,
        },
        candleTimeSec: sliceTime,
        bucketPrice: toStoredNumber(row.bucketPrice),
        bucketPriceKey: toNumberKey(row.bucketPrice),
        bidVol: toStoredNumber(row.bidVol),
        askVol: toStoredNumber(row.askVol),
        totalVol: toStoredNumber(totalVol),
        delta: toStoredNumber(delta),
        storedAt,
      }
    })
}

function toProfileDocuments(runtime, sliceTime, rows) {
  const time = new Date(sliceTime * 1000)
  const storedAt = new Date()
  const baseBucketSizeKey = toNumberKey(runtime.profileBaseBucketSize)

  return rows
    .filter((row) => (
      Number.isFinite(row.candleTime)
      && row.baseBucketSize > 0
      && Number.isFinite(row.bucketPrice)
      && row.totalVol > 0
      && row.tradeCount > 0
    ))
    .map((row) => ({
      time,
      meta: {
        symbol: runtime.symbol,
        contractType: runtime.contractType,
        dataSourceMode: runtime.dataSourceMode,
        timeframe: BASE_TIMEFRAME,
        baseBucketSizeKey,
      },
      candleTimeSec: sliceTime,
      baseBucketSize: toStoredNumber(row.baseBucketSize),
      bucketPrice: toStoredNumber(row.bucketPrice),
      bucketPriceKey: toNumberKey(row.bucketPrice),
      bidVol: toStoredNumber(row.bidVol),
      askVol: toStoredNumber(row.askVol),
      totalVol: toStoredNumber(row.totalVol),
      tradeCount: Math.max(0, Math.floor(row.tradeCount)),
      storedAt,
    }))
}

async function insertMissingFootprintDocuments(documents) {
  if (documents.length === 0) return { inserted: 0, skipped: 0 }

  const collection = mongoDb.collection(COLLECTIONS.footprint)
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
  const missing = documents.filter((document) => !existingKeys.has(getDocumentIdentityKey(document)))

  if (missing.length > 0) {
    await collection.insertMany(missing, { ordered: false })
  }

  return { inserted: missing.length, skipped: documents.length - missing.length }
}

async function insertMissingProfileDocuments(documents) {
  if (documents.length === 0) return { inserted: 0, skipped: 0 }

  const collection = mongoDb.collection(COLLECTIONS.profile)
  const first = documents[0]
  const existing = await collection
    .find({
      'meta.symbol': first.meta.symbol,
      'meta.contractType': first.meta.contractType,
      'meta.dataSourceMode': first.meta.dataSourceMode,
      'meta.timeframe': first.meta.timeframe,
      'meta.baseBucketSizeKey': first.meta.baseBucketSizeKey,
      time: first.time,
      bucketPriceKey: { $in: documents.map((document) => document.bucketPriceKey) },
    })
    .project({ candleTimeSec: 1, bucketPriceKey: 1 })
    .toArray()
  const existingKeys = new Set(existing.map((document) => (
    `${Number(document.candleTimeSec)}:${String(document.bucketPriceKey)}`
  )))
  const missing = documents.filter((document) => !existingKeys.has(getDocumentIdentityKey(document)))

  if (missing.length > 0) {
    await collection.insertMany(missing, { ordered: false })
  }

  return { inserted: missing.length, skipped: documents.length - missing.length }
}

async function updateCollectorMeta(values) {
  const collection = mongoDb.collection(COLLECTIONS.collectorMeta)
  const updates = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => collection.updateOne(
      { key },
      { $set: { key, value: String(value), updatedAt: new Date() } },
      { upsert: true },
    ))

  await Promise.all(updates)
}

function markSourceGap(source) {
  for (const runtime of runtimes) {
    if (!runtime.activeSources.includes(source)) continue
    runtime.firstFullyCoveredBaseTimeBySource[source] = null
    runtime.latestBaseTimeBySource[source] = null
  }
  priceReferences[source] = null
  logger.warn('source marked partial after stream gap', { source })
}

function getCoverageStart(runtime) {
  const times = runtime.activeSources.map((source) => runtime.firstFullyCoveredBaseTimeBySource[source])
  if (times.some((time) => time === null)) return null
  return Math.max(...times)
}

function getClosedBeforeTime(runtime) {
  const times = runtime.activeSources.map((source) => runtime.latestBaseTimeBySource[source])
  if (times.some((time) => time === null)) return null
  return Math.min(...times)
}

function getSortedSliceTimes(runtime) {
  return Array.from(new Set([
    ...runtime.footprintSlices.keys(),
    ...runtime.profileSlices.keys(),
  ])).sort((a, b) => a - b)
}

function deleteSlice(runtime, sliceTime) {
  runtime.footprintSlices.delete(sliceTime)
  runtime.profileSlices.delete(sliceTime)
}

async function logStatus() {
  const pendingSlices = runtimes.reduce((total, runtime) => total + getSortedSliceTimes(runtime).length, 0)
  const status = {
    symbol: SYMBOL,
    writesEnabled: config.enableWrites,
    dryRun: config.dryRun,
    priceReferences,
    pendingSlices,
    metrics,
    runtimes: runtimes.map((runtime) => ({
      identity: runtime.identity,
      coverageStart: getCoverageStart(runtime),
      closedBeforeTime: getClosedBeforeTime(runtime),
      pendingSlices: getSortedSliceTimes(runtime).length,
    })),
  }

  logger.info('collector status', status)

  if (config.enableWrites && !config.dryRun) {
    await updateCollectorMeta({
      last_collector_heartbeat: new Date().toISOString(),
      collector_status: JSON.stringify({
        symbol: status.symbol,
        pendingSlices: status.pendingSlices,
        tradesReceived: status.metrics.tradesReceived,
        slicesPersisted: status.metrics.slicesPersisted,
        writeFailures: status.metrics.writeFailures,
      }),
    })
  }
}

async function shutdown(signal, flushTimer, statusTimer) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('collector shutting down', { signal })
  clearInterval(flushTimer)
  clearInterval(statusTimer)

  try {
    if (persistPromise) {
      await persistPromise
    }
    await persistAllEligibleSlices('shutdown')
  } catch (error) {
    logger.error('shutdown flush failed', { error: getErrorMessage(error) })
  }

  streamClients.forEach((client) => client.close())
  if (mongoClient) {
    await mongoClient.close()
  }
  logger.info('collector stopped')
  process.exit(0)
}

function getTradeKey(trade) {
  if (Number.isFinite(trade.id)) return `${trade.source}:id:${trade.id}`
  return `${trade.source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker ? 1 : 0}`
}

function getBaseTimeForTradeMs(timeMs) {
  return Math.floor((timeMs / 1000) / BASE_TIMEFRAME_SECONDS) * BASE_TIMEFRAME_SECONDS
}

function normalizePriceToBucket(price, bucketSize) {
  return Math.floor(price / bucketSize) * bucketSize
}

function toStoredNumber(value) {
  return Number.isFinite(value) ? String(value) : '0'
}

function toNumberKey(value) {
  if (!Number.isFinite(value)) return '0'
  const fixed = value.toFixed(12).replace(/\.?0+$/, '')
  return fixed === '-0' || fixed === '' ? '0' : fixed
}

function getDocumentIdentityKey(document) {
  return `${document.candleTimeSec}:${document.bucketPriceKey}`
}

function isValidTrade(trade) {
  return SOURCES.includes(trade.source)
    && Number.isFinite(trade.time)
    && Number.isFinite(trade.price)
    && Number.isFinite(trade.quantity)
    && trade.quantity > 0
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getIntegerEnv(name, fallback) {
  return Math.floor(getNumberEnv(name, fallback))
}

function createLogger(level) {
  const debugEnabled = level === 'debug'
  const useJson = config.logFormat === 'json'
  const useColors = !useJson && Boolean(process.stdout?.isTTY)
  const levelStyles = {
    debug: useColors ? '\x1b[36mDEBUG\x1b[0m' : 'DEBUG',
    info: useColors ? '\x1b[32mINFO \x1b[0m' : 'INFO ',
    warn: useColors ? '\x1b[33mWARN \x1b[0m' : 'WARN ',
    error: useColors ? '\x1b[31mERROR\x1b[0m' : 'ERROR',
  }

  const log = (severity, message, details) => {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')

    if (useJson) {
      const payload = {
        ts: new Date().toISOString(),
        level: severity,
        message,
        ...(details ? { details } : {}),
      }
      console.log(JSON.stringify(payload))
      return
    }

    console.log(`[${timestamp}] ${levelStyles[severity]} ${message}`)
    if (details !== undefined) {
      console.log(
        inspect(details, {
          depth: null,
          colors: useColors,
          compact: false,
          sorted: true,
          breakLength: 120,
        }),
      )
    }
  }

  return {
    debug(message, details) {
      if (debugEnabled) log('debug', message, details)
    },
    info(message, details) {
      log('info', message, details)
    },
    warn(message, details) {
      log('warn', message, details)
    },
    error(message, details) {
      log('error', message, details)
    },
  }
}

function describeWebSocketEvent(event) {
  if (!event) return 'unknown websocket error'
  if ('message' in event && event.message) return String(event.message)
  if ('type' in event && event.type) return String(event.type)
  return String(event)
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function handlePipeError(error) {
  if (error?.code === 'EPIPE') {
    process.exit(0)
  }
}

class BoundedSet {
  constructor(limit) {
    this.limit = limit
    this.values = new Set()
  }

  has(value) {
    return this.values.has(value)
  }

  add(value) {
    this.values.add(value)
    while (this.values.size > this.limit) {
      const oldest = this.values.values().next().value
      if (oldest === undefined) break
      this.values.delete(oldest)
    }
  }
}

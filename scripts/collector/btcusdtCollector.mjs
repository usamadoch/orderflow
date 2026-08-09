import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'

const SYMBOL = 'BTCUSDT'
const BASE_TIMEFRAME = '1m'
const BASE_TIMEFRAME_SECONDS = 60
const FOOTPRINT_BUCKET_SIZE = 5
const MIN_PROFILE_BASE_BUCKET_SIZE = 1.5
const DEFAULT_TICK_SIZE = 0.5
const DEFAULT_RETENTION_DAYS = 90
const DEFAULT_FLUSH_INTERVAL_MS = 1000
const DEFAULT_STATUS_INTERVAL_MS = 30000
const DEFAULT_MAX_DEDUPE_KEYS = 100000
const DEFAULT_RECONNECT_MIN_MS = 1000
const DEFAULT_RECONNECT_MAX_MS = 30000
const DEFAULT_HEARTBEAT_MS = 30000
// const DEFAULT_AGG_BUBBLE_MIN_VOLUME_BTC = 15
// const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT = 75
// const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC = 3
const DEFAULT_AGG_BUBBLE_FLUSH_SIZE = 1000

const COLLECTIONS = {
  footprint: 'footprint_cells_ts',
  profile: 'profile_rows_ts',
  collectorMeta: 'collector_meta',
  aggregateBubbles: 'aggregate_bubble_events',
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
  aggregateBubbles: {
    received: { spot: 0, futures: 0 },
    qualified: 0,
    skippedBelowThreshold: 0,
    skippedMissingAggregateTradeId: 0,
    skippedInvalidTradeRange: 0,
    duplicatesSkipped: 0,
    inserted: 0,
    insertFailed: 0,
    skippedPersistenceDisabled: 0,
  },
}

let mongoClient = null
let mongoDb = null
let bubbleMongoClient = null
let bubbleMongoDb = null
let shuttingDown = false
let persistPromise = null

const priceReferences = {
  spot: null,
  futures: null,
}

let runtimes = []
const streamClients = []
const queuedAggregateBubbleEvents = []
const queuedAggregateBubbleKeys = new Set()

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    logger.error('collector fatal error', { error: getErrorMessage(error) })
    process.exitCode = 1
  })
}

async function main() {
  assertRuntimeSupport()
  await initMongo()
  await initAggregateBubblePersistence()
  runtimes = TARGETS.map((target) => createRuntime(target))

  logger.info('active aggregation identities', {
    symbol: SYMBOL,
    identities: runtimes.map((runtime) => runtime.identity),
    footprintBucketSize: FOOTPRINT_BUCKET_SIZE,
    profileBaseBucketSize: config.profileBaseBucketSize,
    aggregateBubbleThresholds: {
      minVolume: config.aggregateBubbleMinVolume,
      minTradeCount: config.aggregateBubbleMinTradeCount,
      minTradeCountVolume: config.aggregateBubbleMinTradeCountVolume,
    },
    writesEnabled: config.enableWrites,
    dryRun: config.dryRun,
    aggregateBubbleWritesEnabled: config.aggregateBubbleWritesEnabled,
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
  const tickSize = DEFAULT_TICK_SIZE

  return {
    mongoUri: 'mongodb://usamadoch_db_user:17ZvfflxOlDWgWOC@ac-nqzf95f-shard-00-00.vvdhsab.mongodb.net:27017,ac-nqzf95f-shard-00-01.vvdhsab.mongodb.net:27017,ac-nqzf95f-shard-00-02.vvdhsab.mongodb.net:27017/orderflow?ssl=true&replicaSet=atlas-1x7o74-shard-0&authSource=admin&appName=Cluster0',
    mongoDbName: 'orderflow',
    bubblesMongoUri: 'mongodb://usamadoch_db_user:3aAhUVGGWOQRyMRc@ac-skht2qq-shard-00-00.lx6pbxx.mongodb.net:27017,ac-skht2qq-shard-00-01.lx6pbxx.mongodb.net:27017,ac-skht2qq-shard-00-02.lx6pbxx.mongodb.net:27017/orderflow_bubbles?ssl=true&replicaSet=atlas-o30yvr-shard-0&authSource=admin&appName=Cluster0',
    bubblesMongoDbName: 'orderflow_bubbles',
    retentionSeconds: Math.floor(DEFAULT_RETENTION_DAYS * 24 * 60 * 60),
    flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
    statusIntervalMs: DEFAULT_STATUS_INTERVAL_MS,
    maxDedupeKeys: DEFAULT_MAX_DEDUPE_KEYS,
    aggregateBubbleFlushSize: DEFAULT_AGG_BUBBLE_FLUSH_SIZE,
    aggregateBubbleMinVolume: 1,
    aggregateBubbleMinTradeCount: 25,
    aggregateBubbleMinTradeCountVolume: 0.5,
    reconnectMinMs: DEFAULT_RECONNECT_MIN_MS,
    reconnectMaxMs: DEFAULT_RECONNECT_MAX_MS,
    heartbeatMs: DEFAULT_HEARTBEAT_MS,
    exitAfterMs: 0,
    tickSize,
    profileBaseBucketSize: Math.max(MIN_PROFILE_BASE_BUCKET_SIZE, tickSize),
    enableWrites: true,
    dryRun: false,
    aggregateBubbleWritesEnabled: false,
    logLevel: 'info',
    logFormat: 'pretty',
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

async function initAggregateBubblePersistence() {
  if (!config.enableWrites || config.dryRun) return

  if (!config.bubblesMongoUri || !config.bubblesMongoDbName) {
    logger.warn('aggregate bubble persistence disabled; continuing footprint/profile collector', {
      requiredEnv: 'Set BUBBLES_MONGODB_URI and BUBBLES_MONGODB_DB_NAME to persist aggregate bubble candidates.',
      hasBubblesMongoUri: Boolean(config.bubblesMongoUri),
      hasBubblesMongoDbName: Boolean(config.bubblesMongoDbName),
    })
    return
  }

  try {
    await initBubbleMongo()
    config.aggregateBubbleWritesEnabled = true
  } catch (error) {
    if (bubbleMongoClient) {
      try {
        await bubbleMongoClient.close()
      } catch {
        // Best-effort cleanup after a failed startup connection.
      }
    }
    bubbleMongoClient = null
    bubbleMongoDb = null
    config.aggregateBubbleWritesEnabled = false
    logger.warn('aggregate bubble mongodb unavailable; continuing footprint/profile collector', {
      error: getErrorMessage(error),
      impact: 'Aggregate bubble candidates will be skipped until the collector is restarted with a healthy bubbles MongoDB connection.',
    })
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

async function initBubbleMongo() {
  bubbleMongoClient = new MongoClient(config.bubblesMongoUri)
  await bubbleMongoClient.connect()
  bubbleMongoDb = bubbleMongoClient.db(config.bubblesMongoDbName)
  await bubbleMongoDb.command({ ping: 1 })
  await ensureAggregateBubbleCollection()
  logger.info('aggregate bubble mongodb connected', {
    dbName: bubbleMongoDb.databaseName,
    collection: COLLECTIONS.aggregateBubbles,
    retentionSeconds: config.retentionSeconds,
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

async function ensureAggregateBubbleCollection() {
  const existing = await bubbleMongoDb.listCollections({ name: COLLECTIONS.aggregateBubbles }).toArray()

  if (existing.length === 0) {
    await bubbleMongoDb.createCollection(COLLECTIONS.aggregateBubbles)
  } else if (existing[0].type === 'timeseries') {
    throw new Error(`${COLLECTIONS.aggregateBubbles} must be a regular MongoDB collection for aggregate trade id deduplication`)
  }

  const collection = bubbleMongoDb.collection(COLLECTIONS.aggregateBubbles)
  await collection.createIndex(
    { symbol: 1, contractType: 1, aggregateTradeId: 1 },
    { unique: true, name: 'uniq_aggregate_bubbles_source_id' },
  )
  await collection.createIndex(
    { symbol: 1, contractType: 1, eventTime: 1, aggregateTradeId: 1 },
    { name: 'idx_aggregate_bubbles_restore', background: true },
  )

  const indexes = await collection.indexes()
  const existingTtl = indexes.find((index) => index.name === 'ttl_aggregate_bubbles_event_time')
  if (existingTtl && existingTtl.expireAfterSeconds !== config.retentionSeconds) {
    await collection.dropIndex('ttl_aggregate_bubbles_event_time')
  }
  await collection.createIndex(
    { eventTime: 1 },
    { expireAfterSeconds: config.retentionSeconds, name: 'ttl_aggregate_bubbles_event_time' },
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
    taintedRangesBySource: { spot: [], futures: [] },
    processedTradeKeys: new BoundedSet(config.maxDedupeKeys),
    persistedSlices: new BoundedSet(config.maxDedupeKeys),
    footprintSlices: new Map(),
    profileSlices: new Map(),
  }
}

function createBinanceStreamClient(source) {
  const lowerSymbol = SYMBOL.toLowerCase()
  const baseUrl = source === 'spot'
    ? 'wss://data-stream.binance.vision/stream'
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
    firstTradeId: Number.isFinite(Number(data.f)) ? Number(data.f) : undefined,
    lastTradeId: Number.isFinite(Number(data.l)) ? Number(data.l) : undefined,
    time: Number(data.T),
    price: Number(data.p),
    quantity: Number(data.q),
    isBuyerMaker: Boolean(data.m),
  }

  if (!isValidTrade(trade)) return

  metrics.tradesReceived[source] += 1
  queueAggregateBubbleCandidate(trade)
  for (const runtime of runtimes) {
    if (!runtime.activeSources.includes(source)) continue
    ingestTrade(runtime, trade)
  }
}

function getAggregateTradeCount(trade) {
  const firstTradeId = Number(trade.firstTradeId)
  const lastTradeId = Number(trade.lastTradeId)

  if (!Number.isFinite(firstTradeId) || !Number.isFinite(lastTradeId) || lastTradeId < firstTradeId) {
    return null
  }

  return Math.floor(lastTradeId - firstTradeId + 1)
}

function queueAggregateBubbleCandidate(trade) {
  if (config.enableWrites && !config.dryRun && !config.aggregateBubbleWritesEnabled) {
    metrics.aggregateBubbles.skippedPersistenceDisabled += 1
    return
  }

  metrics.aggregateBubbles.received[trade.source] += 1

  if (!Number.isFinite(trade.id)) {
    metrics.aggregateBubbles.skippedMissingAggregateTradeId += 1
    return
  }

  const tradeCount = getAggregateTradeCount(trade)
  if (tradeCount === null) {
    metrics.aggregateBubbles.skippedInvalidTradeRange += 1
    return
  }

  const key = `${SYMBOL}:${trade.source}:${trade.id}`
  if (queuedAggregateBubbleKeys.has(key)) {
    metrics.aggregateBubbles.duplicatesSkipped += 1
    return
  }
  rememberBoundedSet(queuedAggregateBubbleKeys, key, config.maxDedupeKeys)

  const qualifiedBy = []
  if (trade.quantity >= config.aggregateBubbleMinVolume) {
    qualifiedBy.push('volume')
  }
  if (
    tradeCount >= config.aggregateBubbleMinTradeCount
    && trade.quantity >= config.aggregateBubbleMinTradeCountVolume
  ) {
    qualifiedBy.push('tradeCount')
  }

  if (qualifiedBy.length === 0) {
    metrics.aggregateBubbles.skippedBelowThreshold += 1
    return
  }

  queuedAggregateBubbleEvents.push({
    symbol: SYMBOL,
    contractType: trade.source,
    aggregateTradeId: Math.floor(trade.id),
    eventTime: new Date(trade.time),
    eventTimeMs: trade.time,
    price: toStoredNumber(trade.price),
    side: trade.isBuyerMaker ? 'sell' : 'buy',
    volume: toStoredNumber(trade.quantity),
    tradeCount,
    firstTradeId: Math.floor(trade.firstTradeId),
    lastTradeId: Math.floor(trade.lastTradeId),
    createdAt: new Date(),
    storageVersion: 1,
    qualifiedBy,
    minVolumeAtIngest: toStoredNumber(config.aggregateBubbleMinVolume),
    minTradeCountAtIngest: config.aggregateBubbleMinTradeCount,
  })
  metrics.aggregateBubbles.qualified += 1
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

  const taintedRanges = runtime.taintedRangesBySource[trade.source]
  if (taintedRanges.length > 0) {
    const activeGap = taintedRanges[taintedRanges.length - 1]
    if (activeGap.end === null) {
      activeGap.end = baseTime
      logger.warn('tainted range created', {
        identity: runtime.identity,
        source: trade.source,
        start: activeGap.start,
        end: activeGap.end,
        sizeSeconds: activeGap.end - activeGap.start
      })
    }
  }

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

  await persistAggregateBubbleEvents(reason)

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

  let droppedTaintedSlices = 0
  for (const sliceTime of sliceTimes) {
    if (sliceTime < coverageStart) {
      deleteSlice(runtime, sliceTime)
      continue
    }

    if (sliceTime >= closedBeforeTime) {
      continue
    }

    let isTainted = false
    let taintedBySource = null
    for (const source of runtime.activeSources) {
      for (const range of runtime.taintedRangesBySource[source]) {
        if (range.end !== null && sliceTime > range.start && sliceTime < range.end) {
          isTainted = true
          taintedBySource = source
          break
        }
      }
      if (isTainted) break
    }

    if (isTainted) {
      deleteSlice(runtime, sliceTime)
      droppedTaintedSlices += 1
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

  if (droppedTaintedSlices > 0) {
    logger.warn('discarded tainted slices', {
      identity: runtime.identity,
      droppedCount: droppedTaintedSlices
    })
  }

  for (const source of runtime.activeSources) {
    runtime.taintedRangesBySource[source] = runtime.taintedRangesBySource[source].filter(
      (range) => range.end === null || range.end >= closedBeforeTime
    )
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

  // Try the write; if it fails, just throw so it can be retried on the next interval
  try {
    return await executeSliceWrite(runtime, sliceTime, footprintDocuments, profileDocuments)
  } catch (firstError) {
    logger.warn('slice write failed, data remains in memory to retry on next interval', {
      identity: runtime.identity,
      candleTime: sliceTime,
      error: getErrorMessage(firstError),
    })
    throw firstError
  }
}

async function executeSliceWrite(runtime, sliceTime, footprintDocuments, profileDocuments) {
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

async function persistAggregateBubbleEvents(reason) {
  if (queuedAggregateBubbleEvents.length === 0) return

  const batch = queuedAggregateBubbleEvents.slice(0, config.aggregateBubbleFlushSize)

  if (config.enableWrites && !config.dryRun && !config.aggregateBubbleWritesEnabled) {
    queuedAggregateBubbleEvents.splice(0, batch.length)
    metrics.aggregateBubbles.skippedPersistenceDisabled += batch.length
    logger.warn('aggregate bubble candidate write skipped; persistence disabled', {
      reason,
      rows: batch.length,
    })
    return
  }

  if (config.dryRun || !config.enableWrites) {
    queuedAggregateBubbleEvents.splice(0, batch.length)
    logger.info('dry-run aggregate bubble candidate write', {
      reason,
      rows: batch.length,
      writesEnabled: config.enableWrites,
      dryRun: config.dryRun,
      thresholds: {
        minVolume: config.aggregateBubbleMinVolume,
        minTradeCount: config.aggregateBubbleMinTradeCount,
        minTradeCountVolume: config.aggregateBubbleMinTradeCountVolume,
      },
    })
    return
  }

  try {
    const result = await insertAggregateBubbleDocuments(batch)
    queuedAggregateBubbleEvents.splice(0, batch.length)
    metrics.aggregateBubbles.inserted += result.inserted
    metrics.aggregateBubbles.duplicatesSkipped += result.duplicatesSkipped

    if (result.inserted > 0 || result.duplicatesSkipped > 0) {
      await updateCollectorMeta({
        last_aggregate_bubbles_stored: result.inserted > 0 ? new Date().toISOString() : undefined,
        aggregate_bubble_thresholds: JSON.stringify({
          minVolume: config.aggregateBubbleMinVolume,
          minTradeCount: config.aggregateBubbleMinTradeCount,
          minTradeCountVolume: config.aggregateBubbleMinTradeCountVolume,
        }),
      })
    }

    logger.info('aggregate bubble candidates persisted', {
      reason,
      rowsSubmitted: batch.length,
      rowsInserted: result.inserted,
      duplicatesSkipped: result.duplicatesSkipped,
      pendingRows: queuedAggregateBubbleEvents.length,
    })
  } catch (error) {
    metrics.aggregateBubbles.insertFailed += batch.length
    metrics.writeFailures += 1
    logger.error('aggregate bubble candidate persist failed', {
      reason,
      rows: batch.length,
      error: getErrorMessage(error),
    })
  }
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

async function insertAggregateBubbleDocuments(documents) {
  if (documents.length === 0) return { inserted: 0, duplicatesSkipped: 0 }

  const collection = bubbleMongoDb.collection(COLLECTIONS.aggregateBubbles)

  try {
    const result = await collection.insertMany(documents, { ordered: false })
    return { inserted: result.insertedCount, duplicatesSkipped: 0 }
  } catch (error) {
    const writeErrors = Array.isArray(error?.writeErrors) ? error.writeErrors : []
    const duplicateCount = writeErrors.filter((writeError) => writeError.code === 11000).length
    const inserted = Number(error?.result?.insertedCount ?? error?.insertedCount ?? 0)

    if (writeErrors.length > 0 && duplicateCount === writeErrors.length) {
      return { inserted, duplicatesSkipped: duplicateCount }
    }

    throw error
  }
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
    
    const gapStart = runtime.latestBaseTimeBySource[source]
    if (gapStart !== null) {
       runtime.taintedRangesBySource[source].push({ start: gapStart, end: null })
    }
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
  const conciseStatus = {
    pendingSlices,
    pendingBubbles: queuedAggregateBubbleEvents.length,
    trades: metrics.tradesReceived,
    fails: metrics.writeFailures
  }

  logger.info('collector status', conciseStatus)

  if (config.enableWrites && !config.dryRun) {
    await updateCollectorMeta({
      last_collector_heartbeat: new Date().toISOString(),
      collector_status: JSON.stringify({
        symbol: SYMBOL,
        pendingSlices,
        pendingAggregateBubbleEvents: queuedAggregateBubbleEvents.length,
        tradesReceived: metrics.tradesReceived,
        aggregateBubbles: metrics.aggregateBubbles,
        slicesPersisted: metrics.slicesPersisted,
        writeFailures: metrics.writeFailures,
      }),
    })

    // Informational size log.
    try {
      const stats = await mongoDb.command({ dbStats: 1 })
      const dataSizeMB = ((stats.dataSize || 0) / 1024 / 1024).toFixed(2)
      const storageSizeMB = ((stats.storageSize || 0) / 1024 / 1024).toFixed(2)
      const indexSizeMB = ((stats.indexSize || 0) / 1024 / 1024).toFixed(2)
      logger.info('database size report', {
        dataSizeMB,
        storageSizeMB,
        indexSizeMB,
        retentionDays: DEFAULT_RETENTION_DAYS,
      })
    } catch (e) {
      logger.warn('could not read database size', { error: getErrorMessage(e) })
    }
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
  if (bubbleMongoClient) {
    await bubbleMongoClient.close()
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

    const isSerious = severity === 'error' || severity === 'warn'
    const hr = useColors ? '\x1b[90m' + '─'.repeat(80) + '\x1b[0m' : '─'.repeat(80)

    if (isSerious) console.log(hr)

    let detailsStr = ''
    if (details !== undefined) {
      if (typeof details === 'string') {
        detailsStr = ` [${details}]`
      } else {
        try {
          detailsStr = ' ' + JSON.stringify(details)
        } catch {
          detailsStr = ' [Object]'
        }
      }
    }

    console.log(`[${timestamp}] ${levelStyles[severity]} ${message}${detailsStr}`)

    if (isSerious) console.log(hr)
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

function rememberBoundedSet(set, value, limit) {
  set.add(value)
  while (set.size > limit) {
    const oldest = set.values().next().value
    if (oldest === undefined) break
    set.delete(oldest)
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

export const _test = {
  config,
  runtimes,
  metrics,
  queuedAggregateBubbleEvents,
  queuedAggregateBubbleKeys,
  priceReferences,
  createRuntime,
  markSourceGap,
  getCoverageStart,
  getClosedBeforeTime,
  getSortedSliceTimes,
  deleteSlice,
  ingestTrade,
  persistRuntimeEligibleSlices,
  setMongoDb: (db) => { mongoDb = db },
  setBubbleMongoDb: (db) => { bubbleMongoDb = db },
  setShuttingDown: (val) => { shuttingDown = val },
  setPersistPromise: (val) => { persistPromise = val },
  getRuntimes: () => runtimes,
  setRuntimes: (val) => { runtimes.length = 0; runtimes.push(...val) }
}

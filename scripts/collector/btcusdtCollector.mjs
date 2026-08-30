import pg from 'pg'
const { Pool } = pg

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
const DEFAULT_AGG_BUBBLE_MIN_VOLUME_BTC = 15
const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT = 75
const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC = 3
const DEFAULT_AGG_BUBBLE_FLUSH_SIZE = 1000

// No longer using MongoDB collections

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

let pgPool = null
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

const sourceState = {
  spot: { connected: false, isBackfilling: false, lastTradeTimeMs: null },
  futures: { connected: false, isBackfilling: false, lastTradeTimeMs: null },
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    logger.error('collector fatal error', { error: getErrorMessage(error) })
    process.exitCode = 1
  })
}

async function main() {
  assertRuntimeSupport()
  await initTimescale()
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
    timescaleUrl: 'postgres://tsdbadmin:p9n9i8cp16mol92v@cq4mtid05l.sa5cunrc6u.tsdb.cloud.timescale.com:34945/tsdb?sslmode=no-verify',
    retentionSeconds: Math.floor(DEFAULT_RETENTION_DAYS * 24 * 60 * 60),
    flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
    statusIntervalMs: DEFAULT_STATUS_INTERVAL_MS,
    maxDedupeKeys: DEFAULT_MAX_DEDUPE_KEYS,
    aggregateBubbleFlushSize: DEFAULT_AGG_BUBBLE_FLUSH_SIZE,
    aggregateBubbleMinVolume: process.env.COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC ? Number(process.env.COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC) : DEFAULT_AGG_BUBBLE_MIN_VOLUME_BTC,
    aggregateBubbleMinTradeCount: process.env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT ? Number(process.env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT) : DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT,
    aggregateBubbleMinTradeCountVolume: process.env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC ? Number(process.env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC) : DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC,
    reconnectMinMs: DEFAULT_RECONNECT_MIN_MS,
    reconnectMaxMs: DEFAULT_RECONNECT_MAX_MS,
    heartbeatMs: DEFAULT_HEARTBEAT_MS,
    exitAfterMs: 0,
    tickSize,
    profileBaseBucketSize: Math.max(MIN_PROFILE_BASE_BUCKET_SIZE, tickSize),
    enableWrites: true,
    dryRun: false,
    aggregateBubbleWritesEnabled: true,
    logLevel: 'info',
    logFormat: 'pretty',
  }
}

function assertRuntimeSupport() {
  if (!config.timescaleUrl) {
    throw new Error('TIMESCALEDB_URL or PG_URL is required for the BTCUSDT collector')
  }

  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is unavailable. Run this collector with Node.js 22+ or a Node runtime that provides WebSocket.')
  }
}

async function initTimescale() {
  pgPool = new Pool({
    connectionString: config.timescaleUrl,
    max: 10,
    idleTimeoutMillis: 30000,
  })

  // Verify connection
  const client = await pgPool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }

  logger.info('timescaledb connected')
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
      sourceState[source].connected = true
      
      const gapStart = sourceState[source].lastTradeTimeMs
      if (gapStart) {
        const gapEnd = Date.now()
        sourceState[source].isBackfilling = true
        runBackfill(source, gapStart, gapEnd).catch(error => {
          logger.error('backfill fatal error', { source, error: getErrorMessage(error) })
        }).finally(() => {
          sourceState[source].isBackfilling = false
        })
      } else {
        sourceState[source].isBackfilling = false
      }

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
      sourceState[source].lastTradeTimeMs = Date.now()
      handleStreamMessage(source, String(event.data)).catch((error) => {
        logger.error('stream message handling failed', { source, error: getErrorMessage(error) })
      })
    }

    ws.onerror = (event) => {
      logger.error('stream error', { source, error: describeWebSocketEvent(event) })
    }

    ws.onclose = (event) => {
      clearTimers()
      sourceState[source].connected = false
      if (shuttingDown) return
      logger.warn('stream closed', { source, code: event.code, reason: event.reason })
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

  const values = []
  const placeholders = []
  let paramIndex = 1

  for (const doc of documents) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
    
    values.push(
      doc.time,
      doc.meta.symbol,
      doc.meta.contractType,
      doc.meta.dataSourceMode,
      doc.meta.timeframe,
      doc.meta.bucketSize,
      doc.candleTimeSec,
      Number(doc.bucketPrice),
      Number(doc.bidVol),
      Number(doc.askVol),
      Number(doc.totalVol),
      Number(doc.delta)
    )
  }

  const sql = `
    INSERT INTO footprint_cells (
      time, symbol, contract_type, data_source_mode, timeframe, bucket_size, 
      candle_time_sec, bucket_price, bid_vol, ask_vol, total_vol, delta
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, data_source_mode, timeframe, bucket_size, time, bucket_price) DO NOTHING
  `

  const result = await pgPool.query(sql, values)
  const inserted = result.rowCount ?? 0
  return { inserted, skipped: documents.length - inserted }
}

async function insertMissingProfileDocuments(documents) {
  if (documents.length === 0) return { inserted: 0, skipped: 0 }

  const values = []
  const placeholders = []
  let paramIndex = 1

  for (const doc of documents) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
    
    values.push(
      doc.time,
      doc.meta.symbol,
      doc.meta.contractType,
      doc.meta.dataSourceMode,
      doc.meta.timeframe,
      doc.candleTimeSec,
      Number(doc.baseBucketSize),
      Number(doc.bucketPrice),
      Number(doc.bidVol),
      Number(doc.askVol),
      Number(doc.totalVol),
      doc.tradeCount
    )
  }

  const sql = `
    INSERT INTO profile_rows (
      time, symbol, contract_type, data_source_mode, timeframe, 
      candle_time_sec, base_bucket_size, bucket_price, bid_vol, ask_vol, total_vol, trade_count
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, data_source_mode, timeframe, base_bucket_size, time, bucket_price) DO NOTHING
  `

  const result = await pgPool.query(sql, values)
  const inserted = result.rowCount ?? 0
  return { inserted, skipped: documents.length - inserted }
}

async function insertAggregateBubbleDocuments(documents) {
  if (documents.length === 0) return { inserted: 0, duplicatesSkipped: 0 }

  const values = []
  const placeholders = []
  let paramIndex = 1

  for (const doc of documents) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
    
    values.push(
      doc.eventTime,
      doc.symbol,
      doc.contractType,
      doc.aggregateTradeId,
      doc.eventTimeMs,
      Number(doc.price),
      doc.side,
      Number(doc.volume),
      doc.tradeCount,
      doc.firstTradeId,
      doc.lastTradeId,
      doc.qualifiedBy,
      Number(doc.minVolumeAtIngest),
      doc.minTradeCountAtIngest
    )
  }

  const sql = `
    INSERT INTO aggregate_bubble_events (
      event_time, symbol, contract_type, aggregate_trade_id, event_time_ms, price, side, 
      volume, trade_count, first_trade_id, last_trade_id, qualified_by, min_volume_at_ingest, min_trade_count_at_ingest
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, aggregate_trade_id, event_time) DO NOTHING
  `

  const result = await pgPool.query(sql, values)
  const inserted = result.rowCount ?? 0
  return { inserted, duplicatesSkipped: documents.length - inserted }
}

async function updateCollectorMeta(values) {
  const updates = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(async ([key, value]) => {
      await pgPool.query(
        `INSERT INTO collector_meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      )
    })

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
  for (const source of runtime.activeSources) {
    if (!sourceState[source].connected || sourceState[source].isBackfilling) {
      return null
    }
  }

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
      const stats = await pgPool.query('SELECT pg_database_size(current_database()) as size')
      const dataSizeMB = (parseInt(stats.rows[0].size || '0', 10) / 1024 / 1024).toFixed(2)
      logger.info('database size report', {
        dataSizeMB,
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
  if (pgPool) {
    await pgPool.end()
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



function isValidTrade(trade) {
  return SOURCES.includes(trade.source)
    && Number.isFinite(trade.time)
    && Number.isFinite(trade.price)
    && Number.isFinite(trade.quantity)
    && trade.quantity > 0
}

// function getNumberEnv(name, fallback) {
//   const value = Number(process.env[name])
//   return Number.isFinite(value) && value > 0 ? value : fallback
// }

// function getIntegerEnv(name, fallback) {
//   return Math.floor(getNumberEnv(name, fallback))
// }

async function runBackfill(source, startTime, endTime) {
  if (endTime - startTime < 1000) return // Ignore gaps under 1s
  
  logger.info('starting auto-backfill for gap', { source, gapMs: endTime - startTime })
  
  const isSpot = source === 'spot'
  const baseUrl = isSpot ? 'https://api.binance.com/api/v3' : 'https://fapi.binance.com/fapi/v1'
  let currentStartTime = startTime
  let totalFetched = 0

  while (currentStartTime < endTime) {
    if (shuttingDown) break
    const url = `${baseUrl}/aggTrades?symbol=${SYMBOL}&startTime=${currentStartTime}&endTime=${endTime}&limit=1000`
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        logger.error('backfill request failed', { source, status: response.status, statusText: response.statusText })
        break
      }
      
      const trades = await response.json()
      if (trades.length === 0) break

      for (const data of trades) {
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

        if (isValidTrade(trade)) {
          queueAggregateBubbleCandidate(trade)
          for (const runtime of runtimes) {
            if (!runtime.activeSources.includes(source)) continue
            ingestTrade(runtime, trade)
          }
        }
      }
      
      totalFetched += trades.length
      
      const lastTradeTime = trades[trades.length - 1].T
      if (trades.length < 1000) break
      
      currentStartTime = lastTradeTime + 1
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      logger.error('backfill network error', { source, error: getErrorMessage(error) })
      break
    }
  }
  
  logger.info('auto-backfill completed', { source, totalFetched })
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
  setPgPool: (p) => { pgPool = p },
  setShuttingDown: (val) => { shuttingDown = val },
  setPersistPromise: (val) => { persistPromise = val },
  getRuntimes: () => runtimes,
  setRuntimes: (val) => { runtimes.length = 0; runtimes.push(...val) }
}

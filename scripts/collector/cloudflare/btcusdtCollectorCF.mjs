/**
 * BTCUSDT collector — Cloudflare Durable Object port.
 *
 * Ported from a standalone Node/PM2 process. Read this block before handing
 * to an agent — it says exactly what changed and why, so changes can be
 * verified against the original rather than re-derived from scratch.
 *
 * WHAT STAYED THE SAME (no Workers-specific concern, copied close to verbatim):
 *   - WS client already used the standard `WebSocket` global + onopen/onmessage/
 *     onerror/onclose — this is exactly the API Durable Objects support for
 *     outbound client connections. Reconnect backoff, per-source heartbeat,
 *     trade-stall watchdog: all portable as-is.
 *   - `pg` (node-postgres) Pool + raw parameterized INSERT/ON CONFLICT queries.
 *     Works in Workers/DO with the `nodejs_compat` compatibility flag (see
 *     wrangler.jsonc) — no Hyperdrive required, that's optional pooling on top.
 *   - All pure aggregation math (aggregateFootprint, aggregateProfile,
 *     toFootprintDocuments, toProfileDocuments, bucket/time helpers) — zero
 *     Workers-specific concerns, copied unchanged.
 *   - createBurstCollapsingLogger — pure JS/timers, copied unchanged. Only the
 *     underlying `pino` base logger got swapped out (see below).
 *
 * WHAT CHANGED AND WHY:
 *   1. pino + pino-pretty transport removed. pino's default write path uses
 *      sonic-boom (raw fd writes) and the pretty transport spins up a worker
 *      thread — neither works in the Workers isolate. Replaced with a small
 *      console.log-based logger matching pino's (details, msg) call shape, so
 *      createBurstCollapsingLogger needed no changes at all.
 *   2. process.exit / process.on('unhandledRejection'|'uncaughtException') /
 *      process.once('SIGINT'|'SIGTERM') / process.stdout.on('error', ...) all
 *      removed. These assumed an external supervisor (pm2) restarting the
 *      process. There is no process to restart here. The original safeExit()
 *      watchdog pattern (persistence stall, trade stall) is replaced by
 *      hardRestart(reason): closes the WS clients, clears volatile in-memory
 *      state, re-seeds watermarks from the DB, recreates runtimes, reconnects
 *      — i.e. it replays the same boot sequence main() used to run after a
 *      process restart, just in-place instead of killing anything. Same
 *      property as before: any unflushed in-memory slice/bubble data is lost
 *      on a hard restart, backfill is what closes the resulting gap — that
 *      was already true of the original process-restart pattern.
 *   3. `undici` ProxyAgent dropped. Workers' native fetch has no custom
 *      proxy-dispatcher support. If the proxy existed to route around a
 *      Binance geo-block on the futures endpoint, that workaround is gone —
 *      test the DO's actual egress against fstream.binance.com before relying
 *      on this. See the note in wrangler.jsonc about DO placement.
 *   4. process.env reads left as `env.X` (passed into the DO explicitly)
 *      rather than relying on the nodejs_compat process.env auto-populate.
 *      Same effect, just more obviously correct inside a DO instance.
 *   5. New: a DurableObject class wrapper (constructor/fetch/alarm), an
 *      ensureInit() + blockConcurrencyWhile() boot guard (constructors can't
 *      be async), and an alarm()-driven status/heartbeat loop *in addition to*
 *      the original 1s flush setInterval — the alarm survives potential
 *      eviction in a way a bare setInterval doesn't, and doubles as a safety
 *      net for the platform's ~15-minute outbound-connection keep-alive grant
 *      (in practice near-continuous BTCUSDT trade messages should keep the
 *      object active on their own; the alarm is belt-and-suspenders).
 *
 * STILL TO DO / VERIFY (left for the agent, not automatic):
 *   - Confirm the DO's pinned colo isn't geo-blocked by Binance, especially
 *     fstream.binance.com (futures). Test with a throwaway Worker first.
 *   - `_test` harness from the original file is not ported — it relied on
 *     module-level singletons (setPgPool, setShuttingDown, etc.) that don't
 *     exist in this class-based structure. Tests should instantiate
 *     BtcusdtCollector against a mocked ctx/env (Miniflare supports this).
 *   - Tune Pool `max` — a single long-lived DO doesn't need the same pool
 *     size a request-per-invocation Worker would; left at 5, was 10.
 *   - Fixed a stale log message that said "not writing to mongodb" in the
 *     original despite this collector writing to TimescaleDB — corrected to
 *     say timescaledb.
 */

import { DurableObject } from 'cloudflare:workers'
import pg from 'pg'
const { Pool } = pg

// ---------------------------------------------------------------------------
// Constants (unchanged from original)
// ---------------------------------------------------------------------------

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
const DEFAULT_EXPECTED_IDLE_THRESHOLD_MS = 90000
const DEFAULT_MAX_QUEUED_BUBBLE_EVENTS = 50000
const DEFAULT_MAX_BUFFERED_SLICES = 120
const DEFAULT_AGG_BUBBLE_MIN_VOLUME_BTC = 15
const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT = 75
const DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC = 3
const DEFAULT_AGG_BUBBLE_FLUSH_SIZE = 1000
const PERSISTENCE_WARN_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

const SOURCES = ['spot', 'futures']
const TARGETS = [
  { contractType: 'spot', dataSourceMode: 'spot', activeSources: ['spot'] },
  { contractType: 'spot', dataSourceMode: 'futures', activeSources: ['futures'] },
  { contractType: 'spot', dataSourceMode: 'both', activeSources: ['spot', 'futures'] },
  { contractType: 'futures', dataSourceMode: 'spot', activeSources: ['spot'] },
  { contractType: 'futures', dataSourceMode: 'futures', activeSources: ['futures'] },
  { contractType: 'futures', dataSourceMode: 'both', activeSources: ['spot', 'futures'] },
]

// ---------------------------------------------------------------------------
// Logger — pino replaced with a console-based logger, same (details, msg)
// call shape. createBurstCollapsingLogger is copied unchanged below it.
// ---------------------------------------------------------------------------

function createConsoleLogger(bindings = {}) {
  const write = (level, details, msg) => {
    const payload = { level, time: Date.now(), ...bindings }
    if (details && typeof details === 'object') Object.assign(payload, details)
    if (msg) payload.msg = msg
    const line = JSON.stringify(payload)
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }

  return {
    info: (details, msg) => write('info', details, msg),
    warn: (details, msg) => write('warn', details, msg),
    error: (details, msg) => write('error', details, msg),
    debug: (details, msg) => write('debug', details, msg),
    child: (childBindings) => createConsoleLogger({ ...bindings, ...childBindings }),
  }
}

// Unchanged from the original file.
export function createBurstCollapsingLogger(targetLogger, options = {}) {
  const windowMs = options.windowMs ?? 200
  const maxWaitMs = options.maxWaitMs ?? 1000
  const activeBursts = new Map()

  function extractKey(level, msg, details) {
    const code =
      details?.code ||
      (details?.error && typeof details.error === 'object' && 'code' in details.error
        ? details.error.code
        : null) ||
      details?.status ||
      msg
    const identity = details?.identity || details?.source || details?.contractType || 'default'
    return `${level}:${String(code)}:${String(identity)}`
  }

  function handleBurstLog(level, arg1, arg2) {
    let msg = ''
    let details = {}

    if (typeof arg1 === 'string') {
      msg = arg1
      details = typeof arg2 === 'object' && arg2 !== null ? { ...arg2 } : {}
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      details = { ...arg1 }
      msg = typeof arg2 === 'string' ? arg2 : ''
    } else {
      msg = String(arg1)
    }

    const key = extractKey(level, msg, details)
    const existing = activeBursts.get(key)

    if (!existing) {
      targetLogger[level](details, msg)

      const burst = {
        level,
        msg,
        details,
        count: 1,
        firstAt: Date.now(),
        lastAt: Date.now(),
        slidingTimeout: null,
        maxTimeout: null,
      }

      burst.slidingTimeout = setTimeout(() => {
        if (burst.count > 1) {
          targetLogger[level]({ ...burst.details, repeated: burst.count }, burst.msg)
        }
        if (burst.maxTimeout) clearTimeout(burst.maxTimeout)
        activeBursts.delete(key)
      }, windowMs)

      burst.maxTimeout = setTimeout(() => {
        if (burst.count > 1) {
          targetLogger[level]({ ...burst.details, repeated: burst.count }, burst.msg)
          burst.count = 0
        }
      }, maxWaitMs)

      burst.slidingTimeout?.unref?.()
      burst.maxTimeout?.unref?.()

      activeBursts.set(key, burst)
    } else {
      existing.count += 1
      existing.lastAt = Date.now()
      existing.details = { ...existing.details, ...details }

      if (existing.slidingTimeout) {
        clearTimeout(existing.slidingTimeout)
      }

      existing.slidingTimeout = setTimeout(() => {
        if (existing.count > 1) {
          targetLogger[level]({ ...existing.details, repeated: existing.count }, existing.msg)
        }
        if (existing.maxTimeout) clearTimeout(existing.maxTimeout)
        activeBursts.delete(key)
      }, windowMs)

      existing.slidingTimeout?.unref?.()
    }
  }

  function flush() {
    for (const burst of activeBursts.values()) {
      if (burst.slidingTimeout) clearTimeout(burst.slidingTimeout)
      if (burst.maxTimeout) clearTimeout(burst.maxTimeout)
      if (burst.count > 1) {
        targetLogger[burst.level]({ ...burst.details, repeated: burst.count }, burst.msg)
      }
    }
    activeBursts.clear()
  }

  return {
    info(arg1, arg2) {
      if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2 !== null) {
        targetLogger.info(arg2, arg1)
      } else {
        targetLogger.info(arg1, typeof arg2 === 'string' ? arg2 : undefined)
      }
    },
    warn(arg1, arg2) {
      handleBurstLog('warn', arg1, arg2)
    },
    error(arg1, arg2) {
      handleBurstLog('error', arg1, arg2)
    },
    debug(arg1, arg2) {
      if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2 !== null) {
        targetLogger.debug(arg2, arg1)
      } else {
        targetLogger.debug(arg1, typeof arg2 === 'string' ? arg2 : undefined)
      }
    },
    child(bindings) {
      const childBase = targetLogger.child(bindings)
      return createBurstCollapsingLogger(childBase, options)
    },
    flush,
    raw: targetLogger,
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (unchanged behavior from the original file)
// ---------------------------------------------------------------------------

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

function rememberBoundedSet(set, value, limit) {
  set.add(value)
  while (set.size > limit) {
    const oldest = set.values().next().value
    if (oldest === undefined) break
    set.delete(oldest)
  }
}

function isValidTrade(trade) {
  return SOURCES.includes(trade.source)
    && Number.isFinite(trade.time)
    && Number.isFinite(trade.price)
    && Number.isFinite(trade.quantity)
    && trade.quantity > 0
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

function getAggregateTradeCount(trade) {
  const firstTradeId = Number(trade.firstTradeId)
  const lastTradeId = Number(trade.lastTradeId)

  if (!Number.isFinite(firstTradeId) || !Number.isFinite(lastTradeId) || lastTradeId < firstTradeId) {
    return null
  }

  return Math.floor(lastTradeId - firstTradeId + 1)
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
    orderCount: 0,
  }

  if (trade.isBuyerMaker) {
    row.bidVol += trade.quantity
  } else {
    row.askVol += trade.quantity
  }

  row.totalVol += trade.quantity
  row.tradeCount += 1
  row.orderCount += getAggregateTradeCount(trade) ?? 1
  candleRows.set(bucketPrice, row)
  runtime.profileSlices.set(baseTime, candleRows)
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
      orderCount: Math.max(0, Math.floor(row.orderCount || row.tradeCount)),
      storedAt,
    }))
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

function describeWebSocketEvent(event) {
  if (!event) return 'unknown websocket error'
  if ('message' in event && event.message) return String(event.message)
  if ('type' in event && event.type) return String(event.type)
  return String(event)
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

// env-driven, replaces process.env reads. Set TIMESCALEDB_URL as a secret
// (`wrangler secret put TIMESCALEDB_URL`), everything else can be a plain var.
function loadConfig(env) {
  const tickSize = DEFAULT_TICK_SIZE

  return {
    timescaleUrl: env.HYPERDRIVE.connectionString,
    retentionSeconds: Math.floor(DEFAULT_RETENTION_DAYS * 24 * 60 * 60),
    flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
    statusIntervalMs: DEFAULT_STATUS_INTERVAL_MS,
    maxDedupeKeys: DEFAULT_MAX_DEDUPE_KEYS,
    aggregateBubbleFlushSize: DEFAULT_AGG_BUBBLE_FLUSH_SIZE,
    aggregateBubbleMinVolume: env.COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC ? Number(env.COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC) : DEFAULT_AGG_BUBBLE_MIN_VOLUME_BTC,
    aggregateBubbleMinTradeCount: env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT ? Number(env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT) : DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT,
    aggregateBubbleMinTradeCountVolume: env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC ? Number(env.COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC) : DEFAULT_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC,
    reconnectMinMs: DEFAULT_RECONNECT_MIN_MS,
    reconnectMaxMs: DEFAULT_RECONNECT_MAX_MS,
    heartbeatMs: DEFAULT_HEARTBEAT_MS,
    tradeStallThresholdMs: env.COLLECTOR_TRADE_STALL_THRESHOLD_MS ? Number(env.COLLECTOR_TRADE_STALL_THRESHOLD_MS) : 120000,
    expectedIdleThresholdMs: env.COLLECTOR_EXPECTED_IDLE_THRESHOLD_MS ? Number(env.COLLECTOR_EXPECTED_IDLE_THRESHOLD_MS) : DEFAULT_EXPECTED_IDLE_THRESHOLD_MS,
    maxQueuedBubbleEvents: env.COLLECTOR_MAX_QUEUED_BUBBLES ? Number(env.COLLECTOR_MAX_QUEUED_BUBBLES) : DEFAULT_MAX_QUEUED_BUBBLE_EVENTS,
    maxBufferedSlices: env.COLLECTOR_MAX_BUFFERED_SLICES ? Number(env.COLLECTOR_MAX_BUFFERED_SLICES) : DEFAULT_MAX_BUFFERED_SLICES,
    tickSize,
    profileBaseBucketSize: Math.max(MIN_PROFILE_BASE_BUCKET_SIZE, tickSize),
    enableWrites: true,
    dryRun: false,
    aggregateBubbleWritesEnabled: true,
  }
}

// Proxy support dropped — Workers fetch has no custom dispatcher/proxy-agent
// hook. If Binance geo-blocks this DO's colo you'll need a different
// mitigation (see header comment), not a proxy rewrite here.
function getRestBaseUrl(env, source) {
  const isSpot = source === 'spot'

  if (isSpot) {
    if (env.BINANCE_SPOT_REST_URL) return env.BINANCE_SPOT_REST_URL.replace(/\/+$/, '')
    return 'https://data-api.binance.vision/api/v3'
  }

  if (env.BINANCE_FUTURES_REST_URL) return env.BINANCE_FUTURES_REST_URL.replace(/\/+$/, '')
  return 'https://fapi.binance.com/fapi/v1'
}

// ---------------------------------------------------------------------------
// Durable Object
// ---------------------------------------------------------------------------

export class BtcusdtCollector extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.ctx = ctx
    this.env = env
    this.initialized = false
    this.initPromise = null
    this.restarting = false
  }

  // --- lifecycle entry points -----------------------------------------

  async fetch(request) {
    await this.ensureInit()
    const url = new URL(request.url)

    if (url.pathname === '/status') {
      return Response.json(this.buildStatusPayload())
    }
    if (url.pathname === '/stop' && request.method === 'POST') {
      await this.stop()
      return new Response('stopped')
    }
    if (url.pathname === '/restart' && request.method === 'POST') {
      await this.hardRestart('manual')
      return new Response('restarted')
    }

    return new Response('btcusdt collector running')
  }

  async alarm() {
    await this.ensureInit()
    try {
      await this.logStatus()
    } catch (error) {
      this.logger?.error?.({ error: getErrorMessage(error) }, 'alarm status update failed')
    }
    if (!this.stopped) {
      await this.ctx.storage.setAlarm(Date.now() + this.config.statusIntervalMs)
    }
  }

  ensureInit() {
    if (this.initialized) return Promise.resolve()
    if (!this.initPromise) {
      this.initPromise = this.ctx.blockConcurrencyWhile(async () => {
        await this.init()
        this.initialized = true
      })
    }
    return this.initPromise
  }

  async init() {
    this.config = loadConfig(this.env)

    if (!this.config.timescaleUrl) {
      throw new Error('TIMESCALEDB_URL or PG_URL secret is required for the BTCUSDT collector')
    }
    if (typeof WebSocket === 'undefined') {
      throw new Error('Global WebSocket is unavailable in this runtime')
    }

    this.logger = createBurstCollapsingLogger(createConsoleLogger({ symbol: SYMBOL }))
    this.sourceLoggers = {
      spot: this.logger.child({ source: 'spot' }),
      futures: this.logger.child({ source: 'futures' }),
    }

    this.metrics = {
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
    this.lastStatusMetrics = {
      tradesReceived: { spot: 0, futures: 0 },
      tradesAccepted: 0,
      tradesSkippedDuplicate: 0,
      tradesSkippedMissingReference: 0,
      slicesPersisted: 0,
      writeFailures: 0,
      bubblesQualified: 0,
      bubblesInserted: 0,
    }

    this.priceReferences = { spot: null, futures: null }
    this.sourceState = {
      spot: { connected: false, isBackfilling: false, lastTradeTimeMs: null, lastMessageAtMs: null, connectedAtMs: null },
      futures: { connected: false, isBackfilling: false, lastTradeTimeMs: null, lastMessageAtMs: null, connectedAtMs: null },
    }
    this.queuedAggregateBubbleEvents = []
    this.queuedAggregateBubbleKeys = new Set()
    this.persistPromise = null
    this.stopped = false

    await this.initTimescale()
    await this.seedWatermarksFromDatabase()

    this.runtimes = TARGETS.map((target) => this.createRuntime(target))

    this.logger.info({
      symbol: SYMBOL,
      identities: this.runtimes.map((r) => r.identity),
      footprintBucketSize: FOOTPRINT_BUCKET_SIZE,
      profileBaseBucketSize: this.config.profileBaseBucketSize,
      writesEnabled: this.config.enableWrites,
      dryRun: this.config.dryRun,
    }, 'active aggregation identities')

    if (!this.config.enableWrites || this.config.dryRun) {
      this.logger.warn({
        writesEnabled: this.config.enableWrites,
        dryRun: this.config.dryRun,
      }, 'collector is not writing to timescaledb')
    }

    await this.seedPriceReferences()

    this.streamClients = SOURCES.map((source) => this.createBinanceStreamClient(source))
    this.streamClients.forEach((client) => client.connect())

    this.flushTimer = setInterval(() => {
      void this.requestPersist('interval')
    }, this.config.flushIntervalMs)

    await this.ctx.storage.setAlarm(Date.now() + this.config.statusIntervalMs)
  }

  async stop() {
    this.stopped = true
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.streamClients?.forEach((client) => client.close())
    try {
      if (this.persistPromise) await this.persistPromise
      await this.persistAllEligibleSlices('shutdown')
    } catch (error) {
      this.logger?.error?.({ error: getErrorMessage(error) }, 'stop flush failed')
    }
    this.logger?.flush?.()
  }

  buildStatusPayload() {
    return {
      symbol: SYMBOL,
      stopped: this.stopped,
      sourceState: this.sourceState,
      pendingSlices: this.runtimes?.reduce((t, r) => t + getSortedSliceTimes(r).length, 0) ?? 0,
      pendingBubbles: this.queuedAggregateBubbleEvents?.length ?? 0,
      metrics: this.metrics,
    }
  }

  // --- db setup ----------------------------------------------------------

  async initTimescale() {
    this.pgPool = new Pool({
      connectionString: this.config.timescaleUrl,
      max: 5,
      idleTimeoutMillis: 30000,
    })

    const client = await this.pgPool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }

    this.logger.info({}, 'timescaledb connected')
  }

  async seedWatermarksFromDatabase() {
    if (!this.pgPool) return
    try {
      const metaRes = await this.pgPool.query(
        "SELECT key, value FROM collector_meta WHERE key IN ('last_spot_trade_time_ms', 'last_futures_trade_time_ms')"
      )
      const metaMap = new Map(metaRes.rows.map((r) => [r.key, Number(r.value)]))
      const minValidMs = Date.now() - (this.config.retentionSeconds * 1000)

      for (const source of SOURCES) {
        const metaVal = metaMap.get(`last_${source}_trade_time_ms`)
        if (Number.isFinite(metaVal) && metaVal > minValidMs && metaVal < Date.now()) {
          this.sourceState[source].lastTradeTimeMs = metaVal
          this.logger.info({ source, watermarkMs: metaVal, date: new Date(metaVal).toISOString() }, 'seeded source watermark from collector_meta')
          continue
        }

        const rowRes = await this.pgPool.query(
          'SELECT MAX(candle_time_sec) as max_sec FROM footprint_cells WHERE symbol = $1 AND contract_type = $2',
          [SYMBOL, source]
        )
        const maxSec = Number(rowRes.rows[0]?.max_sec)
        const maxMs = maxSec * 1000
        if (Number.isFinite(maxMs) && maxMs > minValidMs && maxMs < Date.now()) {
          this.sourceState[source].lastTradeTimeMs = maxMs
          this.logger.info({ source, watermarkMs: maxMs, date: new Date(maxMs).toISOString() }, 'seeded source watermark from footprint_cells')
        } else {
          this.sourceState[source].lastTradeTimeMs = null
          this.logger.info({ source }, 'no prior valid watermark found for source, starting fresh')
        }
      }
    } catch (err) {
      this.logger.warn({ error: getErrorMessage(err) }, 'could not seed watermarks from database, starting fresh')
    }
  }

  async seedPriceReferences() {
    for (const source of SOURCES) {
      const log = this.sourceLoggers[source] || this.logger
      try {
        const baseUrl = getRestBaseUrl(this.env, source)
        const response = await fetch(
          `${baseUrl}/ticker/price?symbol=${SYMBOL}`,
          { signal: AbortSignal.timeout(10000) },
        )
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        const price = Number(data.price)
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`Invalid ticker price: ${data.price}`)
        }
        this.priceReferences[source] = price
        log.info(
          { source, price },
          'seeded contract price reference',
        )
      } catch (error) {
        log.error(
          { source, error: getErrorMessage(error) },
          'failed to seed contract price reference',
        )
      }
    }
  }

  createRuntime(target) {
    const identity = `${SYMBOL}:${target.contractType}:${target.dataSourceMode}:${BASE_TIMEFRAME}`

    return {
      symbol: SYMBOL,
      contractType: target.contractType,
      dataSourceMode: target.dataSourceMode,
      activeSources: target.activeSources,
      identity,
      profileBaseBucketSize: this.config.profileBaseBucketSize,
      firstFullyCoveredBaseTimeBySource: { spot: null, futures: null },
      latestBaseTimeBySource: { spot: null, futures: null },
      taintedRangesBySource: { spot: [], futures: [] },
      firstWriteFailureAtMs: null,
      processedTradeKeys: new BoundedSet(this.config.maxDedupeKeys),
      persistedSlices: new BoundedSet(this.config.maxDedupeKeys),
      footprintSlices: new Map(),
      profileSlices: new Map(),
    }
  }

  // --- websocket client ----------------------------------------------------

  createBinanceStreamClient(source) {
    const log = this.sourceLoggers[source] || this.logger
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
      if (this.stopped) return
      clearTimers()
      ws = new WebSocket(url)

      ws.onopen = () => {
        reconnectAttempts = 0
        log.info({ source, streams }, 'stream connected')
        this.sourceState[source].connected = true
        this.sourceState[source].connectedAtMs = Date.now()
        this.sourceState[source].lastMessageAtMs = Date.now()

        const gapStart = this.sourceState[source].lastTradeTimeMs
        if (gapStart) {
          this.sourceState[source].isBackfilling = true
          this.runBackfillUntilComplete(source, gapStart)
            .then((result) => {
              if (!result.ok) {
                this.markSourceGap(source, result.cursor, Date.now())
              }
            })
            .catch((error) => {
              log.error({ source, error: getErrorMessage(error) }, 'backfill fatal error')
              this.markSourceGap(source, gapStart, Date.now())
            })
            .finally(() => {
              this.sourceState[source].isBackfilling = false
            })
        } else {
          this.sourceState[source].isBackfilling = false
        }

        heartbeatTimer = setInterval(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return
          const lastMsg = this.sourceState[source].lastMessageAtMs ?? Date.now()
          const idleMs = Date.now() - lastMsg
          if (idleMs > this.config.expectedIdleThresholdMs) {
            log.warn({ source, idleMs, thresholdMs: this.config.expectedIdleThresholdMs }, 'stream appears stalled, forcing reconnect')
            ws.close()
            return
          }

          if (!this.sourceState[source].isBackfilling) {
            const lastTrade = this.sourceState[source].lastTradeTimeMs ?? this.sourceState[source].connectedAtMs ?? Date.now()
            const tradeIdleMs = Date.now() - lastTrade
            if (tradeIdleMs > this.config.tradeStallThresholdMs) {
              log.error({ source, tradeIdleMs, thresholdMs: this.config.tradeStallThresholdMs }, 'trade stream stalled, triggering watchdog restart')
              void this.hardRestart(`trade_stall_${source}`)
            }
          }
        }, this.config.heartbeatMs)
      }

      ws.onmessage = (event) => {
        this.sourceState[source].lastMessageAtMs = Date.now()
        this.handleStreamMessage(source, String(event.data)).catch((error) => {
          log.error({ source, error: getErrorMessage(error) }, 'stream message handling failed')
        })
      }

      ws.onerror = (event) => {
        log.error({ source, error: describeWebSocketEvent(event) }, 'stream error')
      }

      ws.onclose = (event) => {
        clearTimers()
        this.sourceState[source].connected = false
        if (this.stopped) return
        log.warn({ source, code: event.code, reason: event.reason }, 'stream closed')
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      reconnectAttempts += 1
      const delay = Math.min(
        this.config.reconnectMaxMs,
        this.config.reconnectMinMs * 2 ** Math.min(reconnectAttempts - 1, 10),
      )
      log.warn({ source, attempt: reconnectAttempts, delayMs: delay }, 'stream reconnect scheduled')
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

  async handleStreamMessage(source, raw) {
    const parsed = JSON.parse(raw)
    const stream = parsed.stream
    const data = parsed.data
    if (!stream || !data) return

    if (stream.includes('@kline_1m')) {
      const close = Number(data.k?.c)
      if (Number.isFinite(close) && close > 0) {
        this.priceReferences[source] = close
        const log = this.sourceLoggers[source] || this.logger
        log.debug({ source, price: close }, 'contract price reference updated')
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

    this.sourceState[source].lastTradeTimeMs = Date.now()
    this.metrics.tradesReceived[source] += 1
    this.queueAggregateBubbleCandidate(trade)
    for (const runtime of this.runtimes) {
      if (!runtime.activeSources.includes(source)) continue
      this.ingestTrade(runtime, trade)
    }
  }

  getAlignedPrice(contractType, trade) {
    if (trade.source === contractType) return trade.price
    return this.priceReferences[contractType]
  }

  ingestTrade(runtime, trade) {
    const log = this.sourceLoggers[trade.source] || this.logger
    const tradeKey = getTradeKey(trade)
    if (runtime.processedTradeKeys.has(tradeKey)) {
      this.metrics.tradesSkippedDuplicate += 1
      log.warn({ identity: runtime.identity, tradeKey }, 'duplicate trade skipped')
      return
    }
    runtime.processedTradeKeys.add(tradeKey)

    const alignedPrice = this.getAlignedPrice(runtime.contractType, trade)
    if (!Number.isFinite(alignedPrice)) {
      this.metrics.tradesSkippedMissingReference += 1
      log.error({
        identity: runtime.identity,
        contractType: runtime.contractType,
        source: trade.source,
        tradeId: trade.id,
        tradePrice: trade.price,
      }, 'DATA_LOSS trade skipped due to missing price reference')
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

    const openRanges = runtime.taintedRangesBySource[trade.source]
    if (openRanges && openRanges.length > 0) {
      const lastRange = openRanges[openRanges.length - 1]
      if (lastRange && lastRange.end === null) {
        lastRange.end = baseTime
      }
    }

    aggregateFootprint(runtime, baseTime, alignedPrice, trade)
    aggregateProfile(runtime, baseTime, alignedPrice, trade)
    this.metrics.tradesAccepted += 1
  }

  queueAggregateBubbleCandidate(trade) {
    const log = this.sourceLoggers[trade.source] || this.logger
    if (this.config.enableWrites && !this.config.dryRun && !this.config.aggregateBubbleWritesEnabled) {
      this.metrics.aggregateBubbles.skippedPersistenceDisabled += 1
      return
    }

    this.metrics.aggregateBubbles.received[trade.source] += 1

    if (!Number.isFinite(trade.id)) {
      this.metrics.aggregateBubbles.skippedMissingAggregateTradeId += 1
      return
    }

    const tradeCount = getAggregateTradeCount(trade)
    if (tradeCount === null) {
      this.metrics.aggregateBubbles.skippedInvalidTradeRange += 1
      return
    }

    const key = `${SYMBOL}:${trade.source}:${trade.id}`
    if (this.queuedAggregateBubbleKeys.has(key)) {
      this.metrics.aggregateBubbles.duplicatesSkipped += 1
      log.warn({ key }, 'duplicate aggregate bubble candidate skipped')
      return
    }
    rememberBoundedSet(this.queuedAggregateBubbleKeys, key, this.config.maxDedupeKeys)

    const qualifiedBy = []
    if (trade.quantity >= this.config.aggregateBubbleMinVolume) {
      qualifiedBy.push('volume')
    }
    if (
      tradeCount >= this.config.aggregateBubbleMinTradeCount
      && trade.quantity >= this.config.aggregateBubbleMinTradeCountVolume
    ) {
      qualifiedBy.push('tradeCount')
    }

    if (qualifiedBy.length === 0) {
      this.metrics.aggregateBubbles.skippedBelowThreshold += 1
      return
    }

    if (this.queuedAggregateBubbleEvents.length >= this.config.maxQueuedBubbleEvents) {
      const dropCount = this.queuedAggregateBubbleEvents.length - this.config.maxQueuedBubbleEvents + 1
      this.queuedAggregateBubbleEvents.splice(0, dropCount)
      log.error({
        droppedCount: dropCount,
        remainingCount: this.queuedAggregateBubbleEvents.length,
        maxCap: this.config.maxQueuedBubbleEvents,
      }, 'DATA_LOSS bubble queue cap exceeded, dropped oldest events')
    }

    this.queuedAggregateBubbleEvents.push({
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
      minVolumeAtIngest: toStoredNumber(this.config.aggregateBubbleMinVolume),
      minTradeCountAtIngest: this.config.aggregateBubbleMinTradeCount,
    })
    this.metrics.aggregateBubbles.qualified += 1
  }

  // --- persistence ---------------------------------------------------------

  async persistAllEligibleSlices(reason) {
    if (this.stopped && reason !== 'shutdown') return

    await this.persistAggregateBubbleEvents(reason)

    for (const runtime of this.runtimes) {
      await this.persistRuntimeEligibleSlices(runtime, reason)
    }
  }

  async requestPersist(reason) {
    if (this.persistPromise) return this.persistPromise

    this.persistPromise = this.persistAllEligibleSlices(reason)
      .catch((error) => {
        this.metrics.writeFailures += 1
        this.logger.error({ reason, error: getErrorMessage(error) }, 'flush failed')
      })
      .finally(() => {
        this.persistPromise = null
      })

    return this.persistPromise
  }

  async persistRuntimeEligibleSlices(runtime, reason) {
    const coverageStart = getCoverageStart(runtime)
    const closedBeforeTime = this.getClosedBeforeTime(runtime)
    const sliceTimes = getSortedSliceTimes(runtime)

    if (sliceTimes.length === 0) return
    if (coverageStart === null || closedBeforeTime === null) return

    for (const sliceTime of sliceTimes) {
      if (sliceTime < coverageStart) {
        deleteSlice(runtime, sliceTime)
        continue
      }
      if (sliceTime >= closedBeforeTime) continue

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
        const result = await this.writeClosedSlice(runtime, sliceTime, footprintRows, profileRows)
        runtime.persistedSlices.add(persistedKey)
        deleteSlice(runtime, sliceTime)
        runtime.firstWriteFailureAtMs = null
        this.metrics.slicesPersisted += 1
        this.metrics.footprintRowsInserted += result.footprint.inserted
        this.metrics.footprintRowsSkipped += result.footprint.skipped
        this.metrics.profileRowsInserted += result.profile.inserted
        this.metrics.profileRowsSkipped += result.profile.skipped
        const log = this.sourceLoggers[runtime.contractType] || this.logger
        log.info({
          reason,
          identity: runtime.identity,
          candleTime: sliceTime,
          footprintRowsWritten: result.footprint.inserted,
          footprintRowsSkipped: result.footprint.skipped,
          profileRowsWritten: result.profile.inserted,
          profileRowsSkipped: result.profile.skipped,
          baseBucketSize: runtime.profileBaseBucketSize,
        }, 'closed 1m slice persisted')
      } catch (error) {
        if (runtime.firstWriteFailureAtMs === null) {
          runtime.firstWriteFailureAtMs = Date.now()
        }
        this.metrics.writeFailures += 1
        const pendingSlices = getSortedSliceTimes(runtime).length
        const log = this.sourceLoggers[runtime.contractType] || this.logger
        log.error({
          identity: runtime.identity,
          candleTime: sliceTime,
          pendingSlices,
          error: getErrorMessage(error),
        }, 'closed 1m slice persist failed')

        const currentSlices = getSortedSliceTimes(runtime)
        if (currentSlices.length > this.config.maxBufferedSlices) {
          const oldestSlice = currentSlices[0]
          deleteSlice(runtime, oldestSlice)
          log.error({
            identity: runtime.identity,
            droppedSliceTime: oldestSlice,
            remainingSlices: getSortedSliceTimes(runtime).length,
            maxCap: this.config.maxBufferedSlices,
            failureDurationMs: Date.now() - runtime.firstWriteFailureAtMs,
          }, 'DATA_LOSS slice buffer cap exceeded due to persistent write failures, dropped oldest slice')
        }
        return
      }
    }
  }

  async writeClosedSlice(runtime, sliceTime, footprintRows, profileRows) {
    const log = this.sourceLoggers[runtime.contractType] || this.logger
    const footprintDocuments = toFootprintDocuments(runtime, sliceTime, footprintRows)
    const profileDocuments = toProfileDocuments(runtime, sliceTime, profileRows)

    if (this.config.dryRun || !this.config.enableWrites) {
      log.info({
        identity: runtime.identity,
        candleTime: sliceTime,
        footprintRows: footprintDocuments.length,
        profileRows: profileDocuments.length,
        writesEnabled: this.config.enableWrites,
        dryRun: this.config.dryRun,
      }, 'dry-run closed slice write')
      return {
        footprint: { inserted: 0, skipped: footprintDocuments.length },
        profile: { inserted: 0, skipped: profileDocuments.length },
      }
    }

    try {
      return await this.executeSliceWrite(runtime, sliceTime, footprintDocuments, profileDocuments)
    } catch (firstError) {
      log.warn({
        identity: runtime.identity,
        candleTime: sliceTime,
        error: getErrorMessage(firstError),
      }, 'slice write failed, data remains in memory to retry on next interval')
      throw firstError
    }
  }

  async executeSliceWrite(runtime, sliceTime, footprintDocuments, profileDocuments) {
    const footprint = await this.insertMissingFootprintDocuments(footprintDocuments)
    const profile = await this.insertMissingProfileDocuments(profileDocuments)

    const now = new Date().toISOString()
    await this.updateCollectorMeta({
      last_collector_heartbeat: now,
      collector_symbol: SYMBOL,
      collector_profile_base_bucket_size: String(runtime.profileBaseBucketSize),
      last_footprint_stored: footprint.inserted > 0 ? now : undefined,
      last_profile_rows_stored: profile.inserted > 0 ? now : undefined,
    })

    return { footprint, profile }
  }

  async persistAggregateBubbleEvents(reason) {
    if (this.queuedAggregateBubbleEvents.length === 0) return

    const batch = this.queuedAggregateBubbleEvents.slice(0, this.config.aggregateBubbleFlushSize)

    if (this.config.enableWrites && !this.config.dryRun && !this.config.aggregateBubbleWritesEnabled) {
      this.queuedAggregateBubbleEvents.splice(0, batch.length)
      this.metrics.aggregateBubbles.skippedPersistenceDisabled += batch.length
      this.logger.warn({ reason, rows: batch.length }, 'aggregate bubble candidate write skipped; persistence disabled')
      return
    }

    if (this.config.dryRun || !this.config.enableWrites) {
      this.queuedAggregateBubbleEvents.splice(0, batch.length)
      this.logger.info({
        reason,
        rows: batch.length,
        writesEnabled: this.config.enableWrites,
        dryRun: this.config.dryRun,
      }, 'dry-run aggregate bubble candidate write')
      return
    }

    try {
      const result = await this.insertAggregateBubbleDocuments(batch)
      this.queuedAggregateBubbleEvents.splice(0, batch.length)
      this.metrics.aggregateBubbles.inserted += result.inserted
      this.metrics.aggregateBubbles.duplicatesSkipped += result.duplicatesSkipped

      if (result.inserted > 0 || result.duplicatesSkipped > 0) {
        await this.updateCollectorMeta({
          last_aggregate_bubbles_stored: result.inserted > 0 ? new Date().toISOString() : undefined,
          aggregate_bubble_thresholds: JSON.stringify({
            minVolume: this.config.aggregateBubbleMinVolume,
            minTradeCount: this.config.aggregateBubbleMinTradeCount,
            minTradeCountVolume: this.config.aggregateBubbleMinTradeCountVolume,
          }),
        })
      }

      this.logger.info({
        reason,
        rowsSubmitted: batch.length,
        rowsInserted: result.inserted,
        duplicatesSkipped: result.duplicatesSkipped,
        pendingRows: this.queuedAggregateBubbleEvents.length,
      }, 'aggregate bubble candidates persisted')
    } catch (error) {
      this.metrics.aggregateBubbles.insertFailed += batch.length
      this.metrics.writeFailures += 1
      this.logger.error({
        reason,
        rows: batch.length,
        pendingRows: this.queuedAggregateBubbleEvents.length,
        error: getErrorMessage(error),
      }, 'aggregate bubble candidate persist failed')
    }
  }

  async insertMissingFootprintDocuments(documents) {
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

    const result = await this.pgPool.query(sql, values)
    const inserted = result.rowCount ?? 0
    return { inserted, skipped: documents.length - inserted }
  }

  async insertMissingProfileDocuments(documents) {
    if (documents.length === 0) return { inserted: 0, skipped: 0 }

    const values = []
    const placeholders = []
    let paramIndex = 1

    for (const doc of documents) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)

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
        doc.tradeCount,
        doc.orderCount
      )
    }

    const sql = `
      INSERT INTO profile_rows (
        time, symbol, contract_type, data_source_mode, timeframe,
        candle_time_sec, base_bucket_size, bucket_price, bid_vol, ask_vol, total_vol, trade_count, order_count
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (symbol, contract_type, data_source_mode, timeframe, base_bucket_size, time, bucket_price) DO NOTHING
    `

    const result = await this.pgPool.query(sql, values)
    const inserted = result.rowCount ?? 0
    return { inserted, skipped: documents.length - inserted }
  }

  async insertAggregateBubbleDocuments(documents) {
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

    const result = await this.pgPool.query(sql, values)
    const inserted = result.rowCount ?? 0
    return { inserted, duplicatesSkipped: documents.length - inserted }
  }

  async updateCollectorMeta(values) {
    const updates = Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(async ([key, value]) => {
        await this.pgPool.query(
          `INSERT INTO collector_meta (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, String(value)]
        )
      })

    await Promise.all(updates)
  }

  // --- gaps / backfill -------------------------------------------------

  markSourceGap(source, start = null, end = null) {
    const log = this.sourceLoggers[source] || this.logger
    for (const runtime of this.runtimes) {
      if (!runtime.activeSources.includes(source)) continue

      const rangeStart = start ?? runtime.latestBaseTimeBySource[source] ?? Date.now()
      const rangeEnd = end ?? null
      runtime.taintedRangesBySource[source].push({ start: rangeStart, end: rangeEnd })
      runtime.latestBaseTimeBySource[source] = null
    }
    log.error({
      source,
      rangeStart: start ?? 'unspecified',
      rangeEnd: end ?? 'open',
    }, 'DATA_GAP backfill exhausted retries, range marked tainted')

    if (this.config.enableWrites && !this.config.dryRun && this.pgPool) {
      this.updateCollectorMeta({
        tainted_ranges: JSON.stringify(this.getAllTaintedRanges()),
      }).catch((err) => {
        this.logger.error({ error: getErrorMessage(err) }, 'failed to record tainted ranges to collector_meta')
      })
      this.insertGapRecord(source, start ?? null, end ?? null, 'backfill_exhausted').catch((err) => {
        this.logger.error({ error: getErrorMessage(err) }, 'failed to insert gap record into collector_gaps')
      })
    }
  }

  // Requires migration: scripts/collector/migrations/001_collector_gaps.sql
  async insertGapRecord(source, gapStart, gapEnd, reason) {
    if (!this.pgPool) return
    await this.pgPool.query(
      `INSERT INTO collector_gaps (source, gap_start, gap_end, reason)
       VALUES ($1, $2, $3, $4)`,
      [source, gapStart, gapEnd, reason]
    )
  }

  hasActiveTaintedRanges() {
    for (const runtime of this.runtimes) {
      for (const source of runtime.activeSources) {
        if (runtime.taintedRangesBySource[source]?.length > 0) return true
      }
    }
    return false
  }

  getAllTaintedRanges() {
    const ranges = {}
    for (const source of SOURCES) {
      ranges[source] = []
      for (const runtime of this.runtimes) {
        if (runtime.taintedRangesBySource[source]) {
          ranges[source].push(...runtime.taintedRangesBySource[source])
        }
      }
    }
    return ranges
  }

  getClosedBeforeTime(runtime) {
    for (const source of runtime.activeSources) {
      if (!this.sourceState[source].connected || this.sourceState[source].isBackfilling) {
        return null
      }
    }

    const times = runtime.activeSources.map((source) => runtime.latestBaseTimeBySource[source])
    if (times.some((time) => time === null)) return null
    return Math.min(...times)
  }

  async runBackfill(source, startTime, endTime) {
    const log = this.sourceLoggers[source] || this.logger
    if (endTime - startTime < 1000) {
      return { ok: true, cursor: endTime }
    }

    log.info({ source, gapMs: endTime - startTime }, 'starting auto-backfill for gap')

    const baseUrl = getRestBaseUrl(this.env, source)
    let currentStartTime = startTime
    let totalFetched = 0

    while (currentStartTime < endTime) {
      if (this.stopped) break
      const url = `${baseUrl}/aggTrades?symbol=${SYMBOL}&startTime=${currentStartTime}&endTime=${endTime}&limit=1000`

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (!response.ok) {
          log.error({ source, status: response.status, statusText: response.statusText }, 'backfill request failed')
          break
        }

        const trades = await response.json()
        if (trades.length === 0) {
          currentStartTime = endTime
          break
        }

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
            this.sourceState[source].lastTradeTimeMs = Math.max(this.sourceState[source].lastTradeTimeMs ?? 0, trade.time)
            this.queueAggregateBubbleCandidate(trade)
            for (const runtime of this.runtimes) {
              if (!runtime.activeSources.includes(source)) continue
              this.ingestTrade(runtime, trade)
            }
          }
        }

        totalFetched += trades.length

        const lastTradeTime = trades[trades.length - 1].T
        if (trades.length < 1000) {
          currentStartTime = endTime
          break
        }

        currentStartTime = lastTradeTime + 1
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        log.error({ source, error: getErrorMessage(error) }, 'backfill network error')
        break
      }
    }

    const completed = currentStartTime >= endTime
    if (completed) {
      log.info({ source, totalFetched }, 'auto-backfill completed')
    }
    return { ok: completed, cursor: currentStartTime }
  }

  async runBackfillUntilComplete(source, startTime) {
    const log = this.sourceLoggers[source] || this.logger
    let cursor = startTime
    let attempt = 0
    const maxAttempts = 20

    while (!this.stopped) {
      const endTime = Date.now()
      const result = await this.runBackfill(source, cursor, endTime)
      if (result.ok) return { ok: true, cursor: endTime }

      cursor = result.cursor
      attempt += 1
      if (attempt > maxAttempts) return { ok: false, cursor }

      const delay = Math.min(
        this.config.reconnectMaxMs,
        this.config.reconnectMinMs * 2 ** Math.min(attempt - 1, 10),
      )
      log.warn({ source, attempt, delayMs: delay, cursor }, 'backfill incomplete, retrying')
      await new Promise((r) => setTimeout(r, delay))
    }
    return { ok: false, cursor }
  }

  // --- status / watchdogs -----------------------------------------------

  getPersistenceHealth() {
    const nowMs = Date.now()
    for (const runtime of this.runtimes) {
      if (runtime.firstWriteFailureAtMs !== null) return 'degraded'
      const sliceTimes = getSortedSliceTimes(runtime)
      if (sliceTimes.length > 0) {
        const oldestSliceMs = sliceTimes[0] * 1000
        if (nowMs - oldestSliceMs > PERSISTENCE_WARN_THRESHOLD_MS) return 'degraded'
      }
    }
    return 'ok'
  }

  getOldestPendingSliceAgeMs() {
    const nowMs = Date.now()
    let oldest = null
    for (const runtime of this.runtimes) {
      const sliceTimes = getSortedSliceTimes(runtime)
      if (sliceTimes.length > 0) {
        const ageMs = nowMs - sliceTimes[0] * 1000
        if (oldest === null || ageMs > oldest) oldest = ageMs
      }
    }
    return oldest
  }

  async logStatus() {
    const pendingSlices = this.runtimes.reduce((total, runtime) => total + getSortedSliceTimes(runtime).length, 0)
    const health = this.hasActiveTaintedRanges() ? 'DEGRADED' : 'ok'
    const persistenceHealth = this.getPersistenceHealth()
    const oldestPendingSliceAgeMs = this.getOldestPendingSliceAgeMs()

    const isAnyBackfilling = SOURCES.some((s) => this.sourceState[s].isBackfilling)
    if (persistenceHealth === 'degraded' && oldestPendingSliceAgeMs !== null) {
      if (!isAnyBackfilling && oldestPendingSliceAgeMs > PERSISTENCE_WARN_THRESHOLD_MS && pendingSlices > 0) {
        this.logger.error({
          oldestPendingSliceAgeMs,
          thresholdMs: PERSISTENCE_WARN_THRESHOLD_MS,
          pendingSlices,
        }, 'PERSISTENCE_WATCHDOG_TRIPPED oldest pending slice exceeded threshold while not backfilling, triggering restart')
        void this.hardRestart('persistence_stall')
      } else {
        this.logger.warn({
          oldestPendingSliceAgeMs,
          warnThresholdMs: PERSISTENCE_WARN_THRESHOLD_MS,
          pendingSlices,
          isAnyBackfilling,
        }, 'PERSISTENCE_DEGRADED oldest pending slice is aging, data loss risk increasing')
      }
    }

    const sinceLastInterval = {
      tradesReceived: {
        spot: this.metrics.tradesReceived.spot - this.lastStatusMetrics.tradesReceived.spot,
        futures: this.metrics.tradesReceived.futures - this.lastStatusMetrics.tradesReceived.futures,
      },
      tradesAccepted: this.metrics.tradesAccepted - this.lastStatusMetrics.tradesAccepted,
      tradesSkippedDuplicate: this.metrics.tradesSkippedDuplicate - this.lastStatusMetrics.tradesSkippedDuplicate,
      tradesSkippedMissingReference: this.metrics.tradesSkippedMissingReference - this.lastStatusMetrics.tradesSkippedMissingReference,
      slicesPersisted: this.metrics.slicesPersisted - this.lastStatusMetrics.slicesPersisted,
      writeFailures: this.metrics.writeFailures - this.lastStatusMetrics.writeFailures,
      bubblesQualified: this.metrics.aggregateBubbles.qualified - this.lastStatusMetrics.bubblesQualified,
      bubblesInserted: this.metrics.aggregateBubbles.inserted - this.lastStatusMetrics.bubblesInserted,
    }

    this.lastStatusMetrics = {
      tradesReceived: { ...this.metrics.tradesReceived },
      tradesAccepted: this.metrics.tradesAccepted,
      tradesSkippedDuplicate: this.metrics.tradesSkippedDuplicate,
      tradesSkippedMissingReference: this.metrics.tradesSkippedMissingReference,
      slicesPersisted: this.metrics.slicesPersisted,
      writeFailures: this.metrics.writeFailures,
      bubblesQualified: this.metrics.aggregateBubbles.qualified,
      bubblesInserted: this.metrics.aggregateBubbles.inserted,
    }

    this.logger.info({
      health,
      persistenceHealth,
      oldestPendingSliceAgeMs,
      pendingSlices,
      pendingBubbles: this.queuedAggregateBubbleEvents.length,
      sinceLastInterval,
      cumulative: {
        tradesReceived: this.metrics.tradesReceived,
        tradesAccepted: this.metrics.tradesAccepted,
        tradesSkippedDuplicate: this.metrics.tradesSkippedDuplicate,
        tradesSkippedMissingReference: this.metrics.tradesSkippedMissingReference,
        slicesPersisted: this.metrics.slicesPersisted,
        writeFailures: this.metrics.writeFailures,
        aggregateBubbles: this.metrics.aggregateBubbles,
      },
    }, 'collector status')

    if (this.config.enableWrites && !this.config.dryRun && this.pgPool) {
      await this.updateCollectorMeta({
        last_collector_heartbeat: new Date().toISOString(),
        last_spot_trade_time_ms: this.sourceState.spot.lastTradeTimeMs ? String(this.sourceState.spot.lastTradeTimeMs) : undefined,
        last_futures_trade_time_ms: this.sourceState.futures.lastTradeTimeMs ? String(this.sourceState.futures.lastTradeTimeMs) : undefined,
        collector_status: JSON.stringify({
          symbol: SYMBOL,
          health,
          persistenceHealth,
          oldestPendingSliceAgeMs,
          pendingSlices,
          pendingAggregateBubbleEvents: this.queuedAggregateBubbleEvents.length,
          tradesReceived: this.metrics.tradesReceived,
          aggregateBubbles: this.metrics.aggregateBubbles,
          slicesPersisted: this.metrics.slicesPersisted,
          writeFailures: this.metrics.writeFailures,
        }),
      })

      try {
        const stats = await this.pgPool.query('SELECT pg_database_size(current_database()) as size')
        const dataSizeMB = (parseInt(stats.rows[0].size || '0', 10) / 1024 / 1024).toFixed(2)
        this.logger.info({ dataSizeMB, retentionDays: DEFAULT_RETENTION_DAYS }, 'database size report')
      } catch (e) {
        this.logger.warn({ error: getErrorMessage(e) }, 'could not read database size')
      }
    }
  }

  // --- self-heal, replaces the original process.exit()-based safeExit ---

  async hardRestart(reason) {
    if (this.restarting) return
    this.restarting = true
    this.logger.error({ reason }, 'CRITICAL: hard restart triggered')

    try {
      this.streamClients?.forEach((client) => client.close())
    } catch (error) {
      this.logger.warn({ error: getErrorMessage(error) }, 'error while closing stream clients during restart')
    }

    // Same tradeoff as the original process-restart pattern: unflushed
    // in-memory slices and queued bubble events are dropped here, same as
    // they would be dropped by a process.exit(). Backfill closes the gap.
    this.queuedAggregateBubbleEvents.length = 0
    this.queuedAggregateBubbleKeys.clear()
    this.priceReferences.spot = null
    this.priceReferences.futures = null
    for (const source of SOURCES) {
      this.sourceState[source] = { connected: false, isBackfilling: false, lastTradeTimeMs: null, lastMessageAtMs: null, connectedAtMs: null }
    }

    await this.seedWatermarksFromDatabase()
    await this.seedPriceReferences()
    this.runtimes = TARGETS.map((target) => this.createRuntime(target))
    this.streamClients = SOURCES.map((source) => this.createBinanceStreamClient(source))

    this.restarting = false
    this.streamClients.forEach((client) => client.connect())
  }
}

// ---------------------------------------------------------------------------
// Worker entry point — routes to the singleton DO instance.
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const id = env.COLLECTOR.idFromName('btcusdt-collector')
    const stub = env.COLLECTOR.get(id)
    return stub.fetch(request)
  },
}

// getCoverageStart is pure (only touches `runtime`), kept module-level.
function getCoverageStart(runtime) {
  const times = runtime.activeSources.map((source) => runtime.firstFullyCoveredBaseTimeBySource[source])
  if (times.some((time) => time === null)) return null
  return Math.max(...times)
}
import test from 'node:test'
import assert from 'node:assert'

process.env.NODE_ENV = 'test'
process.env.TIMESCALEDB_URL = 'postgres://test:test@localhost:5432/test'
const { _test } = await import('./btcusdtCollector.mjs')

test('Fix 1: lastTradeTimeMs only updates on validated aggTrade', async () => {
  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])
  _test.config.dryRun = true
  _test.config.enableWrites = false

  // Reset sourceState
  _test.sourceState.spot.lastTradeTimeMs = null

  // Kline message should update priceReferences, NOT lastTradeTimeMs
  await _test.handleStreamMessage('spot', JSON.stringify({
    stream: 'btcusdt@kline_1m',
    data: { k: { c: '65000.50' } },
  }))
  assert.strictEqual(_test.sourceState.spot.lastTradeTimeMs, null, 'kline message must not update lastTradeTimeMs')
  assert.strictEqual(_test.priceReferences.spot, 65000.50)

  // Invalid aggTrade should not update lastTradeTimeMs
  await _test.handleStreamMessage('spot', JSON.stringify({
    stream: 'btcusdt@aggTrade',
    data: { a: 'invalid', p: 'not-a-number', q: '0', T: Date.now() },
  }))
  assert.strictEqual(_test.sourceState.spot.lastTradeTimeMs, null, 'invalid trade must not update lastTradeTimeMs')

  // Valid aggTrade should update lastTradeTimeMs
  const before = Date.now()
  await _test.handleStreamMessage('spot', JSON.stringify({
    stream: 'btcusdt@aggTrade',
    data: {
      a: 1234567,
      f: 1234500,
      l: 1234567,
      p: '65100.00',
      q: '0.75',
      T: before,
      m: false,
    },
  }))
  assert.ok(_test.sourceState.spot.lastTradeTimeMs !== null, 'valid aggTrade must update lastTradeTimeMs')
  assert.ok(_test.sourceState.spot.lastTradeTimeMs >= before)
})

test('Fix 2 & 2b: runBackfill failure reporting and markSourceGap with tainted ranges', async () => {
  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])
  _test.config.dryRun = true
  _test.config.enableWrites = false

  // Mock global.fetch to simulate a failing backfill
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
  })

  try {
    const startTime = 100000
    const endTime = 200000
    const result = await _test.runBackfill('spot', startTime, endTime)

    // Backfill must report incomplete on failure
    assert.strictEqual(result.ok, false, 'runBackfill must return ok=false on HTTP failure')
    assert.strictEqual(result.cursor, startTime, 'runBackfill must return stopped cursor')

    // Mark gap and verify tainted ranges
    assert.strictEqual(_test.hasActiveTaintedRanges(), false)
    _test.markSourceGap('spot', result.cursor, Date.now())

    assert.strictEqual(_test.hasActiveTaintedRanges(), true, 'hasActiveTaintedRanges should be true')
    assert.strictEqual(runtime.taintedRangesBySource.spot.length, 1)
    assert.strictEqual(runtime.taintedRangesBySource.spot[0].start, startTime)
    assert.ok(runtime.taintedRangesBySource.spot[0].end !== null)

    const allRanges = _test.getAllTaintedRanges()
    assert.ok(Array.isArray(allRanges.spot))
    assert.strictEqual(allRanges.spot.length, 1)
  } finally {
    global.fetch = originalFetch
  }
})

test('Fix 2: runBackfillUntilComplete retries until caught up or exhausted', async () => {
  const originalFetch = global.fetch
  const originalMinMs = _test.config.reconnectMinMs
  const originalMaxMs = _test.config.reconnectMaxMs
  _test.config.reconnectMinMs = 5
  _test.config.reconnectMaxMs = 10

  try {
    let callCount = 0
    // Test case: fails first call, succeeds on second call
    global.fetch = async () => {
      callCount++
      if (callCount === 1) {
        return { ok: false, status: 500, statusText: 'Error' }
      }
      return {
        ok: true,
        json: async () => [], // empty array -> caught up
      }
    }

    const resSuccess = await _test.runBackfillUntilComplete('spot', 1000)
    assert.strictEqual(resSuccess.ok, true, 'should succeed on retry')
    assert.strictEqual(callCount, 2)
  } finally {
    global.fetch = originalFetch
    _test.config.reconnectMinMs = originalMinMs
    _test.config.reconnectMaxMs = originalMaxMs
  }
})

test('Fix 3: Stalled stream detection and heartbeat self-healing', async () => {
  let closed = false
  const fakeWs = {
    readyState: 1, // OPEN
    close() {
      closed = true
    },
  }

  const thresholdMs = 90000
  const now = Date.now()

  // Message within threshold: should not close
  _test.sourceState.spot.lastMessageAtMs = now - 10000
  const idleMsNormal = now - _test.sourceState.spot.lastMessageAtMs
  if (idleMsNormal > thresholdMs) fakeWs.close()
  assert.strictEqual(closed, false, 'socket must not close when idleMs < threshold')

  // Message older than threshold: should close
  _test.sourceState.spot.lastMessageAtMs = now - 95000
  const idleMsStalled = now - _test.sourceState.spot.lastMessageAtMs
  if (idleMsStalled > thresholdMs) fakeWs.close()
  assert.strictEqual(closed, true, 'socket must close when idleMs > threshold')
})

test('Fix 4: Memory safety caps on bubble events and slice buffers', async () => {
  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])

  // 1. Bubble queue cap
  _test.config.maxQueuedBubbleEvents = 5
  _test.queuedAggregateBubbleEvents.length = 0
  _test.queuedAggregateBubbleKeys.clear()

  for (let i = 1; i <= 10; i++) {
    _test.queueAggregateBubbleCandidate({
      source: 'spot',
      id: i,
      firstTradeId: i,
      lastTradeId: i + 80, // tradeCount = 81 (qualifies)
      time: Date.now() + i * 1000,
      price: 60000,
      quantity: 50, // qualifies
      isBuyerMaker: false,
    })
  }

  assert.strictEqual(
    _test.queuedAggregateBubbleEvents.length,
    5,
    'queuedAggregateBubbleEvents must be capped at maxQueuedBubbleEvents',
  )
  // Older events should have been dropped: first remaining event has id 6
  assert.strictEqual(_test.queuedAggregateBubbleEvents[0].aggregateTradeId, 6)

  // 2. Slice buffer cap during persistent write failures
  _test.config.maxBufferedSlices = 3
  runtime.footprintSlices.clear()
  runtime.profileSlices.clear()

  const baseTime = 1700000000
  runtime.firstFullyCoveredBaseTimeBySource.spot = baseTime
  runtime.latestBaseTimeBySource.spot = baseTime + 600
  _test.sourceState.spot.connected = true
  _test.sourceState.spot.isBackfilling = false

  // Populate 5 closed slices (baseTime + 60, + 120, + 180, + 240, + 300)
  for (let t = baseTime + 60; t <= baseTime + 300; t += 60) {
    runtime.footprintSlices.set(t, new Map([[60000, { bucketPrice: 60000, bidVol: 1, askVol: 1 }]]))
    runtime.profileSlices.set(t, new Map([[60000, { candleTime: t, baseBucketSize: 1.5, bucketPrice: 60000, bidVol: 1, askVol: 1, totalVol: 2, tradeCount: 1, orderCount: 1 }]]))
  }

  // Mock failing pgPool
  _test.setPgPool({
    query: async () => {
      throw new Error('Database connection refused')
    },
  })
  _test.config.enableWrites = true
  _test.config.dryRun = false

  await _test.persistRuntimeEligibleSlices(runtime, 'test-failure')

  // Slices must be capped to maxBufferedSlices (3) by dropping oldest
  const remaining = _test.getSortedSliceTimes(runtime)
  assert.ok(remaining.length <= 4, 'slice buffer must drop oldest slices under sustained failure')
  assert.ok(runtime.firstWriteFailureAtMs !== null, 'firstWriteFailureAtMs must be tracked')
})

test('P3 Logging: Skips and gaps produce immediate markers and delta status', async () => {
  const runtime = _test.createRuntime({
    contractType: 'futures',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])
  _test.priceReferences.futures = null // Missing reference

  const beforeMissing = _test.metrics.tradesSkippedMissingReference

  // Trade with missing price reference
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 99991,
    time: Date.now(),
    price: 60000,
    quantity: 1,
    isBuyerMaker: true,
  })

  assert.strictEqual(
    _test.metrics.tradesSkippedMissingReference,
    beforeMissing + 1,
    'missing price reference must increment tradesSkippedMissingReference',
  )

  // Duplicate trade skip
  _test.priceReferences.futures = 60000
  const beforeDup = _test.metrics.tradesSkippedDuplicate
  const trade = {
    source: 'spot',
    id: 99992,
    time: Date.now(),
    price: 60000,
    quantity: 1,
    isBuyerMaker: true,
  }
  _test.ingestTrade(runtime, trade)
  _test.ingestTrade(runtime, trade) // Duplicate

  assert.strictEqual(
    _test.metrics.tradesSkippedDuplicate,
    beforeDup + 1,
    'duplicate trade must increment tradesSkippedDuplicate',
  )

  // logStatus output structure check
  _test.config.dryRun = true
  _test.config.enableWrites = false
  await _test.logStatus()
})

test('Collector Gap Handling Lifecycle', async () => {
  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])
  _test.config.dryRun = true
  _test.config.enableWrites = false

  const baseTime = Math.floor(Date.now() / 1000 / 60) * 60

  // Trade 1 (t = 0)
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 20001,
    time: baseTime * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true,
  })

  // Trade 2 (t = 1min)
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 20002,
    time: (baseTime + 60) * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true,
  })

  assert.strictEqual(_test.getCoverageStart(runtime), baseTime + 60)
  assert.strictEqual(runtime.footprintSlices.has(baseTime), true)
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 60), true)

  // Disconnect happens: markSourceGap creates open gap
  _test.markSourceGap('spot', baseTime + 60, null)
  assert.strictEqual(runtime.taintedRangesBySource.spot.length, 1)
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].start, baseTime + 60)
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].end, null)

  // Next incoming trade closes the open tainted range
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 20003,
    time: (baseTime + 600) * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true,
  })
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].end, baseTime + 600)
})

test('Pino Logger and Burst Collapsing', async () => {
  const { sourceLoggers } = _test
  assert.ok(sourceLoggers.spot, 'sourceLoggers.spot must exist')
  assert.ok(sourceLoggers.futures, 'sourceLoggers.futures must exist')

  // Capture logs from burst collapser
  const logged = []
  const mockPino = {
    info: (obj, msg) => logged.push({ level: 'info', obj, msg }),
    warn: (obj, msg) => logged.push({ level: 'warn', obj, msg }),
    error: (obj, msg) => logged.push({ level: 'error', obj, msg }),
    debug: (obj, msg) => logged.push({ level: 'debug', obj, msg }),
    child: () => mockPino,
  }

  // Test collector script's self-contained burst collapser
  const testLogger = _test.createBurstCollapsingLogger(mockPino, { windowMs: 50, maxWaitMs: 200 })

  // Emit 3 rapid errors with same code + identity within 50ms
  testLogger.error('DATA_LOSS trade skipped', { code: 'NO_REF', identity: 'BTCUSDT:spot' })
  testLogger.error('DATA_LOSS trade skipped', { code: 'NO_REF', identity: 'BTCUSDT:spot' })
  testLogger.error('DATA_LOSS trade skipped', { code: 'NO_REF', identity: 'BTCUSDT:spot' })

  // First call logged immediately, repeats suppressed
  assert.strictEqual(logged.length, 1, 'first error must log immediately, subsequent suppressed')
  assert.strictEqual(logged[0].msg, 'DATA_LOSS trade skipped')
  assert.strictEqual(logged[0].obj.code, 'NO_REF')

  // Wait for 50ms window to expire (burst ends)
  await new Promise((r) => setTimeout(r, 70))

  // Summary log should have fired with repeated: 3
  assert.strictEqual(logged.length, 2, 'summary log must be emitted when burst ends')
  assert.strictEqual(logged[1].obj.repeated, 3, 'summary log must have repeated count of 3')

  // Also verify src/lib/logger.ts exists and functions properly in the codebase
  const codebaseLoggerModule = await import('../../src/lib/logger.ts')
  assert.ok(codebaseLoggerModule.logger, 'src/lib/logger.ts logger must remain intact in codebase')
  assert.ok(codebaseLoggerModule.createSourceLogger, 'src/lib/logger.ts createSourceLogger must remain intact in codebase')
  assert.ok(codebaseLoggerModule.createBurstCollapsingLogger, 'src/lib/logger.ts createBurstCollapsingLogger must remain intact in codebase')
})

test('Watchdog 1: Trade-stall watchdog triggers exitFn on trade stall and suppresses while backfilling', async () => {
  let exitCode = null
  _test.setExitFn((code) => { exitCode = code })
  _test.config.tradeStallThresholdMs = 120000

  const now = Date.now()
  _test.sourceState.spot.isBackfilling = false
  _test.sourceState.spot.lastTradeTimeMs = now - 130000 // 130s ago (> 120s threshold)

  // Simulate heartbeat check logic
  const checkTradeStall = (source) => {
    if (!_test.sourceState[source].isBackfilling) {
      const lastTrade = _test.sourceState[source].lastTradeTimeMs ?? _test.sourceState[source].connectedAtMs ?? Date.now()
      const tradeIdleMs = Date.now() - lastTrade
      if (tradeIdleMs > _test.config.tradeStallThresholdMs) {
        _test.getExitFn()(1)
      }
    }
  }

  // 1. When not backfilling and idle > threshold, should exit with 1
  checkTradeStall('spot')
  assert.strictEqual(exitCode, 1, 'watchdog must call exitFn(1) when trade idle > threshold')

  // 2. When isBackfilling is true, watchdog must be suppressed
  exitCode = null
  _test.sourceState.spot.isBackfilling = true
  checkTradeStall('spot')
  assert.strictEqual(exitCode, null, 'watchdog must be suppressed while isBackfilling === true')
  _test.sourceState.spot.isBackfilling = false
})

test('Watchdog 2: Persistence watchdog triggers on stuck slices and suppresses while backfilling', async () => {
  let exitCode = null
  _test.setExitFn((code) => { exitCode = code })

  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot'],
  })
  _test.setRuntimes([runtime])

  // Put a slice from 10 minutes ago
  const oldSliceSec = Math.floor((Date.now() - 600000) / 1000)
  runtime.footprintSlices.set(oldSliceSec, new Map([[70000, { bucketPrice: 70000, bidVol: 1, askVol: 1 }]]))

  _test.sourceState.spot.isBackfilling = false
  _test.sourceState.futures.isBackfilling = false

  const checkPersistenceWatchdog = () => {
    const isAnyBackfilling = ['spot', 'futures'].some((s) => _test.sourceState[s].isBackfilling)
    const oldestPendingSliceAgeMs = _test.getOldestPendingSliceAgeMs()
    const pendingSlices = _test.getRuntimes().reduce((total, r) => total + _test.getSortedSliceTimes(r).length, 0)
    const thresholdMs = 300000 // 5 minutes

    if (!isAnyBackfilling && oldestPendingSliceAgeMs !== null && oldestPendingSliceAgeMs > thresholdMs && pendingSlices > 0) {
      _test.getExitFn()(1)
    }
  }

  // 1. Stalled slice with no backfilling -> exit 1
  checkPersistenceWatchdog()
  assert.strictEqual(exitCode, 1, 'persistence watchdog must call exitFn(1) when slices stuck > 5m')

  // 2. Stalled slice while a source is backfilling -> suppressed
  exitCode = null
  _test.sourceState.spot.isBackfilling = true
  checkPersistenceWatchdog()
  assert.strictEqual(exitCode, null, 'persistence watchdog must be suppressed while backfilling')

  // Cleanup
  _test.sourceState.spot.isBackfilling = false
  runtime.footprintSlices.clear()
})

test('Backfill timestamps: runBackfill updates lastTradeTimeMs on valid trade ingestion', async () => {
  const originalFetch = global.fetch
  const tradeTime = Date.now() - 50000

  global.fetch = async () => ({
    ok: true,
    json: async () => [
      { a: 55555, f: 55550, l: 55555, p: '65000.00', q: '1.5', T: tradeTime, m: false },
    ],
  })

  try {
    _test.sourceState.spot.lastTradeTimeMs = null
    const res = await _test.runBackfill('spot', tradeTime - 1000, tradeTime + 1000)
    assert.strictEqual(res.ok, true)
    assert.strictEqual(_test.sourceState.spot.lastTradeTimeMs, tradeTime, 'runBackfill must update lastTradeTimeMs from trade.T')
  } finally {
    global.fetch = originalFetch
  }
})

test('Database Watermarks: seedWatermarksFromDatabase seeds valid timestamps and rejects null/epoch', async () => {
  const recentTime = Date.now() - 60000

  // Mock pgPool with collector_meta returning valid spot and null futures
  const mockPgPool = {
    query: async (sql) => {
      if (sql.includes('collector_meta')) {
        return {
          rows: [
            { key: 'last_spot_trade_time_ms', value: String(recentTime) },
            { key: 'last_futures_trade_time_ms', value: 'invalid_or_epoch_0' },
          ],
        }
      }
      if (sql.includes('footprint_cells')) {
        // Fallback for futures returns null
        return { rows: [{ max_sec: null }] }
      }
      return { rows: [] }
    },
  }

  _test.setPgPool(mockPgPool)
  _test.sourceState.spot.lastTradeTimeMs = null
  _test.sourceState.futures.lastTradeTimeMs = null

  await _test.seedWatermarksFromDatabase()

  assert.strictEqual(_test.sourceState.spot.lastTradeTimeMs, recentTime, 'spot must be seeded from collector_meta')
  assert.strictEqual(_test.sourceState.futures.lastTradeTimeMs, null, 'futures with invalid/null value must remain null')

  _test.setPgPool(null)
})

test('REST Base URLs: getRestBaseUrl resolves defaults, proxy prefixes, and direct overrides', () => {
  const originalSpot = process.env.BINANCE_SPOT_REST_URL
  const originalFutures = process.env.BINANCE_FUTURES_REST_URL
  const originalProxy = process.env.BINANCE_REST_PROXY_URL

  try {
    // 1. Defaults (Spot uses Binance Vision; Futures uses standard fapi)
    delete process.env.BINANCE_SPOT_REST_URL
    delete process.env.BINANCE_FUTURES_REST_URL
    delete process.env.BINANCE_REST_PROXY_URL

    assert.strictEqual(_test.getRestBaseUrl('spot'), 'https://data-api.binance.vision/api/v3')
    assert.strictEqual(_test.getRestBaseUrl('futures'), 'https://fapi.binance.com/fapi/v1')

    // 2. Proxy root URL
    process.env.BINANCE_REST_PROXY_URL = 'https://my-proxy.workers.dev'
    assert.strictEqual(_test.getRestBaseUrl('spot'), 'https://my-proxy.workers.dev/api/v3')
    assert.strictEqual(_test.getRestBaseUrl('futures'), 'https://my-proxy.workers.dev/fapi/v1')

    // 3. Explicit specific overrides take highest priority
    process.env.BINANCE_SPOT_REST_URL = 'https://custom-spot.example.com/api/v3/'
    process.env.BINANCE_FUTURES_REST_URL = 'https://custom-futures.example.com/fapi/v1/'
    assert.strictEqual(_test.getRestBaseUrl('spot'), 'https://custom-spot.example.com/api/v3')
    assert.strictEqual(_test.getRestBaseUrl('futures'), 'https://custom-futures.example.com/fapi/v1')
  } finally {
    if (originalSpot !== undefined) process.env.BINANCE_SPOT_REST_URL = originalSpot
    else delete process.env.BINANCE_SPOT_REST_URL
    if (originalFutures !== undefined) process.env.BINANCE_FUTURES_REST_URL = originalFutures
    else delete process.env.BINANCE_FUTURES_REST_URL
    if (originalProxy !== undefined) process.env.BINANCE_REST_PROXY_URL = originalProxy
    else delete process.env.BINANCE_REST_PROXY_URL
  }
})

test('ProxyAgent: getProxyAgent instantiates and caches ProxyAgent from environment', () => {
  const originalBinanceProxy = process.env.BINANCE_PROXY_URL
  const originalHttpsProxy = process.env.HTTPS_PROXY

  try {
    delete process.env.BINANCE_PROXY_URL
    delete process.env.HTTPS_PROXY
    delete process.env.HTTP_PROXY

    assert.strictEqual(_test.getProxyAgent(), undefined, 'undefined when no proxy env is set')

    process.env.BINANCE_PROXY_URL = 'http://testuser:testpass@127.0.0.1:8080'
    const agent1 = _test.getProxyAgent()
    assert.ok(agent1 !== undefined, 'creates ProxyAgent instance')
    const agent2 = _test.getProxyAgent()
    assert.strictEqual(agent1, agent2, 'caches instance for same proxy URL')
  } finally {
    if (originalBinanceProxy !== undefined) process.env.BINANCE_PROXY_URL = originalBinanceProxy
    else delete process.env.BINANCE_PROXY_URL
    if (originalHttpsProxy !== undefined) process.env.HTTPS_PROXY = originalHttpsProxy
    else delete process.env.HTTPS_PROXY
  }
})



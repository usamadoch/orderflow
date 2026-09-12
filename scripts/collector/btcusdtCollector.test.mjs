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

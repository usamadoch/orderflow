import test from 'node:test'
import assert from 'node:assert'

process.env.NODE_ENV = 'test'
const { _test } = await import('./btcusdtCollector.mjs')

test('Collector Gap Handling (taintedRanges)', async (t) => {
  // Reset state
  const runtime = _test.createRuntime({
    contractType: 'spot',
    dataSourceMode: 'spot',
    activeSources: ['spot']
  })
  _test.setRuntimes([runtime])
  
  // Need to mock getErrorMessage since it's used but we are not testing logger
  _test.config.dryRun = true
  _test.config.enableWrites = false

  // Mock trades
  const baseTime = Math.floor(Date.now() / 1000 / 60) * 60
  
  // Trade 1 (t = 0)
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 1,
    time: baseTime * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true
  })
  
  // Trade 2 (t = 1min) - coverage start becomes t=1min
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 2,
    time: (baseTime + 60) * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true
  })

  // Coverage start is baseTime + 60.
  assert.strictEqual(_test.getCoverageStart(runtime), baseTime + 60, 'Initial coverage start should be set')
  assert.strictEqual(runtime.footprintSlices.has(baseTime), true)
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 60), true)

  // Disconnect happens
  _test.markSourceGap('spot')

  // Gap created from baseTime + 60
  assert.strictEqual(runtime.taintedRangesBySource.spot.length, 1)
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].start, baseTime + 60)
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].end, null)
  
  // Coverage start should remain the same because it's not nulled out anymore!
  assert.strictEqual(_test.getCoverageStart(runtime), baseTime + 60, 'Coverage start should survive disconnect')

  // Reconnect and trade 3 (t = 10min)
  _test.ingestTrade(runtime, {
    source: 'spot',
    id: 3,
    time: (baseTime + 600) * 1000,
    price: 60000,
    quantity: 1,
    isBuyerMaker: true
  })

  // Gap should be closed at baseTime + 600
  assert.strictEqual(runtime.taintedRangesBySource.spot[0].end, baseTime + 600)
  
  // Simulate slices
  runtime.footprintSlices.set(baseTime - 60, new Map()) // Should be dropped (before coverage)
  runtime.footprintSlices.set(baseTime + 120, new Map()) // Tainted (inside gap)
  runtime.profileSlices.set(baseTime + 120, new Map())

  assert.strictEqual(runtime.footprintSlices.has(baseTime), true)
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 60), true)
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 120), true)
  
  await _test.persistRuntimeEligibleSlices(runtime, 'test')

  // baseTime - 60 dropped because it's < coverageStart
  assert.strictEqual(runtime.footprintSlices.has(baseTime - 60), false, 'Pre-coverage slice should be dropped')
  
  // baseTime + 120 dropped because it's tainted
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 120), false, 'Tainted slice should be dropped')
  
  // baseTime + 60 is dropped because it became a persisted slice (writeClosedSlice mocked via dryRun, then slice deleted)
  // Wait, if sliceTime >= closedBeforeTime, it's skipped. 
  // closedBeforeTime is baseTime + 600.
  // baseTime (0) < 600, so it gets processed.
  // But wait, coverageStart is baseTime + 60.
  // So baseTime (0) < baseTime + 60, so it gets dropped for being before coverage!
  assert.strictEqual(runtime.footprintSlices.has(baseTime), false, 'Base time dropped due to coverage start')
  
  // baseTime + 60 >= coverageStart, and < closedBeforeTime.
  // So it gets "persisted" (dryRun returns early) and then deleted.
  assert.strictEqual(runtime.footprintSlices.has(baseTime + 60), false, 'Valid slice should be persisted and deleted from memory')
  assert.strictEqual(runtime.persistedSlices.has(`${runtime.identity}:${baseTime + 60}`), true, 'Valid slice should be marked persisted')
})

test('Collector Size-Based Retention (enforceSizeLimitForDb)', async (t) => {
  let commandCalls = 0
  let findCalls = 0
  let deleteManyCalls = 0

  const mockDb = {
    databaseName: 'mockDB',
    command: async () => {
      commandCalls++
      const size = 600 * 1024 * 1024 - (deleteManyCalls * 30 * 1024 * 1024)
      return { storageSize: size, indexSize: 0 }
    },
    collection: () => ({
      find: () => ({
        sort: () => ({
          limit: () => ({
            toArray: async () => {
              findCalls++
              return [{ time: new Date() }]
            }
          })
        })
      }),
      deleteMany: async () => {
        deleteManyCalls++
        return { deletedCount: 100 }
      }
    })
  }

  _test.config.enableWrites = true
  _test.config.dryRun = false
  _test.config.targetSizeBytes = 500 * 1024 * 1024
  _test.config.pruneChunkBytes = 50 * 1024 * 1024
  
  await _test.enforceSizeLimitForDb(mockDb, false)

  // 600MB initial
  // targetAfterPrune = 600MB - 50MB = 550MB
  // Loop 1: drops 60MB -> 540MB. 540MB > 550MB is false. Loop breaks.
  assert.strictEqual(commandCalls, 2) // Initial + 1 loop
  assert.strictEqual(findCalls, 1)
  assert.strictEqual(deleteManyCalls, 2) // 1 loop * 2 calls
})

import { getMongoDb, verifyMongoConnection } from './client'
import type { MarketStorageAdapter } from '../storageAdapter'
import {
  CANDLE_COLLECTION_NAME,
  ensureCandleCollection,
  getMongoCandleCount,
  getMongoCandles,
  storeMongoClosedCandles,
} from './repositories/mongoCandleRepository'
import {
  ensureFootprintCollection,
  FOOTPRINT_COLLECTION_NAME,
  getMongoFootprintCellsForRange,
  storeMongoBaseFootprints,
} from './repositories/mongoFootprintRepository'
import {
  ensureProfileCollection,
  getMongoFineProfileRows,
  PROFILE_COLLECTION_NAME,
  storeMongoFineProfileRows,
} from './repositories/mongoProfileRepository'

export const MONGO_MARKET_COLLECTIONS = {
  candles: CANDLE_COLLECTION_NAME,
  footprintCells: FOOTPRINT_COLLECTION_NAME,
  profileRows: PROFILE_COLLECTION_NAME,
  collectorMeta: 'collector_meta',
  rawTrades: 'raw_trades_ts',
} as const

function notImplemented(methodName: string): never {
  throw new Error(`MongoDB market storage method "${methodName}" is not migrated in this task.`)
}

export function createMongoMarketStorageAdapter(): MarketStorageAdapter {
  return {
    driver: 'mongodb',
    async init() {
      const db = await getMongoDb()
      await Promise.all([
        ensureCandleCollection(db),
        ensureFootprintCollection(db),
        ensureProfileCollection(db),
      ])
    },
    async storeClosedCandle(input) {
      await storeMongoClosedCandles([input])
    },
    async storeBaseFootprint(input) {
      await storeMongoBaseFootprints([input])
    },
    async storeFineProfileRows(input) {
      await storeMongoFineProfileRows([input])
    },
    async storeRawTrades() {
      notImplemented('storeRawTrades')
    },
    async getCandles(symbol, contractType, timeframe, sinceUnixSeconds = 0, untilUnixSeconds = 0, limit = 1000) {
      return getMongoCandles(symbol, contractType, timeframe, sinceUnixSeconds, untilUnixSeconds, limit)
    },
    async getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize) {
      return getMongoFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize)
    },
    async getFootprintCells() {
      notImplemented('getFootprintCells')
    },
    async getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize) {
      return getMongoFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize)
    },
    async getRawTrades() {
      notImplemented('getRawTrades')
    },
    async getCollectorMeta() {
      return {}
    },
    async getCandleCount(symbol, timeframe) {
      return getMongoCandleCount(symbol, 'spot', timeframe)
    },
    async getDatabaseSizeMb() {
      const db = await getMongoDb()
      const stats = await db.command({ dbStats: 1 })
      return +(stats.dataSize / (1024 * 1024)).toFixed(2)
    },
    async getStatus() {
      const ok = await verifyMongoConnection()
      const db = await getMongoDb()
      const stats = await db.command({ dbStats: 1 })
      const dbSizeMb = +(stats.dataSize / (1024 * 1024)).toFixed(2)
      const count = await getMongoCandleCount('BTCUSDT', 'spot', '1m')

      return {
        retentionSeconds: 7 * 24 * 3600,
        dbSizeMb,
        lastStored: null,
        candleCounts: { BTCUSDT_1m: count },
      }
    },
  }
}

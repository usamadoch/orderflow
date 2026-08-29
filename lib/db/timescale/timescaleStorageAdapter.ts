import { query, verifyTimescaleConnection } from './client'
import { runTimescaleMigrations } from './migrations'
import type { MarketStorageAdapter } from '../storageAdapter'
import { getCandleCount, getCandles, storeCandles } from './repositories/candleRepository'
import { getFootprintCellsForRange, storeFootprints } from './repositories/footprintRepository'
import { getFineProfileRows, storeFineProfileRows } from './repositories/profileRepository'

export function createTimescaleMarketStorageAdapter(): MarketStorageAdapter {
  return {
    driver: 'timescaledb' as any,
    
    async init() {
      await runTimescaleMigrations()
    },
    
    async storeClosedCandle(input) {
      await storeCandles([input])
    },
    
    async storeBaseFootprint(input) {
      await storeFootprints([input])
    },
    
    async storeFineProfileRows(input) {
      await storeFineProfileRows([input])
    },
    
    async storeRawTrades() {
      throw new Error('TimescaleDB market storage method "storeRawTrades" is not migrated in this task.')
    },
    
    async getCandles(symbol, contractType, timeframe, sinceUnixSeconds = 0, untilUnixSeconds = 0, limit = 1000) {
      return getCandles(symbol, contractType, timeframe, sinceUnixSeconds, untilUnixSeconds, limit)
    },
    
    async getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize) {
      return getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize)
    },
    
    async getFootprintCells() {
      throw new Error('TimescaleDB market storage method "getFootprintCells" is not migrated in this task.')
    },
    
    async getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize) {
      return getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize)
    },
    
    async getRawTrades() {
      throw new Error('TimescaleDB market storage method "getRawTrades" is not migrated in this task.')
    },
    
    async getCollectorMeta() {
      const sql = 'SELECT key, value FROM collector_meta'
      const result = await query(sql)
      const meta: Record<string, string> = {}
      for (const row of result.rows) {
        meta[row.key] = row.value
      }
      return meta
    },
    
    async getCandleCount(symbol, timeframe) {
      return getCandleCount(symbol, 'spot', timeframe) // hardcoding spot just like mongo did, or modify if needed
    },
    
    async getDatabaseSizeMb() {
      try {
        const result = await query('SELECT pg_database_size(current_database()) as size')
        const bytes = parseInt(result.rows[0].size || '0', 10)
        return +(bytes / (1024 * 1024)).toFixed(2)
      } catch {
        return null
      }
    },
    
    async getStatus() {
      await verifyTimescaleConnection()
      const dbSizeMb = await this.getDatabaseSizeMb()
      const count = await getCandleCount('BTCUSDT', 'spot', '1m')
      
      const retentionDays = process.env.MARKET_DATA_RETENTION_DAYS 
        ? parseInt(process.env.MARKET_DATA_RETENTION_DAYS, 10) 
        : 90

      return {
        retentionSeconds: retentionDays * 24 * 3600,
        dbSizeMb,
        lastStored: null,
        candleCounts: { BTCUSDT_1m: count },
      }
    },
  }
}

import { ALLOWED_SYMBOLS, ALLOWED_TIMEFRAMES } from '../../config/markets'
import type { MarketStorageAdapter } from '../storageAdapter'

export const libsqlMarketStorageAdapter: MarketStorageAdapter = {
  driver: 'libsql',

  async init() {
    const { initDatabase } = await import('../database')
    await initDatabase()
  },

  async getStatus() {
    const { DB_CONFIG, getCandleCount, getCollectorMeta, getDatabaseSizeMb } = await import('../database')
    const meta = await getCollectorMeta()
    const candleCounts: Record<string, number> = {}

    await Promise.all(
      ALLOWED_SYMBOLS.flatMap((symbol) =>
        ALLOWED_TIMEFRAMES.map(async (timeframe) => {
          candleCounts[`${symbol}_${timeframe}`] = await getCandleCount(symbol, timeframe)
        }),
      ),
    )

    return {
      candleCounts,
      lastStored: meta.last_candle_stored ?? null,
      retentionSeconds: Number(meta.retention_hours ?? DB_CONFIG.retentionHours) * 3600,
      dbSizeMb: getDatabaseSizeMb(),
    }
  },

  async storeClosedCandle(input) {
    const { storeClosedCandle } = await import('../marketStorage')
    await storeClosedCandle(
      input.symbol,
      input.contractType,
      input.dataSourceMode,
      input.timeframe,
      input.candle,
      input.cells,
      input.delta,
      input.buyVol,
      input.sellVol,
    )
  },

  async storeBaseFootprint(input) {
    const { storeBaseFootprint } = await import('../marketStorage')
    await storeBaseFootprint(input.symbol, input.contractType, input.dataSourceMode, input.candleTime, input.cells)
  },

  async storeFineProfileRows(input) {
    const { storeFineProfileRows } = await import('../marketStorage')
    await storeFineProfileRows(input.symbol, input.contractType, input.dataSourceMode, input.timeframe, input.rows)
  },

  async storeRawTrades(input) {
    const { storeRawTrades } = await import('../marketStorage')
    await storeRawTrades(input.symbol, input.trades)
  },

  async getCandles(symbol, _contractType, timeframe, since, _until, limit) {
    const { getCandles } = await import('../database')
    return getCandles(symbol, timeframe, since, limit)
  },

  async getFootprintCells(symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize) {
    const { getFootprintCells } = await import('../database')
    return getFootprintCells(symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize)
  },

  async getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize) {
    const { getFootprintCellsForRange } = await import('../database')
    return getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize)
  },

  async getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize) {
    const { getFineProfileRows } = await import('../database')
    return getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize)
  },

  async getRawTrades(symbol, startTimeMs, endTimeMs, options) {
    const { getRawTrades } = await import('../database')
    return getRawTrades(symbol, startTimeMs, endTimeMs, options)
  },

  async getCollectorMeta() {
    const { getCollectorMeta } = await import('../database')
    return getCollectorMeta()
  },

  async getCandleCount(symbol, timeframe) {
    const { getCandleCount } = await import('../database')
    return getCandleCount(symbol, timeframe)
  },

  async getDatabaseSizeMb() {
    const { getDatabaseSizeMb } = await import('../database')
    return getDatabaseSizeMb()
  },
}

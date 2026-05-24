import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import { ALLOWED_SYMBOLS, ALLOWED_TIMEFRAMES } from '../config/markets'
import { mongoMarketStorageAdapter } from './mongo/marketStorageMongo'
import type {
  CandleRow,
  FineProfileRow,
  FineProfileRowWriteInput,
  FootprintCellRow,
  RawTradeRow,
  RawTradeQueryOptions,
} from './database'
import type { SerializedFootprintCell } from './marketStorage'

export type MarketDbDriver = 'libsql' | 'mongodb'

export interface StoreClosedCandleInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  candle: Candle
  cells: SerializedFootprintCell[]
  delta: number
  buyVol: number
  sellVol: number
}

export interface StoreBaseFootprintInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  candleTime: number
  cells: SerializedFootprintCell[]
}

export interface StoreFineProfileRowsInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  rows: FineProfileRowWriteInput[]
}

export interface StoreRawTradesInput {
  symbol: string
  trades: Trade[]
}

export interface MarketStorageStatus {
  retentionSeconds: number
  dbSizeMb: number | null
  lastStored: string | null
  candleCounts: Record<string, number>
}

export interface GetStoredCandlesInput {
  symbol: string
  contractType: string
  timeframe: string
  since?: number
  limit?: number
}

export interface MarketStorageAdapter {
  driver: MarketDbDriver
  init(): Promise<void>
  getStatus(): Promise<MarketStorageStatus>
  storeClosedCandle(input: StoreClosedCandleInput): Promise<void>
  storeBaseFootprint(input: StoreBaseFootprintInput): Promise<void>
  storeFineProfileRows(input: StoreFineProfileRowsInput): Promise<void>
  storeRawTrades(input: StoreRawTradesInput): Promise<void>
  getCandles(symbol: string, contractType: string, timeframe: string, since?: number, limit?: number): Promise<CandleRow[]>
  getFootprintCells(
    symbol: string,
    contractType: string,
    dataSourceMode: string,
    timeframe: string,
    candleTime: number,
    bucketSize?: number,
  ): Promise<FootprintCellRow[]>
  getFootprintCellsForRange(
    symbol: string,
    contractType: string,
    dataSourceMode: string,
    timeframe: string,
    startTime: number,
    endTime: number,
    bucketSize: number,
  ): Promise<FootprintCellRow[]>
  getFineProfileRows(
    symbol: string,
    contractType: string,
    dataSourceMode: string,
    timeframe: string,
    startTime: number,
    endTime: number,
    baseBucketSize: number,
  ): Promise<FineProfileRow[]>
  getRawTrades(
    symbol: string,
    startTimeMs: number,
    endTimeMs: number,
    options?: number | RawTradeQueryOptions,
  ): Promise<RawTradeRow[]>
  getCollectorMeta(): Promise<Record<string, string>>
  getCandleCount(symbol: string, timeframe: string): Promise<number>
  getDatabaseSizeMb(): Promise<number | null>
}

const libsqlMarketStorageAdapter: MarketStorageAdapter = {
  driver: 'libsql',

  async init() {
    const { initDatabase } = await import('./database')
    await initDatabase()
  },

  async getStatus() {
    const {
      DB_CONFIG,
      getCandleCount,
      getCollectorMeta,
      getDatabaseSizeMb,
    } = await import('./database')
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
    const { storeClosedCandle } = await import('./marketStorage')
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
    const { storeBaseFootprint } = await import('./marketStorage')
    await storeBaseFootprint(
      input.symbol,
      input.contractType,
      input.dataSourceMode,
      input.candleTime,
      input.cells,
    )
  },

  async storeFineProfileRows(input) {
    const { storeFineProfileRows } = await import('./marketStorage')
    await storeFineProfileRows(
      input.symbol,
      input.contractType,
      input.dataSourceMode,
      input.timeframe,
      input.rows,
    )
  },

  async storeRawTrades(input) {
    const { storeRawTrades } = await import('./marketStorage')
    await storeRawTrades(input.symbol, input.trades)
  },

  async getCandles(symbol, _contractType, timeframe, since, limit) {
    const { getCandles } = await import('./database')
    return getCandles(symbol, timeframe, since, limit)
  },

  async getFootprintCells(symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize) {
    const { getFootprintCells } = await import('./database')
    return getFootprintCells(symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize)
  },

  async getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize) {
    const { getFootprintCellsForRange } = await import('./database')
    return getFootprintCellsForRange(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize)
  },

  async getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize) {
    const { getFineProfileRows } = await import('./database')
    return getFineProfileRows(symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize)
  },

  async getRawTrades(symbol, startTimeMs, endTimeMs, options) {
    const { getRawTrades } = await import('./database')
    return getRawTrades(symbol, startTimeMs, endTimeMs, options)
  },

  async getCollectorMeta() {
    const { getCollectorMeta } = await import('./database')
    return getCollectorMeta()
  },

  async getCandleCount(symbol, timeframe) {
    const { getCandleCount } = await import('./database')
    return getCandleCount(symbol, timeframe)
  },

  async getDatabaseSizeMb() {
    const { getDatabaseSizeMb } = await import('./database')
    return getDatabaseSizeMb()
  },
}

export function getMarketDbDriver(): MarketDbDriver {
  return process.env.MARKET_DB_DRIVER === 'mongodb' ? 'mongodb' : 'libsql'
}

export function getMarketStorageAdapter(): MarketStorageAdapter {
  return getMarketDbDriver() === 'mongodb'
    ? mongoMarketStorageAdapter
    : libsqlMarketStorageAdapter
}

export async function getStoredCandles(input: GetStoredCandlesInput) {
  return getMarketStorageAdapter().getCandles(
    input.symbol,
    input.contractType,
    input.timeframe,
    input.since,
    input.limit,
  )
}

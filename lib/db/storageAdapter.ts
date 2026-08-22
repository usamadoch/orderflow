import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import type { CandleRow, FineProfileRow, FineProfileRowWriteInput, FootprintCellRow, RawTradeQueryOptions, RawTradeRow } from './database'
import type { SerializedFootprintCell } from './marketStorage'
import { createMongoMarketStorageAdapter } from './mongo/marketStorageMongo'
import { libsqlMarketStorageAdapter } from './repositories/libsqlStorageAdapter'

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
  until?: number
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
  getCandles(symbol: string, contractType: string, timeframe: string, since?: number, until?: number, limit?: number): Promise<CandleRow[]>
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

export function getMarketDbDriver(): MarketDbDriver {
  return process.env.MARKET_DB_DRIVER === 'mongodb' ? 'mongodb' : 'libsql'
}

export function getMarketStorageAdapter(): MarketStorageAdapter {
  return getMarketDbDriver() === 'mongodb'
    ? createMongoMarketStorageAdapter()
    : libsqlMarketStorageAdapter
}

export async function getStoredCandles(input: GetStoredCandlesInput): Promise<CandleRow[]> {
  return getMarketStorageAdapter().getCandles(
    input.symbol,
    input.contractType,
    input.timeframe,
    input.since,
    input.until,
    input.limit,
  )
}

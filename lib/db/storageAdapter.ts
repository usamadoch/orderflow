import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import { createTimescaleMarketStorageAdapter } from './timescale/timescaleStorageAdapter'

export type MarketDbDriver = 'timescaledb'

export interface SerializedFootprintCell {
  bucketPrice: number
  bidVol: number
  askVol: number
}

export interface CandleRow {
  id: number
  symbol: string
  timeframe: string
  open_time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trade_count: number
  close_time: number
  stored_at: number
}

export interface FineProfileRow {
  id: number
  symbol: string
  contract_type: string
  data_source_mode: string
  timeframe: string
  candle_time: number
  base_bucket_size: number
  bucket_price: number
  bid_vol: number
  ask_vol: number
  total_vol: number
  trade_count: number
  order_count?: number
}

export interface FineProfileRowWriteInput {
  candleTime: number
  baseBucketSize: number
  bucketPrice: number
  bidVol: number
  askVol: number
  totalVol: number
  tradeCount: number
  orderCount?: number
}

export interface FootprintCellRow {
  id: number
  symbol: string
  contract_type: string
  data_source_mode: string
  timeframe: string
  candle_time: number
  bucket_price: number
  bucket_size: number
  bid_vol: number
  ask_vol: number
  total_vol?: number
  delta?: number
  stored_at?: number
}

export type RawTradeOrder = 'ASC' | 'DESC'

export interface RawTradeQueryOptions {
  limit?: number
  order?: RawTradeOrder
  cursorTimeMs?: number
  cursorTradeId?: number
}

export interface RawTradeRow {
  id: number
  symbol: string
  aggregate_trade_id: number
  trade_time: number
  price: number
  quantity: number
  is_buyer_maker: number
  stored_at: number
}

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
  return 'timescaledb'
}

export function getMarketStorageAdapter(): MarketStorageAdapter {
  return createTimescaleMarketStorageAdapter()
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

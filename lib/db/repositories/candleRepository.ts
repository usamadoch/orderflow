import type { Candle } from '../../../types/candle'
// import type { FootprintCellWriteInput } from './footprintRepository'

import { db, DB_CONFIG, withDbWriteRetry } from './dbSetup'
import { FootprintCellWriteInput } from './footprintRepository'

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

export type CandleInsertInput = Pick<Candle, 'open' | 'high' | 'low' | 'close' | 'volume' | 'tradeCount'> & {
  time?: number
  open_time?: number
  close_time?: number
  isClosed?: boolean
}

export interface ClosedCandleSnapshotInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  candle: CandleInsertInput
  cells: FootprintCellWriteInput[]
  delta: number
  buyVol: number
  sellVol: number
  bucketSize: number
  storedAtIso?: string
}

export async function insertCandle(symbol: string, timeframe: string, candle: CandleInsertInput) {
  if (candle.isClosed === false) return
  const openTime = candle.open_time ?? candle.time
  if (openTime == null) throw new Error('insertCandle requires candle.open_time or candle.time')

  await db.execute({
    sql: `
      INSERT OR REPLACE INTO candles (symbol, timeframe, open_time, open, high, low, close, volume, trade_count, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      symbol,
      timeframe,
      openTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.tradeCount ?? 0,
      candle.close_time ?? openTime,
    ],
  })
}

export async function persistClosedCandleSnapshot({
  symbol,
  contractType,
  dataSourceMode,
  timeframe,
  candle,
  cells,
  delta,
  buyVol,
  sellVol,
  bucketSize,
  storedAtIso = new Date().toISOString(),
}: ClosedCandleSnapshotInput) {
  if (candle.isClosed === false) return
  const openTime = candle.open_time ?? candle.time
  if (openTime == null) throw new Error('persistClosedCandleSnapshot requires candle.open_time or candle.time')

  const statements: Array<{ sql: string; args: Array<string | number> }> = [
    {
      sql: `
        INSERT OR REPLACE INTO candles (symbol, timeframe, open_time, open, high, low, close, volume, trade_count, close_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        symbol,
        timeframe,
        openTime,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        candle.tradeCount ?? 0,
        candle.close_time ?? openTime,
      ],
    },
  ]

  if (cells.length > 0) {
    statements.push(
      ...cells.map((cell) => ({
        sql: `
          INSERT OR REPLACE INTO footprint_cells (symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [symbol, contractType, dataSourceMode, timeframe, openTime, cell.bucketPrice, bucketSize, cell.bidVol, cell.askVol, cell.askVol - cell.bidVol],
      })),
    )
    statements.push({
      sql: 'INSERT OR REPLACE INTO candle_delta (symbol, timeframe, candle_time, total_delta, buy_vol, sell_vol) VALUES (?, ?, ?, ?, ?, ?)',
      args: [symbol, timeframe, openTime, delta, buyVol, sellVol],
    })
  }

  statements.push({
    sql: 'INSERT INTO collector_meta (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()',
    args: ['last_candle_stored', storedAtIso],
  })

  await withDbWriteRetry('Closed candle snapshot write', async () => {
    await db.batch(statements, 'write')
  })
}

export async function insertCandleDelta(symbol: string, timeframe: string, candleTime: number, delta: number, buyVol: number, sellVol: number) {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO candle_delta (symbol, timeframe, candle_time, total_delta, buy_vol, sell_vol) VALUES (?, ?, ?, ?, ?, ?)',
    args: [symbol, timeframe, candleTime, delta, buyVol, sellVol],
  })
}

export async function getCandles(symbol: string, timeframe: string, sinceUnixSeconds = 0, limit = DB_CONFIG.maxCandlesPerQuery) {
  const boundedLimit = Math.max(1, Math.min(limit, DB_CONFIG.maxCandlesPerQuery))
  if (sinceUnixSeconds <= 0) {
    const result = await db.execute({
      sql: 'SELECT * FROM (SELECT * FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY open_time DESC LIMIT ?) ORDER BY open_time ASC',
      args: [symbol, timeframe, boundedLimit],
    })
    return result.rows as unknown as CandleRow[]
  }
  const result = await db.execute({
    sql: 'SELECT * FROM candles WHERE symbol = ? AND timeframe = ? AND open_time > ? ORDER BY open_time ASC LIMIT ?',
    args: [symbol, timeframe, sinceUnixSeconds, boundedLimit],
  })
  return result.rows as unknown as CandleRow[]
}

export async function getCandleCount(symbol: string, timeframe: string) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM candles WHERE symbol = ? AND timeframe = ?',
    args: [symbol, timeframe],
  })
  return Number(result.rows[0]?.count ?? 0)
}

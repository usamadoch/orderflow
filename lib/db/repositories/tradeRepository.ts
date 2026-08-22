import type { Trade } from '../../../types/trade'
import { db, DB_CONFIG, withDbWriteRetry } from './dbSetup'

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

export type RawTradeWriteInput = Trade
export type RawTradeOrder = 'asc' | 'desc'

export interface RawTradeQueryOptions {
  limit?: number
  order?: RawTradeOrder
  cursorTimeMs?: number
  cursorTradeId?: number
}

export async function insertRawTradeBatch(symbol: string, trades: RawTradeWriteInput[]) {
  const rows = trades.filter((trade) => Number.isFinite(trade.id))
  if (rows.length === 0) return

  await withDbWriteRetry('Raw trade batch write', async () => {
    await db.batch(
      rows.map((trade) => ({
        sql: 'INSERT OR IGNORE INTO raw_trades (symbol, aggregate_trade_id, trade_time, price, quantity, is_buyer_maker) VALUES (?, ?, ?, ?, ?, ?)',
        args: [symbol, trade.id!, trade.time, trade.price, trade.quantity, trade.isBuyerMaker ? 1 : 0],
      })),
      'write',
    )
  })
}

export async function getRawTrades(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number,
  options: number | RawTradeQueryOptions = DB_CONFIG.maxTradesPerQuery,
) {
  const queryOptions: RawTradeQueryOptions = typeof options === 'number' ? { limit: options } : options
  const limit = queryOptions.limit ?? DB_CONFIG.maxTradesPerQuery
  const order: RawTradeOrder = queryOptions.order === 'desc' ? 'desc' : 'asc'
  const boundedLimit = Math.max(1, Math.min(limit, DB_CONFIG.maxTradesPerQuery))
  const direction = order === 'desc' ? 'DESC' : 'ASC'
  const cursorTimeMs = queryOptions.cursorTimeMs
  const cursorTradeId = queryOptions.cursorTradeId
  const hasCursor = Number.isFinite(cursorTimeMs) && Number.isFinite(cursorTradeId)
  const cursorFilter = hasCursor
    ? order === 'desc'
      ? 'AND (trade_time < ? OR (trade_time = ? AND aggregate_trade_id < ?))'
      : 'AND (trade_time > ? OR (trade_time = ? AND aggregate_trade_id > ?))'
    : ''
  const args: Array<string | number> = [symbol, startTimeMs, endTimeMs]

  if (hasCursor) {
    args.push(cursorTimeMs!, cursorTimeMs!, cursorTradeId!)
  }
  args.push(boundedLimit)

  const result = await db.execute({
    sql: `
      SELECT *
      FROM raw_trades
      WHERE symbol = ? AND trade_time >= ? AND trade_time < ?
      ${cursorFilter}
      ORDER BY trade_time ${direction}, aggregate_trade_id ${direction}
      LIMIT ?
    `,
    args,
  })

  return result.rows as unknown as RawTradeRow[]
}

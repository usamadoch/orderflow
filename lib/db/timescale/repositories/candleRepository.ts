import { query } from '../client'
import type { CandleRow } from '../../database'
import type { StoreClosedCandleInput } from '../../storageAdapter'

export async function storeCandles(inputs: StoreClosedCandleInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.candle.isClosed !== false)
  if (validInputs.length === 0) return 0

  const values: any[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  for (const input of validInputs) {
    const time = new Date(input.candle.time * 1000)
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
    
    values.push(
      time,
      input.symbol,
      input.contractType,
      input.timeframe,
      input.candle.open || 0,
      input.candle.high || 0,
      input.candle.low || 0,
      input.candle.close || 0,
      input.candle.volume || 0,
      input.candle.tradeCount || 0,
      time
    )
  }

  const sql = `
    INSERT INTO market_candles (
      time, symbol, contract_type, timeframe, open, high, low, close, volume, trade_count, close_time
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, timeframe, time) DO NOTHING
  `
  
  const result = await query(sql, values)
  return result.rowCount ?? 0
}

export async function getCandles(
  symbol: string,
  contractType: string,
  timeframe: string,
  sinceUnixSeconds = 0,
  untilUnixSeconds = 0,
  limit = 1000
): Promise<CandleRow[]> {
  const conditions: string[] = ['symbol = $1', 'contract_type = $2', 'timeframe = $3']
  const params: any[] = [symbol, contractType, timeframe]
  let paramIndex = 4

  if (sinceUnixSeconds > 0) {
    conditions.push(`time > $${paramIndex++}`)
    params.push(new Date(sinceUnixSeconds * 1000))
  }
  if (untilUnixSeconds > 0) {
    conditions.push(`time <= $${paramIndex++}`)
    params.push(new Date(untilUnixSeconds * 1000))
  }

  const boundedLimit = Math.max(1, Math.min(limit, 50000))
  
  // If sinceUnixSeconds is <= 0, it means we are fetching latest backwards, so DESC limit then reverse
  const order = sinceUnixSeconds <= 0 ? 'DESC' : 'ASC'
  
  const sql = `
    SELECT * FROM market_candles 
    WHERE ${conditions.join(' AND ')}
    ORDER BY time ${order}
    LIMIT ${boundedLimit}
  `
  
  const result = await query(sql, params)
  const rows = result.rows

  if (order === 'DESC') {
    rows.reverse()
  }

  return rows.map((row, idx) => ({
    id: idx + 1,
    symbol: row.symbol,
    timeframe: row.timeframe,
    open_time: Math.floor(row.time.getTime() / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    trade_count: row.trade_count,
    close_time: Math.floor((row.close_time ?? row.time).getTime() / 1000),
    stored_at: Math.floor((row.stored_at ?? row.time).getTime() / 1000),
  }))
}

export async function getCandleCount(symbol: string, contractType: string, timeframe: string): Promise<number> {
  const sql = `
    SELECT COUNT(*) as count FROM market_candles 
    WHERE symbol = $1 AND contract_type = $2 AND timeframe = $3
  `
  const result = await query(sql, [symbol, contractType, timeframe])
  return parseInt(result.rows[0]?.count || '0', 10)
}

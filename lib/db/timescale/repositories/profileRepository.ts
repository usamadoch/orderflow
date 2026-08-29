import { query } from '../client'
import type { FineProfileRow } from '../../database'
import type { StoreFineProfileRowsInput } from '../../storageAdapter'

export async function storeFineProfileRows(inputs: StoreFineProfileRowsInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.rows.length > 0)
  if (validInputs.length === 0) return 0

  const values: any[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  for (const input of validInputs) {
    for (const row of input.rows) {
      const time = new Date(row.candleTime * 1000)
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
      
      values.push(
        time,
        input.symbol,
        input.contractType,
        input.dataSourceMode,
        input.timeframe,
        row.candleTime,
        row.baseBucketSize,
        row.bucketPrice || 0,
        row.bidVol || 0,
        row.askVol || 0,
        row.totalVol || 0,
        row.tradeCount || 0
      )
    }
  }

  if (values.length === 0) return 0

  const sql = `
    INSERT INTO profile_rows (
      time, symbol, contract_type, data_source_mode, timeframe, 
      candle_time_sec, base_bucket_size, bucket_price, bid_vol, ask_vol, total_vol, trade_count
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, data_source_mode, timeframe, base_bucket_size, time, bucket_price) DO NOTHING
  `

  const result = await query(sql, values)
  return result.rowCount ?? 0
}

export async function getFineProfileRows(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  baseBucketSize: number
): Promise<FineProfileRow[]> {
  const sql = `
    SELECT * FROM profile_rows 
    WHERE symbol = $1 
      AND contract_type = $2 
      AND data_source_mode = $3 
      AND timeframe = $4 
      AND base_bucket_size = $5
      AND time >= $6
      AND time < $7
    ORDER BY time ASC, bucket_price ASC
  `
  
  const result = await query(sql, [
    symbol, 
    contractType, 
    dataSourceMode, 
    timeframe, 
    baseBucketSize,
    new Date(startTime * 1000),
    new Date(endTime * 1000)
  ])

  return result.rows.map((row, idx) => ({
    id: idx + 1,
    symbol: row.symbol,
    contract_type: row.contract_type,
    data_source_mode: row.data_source_mode,
    timeframe: row.timeframe,
    candle_time: Number(row.candle_time_sec),
    base_bucket_size: row.base_bucket_size,
    bucket_price: row.bucket_price,
    bid_vol: row.bid_vol,
    ask_vol: row.ask_vol,
    total_vol: row.total_vol,
    trade_count: row.trade_count,
    stored_at: Math.floor((row.stored_at ?? row.time).getTime() / 1000),
  }))
}

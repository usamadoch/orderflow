import { query } from '../client'
import type { FootprintCellRow } from '../../database'
import type { StoreBaseFootprintInput } from '../../storageAdapter'

export async function storeFootprints(inputs: StoreBaseFootprintInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.cells.length > 0)
  if (validInputs.length === 0) return 0

  const values: any[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  for (const input of validInputs) {
    const time = new Date(input.candleTime * 1000)
    for (const cell of input.cells) {
      const bidVol = cell.bidVol || 0
      const askVol = cell.askVol || 0
      const totalVol = bidVol + askVol
      const delta = askVol - bidVol

      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
      
      values.push(
        time,
        input.symbol,
        input.contractType,
        input.dataSourceMode,
        '1m', // timeframe
        5,    // bucket_size hardcoded for base footprint like mongo version
        input.candleTime,
        cell.bucketPrice || 0,
        bidVol,
        askVol,
        totalVol,
        delta
      )
    }
  }

  if (values.length === 0) return 0

  const sql = `
    INSERT INTO footprint_cells (
      time, symbol, contract_type, data_source_mode, timeframe, bucket_size, 
      candle_time_sec, bucket_price, bid_vol, ask_vol, total_vol, delta
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, data_source_mode, timeframe, bucket_size, time, bucket_price) DO NOTHING
  `

  const result = await query(sql, values)
  return result.rowCount ?? 0
}

export async function getFootprintCellsForRange(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  bucketSize: number
): Promise<FootprintCellRow[]> {
  const sql = `
    SELECT * FROM footprint_cells 
    WHERE symbol = $1 
      AND contract_type = $2 
      AND data_source_mode = $3 
      AND timeframe = $4 
      AND bucket_size = $5
      AND time >= $6
      AND time < $7
    ORDER BY time ASC, bucket_price ASC
  `
  
  const result = await query(sql, [
    symbol, 
    contractType, 
    dataSourceMode, 
    timeframe, 
    bucketSize,
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
    bucket_price: row.bucket_price,
    bucket_size: row.bucket_size,
    bid_vol: row.bid_vol,
    ask_vol: row.ask_vol,
    delta: row.delta,
    stored_at: Math.floor((row.stored_at ?? row.time).getTime() / 1000),
  }))
}

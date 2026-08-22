import { db, withDbWriteRetry } from './dbSetup'

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
  stored_at: number
}

export interface FineProfileRowWriteInput {
  candleTime: number
  baseBucketSize: number
  bucketPrice: number
  bidVol: number
  askVol: number
  totalVol: number
  tradeCount: number
}

export async function insertFineProfileRows(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  const storableRows = rows.filter((row) => {
    const validCandleTime = Number.isFinite(row.candleTime)
    const validBaseBucketSize = row.baseBucketSize > 0
    const validBucketPrice = Number.isFinite(row.bucketPrice)
    const validVolume = row.totalVol > 0
    const validTradeCount = row.tradeCount > 0
    return validCandleTime && validBaseBucketSize && validBucketPrice && validVolume && validTradeCount
  })

  if (storableRows.length === 0) return

  await withDbWriteRetry('Fine profile row batch write', async () => {
    await db.batch(
      storableRows.map((row) => ({
        sql: 'INSERT OR REPLACE INTO fine_profile_rows (symbol, contract_type, data_source_mode, timeframe, candle_time, base_bucket_size, bucket_price, bid_vol, ask_vol, total_vol, trade_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [symbol, contractType, dataSourceMode, timeframe, row.candleTime, row.baseBucketSize, row.bucketPrice, row.bidVol, row.askVol, row.totalVol, row.tradeCount],
      })),
      'write',
    )
  })
}

export async function getFineProfileRows(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  baseBucketSize: number,
) {
  const result = await db.execute({
    sql: `
      SELECT * FROM fine_profile_rows
      WHERE symbol = ? AND contract_type = ? AND data_source_mode = ? AND timeframe = ? AND candle_time >= ? AND candle_time < ? AND base_bucket_size = ?
      ORDER BY candle_time ASC, bucket_price ASC
    `,
    args: [symbol, contractType, dataSourceMode, timeframe, startTime, endTime, baseBucketSize],
  })
  return result.rows as unknown as FineProfileRow[]
}

import type { FootprintCell } from '../../../types/footprint'
import { db, withDbWriteRetry } from './dbSetup'

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
  delta: number
  stored_at: number
}

export interface FootprintCellWriteInput {
  bucketPrice: number
  bidVol: number
  askVol: number
}

export interface FootprintSnapshotInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  candleTime: number
  cells: FootprintCellWriteInput[]
  bucketSize: number
}

export async function insertFootprintBatch(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  cells: Map<number, FootprintCell>,
  bucketSize: number,
) {
  if (cells.size === 0) return
  await db.batch(
    Array.from(cells.entries()).map(([bucketPrice, cell]) => ({
      sql: 'INSERT OR REPLACE INTO footprint_cells (symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [symbol, contractType, dataSourceMode, timeframe, candleTime, bucketPrice, bucketSize, cell.bidVol, cell.askVol, cell.askVol - cell.bidVol],
    })),
    'write',
  )
}

export async function persistFootprintSnapshot({
  symbol,
  contractType,
  dataSourceMode,
  timeframe,
  candleTime,
  cells,
  bucketSize,
}: FootprintSnapshotInput) {
  if (cells.length === 0) return
  await withDbWriteRetry('Footprint snapshot write', async () => {
    await db.batch(
      cells.map((cell) => ({
        sql: 'INSERT OR REPLACE INTO footprint_cells (symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [symbol, contractType, dataSourceMode, timeframe, candleTime, cell.bucketPrice, bucketSize, cell.bidVol, cell.askVol, cell.askVol - cell.bidVol],
      })),
      'write',
    )
  })
}

export async function getFootprintCellsForRange(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  bucketSize: number,
): Promise<FootprintCellRow[]>
export async function getFootprintCellsForRange(
  symbol: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  bucketSize: number,
): Promise<FootprintCellRow[]>
export async function getFootprintCellsForRange(
  arg1: string,
  arg2: string,
  arg3: string | number,
  arg4: string | number,
  arg5: number,
  arg6?: number,
  arg7?: number,
): Promise<FootprintCellRow[]> {
  let symbol: string
  let contractType: string
  let dataSourceMode: string
  let timeframe: string
  let startTime: number
  let endTime: number
  let bucketSize: number

  if (typeof arg3 === 'number') {
    symbol = arg1
    contractType = 'spot'
    dataSourceMode = 'direct'
    timeframe = arg2
    startTime = arg3
    endTime = arg4 as number
    bucketSize = arg5
  } else {
    symbol = arg1
    contractType = arg2
    dataSourceMode = arg3 as string
    timeframe = arg4 as string
    startTime = arg5
    endTime = arg6!
    bucketSize = arg7!
  }

  const result = await db.execute({
    sql: `
      SELECT * FROM footprint_cells
      WHERE symbol = ? AND contract_type = ? AND data_source_mode = ? AND timeframe = ? AND candle_time >= ? AND candle_time < ? AND bucket_size = ?
      ORDER BY candle_time ASC, bucket_price ASC
    `,
    args: [symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize],
  })
  return result.rows as unknown as FootprintCellRow[]
}

export async function getFootprintCells(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  bucketSize?: number,
): Promise<FootprintCellRow[]>
export async function getFootprintCells(
  symbol: string,
  timeframe: string,
  candleTime: number,
  bucketSize?: number,
): Promise<FootprintCellRow[]>
export async function getFootprintCells(
  arg1: string,
  arg2: string,
  arg3: string | number,
  arg4?: string | number,
  arg5?: number,
  arg6?: number,
): Promise<FootprintCellRow[]> {
  let symbol: string
  let contractType: string
  let dataSourceMode: string
  let timeframe: string
  let candleTime: number
  let bucketSize: number | undefined

  if (typeof arg3 === 'number') {
    symbol = arg1
    contractType = 'spot'
    dataSourceMode = 'direct'
    timeframe = arg2
    candleTime = arg3
    bucketSize = arg4 as number | undefined
  } else {
    symbol = arg1
    contractType = arg2
    dataSourceMode = arg3 as string
    timeframe = arg4 as string
    candleTime = arg5!
    bucketSize = arg6
  }

  const bucketFilter = bucketSize == null ? '' : 'AND bucket_size = ?'
  const args = bucketSize == null
    ? [symbol, contractType, dataSourceMode, timeframe, candleTime]
    : [symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize]

  const result = await db.execute({
    sql: `
      SELECT * FROM footprint_cells
      WHERE symbol = ? AND contract_type = ? AND data_source_mode = ? AND timeframe = ? AND candle_time = ?
      ${bucketFilter}
      ORDER BY bucket_price ASC
    `,
    args,
  })
  return result.rows as unknown as FootprintCellRow[]
}

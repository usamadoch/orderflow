'use server'

import { storeClosedCandle, storeFineProfileRows, storeRawTrades, type SerializedFootprintCell } from '../db/marketStorage'
import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import type { FineProfileRowWriteInput } from '../db/database'

export async function storeClosedCandleAction(
  symbol: string,
  timeframe: string,
  candle: Candle,
  cells: SerializedFootprintCell[],
  delta: number,
  buyVol: number,
  sellVol: number,
  bucketSize: number,
) {
  await storeClosedCandle(symbol, timeframe, candle, cells, delta, buyVol, sellVol, bucketSize)
}

export async function storeRawTradesAction(symbol: string, trades: Trade[]) {
  await storeRawTrades(symbol, trades)
}

export async function storeFineProfileRowsAction(
  symbol: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  await storeFineProfileRows(symbol, timeframe, rows)
}

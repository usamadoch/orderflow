'use server'

import { storeClosedCandle, storeRawTrades, type SerializedFootprintCell } from '../db/marketStorage'
import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'

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

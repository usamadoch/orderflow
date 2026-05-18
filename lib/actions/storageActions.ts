'use server'

import { storeClosedCandle, type SerializedFootprintCell } from '../db/marketStorage'
import type { Candle } from '../../types/candle'

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

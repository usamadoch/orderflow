'use server'

import { storeBaseFootprint, storeClosedCandle, storeFineProfileRows, storeRawTrades, type SerializedFootprintCell } from '../db/marketStorage'
import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import type { FineProfileRowWriteInput } from '../db/database'

export async function storeClosedCandleAction(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candle: Candle,
  cells: SerializedFootprintCell[],
  delta: number,
  buyVol: number,
  sellVol: number,
) {
  await storeClosedCandle(symbol, contractType, dataSourceMode, timeframe, candle, cells, delta, buyVol, sellVol)
}

export async function storeBaseFootprintAction(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  candleTime: number,
  cells: SerializedFootprintCell[],
) {
  await storeBaseFootprint(symbol, contractType, dataSourceMode, candleTime, cells)
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

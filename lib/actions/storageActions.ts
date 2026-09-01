'use server'

import { getMarketStorageAdapter } from '../db/storageAdapter'
import type { SerializedFootprintCell, FineProfileRowWriteInput } from '../db/storageAdapter'
import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'

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
  await getMarketStorageAdapter().storeClosedCandle({
    symbol,
    contractType,
    dataSourceMode,
    timeframe,
    candle,
    cells,
    delta,
    buyVol,
    sellVol,
  })
}

export async function storeBaseFootprintAction(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  candleTime: number,
  cells: SerializedFootprintCell[],
) {
  await getMarketStorageAdapter().storeBaseFootprint({
    symbol,
    contractType,
    dataSourceMode,
    candleTime,
    cells,
  })
}

export async function storeRawTradesAction(symbol: string, trades: Trade[]) {
  await getMarketStorageAdapter().storeRawTrades({ symbol, trades })
}

export async function storeFineProfileRowsAction(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  await getMarketStorageAdapter().storeFineProfileRows({
    symbol,
    contractType,
    dataSourceMode,
    timeframe,
    rows,
  })
}

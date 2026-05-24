'use server'

import { storeBaseFootprint, storeClosedCandle, storeFineProfileRows, storeRawTrades, type SerializedFootprintCell } from '../db/marketStorage'
import { getMarketDbDriver, getMarketStorageAdapter } from '../db/storageAdapter'
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
  if (getMarketDbDriver() === 'libsql') {
    if (contractType !== 'spot') return
    await storeClosedCandle(symbol, contractType, dataSourceMode, timeframe, candle, cells, delta, buyVol, sellVol)
    return
  }

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
  if (getMarketDbDriver() === 'libsql') {
    await storeBaseFootprint(symbol, contractType, dataSourceMode, candleTime, cells)
    return
  }

  await getMarketStorageAdapter().storeBaseFootprint({
    symbol,
    contractType,
    dataSourceMode,
    candleTime,
    cells,
  })
}

export async function storeRawTradesAction(symbol: string, trades: Trade[]) {
  await storeRawTrades(symbol, trades)
}

export async function storeFineProfileRowsAction(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  if (getMarketDbDriver() === 'libsql') {
    await storeFineProfileRows(symbol, contractType, dataSourceMode, timeframe, rows)
    return
  }

  await getMarketStorageAdapter().storeFineProfileRows({
    symbol,
    contractType,
    dataSourceMode,
    timeframe,
    rows,
  })
}

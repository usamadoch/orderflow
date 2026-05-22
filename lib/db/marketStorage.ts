import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import { BASE_FOOTPRINT_BUCKET_SIZE, BASE_FOOTPRINT_TIMEFRAME } from '../aggregation/engine'
import {
  insertFineProfileRows,
  insertRawTradeBatch,
  persistFootprintSnapshot,
  persistClosedCandleSnapshot,
  type FineProfileRowWriteInput,
} from './database'

export interface SerializedFootprintCell {
  bucketPrice: number
  bidVol: number
  askVol: number
}

export async function storeClosedCandle(
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
  try {
    if (!candle.isClosed) return

    await persistClosedCandleSnapshot({
      symbol,
      contractType,
      dataSourceMode,
      timeframe,
      candle,
      cells,
      delta,
      buyVol,
      sellVol,
      bucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
      storedAtIso: new Date().toISOString(),
    })

    console.log(
      `[Storage] ${symbol} ${timeframe} ${formatCandleTime(candle.time)} stored OHLCV${cells.length > 0 ? ` + ${cells.length} footprint cells, delta: ${formatSigned(delta)}` : ''}`,
    )
  } catch (error) {
    console.error(
      `[Storage] Failed to store full candle snapshot for ${symbol} ${timeframe} ${formatCandleTime(candle.time)} after retries:`,
      error,
    )
  }
}

export async function storeBaseFootprint(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  candleTime: number,
  cells: SerializedFootprintCell[],
) {
  try {
    if (cells.length === 0) return

    await persistFootprintSnapshot({
      symbol,
      contractType,
      dataSourceMode,
      timeframe: BASE_FOOTPRINT_TIMEFRAME,
      candleTime,
      cells,
      bucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
    })
  } catch (error) {
    console.error(
      `[Storage] Failed to store base footprint for ${symbol} ${contractType}/${dataSourceMode} ${formatCandleTime(candleTime)}:`,
      error,
    )
  }
}

export async function storeRawTrades(symbol: string, trades: Trade[]) {
  try {
    const storableTrades = trades.filter((trade) => Number.isFinite(trade.id))
    if (storableTrades.length === 0) return

    await insertRawTradeBatch(symbol, storableTrades)
  } catch (error) {
    console.error(`[Storage] Failed to store raw trades for ${symbol}:`, error)
  }
}

export async function storeFineProfileRows(
  symbol: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  try {
    if (rows.length === 0) return

    await insertFineProfileRows(symbol, timeframe, rows)
  } catch (error) {
    console.error(`[Storage] Failed to store fine profile rows for ${symbol} ${timeframe}:`, error)
  }
}

function formatCandleTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(11, 16)
}

function formatSigned(value: number) {
  const formatted = value.toFixed(1)
  return value > 0 ? `+${formatted}` : formatted
}

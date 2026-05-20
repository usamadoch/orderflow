import type { Candle } from '../../types/candle'
import type { Trade } from '../../types/trade'
import {
  insertFineProfileRows,
  insertRawTradeBatch,
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
  timeframe: string,
  candle: Candle,
  cells: SerializedFootprintCell[],
  delta: number,
  buyVol: number,
  sellVol: number,
  bucketSize: number,
) {
  try {
    if (!candle.isClosed) return

    if (cells.length === 0) {
      console.warn(`[Storage] ${symbol} ${timeframe} ${formatCandleTime(candle.time)} stored OHLCV with no footprint cells`)
    }

    await persistClosedCandleSnapshot({
      symbol,
      timeframe,
      candle,
      cells,
      delta,
      buyVol,
      sellVol,
      bucketSize,
      storedAtIso: new Date().toISOString(),
    })

    console.log(
      `[Storage] ${symbol} ${timeframe} ${formatCandleTime(candle.time)} stored - ${cells.length} cells, delta: ${formatSigned(delta)}`,
    )
  } catch (error) {
    console.error(
      `[Storage] Failed to store full candle snapshot for ${symbol} ${timeframe} ${formatCandleTime(candle.time)} after retries:`,
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

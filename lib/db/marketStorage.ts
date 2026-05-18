import type { Candle } from '../../types/candle'
import { persistClosedCandleSnapshot } from './database'

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

function formatCandleTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(11, 16)
}

function formatSigned(value: number) {
  const formatted = value.toFixed(1)
  return value > 0 ? `+${formatted}` : formatted
}

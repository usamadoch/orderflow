import type { Candle } from '../../types/candle'
import type { FootprintCell } from '../../types/footprint'
import {
  insertCandle,
  insertCandleDelta,
  insertFootprintBatch,
  updateMeta,
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

    await insertCandle(symbol, timeframe, candle)

    if (cells.length === 0) {
      console.warn(`[Storage] ${symbol} ${timeframe} ${formatCandleTime(candle.time)} stored OHLCV with no footprint cells`)
    } else {
      const cellMap = new Map<number, FootprintCell>(
        cells.map((cell) => [
          cell.bucketPrice,
          {
            bidVol: cell.bidVol,
            askVol: cell.askVol,
          },
        ]),
      )

      await insertFootprintBatch(symbol, timeframe, candle.time, cellMap, bucketSize)
      await insertCandleDelta(symbol, timeframe, candle.time, delta, buyVol, sellVol)
    }

    await updateMeta('last_candle_stored', new Date().toISOString())
    console.log(
      `[Storage] ${symbol} ${timeframe} ${formatCandleTime(candle.time)} stored - ${cells.length} cells, delta: ${formatSigned(delta)}`,
    )
  } catch (error) {
    console.error('[Storage] Failed to store closed candle:', error)
  }
}

function formatCandleTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(11, 16)
}

function formatSigned(value: number) {
  const formatted = value.toFixed(1)
  return value > 0 ? `+${formatted}` : formatted
}

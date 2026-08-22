import type { AbsorptionResult } from '../../types/absorption'
import type { Candle } from '../../types/candle'
import type { AggregationEngine } from '../aggregation/engine'
import { scoreCandle } from './absorptionScorer'

const LOOKBACK = 20

export function detectAbsorption(
  candles: Candle[],
  engine: AggregationEngine,
): Map<number, AbsorptionResult> {
  const map = new Map<number, AbsorptionResult>()
  if (candles.length < 5) return map

  for (let i = 4; i < candles.length; i++) {
    const candle = candles[i]
    const windowStart = Math.max(0, i - LOOKBACK)
    const recentCandles = candles.slice(windowStart, i)
    const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time))
    const footprint = engine.getFootprintCandle(candle.time)

    const result = scoreCandle(candle, footprint, recentCandles, recentFootprints)
    if (result) {
      map.set(candle.time, result)
    }
  }

  return map
}

export const buildAbsorptionMap = detectAbsorption

export function updateAbsorptionForLastCandle(
  candles: Candle[],
  engine: AggregationEngine,
  existingMap: Map<number, AbsorptionResult>,
): Map<number, AbsorptionResult> {
  if (candles.length < 5) return existingMap

  const lastCandle = candles[candles.length - 1]
  const windowStart = Math.max(0, candles.length - 1 - LOOKBACK)
  const recentCandles = candles.slice(windowStart, candles.length - 1)
  const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time))
  const footprint = engine.getFootprintCandle(lastCandle.time)

  const result = scoreCandle(lastCandle, footprint, recentCandles, recentFootprints)
  const newMap = new Map(existingMap)

  if (result) {
    newMap.set(lastCandle.time, result)
  } else {
    newMap.delete(lastCandle.time)
  }

  return newMap
}

export const scoreLatestCandle = updateAbsorptionForLastCandle

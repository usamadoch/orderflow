import type { AbsorptionResult } from '../../types/absorption'
import type { ExhaustionResult } from '../../types/exhaustion'
import type { Candle } from '../../types/candle'
import type { AggregationEngine } from '../aggregation/engine'
import { scoreExhaustionCandle } from './exhaustionScorer'

const DEFAULT_LOOKBACK = 20

export function detectExhaustion(
  candles: Candle[],
  engine: AggregationEngine,
  _absorptionMap?: Map<number, AbsorptionResult>,
  lookback: number = DEFAULT_LOOKBACK,
): Map<number, ExhaustionResult> {
  const map = new Map<number, ExhaustionResult>()
  if (candles.length < 5) return map

  const lookbackWindow = Math.max(5, Math.min(50, Math.round(lookback)))

  for (let i = 4; i < candles.length; i++) {
    const candle = candles[i]
    const windowStart = Math.max(0, i - lookbackWindow)
    const recentCandles = candles.slice(windowStart, i)
    const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time))
    const footprint = engine.getFootprintCandle(candle.time)
    const nextCandles = candles.slice(i + 1, i + 3)

    const result = scoreExhaustionCandle(candle, footprint, recentCandles, recentFootprints, nextCandles)
    if (result) {
      map.set(candle.time, result)
    }
  }

  return map
}

export const buildExhaustionMap = detectExhaustion

export function updateExhaustionForLastCandle(
  candles: Candle[],
  engine: AggregationEngine,
  _absorptionMap?: Map<number, AbsorptionResult>,
  existingMap?: Map<number, ExhaustionResult>,
  lookback: number = DEFAULT_LOOKBACK,
): Map<number, ExhaustionResult> {
  if (candles.length < 5) return existingMap ?? new Map()

  const lastCandle = candles[candles.length - 1]
  const lookbackWindow = Math.max(5, Math.min(50, Math.round(lookback)))
  const windowStart = Math.max(0, candles.length - 1 - lookbackWindow)
  const recentCandles = candles.slice(windowStart, candles.length - 1)
  const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time))
  const footprint = engine.getFootprintCandle(lastCandle.time)

  const result = scoreExhaustionCandle(lastCandle, footprint, recentCandles, recentFootprints, [])
  const newMap = new Map(existingMap)

  if (result) {
    newMap.set(lastCandle.time, result)
  } else {
    newMap.delete(lastCandle.time)
  }

  return newMap
}

export const scoreLatestExhaustion = updateExhaustionForLastCandle

import type { Candle } from '../../types/candle'
import type { FootprintCandle } from '../../types/footprint'
import type { IcebergLevel } from '../../types/iceberg'
import type { AggregationEngine } from '../aggregation/engine'
import { clamp, evaluateIcebergLevel } from './icebergScorer'

const DEFAULT_LOOKBACK = 10
const MAX_RESULTS = 20

export class IcebergEngine {
  private bucketSize: number
  private lookbackWindow: number
  private levels: IcebergLevel[] = []

  constructor(bucketSize: number, lookbackWindow: number = DEFAULT_LOOKBACK) {
    this.bucketSize = bucketSize
    this.lookbackWindow = clamp(Math.round(lookbackWindow), 5, 20)
  }

  setBucketSize(bucketSize: number) {
    this.bucketSize = bucketSize
    this.reset()
  }

  setLookbackWindow(lookbackWindow: number) {
    this.lookbackWindow = clamp(Math.round(lookbackWindow), 5, 20)
  }

  getLookbackWindow(): number {
    return this.lookbackWindow
  }

  getBucketSize(): number {
    return this.bucketSize
  }

  analyzeLevel(
    bucketPrice: number,
    candles: Candle[],
    footprintCandles: (FootprintCandle | null)[],
    windowStart: number,
    windowEnd: number,
  ): IcebergLevel | null {
    return evaluateIcebergLevel(
      bucketPrice,
      this.bucketSize,
      this.lookbackWindow,
      candles,
      footprintCandles,
      windowStart,
      windowEnd,
    )
  }

  update(
    candles: Candle[],
    engine: AggregationEngine,
    visiblePriceMin?: number,
    visiblePriceMax?: number,
  ): IcebergLevel[] {
    this.levels = runFullAnalysis(candles, this, engine, visiblePriceMin, visiblePriceMax)
    return this.levels
  }

  getTopLevels(limit: number = MAX_RESULTS): IcebergLevel[] {
    return this.levels.slice(0, limit)
  }

  reset() {
    this.levels = []
  }
}

export function runFullAnalysis(
  candles: Candle[],
  icebergEngine: IcebergEngine,
  engine: AggregationEngine,
  visiblePriceMin?: number,
  visiblePriceMax?: number,
): IcebergLevel[] {
  if (candles.length === 0) return []

  const lookbackWindow = icebergEngine.getLookbackWindow()
  const windowEnd = candles.length
  const windowStart = Math.max(0, windowEnd - lookbackWindow)
  const windowCandles = candles.slice(windowStart, windowEnd)
  if (windowCandles.length < 3) return []

  const footprintCandles = candles.map((candle) => engine.getFootprintCandle(candle.time))
  const minPrice = visiblePriceMin ?? Math.min(...windowCandles.map((candle) => candle.low))
  const maxPrice = visiblePriceMax ?? Math.max(...windowCandles.map((candle) => candle.high))
  const bucketSize = icebergEngine.getBucketSize()
  const bucketStart = Math.floor(minPrice / bucketSize) * bucketSize
  const bucketEnd = Math.ceil(maxPrice / bucketSize) * bucketSize
  const results: IcebergLevel[] = []

  for (let price = bucketStart; price <= bucketEnd; price += bucketSize) {
    const result = icebergEngine.analyzeLevel(price, candles, footprintCandles, windowStart, windowEnd)
    if (result) results.push(result)
  }

  return results.sort((a, b) => b.score - a.score)
}

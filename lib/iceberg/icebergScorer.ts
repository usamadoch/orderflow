import type { IcebergLevel, IcebergRank, IcebergSide } from '../../types/iceberg'
import type { Candle } from '../../types/candle'
import type { FootprintCandle } from '../../types/footprint'
import { normalizePriceToBucket } from '../utils/aggregation'

const MIN_SCORE_THRESHOLD = 35

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function getRank(score: number): IcebergRank {
  if (score >= 75) return 'confirmed'
  if (score >= 55) return 'probable'
  return 'suspected'
}

export function scoreByThresholds(value: number, thresholds: Array<[number, number]>): number {
  let score = 0
  for (const [threshold, points] of thresholds) {
    if (value > threshold) score = points
  }
  return score
}

export function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

export function getAverageBucketVolume(footprints: FootprintCandle[], lookbackWindow: number): number {
  let totalVolume = 0
  let nonEmptyCells = 0

  for (const footprint of footprints) {
    for (const cell of footprint.cells.values()) {
      const volume = cell.askVol + cell.bidVol
      if (volume > 0) {
        totalVolume += volume
        nonEmptyCells++
      }
    }
  }

  if (nonEmptyCells === 0 || lookbackWindow <= 0) return 0
  return totalVolume / nonEmptyCells
}

export function evaluateIcebergLevel(
  bucketPrice: number,
  bucketSize: number,
  lookbackWindow: number,
  candles: Candle[],
  footprintCandles: (FootprintCandle | null)[],
  windowStart: number,
  windowEnd: number,
): IcebergLevel | null {
  const windowCandles = candles.slice(windowStart, windowEnd)
  const windowFootprints = footprintCandles.slice(windowStart, windowEnd)
  const avgBucketVolume = getAverageBucketVolume(
    footprintCandles.filter((fp): fp is FootprintCandle => fp !== null),
    lookbackWindow,
  )

  let totalBidVol = 0
  let totalAskVol = 0
  let candleCount = 0
  let visitCount = 0
  let recentVisitCount = 0
  const visitedVolumes: number[] = []

  for (let i = 0; i < windowCandles.length; i++) {
    const candle = windowCandles[i]
    const footprint = windowFootprints[i]
    const visited = candle.low <= bucketPrice + bucketSize && candle.high >= bucketPrice

    if (visited) {
      visitCount++
      if (i >= Math.max(0, windowCandles.length - 3)) recentVisitCount++
    }

    const normalizedPrice = normalizePriceToBucket(bucketPrice, bucketSize)
    const cell = footprint?.cells.get(normalizedPrice)
    const volume = cell ? cell.askVol + cell.bidVol : 0
    if (visited && footprint && footprint.cells.size > 0) {
      visitedVolumes.push(volume)
    }
    if (!cell || volume <= 0) continue

    totalBidVol += cell.bidVol
    totalAskVol += cell.askVol
    candleCount++
  }

  const totalVolume = totalBidVol + totalAskVol
  if (totalVolume <= 0 || visitCount < 3) return null

  const cumulativeDelta = totalAskVol - totalBidVol
  const dominantVol = Math.max(totalAskVol, totalBidVol)
  const side: IcebergSide = totalAskVol >= totalBidVol ? 'bid_defense' : 'ask_defense'
  const avgVolumePerCandle = candleCount > 0 ? totalVolume / candleCount : 0
  const reasons: string[] = []

  const accumulationRatio = avgBucketVolume > 0 ? totalVolume / (avgBucketVolume * lookbackWindow) : 0
  const s1 = scoreByThresholds(accumulationRatio, [[2, 12], [4, 20], [6, 25]])
  if (s1 > 0) reasons.push(`Volume accumulation ${accumulationRatio.toFixed(1)}x average`)

  const dominanceRatio = dominantVol / totalVolume
  const s2 = scoreByThresholds(dominanceRatio, [[0.65, 10], [0.75, 18], [0.85, 25]])
  if (s2 > 0) {
    const dominantLabel = totalAskVol >= totalBidVol ? 'ask' : 'bid'
    reasons.push(`Side consistency ${(dominanceRatio * 100).toFixed(0)}% ${dominantLabel} volume`)
  }

  const visitRatio = visitCount / Math.max(1, lookbackWindow)
  const s3 = scoreByThresholds(visitRatio, [[0.5, 8], [0.7, 14], [0.9, 20]])
  if (s3 > 0) reasons.push(`Price persistence ${visitCount}/${lookbackWindow} candles`)

  const neutralizationRatio = 1 - Math.abs(cumulativeDelta) / totalVolume
  const s4 = scoreByThresholds(neutralizationRatio, [[0.7, 8], [0.85, 14], [0.95, 20]])
  if (s4 > 0) reasons.push(`Delta neutralization ${(neutralizationRatio * 100).toFixed(0)}%`)

  let s5 = 0
  if (visitCount >= 5) {
    const mean = visitedVolumes.reduce((sum, value) => sum + value, 0) / visitedVolumes.length
    const cv = mean > 0 ? standardDeviation(visitedVolumes, mean) / mean : Number.POSITIVE_INFINITY
    s5 = cv < 0.3 ? 10 : cv < 0.5 ? 6 : 0
    if (s5 > 0) reasons.push(`Volume stability CV ${cv.toFixed(2)}`)
  } else {
    reasons.push('Volume stability: N/A (insufficient visits)')
  }

  const score = clamp(s1 + s2 + s3 + s4 + s5, 0, 100)
  if (score < MIN_SCORE_THRESHOLD) return null

  return {
    price: bucketPrice,
    side,
    score,
    rank: getRank(score),
    provisional: windowCandles.some((candle) => !candle.isClosed),
    totalVolume,
    candleCount,
    avgVolumePerCandle,
    cumulativeDelta,
    windowStartIndex: windowStart,
    windowEndIndex: windowEnd - 1,
    reasons,
    signals: {
      volumeAccumulation: s1,
      sideConsistency: s2,
      pricePersistence: s3,
      deltaNeutralization: s4,
      volumeStability: s5,
    },
    detectedAt: Date.now(),
    isActive: recentVisitCount > 0,
  }
}

import type { AggregationEngine } from '../aggregation/engine'
import { normalizePriceToBucket } from '../utils/aggregation'
import type { Candle } from '../../types/candle'
import type { FootprintCandle } from '../../types/footprint'
import type {
  LiquidityVacuumAnchor,
  LiquidityVacuumDirection,
  LiquidityVacuumRank,
  LiquidityVacuumZone,
} from '../../types/liquidityVacuum'

export interface SegmentStats {
  totalVolume: number
  bidVol: number
  askVol: number
  delta: number
  activeLevels: number
  expectedLevels: number
  hasFootprint: boolean
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getRank(score: number): LiquidityVacuumRank {
  if (score >= 80) return 'strong'
  if (score >= 65) return 'probable'
  return 'weak'
}

export function getFootprintVolume(footprint: FootprintCandle | null) {
  if (!footprint || footprint.cells.size === 0) {
    return { bidVol: 0, askVol: 0, totalVolume: 0, delta: 0, activeLevels: 0 }
  }
  let bidVol = 0
  let askVol = 0
  let activeLevels = 0

  footprint.cells.forEach((cell) => {
    const total = cell.bidVol + cell.askVol
    if (total > 0) activeLevels += 1
    bidVol += cell.bidVol
    askVol += cell.askVol
  })

  return {
    bidVol,
    askVol,
    totalVolume: bidVol + askVol,
    delta: askVol - bidVol,
    activeLevels,
  }
}

export function getAnchor(
  candle: Candle,
  index: number,
  engine: AggregationEngine,
): LiquidityVacuumAnchor {
  const fp = engine.getFootprintCandle(candle.time)
  const footprintVolume = getFootprintVolume(fp)

  return {
    index,
    candleTime: candle.time,
    priceLow: candle.low,
    priceHigh: candle.high,
    volume: footprintVolume.totalVolume || candle.volume,
    delta: footprintVolume.delta,
  }
}

export function getBaseline(candles: Candle[], engine: AggregationEngine, endIndex: number, lookback: number) {
  const start = Math.max(0, endIndex - lookback)
  const window = candles.slice(start, endIndex)
  if (window.length === 0) {
    return {
      avgRange: 0,
      avgVolume: 0,
      avgVolumePerRange: 0,
      avgActiveLevels: 0,
    }
  }

  let rangeSum = 0
  let volumeSum = 0
  let activeLevelSum = 0
  let footprintCount = 0

  for (const candle of window) {
    const range = Math.max(0, candle.high - candle.low)
    const fpStats = getFootprintVolume(engine.getFootprintCandle(candle.time))
    const volume = fpStats.totalVolume || candle.volume

    rangeSum += range
    volumeSum += volume
    if (fpStats.activeLevels > 0) {
      activeLevelSum += fpStats.activeLevels
      footprintCount += 1
    }
  }

  const avgRange = rangeSum / window.length
  const avgVolume = volumeSum / window.length

  return {
    avgRange,
    avgVolume,
    avgVolumePerRange: rangeSum > 0 ? volumeSum / rangeSum : 0,
    avgActiveLevels: footprintCount > 0 ? activeLevelSum / footprintCount : 0,
  }
}

export function getSegmentStats(
  segment: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  priceLow: number,
  priceHigh: number,
): SegmentStats {
  const levelVolumes = new Map<number, number>()
  let bidVol = 0
  let askVol = 0
  let fallbackVolume = 0
  let hasFootprint = false

  for (const candle of segment) {
    fallbackVolume += candle.volume
    const fp = engine.getFootprintCandle(candle.time)
    if (!fp || fp.cells.size === 0) continue

    hasFootprint = true
    fp.cells.forEach((cell, price) => {
      if (price < priceLow || price > priceHigh) return
      const total = cell.bidVol + cell.askVol
      if (total <= 0) return
      bidVol += cell.bidVol
      askVol += cell.askVol
      levelVolumes.set(price, (levelVolumes.get(price) ?? 0) + total)
    })
  }

  const normalizedLow = normalizePriceToBucket(priceLow, bucketSize)
  const normalizedHigh = normalizePriceToBucket(priceHigh, bucketSize)
  const expectedLevels = Math.max(1, Math.round((normalizedHigh - normalizedLow) / bucketSize) + 1)

  return {
    totalVolume: hasFootprint ? bidVol + askVol : fallbackVolume,
    bidVol,
    askVol,
    delta: askVol - bidVol,
    activeLevels: levelVolumes.size,
    expectedLevels,
    hasFootprint,
  }
}

export function scoreFastMovement(speedRatio: number, bodyEfficiency: number, reasons: string[]) {
  let score = 0
  if (speedRatio >= 2.5) {
    score = 25
    reasons.push(`Very fast auction move (${speedRatio.toFixed(1)}x range pace)`)
  } else if (speedRatio >= 1.8) {
    score = 18
    reasons.push(`Fast auction move (${speedRatio.toFixed(1)}x range pace)`)
  } else if (speedRatio >= 1.25) {
    score = 10
    reasons.push(`Elevated movement pace (${speedRatio.toFixed(1)}x range pace)`)
  }

  if (bodyEfficiency >= 0.65) {
    score += 5
    reasons.push(`Directional body efficiency ${(bodyEfficiency * 100).toFixed(0)}%`)
  }

  return clamp(score, 0, 30)
}

export function scoreLowParticipation(participationRatio: number, reasons: string[]) {
  if (participationRatio <= 0) return 0
  if (participationRatio <= 0.45) {
    reasons.push(`Low volume participation (${(participationRatio * 100).toFixed(0)}% of baseline)`)
    return 30
  }
  if (participationRatio <= 0.65) {
    reasons.push(`Subdued participation (${(participationRatio * 100).toFixed(0)}% of baseline)`)
    return 20
  }
  if (participationRatio <= 0.85) {
    reasons.push(`Slightly thin participation (${(participationRatio * 100).toFixed(0)}% of baseline)`)
    return 10
  }
  return 0
}

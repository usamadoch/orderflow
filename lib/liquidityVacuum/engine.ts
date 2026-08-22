import type { AggregationEngine } from '../aggregation/engine'
import { normalizePriceToBucket } from '../utils/aggregation'
import type { Candle } from '../../types/candle'
import type {
  LiquidityVacuumAnchor,
  LiquidityVacuumDirection,
  LiquidityVacuumZone,
} from '../../types/liquidityVacuum'
import {
  clamp,
  getAnchor,
  getBaseline,
  getRank,
  getSegmentStats,
  scoreFastMovement,
  scoreLowParticipation,
} from './vacuumDetector'

interface LiquidityVacuumOptions {
  minScore?: number
  maxZones?: number
  lookback?: number
}

const DEFAULT_LOOKBACK = 20
const MAX_SEGMENT_CANDLES = 4
const MIN_INTERNAL_SCORE = 40

function scoreThinStructure(thinProfileRatio: number, hasFootprint: boolean, reasons: string[]) {
  if (!hasFootprint) return 0
  if (thinProfileRatio <= 0.35) {
    reasons.push(`Thin footprint structure (${(thinProfileRatio * 100).toFixed(0)}% level coverage)`)
    return 20
  }
  if (thinProfileRatio <= 0.5) {
    reasons.push(`Patchy footprint structure (${(thinProfileRatio * 100).toFixed(0)}% level coverage)`)
    return 14
  }
  if (thinProfileRatio <= 0.7) {
    reasons.push(`Below-normal level coverage (${(thinProfileRatio * 100).toFixed(0)}%)`)
    return 7
  }
  return 0
}

function scoreDeltaImbalance(
  deltaImbalanceRatio: number,
  direction: LiquidityVacuumDirection,
  reasons: string[],
) {
  if (deltaImbalanceRatio >= 0.6) {
    reasons.push(`One-sided ${direction === 'up' ? 'buy' : 'sell'} flow with weak opposing participation`)
    return 15
  }
  if (deltaImbalanceRatio >= 0.4) {
    reasons.push(`Directional delta imbalance (${deltaImbalanceRatio.toFixed(2)})`)
    return 10
  }
  if (deltaImbalanceRatio >= 0.25) {
    return 5
  }
  return 0
}

function scoreActiveAnchors(
  before: LiquidityVacuumAnchor,
  after: LiquidityVacuumAnchor,
  avgVolume: number,
  reasons: string[],
) {
  if (avgVolume <= 0) return 0
  const beforeRatio = before.volume / avgVolume
  const afterRatio = after.volume / avgVolume
  const weaker = Math.min(beforeRatio, afterRatio)

  if (weaker >= 1.2) {
    reasons.push(`High-volume anchors on both sides (${beforeRatio.toFixed(1)}x / ${afterRatio.toFixed(1)}x)`)
    return 15
  }
  if (weaker >= 0.9) {
    reasons.push(`Active participation zones bracket the move`)
    return 11
  }
  if (beforeRatio >= 1.1 || afterRatio >= 1.1) {
    return 6
  }
  return 0
}

function hasRevisited(candles: Candle[], zone: Pick<LiquidityVacuumZone, 'endIndex' | 'priceLow' | 'priceHigh'>) {
  for (let i = zone.endIndex + 1; i < candles.length; i++) {
    const candle = candles[i]
    if (candle.high >= zone.priceLow && candle.low <= zone.priceHigh) {
      return true
    }
  }
  return false
}

function buildCandidate(
  candles: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  startIndex: number,
  endIndex: number,
  lookback: number,
): LiquidityVacuumZone | null {
  if (startIndex <= 0 || endIndex >= candles.length || bucketSize <= 0) return null

  const segment = candles.slice(startIndex, endIndex + 1)
  const first = segment[0]
  const last = segment[segment.length - 1]
  const direction: LiquidityVacuumDirection = last.close >= first.open ? 'up' : 'down'
  const directionSign = direction === 'up' ? 1 : -1
  const directionalMove = directionSign * (last.close - first.open)
  if (directionalMove <= 0) return null

  const beforeIndex = startIndex - 1
  const afterIndex = Math.min(candles.length - 1, endIndex + 1)
  if (afterIndex <= endIndex) return null

  const priceLow = Math.min(...segment.map((candle) => candle.low))
  const priceHigh = Math.max(...segment.map((candle) => candle.high))
  const travelledRange = Math.max(bucketSize, priceHigh - priceLow)
  const bodyEfficiency = directionalMove / travelledRange
  if (bodyEfficiency < 0.45) return null

  const baseline = getBaseline(candles, engine, startIndex, lookback)
  if (baseline.avgRange <= 0 || baseline.avgVolume <= 0) return null

  const speedRatio = directionalMove / Math.max(bucketSize, baseline.avgRange * segment.length)
  if (speedRatio < 1.15) return null

  const stats = getSegmentStats(segment, engine, bucketSize, priceLow, priceHigh)
  if (stats.totalVolume <= 0) return null

  const currentVolumePerRange = stats.totalVolume / travelledRange
  const participationRatio = baseline.avgVolumePerRange > 0
    ? currentVolumePerRange / baseline.avgVolumePerRange
    : 1
  const thinProfileRatio = stats.hasFootprint
    ? stats.activeLevels / Math.max(1, stats.expectedLevels)
    : 1
  const directionalDelta = directionSign * stats.delta
  const deltaImbalanceRatio = stats.totalVolume > 0
    ? Math.max(0, directionalDelta) / stats.totalVolume
    : 0
  const beforeAnchor = getAnchor(candles[beforeIndex], beforeIndex, engine)
  const afterAnchor = getAnchor(candles[afterIndex], afterIndex, engine)

  const reasons: string[] = []
  const signals = {
    fastMovement: scoreFastMovement(speedRatio, bodyEfficiency, reasons),
    lowParticipation: scoreLowParticipation(participationRatio, reasons),
    thinStructure: scoreThinStructure(thinProfileRatio, stats.hasFootprint, reasons),
    deltaImbalance: scoreDeltaImbalance(deltaImbalanceRatio, direction, reasons),
    activeAnchors: scoreActiveAnchors(beforeAnchor, afterAnchor, baseline.avgVolume, reasons),
  }
  const score = clamp(
    signals.fastMovement +
    signals.lowParticipation +
    signals.thinStructure +
    signals.deltaImbalance +
    signals.activeAnchors,
    0,
    100,
  )

  if (score < MIN_INTERNAL_SCORE || signals.activeAnchors === 0) return null

  const provisional = segment.some((candle) => !candle.isClosed) || !candles[afterIndex].isClosed
  const zoneBase = {
    endIndex: afterIndex,
    priceLow,
    priceHigh,
  }
  const revisited = hasRevisited(candles, zoneBase)
  const lastCandle = candles[candles.length - 1]
  const latestTouchesZone = lastCandle.high >= priceLow && lastCandle.low <= priceHigh

  return {
    id: `${candles[startIndex].time}:${candles[endIndex].time}:${direction}:${normalizePriceToBucket(priceLow, bucketSize)}`,
    direction,
    rank: getRank(score),
    score,
    startIndex,
    endIndex: afterIndex,
    startTime: candles[startIndex].time,
    endTime: candles[afterIndex].time,
    priceLow,
    priceHigh,
    anchorBefore: beforeAnchor,
    anchorAfter: afterAnchor,
    speedRatio,
    participationRatio,
    thinProfileRatio,
    deltaImbalanceRatio,
    reasons,
    signals,
    detectedAt: candles[afterIndex].time * 1000,
    provisional,
    isActive: !revisited || latestTouchesZone,
    revisited,
  }
}

function overlaps(a: LiquidityVacuumZone, b: LiquidityVacuumZone) {
  const timeOverlap = a.startIndex <= b.endIndex && b.startIndex <= a.endIndex
  const priceOverlap = a.priceLow <= b.priceHigh && b.priceLow <= a.priceHigh
  return timeOverlap && priceOverlap
}

export function buildLiquidityVacuumZones(
  candles: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  options: LiquidityVacuumOptions = {},
): LiquidityVacuumZone[] {
  if (candles.length < DEFAULT_LOOKBACK / 2 || bucketSize <= 0) return []

  const lookback = Math.max(8, options.lookback ?? DEFAULT_LOOKBACK)
  const minScore = options.minScore ?? MIN_INTERNAL_SCORE
  const maxZones = Math.max(1, options.maxZones ?? 6)
  const candidates: LiquidityVacuumZone[] = []

  for (let endIndex = 2; endIndex < candles.length - 1; endIndex++) {
    for (let length = 1; length <= MAX_SEGMENT_CANDLES; length++) {
      const startIndex = endIndex - length + 1
      if (startIndex <= 0) continue

      const zone = buildCandidate(candles, engine, bucketSize, startIndex, endIndex, lookback)
      if (zone && zone.score >= minScore) {
        candidates.push(zone)
      }
    }
  }

  const selected: LiquidityVacuumZone[] = []
  const ranked = candidates.sort((a, b) => {
    const aPriority = a.score + a.endIndex * 0.03
    const bPriority = b.score + b.endIndex * 0.03
    return bPriority - aPriority
  })

  for (const candidate of ranked) {
    if (selected.some((zone) => overlaps(zone, candidate))) continue
    selected.push(candidate)
    if (selected.length >= maxZones) break
  }

  return selected.sort((a, b) => a.startIndex - b.startIndex)
}

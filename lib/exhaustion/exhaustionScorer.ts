import type { ExhaustionDirection, ExhaustionRank, ExhaustionResult } from '../../types/exhaustion'
import type { Candle } from '../../types/candle'
import type { FootprintCandle } from '../../types/footprint'
import { getRollingAverages } from '../utils/chartUtils'

const MIN_SCORE_THRESHOLD = 30

function getRank(score: number): ExhaustionRank {
  if (score >= 80) return 'extreme'
  if (score >= 65) return 'strong'
  if (score >= 50) return 'moderate'
  return 'weak'
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function scoreMomentumDecay(
  currentDelta: number,
  recentFootprints: (FootprintCandle | null)[],
  reasons: string[],
): number {
  const deltas = recentFootprints.map((fp) => (fp ? fp.delta : 0))
  const absDeltas = deltas.map(Math.abs)
  const currentAbsDelta = Math.abs(currentDelta)
  const sequence = [...absDeltas, currentAbsDelta]

  let decayCount = 0
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] < sequence[i - 1]) {
      decayCount++
    }
  }

  const firstAvg = (sequence[0] + sequence[1]) / 2
  const lastAvg = (sequence[sequence.length - 2] + sequence[sequence.length - 1]) / 2
  const overallDecay = lastAvg < firstAvg

  if (!overallDecay) return 0

  let pts = 0
  const maxDecay = sequence.length - 1
  if (decayCount >= maxDecay) {
    pts = 30
    reasons.push(`Perfect momentum decay over ${sequence.length} candles`)
  } else if (decayCount >= maxDecay - 1) {
    pts = 20
    reasons.push(`Momentum decay over ${maxDecay} candles`)
  } else if (decayCount >= maxDecay - 2) {
    pts = 10
    reasons.push(`Slight momentum decay over ${maxDecay - 1} candles`)
  }

  return pts
}

function scoreWeakContinuation(
  candle: Candle,
  footprint: FootprintCandle | null,
  avgAbsDelta: number,
  avgPriceMove: number,
  reasons: string[],
): number {
  if (avgAbsDelta === 0 || avgPriceMove === 0 || !footprint) return 0

  const deltaRatio = Math.abs(footprint.delta) / avgAbsDelta
  const priceMove = Math.abs(candle.close - candle.open)
  const continuationRatio = priceMove / avgPriceMove

  let pts = 0
  if (continuationRatio < 0.3 && deltaRatio > 0.8) {
    pts = 25
    reasons.push(`Extreme effort vs result (delta ${deltaRatio.toFixed(1)}x, move ${continuationRatio.toFixed(1)}x)`)
  } else if (continuationRatio < 0.5 && deltaRatio > 0.5) {
    pts = 15
    reasons.push(`Weak continuation (delta ${deltaRatio.toFixed(1)}x, move ${continuationRatio.toFixed(1)}x)`)
  }

  return pts
}

function scoreWickRejection(
  candle: Candle,
  direction: ExhaustionDirection,
  reasons: string[],
): number {
  const range = candle.high - candle.low
  if (range === 0) return 0

  let wick = 0
  if (direction === 'buyer') {
    wick = candle.high - Math.max(candle.open, candle.close)
  } else {
    wick = Math.min(candle.open, candle.close) - candle.low
  }

  const wickRatio = wick / range
  let pts = 0
  if (wickRatio > 0.5) {
    pts = 20
    reasons.push(`Extreme wick rejection (${(wickRatio * 100).toFixed(0)}%)`)
  } else if (wickRatio > 0.3) {
    pts = 10
    reasons.push(`Significant wick rejection (${(wickRatio * 100).toFixed(0)}%)`)
  }

  return pts
}

function scoreRangeShrink(
  candle: Candle,
  recentCandles: Candle[],
  _currentDelta: number,
  reasons: string[],
): number {
  const sequence = [...recentCandles, candle]
  const ranges = sequence.map((c) => c.high - c.low)

  const firstAvg = (ranges[0] + ranges[1]) / 2
  const lastAvg = (ranges[ranges.length - 2] + ranges[ranges.length - 1]) / 2

  if (firstAvg === 0) return 0
  const shrinkRatio = (firstAvg - lastAvg) / firstAvg

  let pts = 0
  if (shrinkRatio > 0.4) {
    pts = 15
    reasons.push(`Extreme range compression (${(shrinkRatio * 100).toFixed(0)}%)`)
  } else if (shrinkRatio > 0.2) {
    pts = 8
    reasons.push(`Range compression (${(shrinkRatio * 100).toFixed(0)}%)`)
  }

  return pts
}

function scoreImbalancesNoExtension(
  candle: Candle,
  footprint: FootprintCandle | null,
  nextCandles: Candle[],
  reasons: string[],
): number {
  if (!footprint || nextCandles.length === 0) return 0

  const direction = footprint.delta >= 0 ? 'buyer' : 'seller'
  const range = candle.high - candle.low
  if (range === 0) return 0

  let hasImbalanceAtExtreme = false
  if (direction === 'buyer') {
    const threshold = candle.high - range / 3
    for (const [price, cell] of footprint.cells) {
      if (price >= threshold) {
        if (cell.askVol / (cell.bidVol + 1) > 3) {
          hasImbalanceAtExtreme = true
          break
        }
      }
    }
  } else {
    const threshold = candle.low + range / 3
    for (const [price, cell] of footprint.cells) {
      if (price <= threshold) {
        if (cell.bidVol / (cell.askVol + 1) > 3) {
          hasImbalanceAtExtreme = true
          break
        }
      }
    }
  }

  if (!hasImbalanceAtExtreme) return 0

  let extended = false
  for (const nextCandle of nextCandles) {
    if (direction === 'buyer' && nextCandle.high > candle.high) {
      extended = true
      break
    }
    if (direction === 'seller' && nextCandle.low < candle.low) {
      extended = true
      break
    }
  }

  if (!extended) {
    reasons.push('Aggressive imbalances at extreme failed to break structure')
    return 10
  }

  return 0
}

export function scoreExhaustionCandle(
  candle: Candle,
  footprint: FootprintCandle | null,
  recentCandles: Candle[],
  recentFootprints: (FootprintCandle | null)[],
  nextCandles: Candle[],
): ExhaustionResult | null {
  if (recentCandles.length < 3 || !footprint) return null

  const delta = footprint.delta
  const direction: ExhaustionDirection = delta >= 0 ? 'buyer' : 'seller'

  let sameDirectionCount = 0
  for (let i = recentFootprints.length - 1; i >= 0; i--) {
    const fp = recentFootprints[i]
    if (!fp) break
    const prevDir = fp.delta >= 0 ? 'buyer' : 'seller'
    if (prevDir === direction) {
      sameDirectionCount++
    } else {
      break
    }
  }

  if (sameDirectionCount < 2) return null

  const { avgAbsDelta } = getRollingAverages(recentCandles, recentFootprints)
  const priceMoves = recentCandles.map((c) => Math.abs(c.close - c.open))
  const avgPriceMove = priceMoves.reduce((a, b) => a + b, 0) / (priceMoves.length || 1)

  const reasons: string[] = []
  const momentumPts = scoreMomentumDecay(delta, recentFootprints, reasons)
  const weakContinuationPts = scoreWeakContinuation(candle, footprint, avgAbsDelta, avgPriceMove, reasons)
  const wickPts = scoreWickRejection(candle, direction, reasons)
  const shrinkPts = scoreRangeShrink(candle, recentCandles, delta, reasons)
  const noExtPts = scoreImbalancesNoExtension(candle, footprint, nextCandles, reasons)

  const score = clamp(momentumPts + weakContinuationPts + wickPts + shrinkPts + noExtPts, 0, 100)
  if (score < MIN_SCORE_THRESHOLD) return null

  return {
    candleTime: candle.time,
    direction,
    rank: getRank(score),
    score,
    provisional: candle.isClosed === false,
    reasons,
    signals: {
      momentumDecay: momentumPts,
      weakContinuation: weakContinuationPts,
      wickRejection: wickPts,
      rangeShrink: shrinkPts,
      imbalanceNoExtension: noExtPts,
    },
  }
}

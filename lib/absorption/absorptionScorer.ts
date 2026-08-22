import type { AbsorptionDirection, AbsorptionRank, AbsorptionResult } from '../../types/absorption'
import type { Candle } from '../../types/candle'
import type { FootprintCandle } from '../../types/footprint'
import { getRollingAverages } from '../utils/chartUtils'

const MIN_SCORE_THRESHOLD = 40
const NEAR_ZERO_DELTA_FACTOR = 0.15

function getRank(score: number): AbsorptionRank {
  if (score >= 80) return 'extreme'
  if (score >= 60) return 'strong'
  return 'minor'
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function scoreDeltaExtremity(absDelta: number, avgAbsDelta: number, reasons: string[]): number {
  if (avgAbsDelta === 0) return 0
  const ratio = absDelta / avgAbsDelta
  let pts = 0
  if (ratio >= 3) {
    pts = 25
    reasons.push(`Extreme delta (${ratio.toFixed(1)}× average)`)
  } else if (ratio >= 2) {
    pts = 17
    reasons.push(`High delta (${ratio.toFixed(1)}× average)`)
  } else if (ratio >= 1.5) {
    pts = 10
    reasons.push(`Elevated delta (${ratio.toFixed(1)}× average)`)
  }
  return pts
}

function scoreVolumeExtremity(volume: number, avgVolume: number, reasons: string[]): number {
  if (avgVolume === 0) return 0
  const ratio = volume / avgVolume
  let pts = 0
  if (ratio >= 2.5) {
    pts = 15
    reasons.push(`Very high volume (${ratio.toFixed(1)}× average)`)
  } else if (ratio >= 2) {
    pts = 12
    reasons.push(`High volume (${ratio.toFixed(1)}× average)`)
  } else if (ratio >= 1.5) {
    pts = 7
    reasons.push(`Elevated volume (${ratio.toFixed(1)}× average)`)
  }
  return pts
}

function scorePoorProgression(candle: Candle, delta: number, reasons: string[]): number {
  const bodySize = Math.abs(candle.close - candle.open)
  const totalRange = candle.high - candle.low
  if (totalRange === 0) return 0

  let pts = 0
  const bodyRatio = bodySize / totalRange
  if (bodyRatio < 0.15) {
    pts += 20
    reasons.push(`Very tight body (${(bodyRatio * 100).toFixed(0)}% of range)`)
  } else if (bodyRatio < 0.3) {
    pts += 10
    reasons.push(`Small body (${(bodyRatio * 100).toFixed(0)}% of range)`)
  }

  const isSellAggression = delta < 0
  if (isSellAggression) {
    const lowerWick = Math.min(candle.open, candle.close) - candle.low
    const wickRatio = lowerWick / totalRange
    if (wickRatio > 0.6) {
      pts += 10
      reasons.push(`Lower wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`)
    } else if (wickRatio > 0.4) {
      pts += 5
      reasons.push(`Lower wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`)
    }
  } else {
    const upperWick = candle.high - Math.max(candle.open, candle.close)
    const wickRatio = upperWick / totalRange
    if (wickRatio > 0.6) {
      pts += 10
      reasons.push(`Upper wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`)
    } else if (wickRatio > 0.4) {
      pts += 5
      reasons.push(`Upper wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`)
    }
  }

  if (delta < 0 && candle.close >= candle.open) {
    pts += 5
    reasons.push('Price closed up despite sell aggression')
  } else if (delta > 0 && candle.close <= candle.open) {
    pts += 5
    reasons.push('Price closed down despite buy aggression')
  }

  return clamp(pts, 0, 30)
}

function scoreImbalanceCluster(
  footprint: FootprintCandle | null,
  delta: number,
  candle: Candle,
  reasons: string[],
): number {
  if (!footprint) return 0
  const levels = Array.from(footprint.cells.keys()).sort((a, b) => b - a)
  if (levels.length === 0) return 0

  let maxStackedAsk = 0
  let currentStackedAsk = 0
  let maxStackedBid = 0
  let currentStackedBid = 0

  for (const price of levels) {
    const cell = footprint.cells.get(price)
    if (!cell) continue
    const askVol = cell.askVol
    const bidVol = cell.bidVol
    const ratio = askVol / (bidVol + 1)

    if (ratio > 3) {
      currentStackedAsk++
      maxStackedAsk = Math.max(maxStackedAsk, currentStackedAsk)
      currentStackedBid = 0
    } else if (ratio < 0.33 && bidVol > 0) {
      currentStackedBid++
      maxStackedBid = Math.max(maxStackedBid, currentStackedBid)
      currentStackedAsk = 0
    } else {
      currentStackedAsk = 0
      currentStackedBid = 0
    }
  }

  let pts = 0
  const isSellAggression = delta < 0
  const totalRange = candle.high - candle.low

  if (isSellAggression) {
    const isOffLow = totalRange > 0 && candle.close > candle.low + (totalRange * 0.15)
    if (maxStackedBid >= 5 && isOffLow) {
      pts = 20
      reasons.push(`Extreme bid imbalance cluster (${maxStackedBid} levels)`)
    } else if (maxStackedBid >= 3 && isOffLow) {
      pts = 15
      reasons.push(`Bid imbalance cluster (${maxStackedBid} levels)`)
    }
  } else {
    const isOffHigh = totalRange > 0 && candle.close < candle.high - (totalRange * 0.15)
    if (maxStackedAsk >= 5 && isOffHigh) {
      pts = 20
      reasons.push(`Extreme ask imbalance cluster (${maxStackedAsk} levels)`)
    } else if (maxStackedAsk >= 3 && isOffHigh) {
      pts = 15
      reasons.push(`Ask imbalance cluster (${maxStackedAsk} levels)`)
    }
  }

  return pts
}

function scoreRepeatedDefense(
  footprint: FootprintCandle | null,
  delta: number,
  recentFootprints: (FootprintCandle | null)[],
  reasons: string[],
): number {
  if (!footprint) return 0
  const last5 = recentFootprints.slice(-5).filter((f) => f !== null) as FootprintCandle[]
  if (last5.length === 0) return 0

  const isSellAggression = delta < 0
  const avgCellVol = footprint.cells.size > 0 ? footprint.volume / footprint.cells.size : 0
  const highVolThreshold = avgCellVol * 1.5
  let maxTimesDefended = 0

  for (const [price, cell] of footprint.cells.entries()) {
    const cellVol = cell.bidVol + cell.askVol
    if (cellVol < highVolThreshold || cellVol === 0) continue

    if (isSellAggression && cell.bidVol <= cell.askVol) continue
    if (!isSellAggression && cell.askVol <= cell.bidVol) continue

    let timesDefended = 0
    for (const prev of last5) {
      const prevCell = prev.cells.get(price)
      if (!prevCell) continue
      const prevAvgVol = prev.cells.size > 0 ? prev.volume / prev.cells.size : 0
      const prevVol = prevCell.bidVol + prevCell.askVol
      if (prevVol >= prevAvgVol) {
        timesDefended++
      }
    }
    maxTimesDefended = Math.max(maxTimesDefended, timesDefended)
  }

  let pts = 0
  if (maxTimesDefended >= 3) {
    pts = 10
    reasons.push(`Level defended repeatedly (${maxTimesDefended} recent candles)`)
  } else if (maxTimesDefended >= 2) {
    pts = 5
    reasons.push(`Level defended twice in recent candles`)
  }
  return pts
}

export function scoreCandle(
  candle: Candle,
  footprint: FootprintCandle | null,
  recentCandles: Candle[],
  recentFootprints: (FootprintCandle | null)[],
): AbsorptionResult | null {
  if (recentCandles.length < 5) return null

  const delta = footprint ? footprint.delta : 0
  const absDelta = Math.abs(delta)
  const volume = candle.volume
  const { avgAbsDelta, avgVolume } = getRollingAverages(recentCandles, recentFootprints)

  if (absDelta < avgAbsDelta * NEAR_ZERO_DELTA_FACTOR) return null

  const reasons: string[] = []
  const deltaPts = scoreDeltaExtremity(absDelta, avgAbsDelta, reasons)
  const volumePts = scoreVolumeExtremity(volume, avgVolume, reasons)
  const progressionPts = scorePoorProgression(candle, delta, reasons)
  const imbalancePts = scoreImbalanceCluster(footprint, delta, candle, reasons)
  const defensePts = scoreRepeatedDefense(footprint, delta, recentFootprints, reasons)

  const score = clamp(deltaPts + volumePts + progressionPts + imbalancePts + defensePts, 0, 100)
  if (score < MIN_SCORE_THRESHOLD) return null

  const direction: AbsorptionDirection = delta > 0 ? 'buyer' : 'seller'
  return {
    candleTime: candle.time,
    direction,
    rank: getRank(score),
    score,
    provisional: candle.isClosed === false,
    reasons,
    signals: {
      deltaExtremity: deltaPts,
      volumeExtremity: volumePts,
      poorProgression: progressionPts,
      imbalanceCluster: imbalancePts,
      repeatedDefense: defensePts,
    },
  }
}

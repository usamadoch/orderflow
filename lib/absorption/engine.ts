import { Candle } from '../../types/candle';
import { FootprintCandle } from '../../types/footprint';
import {
  AbsorptionResult,
  AbsorptionDirection,
  AbsorptionRank,
} from '../../types/absorption';
import { AggregationEngine } from '../aggregation/engine';

// ── Constants ─────────────────────────────────────────────
const LOOKBACK = 20;           // rolling window size for averages
const MIN_SCORE_THRESHOLD = 40; // below this we discard the result
const NEAR_ZERO_DELTA_FACTOR = 0.15; // delta below 15% of avg is "near-zero"

// ── Helpers ───────────────────────────────────────────────

function getRank(score: number): AbsorptionRank {
  if (score >= 80) return 'extreme';
  if (score >= 60) return 'strong';
  return 'minor';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Signal 1 — Delta Extremity (max 25 pts) ──────────────

function scoreDeltaExtremity(
  absDelta: number,
  avgAbsDelta: number,
  reasons: string[]
): number {
  if (avgAbsDelta === 0) return 0;
  const ratio = absDelta / avgAbsDelta;
  let pts = 0;
  if (ratio >= 3) {
    pts = 25;
    reasons.push(`Extreme delta (${ratio.toFixed(1)}× average)`);
  } else if (ratio >= 2) {
    pts = 17;
    reasons.push(`High delta (${ratio.toFixed(1)}× average)`);
  } else if (ratio >= 1.5) {
    pts = 10;
    reasons.push(`Elevated delta (${ratio.toFixed(1)}× average)`);
  }
  return pts;
}

// ── Signal 2 — Volume Extremity (max 15 pts) ─────────────

function scoreVolumeExtremity(
  volume: number,
  avgVolume: number,
  reasons: string[]
): number {
  if (avgVolume === 0) return 0;
  const ratio = volume / avgVolume;
  let pts = 0;
  if (ratio >= 2.5) {
    pts = 15;
    reasons.push(`Very high volume (${ratio.toFixed(1)}× average)`);
  } else if (ratio >= 2) {
    pts = 12;
    reasons.push(`High volume (${ratio.toFixed(1)}× average)`);
  } else if (ratio >= 1.5) {
    pts = 7;
    reasons.push(`Elevated volume (${ratio.toFixed(1)}× average)`);
  }
  return pts;
}

// ── Signal 3 — Poor Price Progression (max 30 pts) ───────

function scorePoorProgression(
  candle: Candle,
  delta: number,
  reasons: string[]
): number {
  const bodySize = Math.abs(candle.close - candle.open);
  const totalRange = candle.high - candle.low;

  if (totalRange === 0) return 0;

  let pts = 0;

  // Sub-check A: body-to-range ratio
  const bodyRatio = bodySize / totalRange;
  if (bodyRatio < 0.15) {
    pts += 20;
    reasons.push(`Very tight body (${(bodyRatio * 100).toFixed(0)}% of range)`);
  } else if (bodyRatio < 0.3) {
    pts += 10;
    reasons.push(`Small body (${(bodyRatio * 100).toFixed(0)}% of range)`);
  }

  // Sub-check B: wick rejection
  const isSellAggression = delta < 0;
  if (isSellAggression) {
    // Seller absorption: check lower wick (passive buyers rejected the low)
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const wickRatio = lowerWick / totalRange;
    if (wickRatio > 0.6) {
      pts += 10;
      reasons.push(`Lower wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`);
    } else if (wickRatio > 0.4) {
      pts += 5;
      reasons.push(`Lower wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`);
    }
  } else {
    // Buyer absorption: check upper wick (passive sellers rejected the high)
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const wickRatio = upperWick / totalRange;
    if (wickRatio > 0.6) {
      pts += 10;
      reasons.push(`Upper wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`);
    } else if (wickRatio > 0.4) {
      pts += 5;
      reasons.push(`Upper wick rejection (${(wickRatio * 100).toFixed(0)}% of range)`);
    }
  }

  // Sub-check C: price moved against the aggressor
  if (delta < 0 && candle.close >= candle.open) {
    pts += 5;
    reasons.push('Price closed up despite sell aggression');
  } else if (delta > 0 && candle.close <= candle.open) {
    pts += 5;
    reasons.push('Price closed down despite buy aggression');
  }

  return clamp(pts, 0, 30);
}

// ── Main Scoring Function ────────────────────────────────

export function scoreCandle(
  candle: Candle,
  footprint: FootprintCandle | null,
  recentCandles: Candle[],
  recentFootprints: (FootprintCandle | null)[]
): AbsorptionResult | null {
  // Need footprint data for delta
  const delta = footprint ? footprint.delta : 0;
  const absDelta = Math.abs(delta);

  // Compute rolling averages from the window
  let sumAbsDelta = 0;
  let sumVolume = 0;
  let count = 0;
  for (let i = 0; i < recentCandles.length; i++) {
    const fp = recentFootprints[i];
    sumAbsDelta += fp ? Math.abs(fp.delta) : 0;
    sumVolume += recentCandles[i].volume;
    count++;
  }
  const avgAbsDelta = count > 0 ? sumAbsDelta / count : 0;
  const avgVolume = count > 0 ? sumVolume / count : 0;

  // Skip if delta is near-zero relative to the average — ambiguous direction
  if (avgAbsDelta > 0 && absDelta < avgAbsDelta * NEAR_ZERO_DELTA_FACTOR) {
    return null;
  }

  const reasons: string[] = [];

  // ── Signals 1–3 ──
  const s1 = scoreDeltaExtremity(absDelta, avgAbsDelta, reasons);
  const s2 = scoreVolumeExtremity(candle.volume, avgVolume, reasons);
  const s3 = scorePoorProgression(candle, delta, reasons);

  // ── Signals 4 & 5 (not yet implemented) ──
  const s4 = 0;
  const s5 = 0;

  const rawScore = s1 + s2 + s3 + s4 + s5;
  const score = clamp(rawScore, 0, 100);

  if (score < MIN_SCORE_THRESHOLD) return null;

  // Direction: negative delta => sell aggression absorbed by passive buyers => "seller" absorption
  const direction: AbsorptionDirection = delta < 0 ? 'seller' : 'buyer';

  return {
    candleTime: candle.time,
    score,
    rank: getRank(score),
    direction,
    provisional: !candle.isClosed,
    reasons,
    signals: {
      deltaExtremity: s1,
      volumeExtremity: s2,
      poorProgression: s3,
      imbalanceCluster: s4,
      repeatedDefense: s5,
    },
  };
}

// ── Map Builder ──────────────────────────────────────────

export function buildAbsorptionMap(
  candles: Candle[],
  engine: AggregationEngine
): Map<number, AbsorptionResult> {
  const map = new Map<number, AbsorptionResult>();

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Build rolling window (up to LOOKBACK candles *before* this one)
    const windowStart = Math.max(0, i - LOOKBACK);
    const recentCandles = candles.slice(windowStart, i);
    const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time));

    const footprint = engine.getFootprintCandle(candle.time);
    const result = scoreCandle(candle, footprint, recentCandles, recentFootprints);
    if (result) {
      map.set(candle.time, result);
    }
  }

  return map;
}

// ── Incremental Scorer (for single candle updates) ──────

export function scoreLatestCandle(
  candles: Candle[],
  engine: AggregationEngine,
  existingMap: Map<number, AbsorptionResult>
): Map<number, AbsorptionResult> {
  if (candles.length === 0) return existingMap;

  const lastCandle = candles[candles.length - 1];

  // Build rolling window for the last candle
  const windowStart = Math.max(0, candles.length - 1 - LOOKBACK);
  const recentCandles = candles.slice(windowStart, candles.length - 1);
  const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time));

  const footprint = engine.getFootprintCandle(lastCandle.time);
  const result = scoreCandle(lastCandle, footprint, recentCandles, recentFootprints);

  const newMap = new Map(existingMap);
  if (result) {
    newMap.set(lastCandle.time, result);
  } else {
    // Remove any previous provisional result if score dropped below threshold
    newMap.delete(lastCandle.time);
  }

  return newMap;
}

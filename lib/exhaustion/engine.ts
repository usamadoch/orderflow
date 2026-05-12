import { Candle } from '../../types/candle';
import { FootprintCandle } from '../../types/footprint';
import {
  ExhaustionResult,
  ExhaustionDirection,
  ExhaustionRank,
} from '../../types/exhaustion';
import { AbsorptionResult } from '../../types/absorption';
import { AggregationEngine } from '../aggregation/engine';
import { getRollingAverages } from '../utils/chartUtils';

// ── Constants ─────────────────────────────────────────────
const MIN_SCORE_THRESHOLD = 30;

// ── Helpers ───────────────────────────────────────────────

function getRank(score: number): ExhaustionRank {
  if (score >= 80) return 'extreme';
  if (score >= 65) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Signal 1 — Momentum Decay (max 30 pts) ────────────────

function scoreMomentumDecay(
  currentDelta: number,
  recentFootprints: (FootprintCandle | null)[],
  reasons: string[]
): number {
  const deltas = recentFootprints.map(fp => fp ? fp.delta : 0);
  const absDeltas = deltas.map(Math.abs);
  const currentAbsDelta = Math.abs(currentDelta);
  const sequence = [...absDeltas, currentAbsDelta];

  // Perfect decay over 4-5 candles (sequence length 5 or 6)
  let decayCount = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] < sequence[i - 1]) {
      decayCount++;
    }
  }

  // Trend check: average of first two vs last two
  const firstAvg = (sequence[0] + sequence[1]) / 2;
  const lastAvg = (sequence[sequence.length - 2] + sequence[sequence.length - 1]) / 2;
  const overallDecay = lastAvg < firstAvg;

  if (!overallDecay) return 0;

  let pts = 0;
  const maxDecay = sequence.length - 1;
  if (decayCount >= maxDecay) {
    pts = 30;
    reasons.push(`Perfect momentum decay over ${sequence.length} candles`);
  } else if (decayCount >= maxDecay - 1) {
    pts = 20;
    reasons.push(`Momentum decay over ${maxDecay} candles`);
  } else if (decayCount >= maxDecay - 2) {
    pts = 10;
    reasons.push(`Slight momentum decay over ${maxDecay - 1} candles`);
  }

  return pts;
}

// ── Signal 2 — Weak Continuation (max 25 pts) ──────────────

function scoreWeakContinuation(
  candle: Candle,
  footprint: FootprintCandle | null,
  avgAbsDelta: number,
  avgPriceMove: number,
  reasons: string[]
): number {
  if (avgAbsDelta === 0 || avgPriceMove === 0 || !footprint) return 0;

  const deltaRatio = Math.abs(footprint.delta) / avgAbsDelta;
  const priceMove = Math.abs(candle.close - candle.open);
  const continuationRatio = priceMove / avgPriceMove;

  let pts = 0;
  if (continuationRatio < 0.3 && deltaRatio > 2) {
    pts = 25;
    reasons.push(`Extreme effort vs result (delta ${deltaRatio.toFixed(1)}x, move ${continuationRatio.toFixed(1)}x)`);
  } else if (continuationRatio < 0.5 && deltaRatio > 1.5) {
    pts = 15;
    reasons.push(`Weak continuation (delta ${deltaRatio.toFixed(1)}x, move ${continuationRatio.toFixed(1)}x)`);
  }

  return pts;
}

// ── Signal 3 — Wick Rejection Near Extreme (max 20 pts) ─────

function scoreWickRejection(
  candle: Candle,
  direction: ExhaustionDirection,
  reasons: string[]
): number {
  const range = candle.high - candle.low;
  if (range === 0) return 0;

  let wick = 0;
  if (direction === 'buyer') {
    wick = candle.high - Math.max(candle.open, candle.close);
  } else {
    wick = Math.min(candle.open, candle.close) - candle.low;
  }

  const wickRatio = wick / range;
  let pts = 0;
  if (wickRatio > 0.5) {
    pts = 20;
    reasons.push(`Extreme wick rejection (${(wickRatio * 100).toFixed(0)}%)`);
  } else if (wickRatio > 0.3) {
    pts = 10;
    reasons.push(`Significant wick rejection (${(wickRatio * 100).toFixed(0)}%)`);
  }

  return pts;
}

// ── Signal 4 — Range Shrink (max 15 pts) ────────────────────

function scoreRangeShrink(
  candle: Candle,
  recentCandles: Candle[],
  _currentDelta: number,
  reasons: string[]
): number {
  // All must be same direction in window (simplified: we only look at the ones provided)
  // Actually task says "last 4 candles with delta in same direction"
  // But we are passed last 5. 
  const sequence = [...recentCandles, candle];
  const ranges = sequence.map(c => c.high - c.low);

  const firstAvg = (ranges[0] + ranges[1]) / 2;
  const lastAvg = (ranges[ranges.length - 2] + ranges[ranges.length - 1]) / 2;

  if (firstAvg === 0) return 0;
  const shrinkRatio = (firstAvg - lastAvg) / firstAvg;

  let pts = 0;
  if (shrinkRatio > 0.4) {
    pts = 15;
    reasons.push(`Extreme range compression (${(shrinkRatio * 100).toFixed(0)}%)`);
  } else if (shrinkRatio > 0.2) {
    pts = 8;
    reasons.push(`Range compression (${(shrinkRatio * 100).toFixed(0)}%)`);
  }

  return pts;
}

// ── Signal 5 — Imbalances No Extension (max 10 pts) ────────

function scoreImbalancesNoExtension(
  candle: Candle,
  footprint: FootprintCandle | null,
  nextCandles: Candle[],
  reasons: string[]
): number {
  if (!footprint || nextCandles.length === 0) return 0;

  const direction = footprint.delta >= 0 ? 'buyer' : 'seller';
  const range = candle.high - candle.low;
  if (range === 0) return 0;

  let hasImbalanceAtExtreme = false;
  if (direction === 'buyer') {
    const threshold = candle.high - range / 3;
    for (const [price, cell] of footprint.cells) {
      if (price >= threshold) {
        if (cell.askVol / (cell.bidVol + 1) > 3) {
          hasImbalanceAtExtreme = true;
          break;
        }
      }
    }
  } else {
    const threshold = candle.low + range / 3;
    for (const [price, cell] of footprint.cells) {
      if (price <= threshold) {
        if (cell.bidVol / (cell.askVol + 1) > 3) {
          hasImbalanceAtExtreme = true;
          break;
        }
      }
    }
  }

  if (!hasImbalanceAtExtreme) return 0;

  // Check if next candles exceeded extreme
  let extended = false;
  for (const next of nextCandles) {
    if (direction === 'buyer') {
      if (next.high > candle.high) extended = true;
    } else {
      if (next.low < candle.low) extended = true;
    }
  }

  if (!extended) {
    reasons.push('Imbalances at extreme without price extension');
    return 10;
  }

  return 0;
}

// ── Main Scoring Function ──────────────────────────────────

export function scoreExhaustion(
  candle: Candle,
  footprint: FootprintCandle | null,
  recentCandles: Candle[],
  recentFootprints: (FootprintCandle | null)[],
  nextCandles: Candle[] = [],
  lookback: number = 5
): ExhaustionResult | null {
  if (!footprint || recentCandles.length < lookback) return null;

  const delta = footprint.delta;
  if (delta === 0) return null;

  const direction: ExhaustionDirection = delta > 0 ? 'buyer' : 'seller';
  const sign = delta > 0 ? 1 : -1;

  // Direction Classification: All candles in the window must have delta in the same direction
  // (or zero) as the current candle. Mixed direction = not exhaustion.
  const allSameDirection = recentFootprints.every(fp => !fp || fp.delta === 0 || Math.sign(fp.delta) === sign);
  if (!allSameDirection) return null;

  const { avgAbsDelta, avgPriceMove } = getRollingAverages(recentCandles, recentFootprints);

  const reasons: string[] = [];

  const s1 = scoreMomentumDecay(delta, recentFootprints, reasons);
  const s2 = scoreWeakContinuation(candle, footprint, avgAbsDelta, avgPriceMove, reasons);
  const s3 = scoreWickRejection(candle, direction, reasons);
  const s4 = scoreRangeShrink(candle, recentCandles, delta, reasons);
  const s5 = scoreImbalancesNoExtension(candle, footprint, nextCandles, reasons);

  const rawScore = s1 + s2 + s3 + s4 + s5;
  const score = clamp(rawScore, 0, 100);

  if (score < MIN_SCORE_THRESHOLD) return null;

  return {
    candleTime: candle.time,
    score,
    rank: getRank(score),
    direction,
    provisional: !candle.isClosed,
    reasons,
    signals: {
      momentumDecay: s1,
      weakContinuation: s2,
      wickRejection: s3,
      rangeShrink: s4,
      imbalanceNoExtension: s5,
    },
  };
}

// ── Map Builder ─────────────────────────────────────────────

export function buildExhaustionMap(
  candles: Candle[],
  engine: AggregationEngine,
  absorptionMap: Map<number, AbsorptionResult>,
  lookback: number = 5
): Map<number, ExhaustionResult> {
  const map = new Map<number, ExhaustionResult>();

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    
    // Skip if high-confidence absorption
    const absResult = absorptionMap.get(candle.time);
    if (absResult && absResult.score > 60) continue;

    // Window before
    const windowStart = Math.max(0, i - lookback);
    const recentCandles = candles.slice(windowStart, i);
    const recentFootprints = recentCandles.map(c => engine.getFootprintCandle(c.time));

    // Lookahead (Signal 5)
    const nextCandles = candles.slice(i + 1, i + 3);

    const footprint = engine.getFootprintCandle(candle.time);
    const result = scoreExhaustion(candle, footprint, recentCandles, recentFootprints, nextCandles, lookback);
    
    if (result) {
      map.set(candle.time, result);
    }
  }

  return map;
}

export function scoreLatestExhaustion(
  candles: Candle[],
  engine: AggregationEngine,
  absorptionMap: Map<number, AbsorptionResult>,
  existingMap: Map<number, ExhaustionResult>,
  lookback: number = 5
): Map<number, ExhaustionResult> {
  if (candles.length === 0) return existingMap;

  const lastIndex = candles.length - 1;
  const lastCandle = candles[lastIndex];

  // Skip if high-confidence absorption
  const absResult = absorptionMap.get(lastCandle.time);
  if (absResult && absResult.score > 60) {
    const newMap = new Map(existingMap);
    newMap.delete(lastCandle.time);
    return newMap;
  }

  // Window before
  const windowStart = Math.max(0, lastIndex - lookback);
  const recentCandles = candles.slice(windowStart, lastIndex);
  const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time));

  // Lookahead (Signal 5) - only possible if there are candles after (unlikely for latest but good for consistency)
  const nextCandles = candles.slice(lastIndex + 1, lastIndex + 3);

  const footprint = engine.getFootprintCandle(lastCandle.time);
  const result = scoreExhaustion(lastCandle, footprint, recentCandles, recentFootprints, nextCandles, lookback);

  const newMap = new Map(existingMap);
  if (result) {
    newMap.set(lastCandle.time, result);
  } else {
    newMap.delete(lastCandle.time);
  }

  return newMap;
}

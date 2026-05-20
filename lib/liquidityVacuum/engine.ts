import { AggregationEngine } from '@/lib/aggregation/engine';
import { normalizePriceToBucket } from '@/lib/utils/aggregation';
import { Candle } from '@/types/candle';
import { FootprintCandle } from '@/types/footprint';
import {
  LiquidityVacuumAnchor,
  LiquidityVacuumDirection,
  LiquidityVacuumRank,
  LiquidityVacuumZone,
} from '@/types/liquidityVacuum';

interface LiquidityVacuumOptions {
  minScore?: number;
  maxZones?: number;
  lookback?: number;
}

interface SegmentStats {
  totalVolume: number;
  bidVol: number;
  askVol: number;
  delta: number;
  activeLevels: number;
  expectedLevels: number;
  hasFootprint: boolean;
}

const DEFAULT_LOOKBACK = 20;
const MAX_SEGMENT_CANDLES = 4;
const MIN_INTERNAL_SCORE = 40;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getRank(score: number): LiquidityVacuumRank {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'probable';
  return 'weak';
}

function getFootprintVolume(footprint: FootprintCandle | null) {
  if (!footprint || footprint.cells.size === 0) {
    return { bidVol: 0, askVol: 0, totalVolume: 0, delta: 0, activeLevels: 0 };
  }

  let bidVol = 0;
  let askVol = 0;
  let activeLevels = 0;

  footprint.cells.forEach((cell) => {
    const total = cell.bidVol + cell.askVol;
    if (total > 0) activeLevels += 1;
    bidVol += cell.bidVol;
    askVol += cell.askVol;
  });

  return {
    bidVol,
    askVol,
    totalVolume: bidVol + askVol,
    delta: askVol - bidVol,
    activeLevels,
  };
}

function getAnchor(
  candle: Candle,
  index: number,
  engine: AggregationEngine
): LiquidityVacuumAnchor {
  const fp = engine.getFootprintCandle(candle.time);
  const footprintVolume = getFootprintVolume(fp);

  return {
    index,
    candleTime: candle.time,
    priceLow: candle.low,
    priceHigh: candle.high,
    volume: footprintVolume.totalVolume || candle.volume,
    delta: footprintVolume.delta,
  };
}

function getBaseline(candles: Candle[], engine: AggregationEngine, endIndex: number, lookback: number) {
  const start = Math.max(0, endIndex - lookback);
  const window = candles.slice(start, endIndex);
  if (window.length === 0) {
    return {
      avgRange: 0,
      avgVolume: 0,
      avgVolumePerRange: 0,
      avgActiveLevels: 0,
    };
  }

  let rangeSum = 0;
  let volumeSum = 0;
  let activeLevelSum = 0;
  let footprintCount = 0;

  for (const candle of window) {
    const range = Math.max(0, candle.high - candle.low);
    const fpStats = getFootprintVolume(engine.getFootprintCandle(candle.time));
    const volume = fpStats.totalVolume || candle.volume;

    rangeSum += range;
    volumeSum += volume;
    if (fpStats.activeLevels > 0) {
      activeLevelSum += fpStats.activeLevels;
      footprintCount += 1;
    }
  }

  const avgRange = rangeSum / window.length;
  const avgVolume = volumeSum / window.length;

  return {
    avgRange,
    avgVolume,
    avgVolumePerRange: rangeSum > 0 ? volumeSum / rangeSum : 0,
    avgActiveLevels: footprintCount > 0 ? activeLevelSum / footprintCount : 0,
  };
}

function getSegmentStats(
  segment: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  priceLow: number,
  priceHigh: number
): SegmentStats {
  const levelVolumes = new Map<number, number>();
  let bidVol = 0;
  let askVol = 0;
  let fallbackVolume = 0;
  let hasFootprint = false;

  for (const candle of segment) {
    fallbackVolume += candle.volume;
    const fp = engine.getFootprintCandle(candle.time);
    if (!fp || fp.cells.size === 0) continue;

    hasFootprint = true;
    fp.cells.forEach((cell, price) => {
      if (price < priceLow || price > priceHigh) return;

      const total = cell.bidVol + cell.askVol;
      if (total <= 0) return;

      bidVol += cell.bidVol;
      askVol += cell.askVol;
      levelVolumes.set(price, (levelVolumes.get(price) ?? 0) + total);
    });
  }

  const normalizedLow = normalizePriceToBucket(priceLow, bucketSize);
  const normalizedHigh = normalizePriceToBucket(priceHigh, bucketSize);
  const expectedLevels = Math.max(1, Math.round((normalizedHigh - normalizedLow) / bucketSize) + 1);

  return {
    totalVolume: hasFootprint ? bidVol + askVol : fallbackVolume,
    bidVol,
    askVol,
    delta: askVol - bidVol,
    activeLevels: levelVolumes.size,
    expectedLevels,
    hasFootprint,
  };
}

function scoreFastMovement(
  speedRatio: number,
  bodyEfficiency: number,
  reasons: string[]
) {
  let score = 0;
  if (speedRatio >= 2.5) {
    score = 25;
    reasons.push(`Very fast auction move (${speedRatio.toFixed(1)}x range pace)`);
  } else if (speedRatio >= 1.8) {
    score = 18;
    reasons.push(`Fast auction move (${speedRatio.toFixed(1)}x range pace)`);
  } else if (speedRatio >= 1.25) {
    score = 10;
    reasons.push(`Elevated movement pace (${speedRatio.toFixed(1)}x range pace)`);
  }

  if (bodyEfficiency >= 0.65) {
    score += 5;
    reasons.push(`Directional body efficiency ${(bodyEfficiency * 100).toFixed(0)}%`);
  }

  return clamp(score, 0, 30);
}

function scoreLowParticipation(participationRatio: number, reasons: string[]) {
  if (participationRatio <= 0) return 0;

  if (participationRatio <= 0.45) {
    reasons.push(`Very low participation per price traveled (${participationRatio.toFixed(2)}x baseline)`);
    return 25;
  }
  if (participationRatio <= 0.65) {
    reasons.push(`Low participation per price traveled (${participationRatio.toFixed(2)}x baseline)`);
    return 18;
  }
  if (participationRatio <= 0.85) {
    reasons.push(`Light participation per price traveled (${participationRatio.toFixed(2)}x baseline)`);
    return 10;
  }
  return 0;
}

function scoreThinStructure(thinProfileRatio: number, hasFootprint: boolean, reasons: string[]) {
  if (!hasFootprint) return 0;

  if (thinProfileRatio <= 0.35) {
    reasons.push(`Thin footprint structure (${(thinProfileRatio * 100).toFixed(0)}% level coverage)`);
    return 20;
  }
  if (thinProfileRatio <= 0.5) {
    reasons.push(`Patchy footprint structure (${(thinProfileRatio * 100).toFixed(0)}% level coverage)`);
    return 14;
  }
  if (thinProfileRatio <= 0.7) {
    reasons.push(`Below-normal level coverage (${(thinProfileRatio * 100).toFixed(0)}%)`);
    return 7;
  }
  return 0;
}

function scoreDeltaImbalance(
  deltaImbalanceRatio: number,
  direction: LiquidityVacuumDirection,
  reasons: string[]
) {
  if (deltaImbalanceRatio >= 0.6) {
    reasons.push(`One-sided ${direction === 'up' ? 'buy' : 'sell'} flow with weak opposing participation`);
    return 15;
  }
  if (deltaImbalanceRatio >= 0.4) {
    reasons.push(`Directional delta imbalance (${deltaImbalanceRatio.toFixed(2)})`);
    return 10;
  }
  if (deltaImbalanceRatio >= 0.25) {
    return 5;
  }
  return 0;
}

function scoreActiveAnchors(
  before: LiquidityVacuumAnchor,
  after: LiquidityVacuumAnchor,
  avgVolume: number,
  reasons: string[]
) {
  if (avgVolume <= 0) return 0;

  const beforeRatio = before.volume / avgVolume;
  const afterRatio = after.volume / avgVolume;
  const weaker = Math.min(beforeRatio, afterRatio);

  if (weaker >= 1.2) {
    reasons.push(`High-volume anchors on both sides (${beforeRatio.toFixed(1)}x / ${afterRatio.toFixed(1)}x)`);
    return 15;
  }
  if (weaker >= 0.9) {
    reasons.push(`Active participation zones bracket the move`);
    return 11;
  }
  if (beforeRatio >= 1.1 || afterRatio >= 1.1) {
    return 6;
  }
  return 0;
}

function hasRevisited(candles: Candle[], zone: Pick<LiquidityVacuumZone, 'endIndex' | 'priceLow' | 'priceHigh'>) {
  for (let i = zone.endIndex + 1; i < candles.length; i++) {
    const candle = candles[i];
    if (candle.high >= zone.priceLow && candle.low <= zone.priceHigh) {
      return true;
    }
  }
  return false;
}

function buildCandidate(
  candles: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  startIndex: number,
  endIndex: number,
  lookback: number
): LiquidityVacuumZone | null {
  if (startIndex <= 0 || endIndex >= candles.length || bucketSize <= 0) return null;

  const segment = candles.slice(startIndex, endIndex + 1);
  const first = segment[0];
  const last = segment[segment.length - 1];
  const direction: LiquidityVacuumDirection = last.close >= first.open ? 'up' : 'down';
  const directionSign = direction === 'up' ? 1 : -1;
  const directionalMove = directionSign * (last.close - first.open);
  if (directionalMove <= 0) return null;

  const beforeIndex = startIndex - 1;
  const afterIndex = Math.min(candles.length - 1, endIndex + 1);
  if (afterIndex <= endIndex) return null;

  const priceLow = Math.min(...segment.map((candle) => candle.low));
  const priceHigh = Math.max(...segment.map((candle) => candle.high));
  const travelledRange = Math.max(bucketSize, priceHigh - priceLow);
  const bodyEfficiency = directionalMove / travelledRange;
  if (bodyEfficiency < 0.45) return null;

  const baseline = getBaseline(candles, engine, startIndex, lookback);
  if (baseline.avgRange <= 0 || baseline.avgVolume <= 0) return null;

  const speedRatio = directionalMove / Math.max(bucketSize, baseline.avgRange * segment.length);
  if (speedRatio < 1.15) return null;

  const stats = getSegmentStats(segment, engine, bucketSize, priceLow, priceHigh);
  if (stats.totalVolume <= 0) return null;

  const currentVolumePerRange = stats.totalVolume / travelledRange;
  const participationRatio = baseline.avgVolumePerRange > 0
    ? currentVolumePerRange / baseline.avgVolumePerRange
    : 1;
  const thinProfileRatio = stats.hasFootprint
    ? stats.activeLevels / Math.max(1, stats.expectedLevels)
    : 1;
  const directionalDelta = directionSign * stats.delta;
  const deltaImbalanceRatio = stats.totalVolume > 0
    ? Math.max(0, directionalDelta) / stats.totalVolume
    : 0;
  const beforeAnchor = getAnchor(candles[beforeIndex], beforeIndex, engine);
  const afterAnchor = getAnchor(candles[afterIndex], afterIndex, engine);

  const reasons: string[] = [];
  const signals = {
    fastMovement: scoreFastMovement(speedRatio, bodyEfficiency, reasons),
    lowParticipation: scoreLowParticipation(participationRatio, reasons),
    thinStructure: scoreThinStructure(thinProfileRatio, stats.hasFootprint, reasons),
    deltaImbalance: scoreDeltaImbalance(deltaImbalanceRatio, direction, reasons),
    activeAnchors: scoreActiveAnchors(beforeAnchor, afterAnchor, baseline.avgVolume, reasons),
  };
  const score = clamp(
    signals.fastMovement +
    signals.lowParticipation +
    signals.thinStructure +
    signals.deltaImbalance +
    signals.activeAnchors,
    0,
    100
  );

  if (score < MIN_INTERNAL_SCORE || signals.activeAnchors === 0) return null;

  const provisional = segment.some((candle) => !candle.isClosed) || !candles[afterIndex].isClosed;
  const zoneBase = {
    endIndex: afterIndex,
    priceLow,
    priceHigh,
  };
  const revisited = hasRevisited(candles, zoneBase);
  const lastCandle = candles[candles.length - 1];
  const latestTouchesZone = lastCandle.high >= priceLow && lastCandle.low <= priceHigh;

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
  };
}

function overlaps(a: LiquidityVacuumZone, b: LiquidityVacuumZone) {
  const timeOverlap = a.startIndex <= b.endIndex && b.startIndex <= a.endIndex;
  const priceOverlap = a.priceLow <= b.priceHigh && b.priceLow <= a.priceHigh;
  return timeOverlap && priceOverlap;
}

export function buildLiquidityVacuumZones(
  candles: Candle[],
  engine: AggregationEngine,
  bucketSize: number,
  options: LiquidityVacuumOptions = {}
): LiquidityVacuumZone[] {
  if (candles.length < DEFAULT_LOOKBACK / 2 || bucketSize <= 0) return [];

  const lookback = Math.max(8, options.lookback ?? DEFAULT_LOOKBACK);
  const minScore = options.minScore ?? MIN_INTERNAL_SCORE;
  const maxZones = Math.max(1, options.maxZones ?? 6);
  const candidates: LiquidityVacuumZone[] = [];

  for (let endIndex = 2; endIndex < candles.length - 1; endIndex++) {
    for (let length = 1; length <= MAX_SEGMENT_CANDLES; length++) {
      const startIndex = endIndex - length + 1;
      if (startIndex <= 0) continue;

      const zone = buildCandidate(candles, engine, bucketSize, startIndex, endIndex, lookback);
      if (zone && zone.score >= minScore) {
        candidates.push(zone);
      }
    }
  }

  const selected: LiquidityVacuumZone[] = [];
  const ranked = candidates.sort((a, b) => {
    const aPriority = a.score + a.endIndex * 0.03;
    const bPriority = b.score + b.endIndex * 0.03;
    return bPriority - aPriority;
  });

  for (const candidate of ranked) {
    if (selected.some((zone) => overlaps(zone, candidate))) continue;
    selected.push(candidate);
    if (selected.length >= maxZones) break;
  }

  return selected.sort((a, b) => a.startIndex - b.startIndex);
}

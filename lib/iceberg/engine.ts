import { Candle } from '../../types/candle';
import { FootprintCandle } from '../../types/footprint';
import { IcebergLevel, IcebergRank, IcebergSide } from '../../types/iceberg';
import { AggregationEngine } from '../aggregation/engine';
import { normalizePriceToBucket } from '../utils/aggregation';

const MIN_SCORE_THRESHOLD = 35;
const DEFAULT_LOOKBACK = 10;
const MAX_RESULTS = 20;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getRank(score: number): IcebergRank {
  if (score >= 75) return 'confirmed';
  if (score >= 55) return 'probable';
  return 'suspected';
}

function scoreByThresholds(value: number, thresholds: Array<[number, number]>): number {
  let score = 0;
  for (const [threshold, points] of thresholds) {
    if (value > threshold) score = points;
  }
  return score;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getAverageBucketVolume(footprints: FootprintCandle[], lookbackWindow: number): number {
  let totalVolume = 0;
  let nonEmptyCells = 0;

  for (const footprint of footprints) {
    for (const cell of footprint.cells.values()) {
      const volume = cell.askVol + cell.bidVol;
      if (volume > 0) {
        totalVolume += volume;
        nonEmptyCells++;
      }
    }
  }

  if (nonEmptyCells === 0 || lookbackWindow <= 0) return 0;
  return totalVolume / nonEmptyCells;
}

export class IcebergEngine {
  private bucketSize: number;
  private lookbackWindow: number;
  private levels: IcebergLevel[] = [];

  constructor(bucketSize: number, lookbackWindow: number = DEFAULT_LOOKBACK) {
    this.bucketSize = bucketSize;
    this.lookbackWindow = clamp(Math.round(lookbackWindow), 5, 20);
  }

  setBucketSize(bucketSize: number) {
    this.bucketSize = bucketSize;
    this.reset();
  }

  setLookbackWindow(lookbackWindow: number) {
    this.lookbackWindow = clamp(Math.round(lookbackWindow), 5, 20);
  }

  getLookbackWindow(): number {
    return this.lookbackWindow;
  }

  getBucketSize(): number {
    return this.bucketSize;
  }

  analyzeLevel(
    bucketPrice: number,
    candles: Candle[],
    footprintCandles: (FootprintCandle | null)[],
    windowStart: number,
    windowEnd: number
  ): IcebergLevel | null {
    const windowCandles = candles.slice(windowStart, windowEnd);
    const windowFootprints = footprintCandles.slice(windowStart, windowEnd);
    const avgBucketVolume = getAverageBucketVolume(
      footprintCandles.filter((fp): fp is FootprintCandle => fp !== null),
      this.lookbackWindow
    );

    let totalBidVol = 0;
    let totalAskVol = 0;
    let candleCount = 0;
    let visitCount = 0;
    let recentVisitCount = 0;
    const visitedVolumes: number[] = [];

    for (let i = 0; i < windowCandles.length; i++) {
      const candle = windowCandles[i];
      const footprint = windowFootprints[i];
      const visited = candle.low <= bucketPrice + this.bucketSize && candle.high >= bucketPrice;

      if (visited) {
        visitCount++;
        if (i >= Math.max(0, windowCandles.length - 3)) recentVisitCount++;
      }

      const normalizedPrice = normalizePriceToBucket(bucketPrice, this.bucketSize);
      const cell = footprint?.cells.get(normalizedPrice);
      const volume = cell ? cell.askVol + cell.bidVol : 0;
      if (visited && footprint && footprint.cells.size > 0) {
        visitedVolumes.push(volume);
      }
      if (!cell || volume <= 0) continue;

      totalBidVol += cell.bidVol;
      totalAskVol += cell.askVol;
      candleCount++;
    }

    const totalVolume = totalBidVol + totalAskVol;
    if (totalVolume <= 0 || visitCount < 3) return null;

    const cumulativeDelta = totalAskVol - totalBidVol;
    const dominantVol = Math.max(totalAskVol, totalBidVol);
    const side: IcebergSide = totalAskVol >= totalBidVol ? 'bid_defense' : 'ask_defense';
    const avgVolumePerCandle = candleCount > 0 ? totalVolume / candleCount : 0;
    const reasons: string[] = [];

    const accumulationRatio = avgBucketVolume > 0
      ? totalVolume / (avgBucketVolume * this.lookbackWindow)
      : 0;
    const s1 = scoreByThresholds(accumulationRatio, [[2, 12], [4, 20], [6, 25]]);
    if (s1 > 0) reasons.push(`Volume accumulation ${accumulationRatio.toFixed(1)}x average`);

    const dominanceRatio = dominantVol / totalVolume;
    const s2 = scoreByThresholds(dominanceRatio, [[0.65, 10], [0.75, 18], [0.85, 25]]);
    if (s2 > 0) {
      const dominantLabel = totalAskVol >= totalBidVol ? 'ask' : 'bid';
      reasons.push(`Side consistency ${(dominanceRatio * 100).toFixed(0)}% ${dominantLabel} volume`);
    }

    const visitRatio = visitCount / Math.max(1, this.lookbackWindow);
    const s3 = scoreByThresholds(visitRatio, [[0.5, 8], [0.7, 14], [0.9, 20]]);
    if (s3 > 0) reasons.push(`Price persistence ${visitCount}/${this.lookbackWindow} candles`);

    const neutralizationRatio = 1 - Math.abs(cumulativeDelta) / totalVolume;
    const s4 = scoreByThresholds(neutralizationRatio, [[0.7, 8], [0.85, 14], [0.95, 20]]);
    if (s4 > 0) reasons.push(`Delta neutralization ${(neutralizationRatio * 100).toFixed(0)}%`);

    let s5 = 0;
    if (visitCount >= 5) {
      const mean = visitedVolumes.reduce((sum, value) => sum + value, 0) / visitedVolumes.length;
      const cv = mean > 0 ? standardDeviation(visitedVolumes, mean) / mean : Number.POSITIVE_INFINITY;
      s5 = cv < 0.3 ? 10 : cv < 0.5 ? 6 : 0;
      if (s5 > 0) reasons.push(`Volume stability CV ${cv.toFixed(2)}`);
    } else {
      reasons.push('Volume stability: N/A (insufficient visits)');
    }

    const score = clamp(s1 + s2 + s3 + s4 + s5, 0, 100);
    if (score < MIN_SCORE_THRESHOLD) return null;

    return {
      price: bucketPrice,
      side,
      score,
      rank: getRank(score),
      provisional: windowCandles.some(candle => !candle.isClosed),
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
    };
  }

  update(
    candles: Candle[],
    engine: AggregationEngine,
    visiblePriceMin?: number,
    visiblePriceMax?: number
  ): IcebergLevel[] {
    this.levels = runFullAnalysis(candles, this, engine, visiblePriceMin, visiblePriceMax);
    return this.levels;
  }

  getTopLevels(limit: number = MAX_RESULTS): IcebergLevel[] {
    return this.levels.slice(0, limit);
  }

  reset() {
    this.levels = [];
  }
}

export function runFullAnalysis(
  candles: Candle[],
  icebergEngine: IcebergEngine,
  engine: AggregationEngine,
  visiblePriceMin?: number,
  visiblePriceMax?: number
): IcebergLevel[] {
  if (candles.length === 0) return [];

  const lookbackWindow = icebergEngine.getLookbackWindow();
  const windowEnd = candles.length;
  const windowStart = Math.max(0, windowEnd - lookbackWindow);
  const windowCandles = candles.slice(windowStart, windowEnd);
  if (windowCandles.length < 3) return [];

  const footprintCandles = candles.map(candle => engine.getFootprintCandle(candle.time));
  const minPrice = visiblePriceMin ?? Math.min(...windowCandles.map(candle => candle.low));
  const maxPrice = visiblePriceMax ?? Math.max(...windowCandles.map(candle => candle.high));
  const bucketSize = icebergEngine.getBucketSize();
  const bucketStart = Math.floor(minPrice / bucketSize) * bucketSize;
  const bucketEnd = Math.ceil(maxPrice / bucketSize) * bucketSize;
  const results: IcebergLevel[] = [];

  for (let price = bucketStart; price <= bucketEnd; price += bucketSize) {
    const result = icebergEngine.analyzeLevel(price, candles, footprintCandles, windowStart, windowEnd);
    if (result) results.push(result);
  }

  return results.sort((a, b) => b.score - a.score);
}

import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { Trade } from '../../types/trade';
import { Candle } from '../../types/candle';
import { normalizePriceToBucket } from '../utils/aggregation';
import {
  BASE_FOOTPRINT_BUCKET_SIZE,
  BASE_FOOTPRINT_TIMEFRAME,
  BASE_FOOTPRINT_TIMEFRAME_SECONDS,
  FootprintBaseCache,
  getSharedFootprintCache,
  type FootprintCacheKeyParts,
} from './footprintCache';

export {
  BASE_FOOTPRINT_BUCKET_SIZE,
  BASE_FOOTPRINT_TIMEFRAME,
  BASE_FOOTPRINT_TIMEFRAME_SECONDS,
};

function normalizeDisplayBucketSize(bucketSize: number) {
  return Number.isFinite(bucketSize)
    ? Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSize)
    : BASE_FOOTPRINT_BUCKET_SIZE;
}

function mergeCell(target: FootprintCell, source: FootprintCell) {
  target.askVol += source.askVol;
  target.bidVol += source.bidVol;
}

export class AggregationEngine {
  private baseCache = new FootprintBaseCache('panel-local');
  private displayCandleMap = new Map<number, Candle>();
  private displayBucketSize: number;
  private displayTimeframeSeconds: number;
  private maxCandles: number;

  constructor(bucketSize: number, maxCandles: number = 500, displayTimeframeSeconds: number = BASE_FOOTPRINT_TIMEFRAME_SECONDS) {
    this.displayBucketSize = normalizeDisplayBucketSize(bucketSize);
    this.displayTimeframeSeconds = Math.max(BASE_FOOTPRINT_TIMEFRAME_SECONDS, displayTimeframeSeconds);
    this.maxCandles = maxCandles;
  }

  ingestTrade(trade: Trade, currentCandleTime: number) {
    this.baseCache.ingestTrade(trade, currentCandleTime);
  }

  ingestCandle(candle: Candle) {
    this.displayCandleMap.set(candle.time, candle);

    if (candle.isClosed) {
      this.trim();
    }
  }

  hydrateFootprintCandle(candle: Candle, cells: Map<number, FootprintCell>, delta?: number) {
    this.hydrateBaseFootprintCandle(candle.time, cells, {
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      isClosed: candle.isClosed
    }, delta);
  }

  hydrateBaseFootprintCandle(time: number, cells: Map<number, FootprintCell>, candle?: Partial<Candle>, delta?: number) {
    this.baseCache.hydrateBaseFootprintCandle(time, cells, candle, delta);
    this.trim();
  }

  getBaseFootprintCandlesInRange(startTime: number, endTime: number): FootprintCandle[] {
    return this.baseCache.getBaseFootprintCandlesInRange(startTime, endTime);
  }

  hasBaseFootprintCandle(time: number): boolean {
    return this.baseCache.hasBaseFootprintCandle(time);
  }

  getMissingBaseCandleTimes(startTime: number, endTime: number): number[] {
    return this.baseCache.getMissingBaseCandleTimes(startTime, endTime);
  }

  private trim() {
    const maxBaseCandles = Math.max(this.maxCandles, Math.ceil(this.maxCandles * this.displayTimeframeSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS));
    this.baseCache.trim(maxBaseCandles);

    if (this.displayCandleMap.size > this.maxCandles) {
      const keys = Array.from(this.displayCandleMap.keys()).sort((a, b) => a - b);
      const toDelete = keys.slice(0, keys.length - this.maxCandles);
      for (const key of toDelete) {
        this.displayCandleMap.delete(key);
      }
    }
  }

  private aggregateDisplayCells(startTime: number, endTime: number) {
    const cells = new Map<number, FootprintCell>();
    let delta = 0;
    let volume = 0;

    for (const baseCandle of this.getBaseFootprintCandlesInRange(startTime, endTime)) {
      baseCandle.cells.forEach((cell, bucketPrice) => {
        const displayBucket = normalizePriceToBucket(bucketPrice, this.displayBucketSize);
        const target = cells.get(displayBucket) ?? { askVol: 0, bidVol: 0 };
        mergeCell(target, cell);
        cells.set(displayBucket, target);
      });
      delta += baseCandle.delta;
      volume += baseCandle.volume;
    }

    return { cells, delta, volume };
  }

  private getDisplayCandleMetadata(time: number, volume: number, delta: number, cells: Map<number, FootprintCell>): FootprintCandle {
    const candle = this.displayCandleMap.get(time);
    return {
      time,
      open: candle?.open ?? 0,
      high: candle?.high ?? 0,
      low: candle?.low ?? 0,
      close: candle?.close ?? 0,
      volume: candle?.volume ?? volume,
      delta,
      cells,
      isClosed: candle?.isClosed ?? true
    };
  }

  getBaseFootprintCandle(time: number): FootprintCandle | null {
    return this.baseCache.getBaseFootprintCandle(time);
  }

  getFootprintCandle(time: number): FootprintCandle | null {
    const endTime = time + this.displayTimeframeSeconds;
    const { cells, delta, volume } = this.aggregateDisplayCells(time, endTime);
    const candle = this.displayCandleMap.get(time);

    if (cells.size === 0 && !candle) return null;

    return this.getDisplayCandleMetadata(time, volume, delta, cells);
  }

  getAllFootprintCandles(): FootprintCandle[] {
    const keys = this.displayCandleMap.size > 0
      ? Array.from(this.displayCandleMap.keys())
      : this.baseCache.getAllBaseFootprintCandles().map((candle) => candle.time);

    return keys
      .map((time) => this.getFootprintCandle(time))
      .filter((candle): candle is FootprintCandle => candle !== null)
      .sort((a, b) => a.time - b.time);
  }

  setDisplayBucketSize(bucketSize: number) {
    this.displayBucketSize = normalizeDisplayBucketSize(bucketSize);
  }

  setDisplayTimeframeSeconds(seconds: number) {
    this.displayTimeframeSeconds = Math.max(BASE_FOOTPRINT_TIMEFRAME_SECONDS, seconds);
    this.trim();
  }

  setBaseCache(cache: FootprintBaseCache) {
    this.baseCache = cache;
    this.trim();
  }

  setSharedBaseCache(parts: FootprintCacheKeyParts) {
    this.setBaseCache(getSharedFootprintCache(parts));
  }

  getBaseCache() {
    return this.baseCache;
  }

  reset(bucketSize?: number) {
    this.displayCandleMap.clear();
    if (bucketSize !== undefined) {
      this.setDisplayBucketSize(bucketSize);
    }
  }
}

import { Candle } from '../../types/candle';
import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { Trade } from '../../types/trade';
import {
  getCoverageFromTimes,
  recordCacheCleanup,
  recordCacheAccess,
  recordCacheRestoreRequest,
  recordLiveTradeDedupe,
  updateCacheMetric,
} from '../debug/marketMetrics';
import {
  MARKET_CACHE_CLEANUP_INTERVAL_MS,
  MARKET_CACHE_INACTIVE_GRACE_MS,
  MARKET_CACHE_MAX_BASE_SLICES,
  MARKET_CACHE_MAX_FOOTPRINT_CELLS,
  MARKET_CACHE_RETENTION_MINUTES,
  getCleanupTimestamp,
  getRetentionCutoffSeconds,
} from '../cache/marketCachePolicy';
import { normalizePriceToBucket } from '../utils/aggregation';

export const BASE_FOOTPRINT_BUCKET_SIZE = 5;
export const BASE_FOOTPRINT_TIMEFRAME = '1m';
export const BASE_FOOTPRINT_TIMEFRAME_SECONDS = 60;

export interface FootprintCacheKeyParts {
  symbol: string;
  contractType: string;
  dataSourceMode: string;
}

export function getFootprintCacheKey({ symbol, contractType, dataSourceMode }: FootprintCacheKeyParts) {
  return `${symbol}:${contractType}:${dataSourceMode}`;
}

export function normalizeBaseCandleTime(time: number) {
  return Math.floor(time / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS;
}

function createEmptyFootprintCandle(time: number): FootprintCandle {
  return {
    time,
    open: 0,
    high: -Infinity,
    low: Infinity,
    close: 0,
    volume: 0,
    delta: 0,
    cells: new Map<number, FootprintCell>(),
    isClosed: false
  };
}

function cloneCells(cells: Map<number, FootprintCell>) {
  const cloned = new Map<number, FootprintCell>();
  cells.forEach((cell, bucketPrice) => {
    cloned.set(bucketPrice, { askVol: cell.askVol, bidVol: cell.bidVol });
  });
  return cloned;
}

function cloneFootprint(candle: FootprintCandle): FootprintCandle {
  return {
    ...candle,
    cells: cloneCells(candle.cells),
  };
}

/**
 * Shared source-scoped store for canonical 1m/$5 footprint slices.
 * Panel-specific AggregationEngine instances read from this cache and keep
 * their own display timeframe, display bucket size, and candle metadata.
 */
export class FootprintBaseCache {
  private baseFootprintMap = new Map<number, FootprintCandle>();
  private seenTradeKeys = new Set<string>();
  private restorePromises = new Map<string, Promise<unknown>>();
  private loadedRanges: Array<{ startTime: number; endTime: number }> = [];
  private subscriberCountValue = 0;
  private inactiveSince: number | null = null;

  constructor(readonly key: string) {}

  get subscriberCount() {
    return this.subscriberCountValue;
  }

  acquire() {
    this.subscriberCountValue += 1;
    this.inactiveSince = null;
    updateCacheMetric('footprint', this.key, this.getMetricDetails());
  }

  release() {
    this.subscriberCountValue = Math.max(0, this.subscriberCountValue - 1);
    if (this.subscriberCountValue === 0 && this.inactiveSince === null) {
      this.inactiveSince = getCleanupTimestamp();
    }
    updateCacheMetric('footprint', this.key, this.getMetricDetails());
  }

  ingestTrade(trade: Trade, currentCandleTime: number) {
    const tradeKey = this.getTradeKey(trade);
    if (this.seenTradeKeys.has(tradeKey)) {
      recordLiveTradeDedupe('footprint', this.key, this.getMetricDetails());
      return;
    }
    this.seenTradeKeys.add(tradeKey);
    this.trimTradeKeys();

    const bucketKey = normalizePriceToBucket(trade.price, BASE_FOOTPRINT_BUCKET_SIZE);
    const baseCandleTime = normalizeBaseCandleTime(currentCandleTime);

    let candle = this.baseFootprintMap.get(baseCandleTime);
    if (!candle) {
      candle = createEmptyFootprintCandle(baseCandleTime);
      this.baseFootprintMap.set(baseCandleTime, candle);
    }

    let cell = candle.cells.get(bucketKey);
    if (!cell) {
      cell = { askVol: 0, bidVol: 0 };
      candle.cells.set(bucketKey, cell);
    }

    if (!trade.isBuyerMaker) {
      cell.askVol += trade.quantity;
    } else {
      cell.bidVol += trade.quantity;
    }

    if (candle.open === 0) {
      candle.open = trade.price;
    }
    candle.high = Number.isFinite(candle.high) ? Math.max(candle.high, trade.price) : trade.price;
    candle.low = Number.isFinite(candle.low) ? Math.min(candle.low, trade.price) : trade.price;
    candle.close = trade.price;
    candle.volume += trade.quantity;
    candle.delta += trade.isBuyerMaker ? -trade.quantity : trade.quantity;
    updateCacheMetric('footprint', this.key, this.getMetricDetails());
  }

  hydrateBaseFootprintCandle(time: number, cells: Map<number, FootprintCell>, candle?: Partial<Candle>, delta?: number) {
    const baseTime = normalizeBaseCandleTime(time);
    this.baseFootprintMap.set(baseTime, {
      time: baseTime,
      open: candle?.open ?? 0,
      high: candle?.high ?? 0,
      low: candle?.low ?? 0,
      close: candle?.close ?? 0,
      volume: candle?.volume ?? Array.from(cells.values()).reduce((total, cell) => total + cell.askVol + cell.bidVol, 0),
      delta: delta ?? Array.from(cells.values()).reduce((total, cell) => total + cell.askVol - cell.bidVol, 0),
      cells: cloneCells(cells),
      isClosed: candle?.isClosed ?? true
    });
    updateCacheMetric('footprint', this.key, this.getMetricDetails());
  }

  getBaseFootprintCandle(time: number): FootprintCandle | null {
    const candle = this.baseFootprintMap.get(normalizeBaseCandleTime(time));
    return candle ? cloneFootprint(candle) : null;
  }

  getBaseFootprintCandlesInRange(startTime: number, endTime: number): FootprintCandle[] {
    const result: FootprintCandle[] = [];
    for (
      let time = normalizeBaseCandleTime(startTime);
      time < endTime;
      time += BASE_FOOTPRINT_TIMEFRAME_SECONDS
    ) {
      const candle = this.baseFootprintMap.get(time);
      if (candle) result.push(cloneFootprint(candle));
    }

    return result;
  }

  getAllBaseFootprintCandles(): FootprintCandle[] {
    return Array.from(this.baseFootprintMap.values())
      .map(cloneFootprint)
      .sort((a, b) => a.time - b.time);
  }

  hasBaseFootprintCandle(time: number): boolean {
    const candle = this.baseFootprintMap.get(normalizeBaseCandleTime(time));
    return Boolean(candle && candle.cells.size > 0);
  }

  getMissingBaseCandleTimes(startTime: number, endTime: number): number[] {
    const missing: number[] = [];
    for (
      let time = normalizeBaseCandleTime(startTime);
      time < endTime;
      time += BASE_FOOTPRINT_TIMEFRAME_SECONDS
    ) {
      if (!this.hasBaseFootprintCandle(time)) {
        missing.push(time);
      }
    }

    recordCacheAccess('footprint', this.key, missing.length === 0, {
      ...this.getMetricDetails(),
      requestStartTime: normalizeBaseCandleTime(startTime),
      requestEndTime: normalizeBaseCandleTime(endTime),
      missingBaseSliceCount: missing.length,
    });

    return missing;
  }

  trim(maxBaseCandles: number) {
    if (this.baseFootprintMap.size <= maxBaseCandles) return;

    const keys = Array.from(this.baseFootprintMap.keys()).sort((a, b) => a - b);
    const toDelete = keys.slice(0, keys.length - maxBaseCandles);
    for (const key of toDelete) {
      this.baseFootprintMap.delete(key);
    }
    updateCacheMetric('footprint', this.key, this.getMetricDetails());
  }

  cleanup() {
    const before = this.getMetricDetails();
    const beforeSlices = this.baseFootprintMap.size;
    const beforeCells = this.getRowCellCount();
    const latestTime = this.getLatestBaseTime();
    let removedSlices = 0;
    let removedCells = 0;

    if (latestTime !== null) {
      const cutoffTime = getRetentionCutoffSeconds(latestTime);
      const removableTimes = Array.from(this.baseFootprintMap.keys())
        .filter((time) => time < cutoffTime && time !== latestTime)
        .sort((a, b) => a - b);

      for (const time of removableTimes) {
        removedCells += this.deleteBaseSlice(time);
        removedSlices += 1;
      }
    }

    while (this.baseFootprintMap.size > MARKET_CACHE_MAX_BASE_SLICES) {
      const oldestTime = this.getOldestBaseTimeExceptLatest();
      if (oldestTime === null) break;
      removedCells += this.deleteBaseSlice(oldestTime);
      removedSlices += 1;
    }

    while (this.getRowCellCount() > MARKET_CACHE_MAX_FOOTPRINT_CELLS) {
      const oldestTime = this.getOldestBaseTimeExceptLatest();
      if (oldestTime === null) break;
      removedCells += this.deleteBaseSlice(oldestTime);
      removedSlices += 1;
    }

    const after = this.getMetricDetails();
    if (removedSlices > 0 || removedCells > 0) {
      this.loadedRanges = [];
      updateCacheMetric('footprint', this.key, this.getMetricDetails());
    }

    recordCacheCleanup('footprint', this.key, {
      ...this.getMetricDetails(),
      retentionMinutes: MARKET_CACHE_RETENTION_MINUTES,
      inactiveGraceMs: MARKET_CACHE_INACTIVE_GRACE_MS,
      maxBaseSlices: MARKET_CACHE_MAX_BASE_SLICES,
      maxRowCells: MARKET_CACHE_MAX_FOOTPRINT_CELLS,
      slicesRemoved: beforeSlices - this.baseFootprintMap.size,
      rowsRemoved: beforeCells - this.getRowCellCount(),
      approximateMemoryBytesBefore: Number(before.approximateMemoryBytes ?? 0),
      approximateMemoryBytesAfter: Number(after.approximateMemoryBytes ?? 0),
    });
  }

  shouldEvict(nowMs: number) {
    if (this.subscriberCountValue > 0) return false;
    if (this.restorePromises.size > 0) return false;

    const inactiveSince = this.inactiveSince ?? nowMs;
    return nowMs - inactiveSince >= MARKET_CACHE_INACTIVE_GRACE_MS;
  }

  getEvictionDetails() {
    return this.getMetricDetails();
  }

  private getTradeKey(trade: Trade) {
    const source = 'source' in trade ? String(trade.source ?? 'unknown') : 'unknown';
    if (Number.isFinite(trade.id)) return `${source}:${trade.id}`;
    return `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker}`;
  }

  private trimTradeKeys() {
    while (this.seenTradeKeys.size > 100000) {
      const oldest = this.seenTradeKeys.values().next().value;
      if (oldest === undefined) break;
      this.seenTradeKeys.delete(oldest);
    }
  }

  getLoadedRanges() {
    return this.loadedRanges.map((range) => ({ ...range }));
  }

  isRestoreInFlight(startTime: number, endTime: number) {
    return this.restorePromises.has(this.getRestoreKey(startTime, endTime));
  }

  async runRestoreOnce<T>(startTime: number, endTime: number, restore: () => Promise<T>): Promise<T> {
    const restoreKey = this.getRestoreKey(startTime, endTime);
    const existing = this.restorePromises.get(restoreKey) as Promise<T> | undefined;
    if (existing) {
      recordCacheRestoreRequest('footprint', this.key, true, {
        ...this.getMetricDetails(),
        requestStartTime: normalizeBaseCandleTime(startTime),
        requestEndTime: normalizeBaseCandleTime(endTime),
      });
      return existing;
    }

    recordCacheRestoreRequest('footprint', this.key, false, {
      ...this.getMetricDetails(),
      requestStartTime: normalizeBaseCandleTime(startTime),
      requestEndTime: normalizeBaseCandleTime(endTime),
    });

    const restorePromise = restore().then((result) => {
      this.rememberLoadedRange(startTime, endTime);
      updateCacheMetric('footprint', this.key, this.getMetricDetails());
      return result;
    }).finally(() => {
      this.restorePromises.delete(restoreKey);
    });

    this.restorePromises.set(restoreKey, restorePromise);
    return restorePromise;
  }

  private getRestoreKey(startTime: number, endTime: number) {
    return `${normalizeBaseCandleTime(startTime)}:${normalizeBaseCandleTime(endTime)}`;
  }

  private rememberLoadedRange(startTime: number, endTime: number) {
    this.loadedRanges.push({
      startTime: normalizeBaseCandleTime(startTime),
      endTime: normalizeBaseCandleTime(endTime),
    });

    if (this.loadedRanges.length > 100) {
      this.loadedRanges = this.loadedRanges.slice(-100);
    }
  }

  private deleteBaseSlice(time: number) {
    const candle = this.baseFootprintMap.get(time);
    if (!candle) return 0;

    const cellCount = candle.cells.size;
    this.baseFootprintMap.delete(time);
    return cellCount;
  }

  private getLatestBaseTime() {
    if (this.baseFootprintMap.size === 0) return null;
    return Math.max(...this.baseFootprintMap.keys());
  }

  private getOldestBaseTimeExceptLatest() {
    if (this.baseFootprintMap.size <= 1) return null;

    const latestTime = this.getLatestBaseTime();
    const sortedTimes = Array.from(this.baseFootprintMap.keys()).sort((a, b) => a - b);
    return sortedTimes.find((time) => time !== latestTime) ?? null;
  }

  private getRowCellCount() {
    let rowCellCount = 0;
    for (const candle of this.baseFootprintMap.values()) {
      rowCellCount += candle.cells.size;
    }
    return rowCellCount;
  }

  private getMetricDetails() {
    const rowCellCount = this.getRowCellCount();

    return {
      activeCacheKey: this.key,
      subscriberCount: this.subscriberCountValue,
      inactiveSince: this.inactiveSince,
      baseSliceCount: this.baseFootprintMap.size,
      baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
      baseTimeframe: BASE_FOOTPRINT_TIMEFRAME,
      approximateRowCellCount: rowCellCount,
      approximateMemoryBytes: rowCellCount * 32 + this.baseFootprintMap.size * 96,
      coverageRange: getCoverageFromTimes(Array.from(this.baseFootprintMap.keys())),
      loadedRanges: this.getLoadedRanges(),
      inFlightRestoreCount: this.restorePromises.size,
      seenTradeKeyCount: this.seenTradeKeys.size,
    };
  }
}

const sharedFootprintCaches = new Map<string, FootprintBaseCache>();
let footprintCleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureFootprintCleanupTimer() {
  if (footprintCleanupInterval || MARKET_CACHE_CLEANUP_INTERVAL_MS <= 0) return;

  footprintCleanupInterval = setInterval(() => {
    cleanupSharedFootprintCaches();
  }, MARKET_CACHE_CLEANUP_INTERVAL_MS);
}

export function cleanupSharedFootprintCaches() {
  const timestamp = getCleanupTimestamp();

  for (const [key, cache] of Array.from(sharedFootprintCaches.entries())) {
    const before = cache.getEvictionDetails();
    cache.cleanup();

    if (!cache.shouldEvict(timestamp)) continue;

    const after = cache.getEvictionDetails();
    sharedFootprintCaches.delete(key);
    recordCacheCleanup('footprint', key, {
      ...after,
      evicted: true,
      retentionMinutes: MARKET_CACHE_RETENTION_MINUTES,
      inactiveGraceMs: MARKET_CACHE_INACTIVE_GRACE_MS,
      slicesRemoved: Number(after.baseSliceCount ?? 0),
      rowsRemoved: Number(after.approximateRowCellCount ?? 0),
      approximateMemoryBytesBefore: Number(before.approximateMemoryBytes ?? after.approximateMemoryBytes ?? 0),
      approximateMemoryBytesAfter: 0,
    });
  }
}

export function getSharedFootprintCache(parts: FootprintCacheKeyParts) {
  ensureFootprintCleanupTimer();
  const key = getFootprintCacheKey(parts);
  let cache = sharedFootprintCaches.get(key);
  if (!cache) {
    cache = new FootprintBaseCache(key);
    sharedFootprintCaches.set(key, cache);
    updateCacheMetric('footprint', key, {
      activeCacheKey: key,
      baseSliceCount: 0,
      baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
      baseTimeframe: BASE_FOOTPRINT_TIMEFRAME,
      approximateRowCellCount: 0,
      approximateMemoryBytes: 0,
      coverageRange: null,
      loadedRanges: [],
      inFlightRestoreCount: 0,
      seenTradeKeyCount: 0,
      created: true,
    });
  } else {
    updateCacheMetric('footprint', key, {
      activeCacheKey: key,
      reused: true,
    });
  }
  return cache;
}

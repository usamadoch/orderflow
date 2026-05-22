import { Candle } from '../../types/candle';
import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { Trade } from '../../types/trade';
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

  constructor(readonly key: string) {}

  ingestTrade(trade: Trade, currentCandleTime: number) {
    const tradeKey = this.getTradeKey(trade);
    if (this.seenTradeKeys.has(tradeKey)) return;
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

    return missing;
  }

  trim(maxBaseCandles: number) {
    if (this.baseFootprintMap.size <= maxBaseCandles) return;

    const keys = Array.from(this.baseFootprintMap.keys()).sort((a, b) => a - b);
    const toDelete = keys.slice(0, keys.length - maxBaseCandles);
    for (const key of toDelete) {
      this.baseFootprintMap.delete(key);
    }
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
    if (existing) return existing;

    const restorePromise = restore().then((result) => {
      this.rememberLoadedRange(startTime, endTime);
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
}

const sharedFootprintCaches = new Map<string, FootprintBaseCache>();

export function getSharedFootprintCache(parts: FootprintCacheKeyParts) {
  const key = getFootprintCacheKey(parts);
  let cache = sharedFootprintCaches.get(key);
  if (!cache) {
    cache = new FootprintBaseCache(key);
    sharedFootprintCaches.set(key, cache);
  }
  return cache;
}

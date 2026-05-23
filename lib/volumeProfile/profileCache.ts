import { Trade } from '@/types/trade';
import { normalizePriceToBucket } from '@/lib/utils/aggregation';
import type { FineProfileRow } from './profileEngine';

export const BASE_PROFILE_TIMEFRAME_SECONDS = 60;

export interface VolumeProfileCacheKeyParts {
  symbol: string;
  contractType: string;
  dataSourceMode: string;
  baseBucketSize: number;
}

export interface FineProfileRowSnapshot {
  row: FineProfileRow;
  origin: string;
}

type FineRowInsertResult = 'inserted' | 'invalid-base-bucket' | 'invalid-price' | 'non-positive-volume';

export function getVolumeProfileCacheKey({
  symbol,
  contractType,
  dataSourceMode,
  baseBucketSize,
}: VolumeProfileCacheKeyParts) {
  return `${symbol}::${contractType}::${dataSourceMode}::${baseBucketSize}`;
}

export function normalizeProfileBaseCandleTime(timeSeconds: number) {
  return Math.floor(timeSeconds / BASE_PROFILE_TIMEFRAME_SECONDS) * BASE_PROFILE_TIMEFRAME_SECONDS;
}

function getBaseCandleTimeForTradeMs(tradeTimeMs: number) {
  return normalizeProfileBaseCandleTime(Math.floor(tradeTimeMs / 1000));
}

function getTradeKey(trade: Trade) {
  const source = (trade as Trade & { source?: string }).source ?? '';

  return trade.id == null
    ? `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker ? 1 : 0}`
    : `${source}:id:${trade.id}`;
}

function getFineRowKey(row: FineProfileRow) {
  return `${row.baseBucketSize}:${row.bucketPrice}`;
}

function getFineRowStorageKey(row: FineProfileRow) {
  return `${row.candleTime}:${getFineRowKey(row)}`;
}

function cloneFineRow(row: FineProfileRow): FineProfileRow {
  return { ...row };
}

function lowerBoundTradeTime(trades: Trade[], timeMs: number) {
  let low = 0;
  let high = trades.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (trades[mid].time < timeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Shared source-scoped store for canonical 1m fine Volume Profile slices.
 * Panel instances keep their own selected timeframe/range/display settings
 * while reading and writing base rows through this cache.
 */
export class VolumeProfileBaseCache {
  private trades: Trade[] = [];
  private seenTradeKeys = new Set<string>();
  private fineRowsByCandle = new Map<number, Map<string, FineProfileRow>>();
  private fineRowOrigins = new Map<string, string>();
  private restorePromises = new Map<string, Promise<unknown>>();
  private loadedRanges: Array<{ startTime: number; endTime: number }> = [];
  private sorted = true;
  private maxTrades = 50000;
  private versionValue = 0;

  constructor(
    readonly key: string,
    readonly baseBucketSize: number,
  ) {}

  get version() {
    return this.versionValue;
  }

  get rowCount() {
    let count = 0;
    for (const rows of this.fineRowsByCandle.values()) {
      count += rows.size;
    }
    return count;
  }

  get candleCount() {
    return this.fineRowsByCandle.size;
  }

  setMaxTrades(maxTrades: number) {
    this.maxTrades = Math.max(0, maxTrades);
    this.enforceTradeLimit();
  }

  ingestTrade(trade: Trade, origin = 'live') {
    const inserted = this.addTrade(trade);
    if (!inserted || this.baseBucketSize <= 0) return false;

    const candleTime = getBaseCandleTimeForTradeMs(trade.time);
    const bucketPrice = normalizePriceToBucket(trade.price, this.baseBucketSize);
    const candleRows = this.fineRowsByCandle.get(candleTime) ?? new Map<string, FineProfileRow>();
    const rowKey = `${this.baseBucketSize}:${bucketPrice}`;
    let row = candleRows.get(rowKey);
    const createdRow = !row;

    if (!row) {
      row = {
        candleTime,
        baseBucketSize: this.baseBucketSize,
        bucketPrice,
        bidVol: 0,
        askVol: 0,
        totalVol: 0,
        tradeCount: 0,
      };
      candleRows.set(rowKey, row);
      this.fineRowsByCandle.set(candleTime, candleRows);
    }

    if (trade.isBuyerMaker) {
      row.bidVol += trade.quantity;
    } else {
      row.askVol += trade.quantity;
    }

    row.totalVol += trade.quantity;
    row.tradeCount += 1;
    this.fineRowOrigins.set(getFineRowStorageKey(row), origin);
    this.versionValue += 1;

    if (createdRow || row.tradeCount % 100 === 0) {
      console.debug('[VPROFILE_CACHE] Live fine row update', {
        sourceKey: this.key,
        baseBucketSize: this.baseBucketSize,
        candleTime,
        bucketPrice,
        origin,
        rowTradeCount: row.tradeCount,
        rowTotalVol: row.totalVol,
        rowCount: this.rowCount,
        candleCount: this.candleCount,
        coverageRange: this.getLoadedRanges(),
      });
    }

    return true;
  }

  hydrateTrades(trades: Trade[]) {
    let inserted = 0;
    for (const trade of trades) {
      if (this.addTrade(trade)) inserted += 1;
    }
    this.ensureSorted();
    this.enforceTradeLimit();
    return inserted;
  }

  hydrateProfileRows(rows: FineProfileRow[], origin = 'unknown') {
    const stats = {
      rowsReceived: rows.length,
      rowsInserted: 0,
      rowsRejected: 0,
      rejectedInvalidBaseBucket: 0,
      rejectedInvalidPrice: 0,
      rejectedNonPositiveVolume: 0,
      distinctCandleTimes: 0,
      minCandleTime: null as number | null,
      maxCandleTime: null as number | null,
    };
    const candleTimes = new Set<number>();

    for (const row of rows) {
      const result = this.setFineRow(row, origin);
      if (result === 'inserted') {
        stats.rowsInserted += 1;
        candleTimes.add(row.candleTime);
        stats.minCandleTime = stats.minCandleTime === null ? row.candleTime : Math.min(stats.minCandleTime, row.candleTime);
        stats.maxCandleTime = stats.maxCandleTime === null ? row.candleTime : Math.max(stats.maxCandleTime, row.candleTime);
      } else {
        stats.rowsRejected += 1;
        if (result === 'invalid-base-bucket') stats.rejectedInvalidBaseBucket += 1;
        if (result === 'invalid-price') stats.rejectedInvalidPrice += 1;
        if (result === 'non-positive-volume') stats.rejectedNonPositiveVolume += 1;
      }
    }

    stats.distinctCandleTimes = candleTimes.size;
    if (stats.rowsInserted > 0) {
      this.versionValue += 1;
    }

    console.debug('[VPROFILE_CACHE] Hydrated fine rows', {
      sourceKey: this.key,
      baseBucketSize: this.baseBucketSize,
      origin,
      rowCount: this.rowCount,
      candleCount: this.candleCount,
      ...stats,
    });

    return stats;
  }

  removeTradesInTimeRange(startMs: number, endMs: number) {
    if (endMs <= startMs) return false;

    const beforeTradeCount = this.trades.length;
    this.trades = this.trades.filter((trade) => trade.time < startMs || trade.time >= endMs);

    const startSeconds = Math.floor(startMs / 1000);
    const endSeconds = Math.ceil(endMs / 1000);
    let rowsRemoved = 0;
    for (
      let candleTime = normalizeProfileBaseCandleTime(startSeconds);
      candleTime < endSeconds;
      candleTime += BASE_PROFILE_TIMEFRAME_SECONDS
    ) {
      const candleRows = this.fineRowsByCandle.get(candleTime);
      if (!candleRows) continue;

      for (const [rowKey, row] of Array.from(candleRows.entries())) {
        const storageKey = getFineRowStorageKey(row);
        if (this.fineRowOrigins.get(storageKey) !== 'live') continue;
        candleRows.delete(rowKey);
        this.fineRowOrigins.delete(storageKey);
        rowsRemoved += 1;
      }

      if (candleRows.size === 0) {
        this.fineRowsByCandle.delete(candleTime);
      }
    }

    if (this.trades.length !== beforeTradeCount) {
      this.rebuildSeenTradeKeys();
    }

    if (this.trades.length !== beforeTradeCount || rowsRemoved > 0) {
      this.versionValue += 1;
      return true;
    }

    return false;
  }

  pruneBefore(timeMs: number) {
    const beforeTradeCount = this.trades.length;
    const beforeRowCount = this.rowCount;

    this.trades = this.trades.filter((trade) => trade.time >= timeMs);
    this.pruneRowsBefore(Math.floor(timeMs / 1000));

    if (this.trades.length !== beforeTradeCount) {
      this.rebuildSeenTradeKeys();
    }

    if (this.trades.length !== beforeTradeCount || this.rowCount !== beforeRowCount) {
      this.versionValue += 1;
      return true;
    }

    return false;
  }

  getFineRowsInRange(startSeconds: number, endSeconds: number): FineProfileRowSnapshot[] {
    const rows: FineProfileRowSnapshot[] = [];
    for (
      let candleTime = normalizeProfileBaseCandleTime(startSeconds);
      candleTime < endSeconds;
      candleTime += BASE_PROFILE_TIMEFRAME_SECONDS
    ) {
      const candleRows = this.fineRowsByCandle.get(candleTime);
      if (!candleRows) continue;

      for (const row of candleRows.values()) {
        rows.push({
          row: cloneFineRow(row),
          origin: this.fineRowOrigins.get(getFineRowStorageKey(row)) ?? 'unknown',
        });
      }
    }

    return rows;
  }

  getCoveredBaseTimesInRange(startSeconds: number, endSeconds: number): Set<number> {
    const covered = new Set<number>();
    for (
      let candleTime = normalizeProfileBaseCandleTime(startSeconds);
      candleTime < endSeconds;
      candleTime += BASE_PROFILE_TIMEFRAME_SECONDS
    ) {
      const candleRows = this.fineRowsByCandle.get(candleTime);
      if (candleRows && candleRows.size > 0) {
        covered.add(candleTime);
      }
    }
    return covered;
  }

  getTradesInRange(startMs: number, endMs: number) {
    this.ensureSorted();
    const startIndex = lowerBoundTradeTime(this.trades, startMs);
    const endIndex = lowerBoundTradeTime(this.trades, endMs);
    return this.trades.slice(startIndex, endIndex).map((trade) => ({ ...trade }));
  }

  getMissingBaseCandleTimes(startTime: number, endTime: number): number[] {
    const missing: number[] = [];
    for (
      let time = normalizeProfileBaseCandleTime(startTime);
      time < endTime;
      time += BASE_PROFILE_TIMEFRAME_SECONDS
    ) {
      const rows = this.fineRowsByCandle.get(time);
      if (!rows || rows.size === 0) {
        missing.push(time);
      }
    }

    console.debug(`[VPROFILE_CACHE] ${missing.length === 0 ? 'Cache hit' : 'Cache miss'}`, {
      sourceKey: this.key,
      baseBucketSize: this.baseBucketSize,
      startTime: normalizeProfileBaseCandleTime(startTime),
      endTime: normalizeProfileBaseCandleTime(endTime),
      missingCandles: missing.length,
      rowCount: this.rowCount,
      candleCount: this.candleCount,
      loadedRanges: this.getLoadedRanges(),
    });

    return missing;
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
      console.debug('[VPROFILE_CACHE] Restore dedupe', {
        sourceKey: this.key,
        baseBucketSize: this.baseBucketSize,
        startTime: normalizeProfileBaseCandleTime(startTime),
        endTime: normalizeProfileBaseCandleTime(endTime),
        rowCount: this.rowCount,
      });
      return existing;
    }

    console.debug('[VPROFILE_CACHE] Restore start', {
      sourceKey: this.key,
      baseBucketSize: this.baseBucketSize,
      startTime: normalizeProfileBaseCandleTime(startTime),
      endTime: normalizeProfileBaseCandleTime(endTime),
      rowCount: this.rowCount,
    });

    const restorePromise = restore().then((result) => {
      this.rememberLoadedRange(startTime, endTime);
      console.debug('[VPROFILE_CACHE] Restore complete', {
        sourceKey: this.key,
        baseBucketSize: this.baseBucketSize,
        startTime: normalizeProfileBaseCandleTime(startTime),
        endTime: normalizeProfileBaseCandleTime(endTime),
        rowCount: this.rowCount,
        candleCount: this.candleCount,
        loadedRanges: this.getLoadedRanges(),
      });
      return result;
    }).finally(() => {
      this.restorePromises.delete(restoreKey);
    });

    this.restorePromises.set(restoreKey, restorePromise);
    return restorePromise;
  }

  private addTrade(trade: Trade) {
    const key = getTradeKey(trade);
    if (this.seenTradeKeys.has(key)) return false;

    const last = this.trades[this.trades.length - 1];
    if (last && trade.time < last.time) {
      this.sorted = false;
    }

    this.seenTradeKeys.add(key);
    this.trades.push(trade);
    this.versionValue += 1;
    return true;
  }

  private setFineRow(row: FineProfileRow, origin: string): FineRowInsertResult {
    if (row.baseBucketSize <= 0 || Math.abs(row.baseBucketSize - this.baseBucketSize) > 1e-9) {
      return 'invalid-base-bucket';
    }
    if (!Number.isFinite(row.bucketPrice)) return 'invalid-price';
    if (row.totalVol <= 0) return 'non-positive-volume';

    const candleTime = normalizeProfileBaseCandleTime(row.candleTime);
    const normalizedRow = {
      ...row,
      candleTime,
    };
    const candleRows = this.fineRowsByCandle.get(candleTime) ?? new Map<string, FineProfileRow>();
    const fineRowKey = getFineRowKey(normalizedRow);
    candleRows.set(fineRowKey, cloneFineRow(normalizedRow));
    this.fineRowsByCandle.set(candleTime, candleRows);
    this.fineRowOrigins.set(getFineRowStorageKey(normalizedRow), origin);

    return 'inserted';
  }

  private pruneRowsBefore(timeSeconds: number) {
    for (const candleTime of Array.from(this.fineRowsByCandle.keys())) {
      if (candleTime >= timeSeconds) continue;

      const rows = this.fineRowsByCandle.get(candleTime);
      if (rows) {
        for (const row of rows.values()) {
          this.fineRowOrigins.delete(getFineRowStorageKey(row));
        }
      }
      this.fineRowsByCandle.delete(candleTime);
    }
  }

  private ensureSorted() {
    if (this.sorted) return;

    this.trades.sort((a, b) => a.time - b.time);
    this.sorted = true;
    this.versionValue += 1;
  }

  private enforceTradeLimit() {
    if (this.maxTrades <= 0 || this.trades.length <= this.maxTrades) return;

    this.trades = this.trades.slice(this.trades.length - this.maxTrades);
    this.rebuildSeenTradeKeys();
    this.versionValue += 1;
  }

  private rebuildSeenTradeKeys() {
    this.seenTradeKeys.clear();
    for (const trade of this.trades) {
      this.seenTradeKeys.add(getTradeKey(trade));
    }
  }

  private getRestoreKey(startTime: number, endTime: number) {
    return `${normalizeProfileBaseCandleTime(startTime)}:${normalizeProfileBaseCandleTime(endTime)}`;
  }

  private rememberLoadedRange(startTime: number, endTime: number) {
    this.loadedRanges.push({
      startTime: normalizeProfileBaseCandleTime(startTime),
      endTime: normalizeProfileBaseCandleTime(endTime),
    });

    if (this.loadedRanges.length > 100) {
      this.loadedRanges = this.loadedRanges.slice(-100);
    }
  }
}

const sharedVolumeProfileCaches = new Map<string, VolumeProfileBaseCache>();

export function getSharedVolumeProfileCache(parts: VolumeProfileCacheKeyParts) {
  const key = getVolumeProfileCacheKey(parts);
  let cache = sharedVolumeProfileCaches.get(key);
  if (!cache) {
    cache = new VolumeProfileBaseCache(key, parts.baseBucketSize);
    sharedVolumeProfileCaches.set(key, cache);
    console.debug('[VPROFILE_CACHE] Cache miss: created shared base cache', {
      sourceKey: key,
      symbol: parts.symbol,
      contractType: parts.contractType,
      dataSourceMode: parts.dataSourceMode,
      baseBucketSize: parts.baseBucketSize,
    });
    return cache;
  }

  console.debug('[VPROFILE_CACHE] Cache hit: reused shared base cache', {
    sourceKey: key,
    symbol: parts.symbol,
    contractType: parts.contractType,
    dataSourceMode: parts.dataSourceMode,
    baseBucketSize: parts.baseBucketSize,
    rowCount: cache.rowCount,
    candleCount: cache.candleCount,
    loadedRanges: cache.getLoadedRanges(),
  });

  return cache;
}

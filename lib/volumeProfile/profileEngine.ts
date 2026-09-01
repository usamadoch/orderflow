import { Trade } from '@/types/trade';
import { findPOC, findValueArea, findLowVolumeNodes, findHighVolumeNodes } from '@/lib/utils/volumeProfile';
import { normalizePriceToBucket } from '@/lib/utils/aggregation';
import { getAggregateTradeCount } from '@/lib/utils/feedUtils';
import { Candle } from '@/types/candle';
import {
  BASE_PROFILE_TIMEFRAME_SECONDS,
  VolumeProfileBaseCache,
  getSharedVolumeProfileCache,
} from './profileCache';
import type {
  VolumeProfileCacheKeyParts,
  VolumeProfileBuildRequest,
  FineProfileRow,
  VolumeProfileSource,
  VolumeProfile,
  ProfileRow
} from '@/types/volumeProfile';



const DEFAULT_MAX_TRADES = 50000;

/**
 * Panel-local VolumeProfileSource view backed by a shared canonical 1m fine-row cache.
 * The selected timeframe/range/display row size remain panel-local build inputs.
 */
export class RawTradeVolumeProfileEngine implements VolumeProfileSource {
  private baseCache = new VolumeProfileBaseCache('panel-local::spot::spot::1', 1);
  private sharedBaseCache: VolumeProfileBaseCache | null = null;
  private maxTrades: number;
  private profileCache = new Map<string, VolumeProfile | null>();
  private static readonly MAX_PROFILE_CACHE_SIZE = 20;
  private protectedRanges = new Map<string, Array<{ startSeconds: number; endSeconds: number }>>();

  constructor(maxTrades: number = DEFAULT_MAX_TRADES) {
    this.maxTrades = maxTrades;
    this.baseCache.setMaxTrades(maxTrades);
  }

  ingestTrade(trade: Trade) {
    const inserted = this.baseCache.ingestTrade(trade, 'live');
    if (inserted) {
      this.profileCache.clear();
    }
  }

  hydrateTrades(trades: Trade[]) {
    const inserted = this.baseCache.hydrateTrades(trades);
    if (inserted > 0) {
      this.profileCache.clear();
    }
  }

  hydrateProfileRows(rows: FineProfileRow[], origin = 'unknown') {
    if (rows.length === 0) return;

    const stats = this.baseCache.hydrateProfileRows(rows, origin);
    console.debug('[VPROFILE_DEBUG] Hydrate profile rows into engine', {
      origin,
      sourceKey: this.baseCache.key,
      baseBucketSize: this.baseCache.baseBucketSize,
      ...stats,
    });

    if (stats.rowsInserted > 0) {
      this.profileCache.clear();
    }
  }

  removeTradesInTimeRange(startMs: number, endMs: number) {
    const changed = this.baseCache.removeTradesInTimeRange(startMs, endMs);
    if (changed) {
      this.profileCache.clear();
    }
  }

  reset() {
    this.profileCache.clear();
  }

  pruneBefore(timeMs: number) {
    const changed = this.baseCache.pruneBefore(timeMs);
    if (changed) {
      this.profileCache.clear();
    }
  }

  buildProfile(request: VolumeProfileBuildRequest) {
    const {
      candles,
      profileBucketSize,
      priceHigh,
      priceLow,
      nodeSensitivity,
      inputData = 'volume',
      filterMin,
      filterMax,
      debugContext
    } = request;

    if (candles.length === 0 || profileBucketSize <= 0) return null;

    const { startMs, endMs } = getCandleTimeWindow(candles);
    const cacheKey = [
      this.baseCache.key,
      this.baseCache.version,
      startMs,
      endMs,
      profileBucketSize,
      priceHigh ?? '',
      priceLow ?? '',
      nodeSensitivity ?? 0.5,
      inputData,
      filterMin ?? '',
      filterMax ?? ''
    ].join(':');

    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)!;
    }

    const profile = this.buildProfileFromRowsAndTrades(
      candles, 
      startMs, 
      endMs, 
      profileBucketSize, 
      priceHigh, 
      priceLow, 
      debugContext, 
      nodeSensitivity ?? 0.5, 
      inputData,
      filterMin,
      filterMax
    );

    // Evict oldest entries if cache is full
    if (this.profileCache.size >= RawTradeVolumeProfileEngine.MAX_PROFILE_CACHE_SIZE) {
      const firstKey = this.profileCache.keys().next().value;
      if (firstKey !== undefined) this.profileCache.delete(firstKey);
    }
    this.profileCache.set(cacheKey, profile);

    return profile;
  }

  setBaseCache(cache: VolumeProfileBaseCache) {
    if (this.sharedBaseCache && this.sharedBaseCache !== cache) {
      this.sharedBaseCache.release();
      this.sharedBaseCache = null;
    }
    this.baseCache = cache;
    this.baseCache.setMaxTrades(this.maxTrades);
    for (const [ownerId, ranges] of this.protectedRanges.entries()) {
      this.baseCache.setProtectedRanges(ownerId, ranges);
    }
    this.profileCache.clear();
  }

  setSharedBaseCache(parts: VolumeProfileCacheKeyParts) {
    const sharedCache = getSharedVolumeProfileCache(parts);
    if (this.sharedBaseCache !== sharedCache) {
      if (this.sharedBaseCache) {
        this.sharedBaseCache.release();
      }
      sharedCache.acquire();
      this.sharedBaseCache = sharedCache;
    }
    this.setBaseCache(sharedCache);
  }

  getBaseCache() {
    return this.baseCache;
  }

  releaseSharedBaseCache() {
    if (!this.sharedBaseCache) return;

    this.sharedBaseCache.release();
    this.sharedBaseCache = null;
    this.setBaseCache(new VolumeProfileBaseCache('panel-local::spot::spot::1', 1));
  }

  setProtectedRanges(ownerId: string, ranges: Array<{ startSeconds: number; endSeconds: number }>) {
    if (ranges.length === 0) {
      this.protectedRanges.delete(ownerId);
    } else {
      this.protectedRanges.set(ownerId, ranges);
    }
    this.baseCache.setProtectedRanges(ownerId, ranges);
  }

  private buildProfileFromRowsAndTrades(
    candles: Candle[],
    startMs: number,
    endMs: number,
    profileBucketSize: number,
    priceHigh?: number,
    priceLow?: number,
    debugContext?: VolumeProfileBuildRequest['debugContext'],
    nodeSensitivity: number = 0.5,
    inputData: 'volume' | 'orders' | 'aggregateTrades' = 'volume',
    filterMin?: number,
    filterMax?: number
  ) {
    const map = new Map<number, ProfileRow>();
    const candleTimes = new Set(candles.map((candle) => candle.time));
    const fineCoveredBaseTimes = new Set<number>();
    const startSeconds = Math.floor(startMs / 1000);
    const endSeconds = Math.ceil(endMs / 1000);
    const debugStats = {
      fineRowsUsed: 0,
      restoredRowsUsed: 0,
      liveClosedRowsUsed: 0,
      unknownFineRowsUsed: 0,
      liveTradesUsed: 0,
      liveTradesSkippedCovered: 0,
      fineCandleTimes: new Set<number>(),
      liveTradeCandleTimes: new Set<number>(),
    };
    const isFiltering = (filterMin !== undefined && filterMin > 0) || (filterMax !== undefined && filterMax < Infinity);

    const developingPoc: { time: number; price: number }[] = [];
    let currentMaxVol = -1;
    let currentPocPrice = 0;
    
    // Determine the snapshot interval based on chart resolution
    const timeframeSeconds = candles.length >= 2 
      ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time) 
      : 60;
    let nextSnapshotTime = Math.floor(startSeconds / timeframeSeconds) * timeframeSeconds + timeframeSeconds;

    const maybeSnapshot = (timeSeconds: number) => {
      while (timeSeconds >= nextSnapshotTime) {
        if (currentMaxVol > 0) {
          // If we had a gap, push the last known POC up to the current boundary
          const lastTime = developingPoc.length > 0 ? developingPoc[developingPoc.length - 1].time : startMs;
          if (lastTime < (nextSnapshotTime - timeframeSeconds) * 1000) {
             developingPoc.push({ time: (nextSnapshotTime - timeframeSeconds) * 1000, price: currentPocPrice });
          }
          developingPoc.push({ time: nextSnapshotTime * 1000, price: currentPocPrice });
        }
        nextSnapshotTime += timeframeSeconds;
      }
    };

    if (!isFiltering) {
      let lastRowTime = startSeconds;
      for (const { row, origin } of this.baseCache.getFineRowsInRange(startSeconds, endSeconds)) {
        if (!isCompatibleProfileBucket(row.baseBucketSize, profileBucketSize)) continue;
        fineCoveredBaseTimes.add(row.candleTime);
        debugStats.fineRowsUsed += 1;
        debugStats.fineCandleTimes.add(row.candleTime);
        if (origin === 'restore') {
          debugStats.restoredRowsUsed += 1;
        } else if (origin === 'closed-1m' || origin === 'live') {
          debugStats.liveClosedRowsUsed += 1;
        } else {
          debugStats.unknownFineRowsUsed += 1;
        }

        if (row.candleTime > lastRowTime) {
          maybeSnapshot(row.candleTime);
          lastRowTime = row.candleTime;
        }

        const price = normalizePriceToBucket(row.bucketPrice, profileBucketSize);
        if (priceHigh !== undefined && price > priceHigh) continue;
        if (priceLow !== undefined && price < priceLow) continue;

        const profileRow = getOrCreateProfileRow(map, price);

        let metricTotal = row.totalVol;
        let metricBid = row.bidVol;
        let metricAsk = row.askVol;

        if (inputData === 'orders' || inputData === 'aggregateTrades') {
          metricTotal = inputData === 'orders' ? (row.orderCount ?? row.tradeCount) : row.tradeCount;
          const bidRatio = row.totalVol > 0 ? row.bidVol / row.totalVol : 0.5;
          metricBid = metricTotal * bidRatio;
          metricAsk = metricTotal - metricBid;
        }

        profileRow.bidVol += metricBid;
        profileRow.askVol += metricAsk;
        profileRow.totalVol += metricTotal;

        if (profileRow.totalVol > currentMaxVol) {
          currentMaxVol = profileRow.totalVol;
          currentPocPrice = profileRow.price;
        }
      }
      maybeSnapshot(lastRowTime + BASE_PROFILE_TIMEFRAME_SECONDS); // Flush end
    }

    for (const trade of this.baseCache.getTradesInRange(startMs, endMs)) {
      const candleTime = getCandleTimeForTradeMs(trade.time, candles);
      if (!candleTimes.has(candleTime)) continue;
      if (fineCoveredBaseTimes.has(getBaseCandleTimeForTradeMs(trade.time))) {
        debugStats.liveTradesSkippedCovered += 1;
        continue;
      }
      debugStats.liveTradesUsed += 1;
      debugStats.liveTradeCandleTimes.add(getBaseCandleTimeForTradeMs(trade.time));

      const tradeTimeSeconds = Math.floor(trade.time / 1000);
      maybeSnapshot(tradeTimeSeconds);

      const price = normalizePriceToBucket(trade.price, profileBucketSize);
      if (priceHigh !== undefined && price > priceHigh) continue;
      if (priceLow !== undefined && price < priceLow) continue;

      const row = getOrCreateProfileRow(map, price);
      
      let tradeTotal = trade.quantity;
      if (inputData === 'orders') {
        tradeTotal = getAggregateTradeCount(trade) ?? 1;
      } else if (inputData === 'aggregateTrades') {
        tradeTotal = 1;
      }

      if (filterMin !== undefined && tradeTotal < filterMin) continue;
      if (filterMax !== undefined && tradeTotal > filterMax) continue;

      if (trade.isBuyerMaker) {
        row.bidVol += tradeTotal;
      } else {
        row.askVol += tradeTotal;
      }
      row.totalVol += tradeTotal;

      if (row.totalVol > currentMaxVol) {
        currentMaxVol = row.totalVol;
        currentPocPrice = row.price;
      }
    }
    maybeSnapshot(endSeconds); // Final flush

    const profile = buildVolumeProfileFromRowMap(map, nodeSensitivity, developingPoc);
    if (debugContext) {
      console.debug('[VPROFILE_DEBUG] Render selected profile build', {
        ...debugContext,
        selectedStartTime: debugContext.selectedStartTime ?? candles[0]?.time ?? null,
        selectedEndTime: debugContext.selectedEndTime ?? candles[candles.length - 1]?.time ?? null,
        candleCount: candles.length,
        profileBucketSize,
        priceHigh: priceHigh ?? null,
        priceLow: priceLow ?? null,
        sourceKey: this.baseCache.key,
        baseBucketSize: this.baseCache.baseBucketSize,
        baseCacheRowCount: this.baseCache.rowCount,
        fineRowsUsed: debugStats.fineRowsUsed,
        restoredRowsUsed: debugStats.restoredRowsUsed,
        liveClosedRowsUsed: debugStats.liveClosedRowsUsed,
        unknownFineRowsUsed: debugStats.unknownFineRowsUsed,
        fineCandleTimeCount: debugStats.fineCandleTimes.size,
        liveTradesUsed: debugStats.liveTradesUsed,
        liveTradeCandleTimeCount: debugStats.liveTradeCandleTimes.size,
        liveTradesSkippedCovered: debugStats.liveTradesSkippedCovered,
        visiblePriceRows: profile?.rows.length ?? 0,
        totalVolume: profile?.totalVol ?? 0,
      });
    }

    return profile;
  }
}

export function buildVolumeProfileFromTrades(
  trades: Trade[],
  profileBucketSize: number,
  priceHigh?: number,
  priceLow?: number,
  nodeSensitivity: number = 0.5
): VolumeProfile | null {
  if (trades.length === 0 || profileBucketSize <= 0) return null;

  const map = new Map<number, ProfileRow>();

  for (const trade of trades) {
    const price = normalizePriceToBucket(trade.price, profileBucketSize);

    if (priceHigh !== undefined && price > priceHigh) continue;
    if (priceLow !== undefined && price < priceLow) continue;

    const row = getOrCreateProfileRow(map, price);

    if (trade.isBuyerMaker) {
      row.bidVol += trade.quantity;
    } else {
      row.askVol += trade.quantity;
    }
    row.totalVol += trade.quantity;
  }

  return buildVolumeProfileFromRowMap(map, nodeSensitivity, []);
}

function buildVolumeProfileFromRowMap(
  map: Map<number, ProfileRow>, 
  nodeSensitivity: number = 0.5,
  developingPoc: { time: number; price: number }[] = []
): VolumeProfile | null {
  if (map.size === 0) return null;

  const rows = Array.from(map.values()).sort((a, b) => a.price - b.price);
  const totalVol = rows.reduce((sum, row) => sum + row.totalVol, 0);
  const maxVol = rows.reduce((max, row) => Math.max(max, row.totalVol), 0);
  const maxAbsDelta = rows.reduce((max, row) => Math.max(max, Math.abs(row.askVol - row.bidVol)), 0);
  const poc = findPOC(rows);
  const { vaHigh, vaLow } = findValueArea(rows, totalVol);
  const lvns = findLowVolumeNodes(rows, 5, nodeSensitivity);
  const hvns = findHighVolumeNodes(rows, 5, nodeSensitivity);

  return {
    rows,
    totalVol,
    maxVol,
    maxAbsDelta,
    poc,
    vaHigh,
    vaLow,
    lvns,
    hvns,
    developingPoc,
  };
}

function getOrCreateProfileRow(map: Map<number, ProfileRow>, price: number) {
  let row = map.get(price);
  if (!row) {
    row = { price, totalVol: 0, bidVol: 0, askVol: 0, hasFP: true };
    map.set(price, row);
  }

  return row;
}

function getCandleTimeWindow(candles: Candle[]) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  const inferredSeconds = candles.length >= 2
    ? Math.max(1, last.time - candles[candles.length - 2].time)
    : 60;

  return {
    startMs: first.time * 1000,
    endMs: (last.time + inferredSeconds) * 1000,
  };
}

function isCompatibleProfileBucket(baseBucketSize: number, profileBucketSize: number) {
  if (baseBucketSize <= 0 || profileBucketSize <= 0) return false;
  return baseBucketSize <= profileBucketSize + 1e-9;
}

function getCandleTimeForTradeMs(tradeTimeMs: number, candles: Candle[]) {
  if (candles.length < 2) return candles[0]?.time ?? Math.floor(tradeTimeMs / 1000);

  const timeframeSeconds = Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time);
  return Math.floor((tradeTimeMs / 1000) / timeframeSeconds) * timeframeSeconds;
}

function getBaseCandleTimeForTradeMs(tradeTimeMs: number) {
  return Math.floor((tradeTimeMs / 1000) / BASE_PROFILE_TIMEFRAME_SECONDS) * BASE_PROFILE_TIMEFRAME_SECONDS;
}

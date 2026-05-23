import { Trade } from '@/types/trade';
import { VolumeProfile, ProfileRow, findPOC, findValueArea, findLowVolumeNodes } from '@/lib/utils/volumeProfile';
import { normalizePriceToBucket } from '@/lib/utils/aggregation';
import { Candle } from '@/types/candle';
import {
  BASE_PROFILE_TIMEFRAME_SECONDS,
  VolumeProfileBaseCache,
  getSharedVolumeProfileCache,
  type VolumeProfileCacheKeyParts,
} from './profileCache';

export interface VolumeProfileBuildRequest {
  candles: Candle[];
  profileBucketSize: number;
  priceHigh?: number;
  priceLow?: number;
  debugContext?: {
    label: string;
    panelId?: string;
    selectedStartTime?: number;
    selectedEndTime?: number;
  };
}

export interface FineProfileRow {
  candleTime: number;
  baseBucketSize: number;
  bucketPrice: number;
  bidVol: number;
  askVol: number;
  totalVol: number;
  tradeCount: number;
}

export interface VolumeProfileSource {
  ingestTrade(trade: Trade): void;
  hydrateTrades(trades: Trade[]): void;
  hydrateProfileRows(rows: FineProfileRow[], origin?: string): void;
  removeTradesInTimeRange(startMs: number, endMs: number): void;
  reset(): void;
  pruneBefore(timeMs: number): void;
  buildProfile(request: VolumeProfileBuildRequest): VolumeProfile | null;
}

const DEFAULT_MAX_TRADES = 50000;

/**
 * Panel-local VolumeProfileSource view backed by a shared canonical 1m fine-row cache.
 * The selected timeframe/range/display row size remain panel-local build inputs.
 */
export class RawTradeVolumeProfileEngine implements VolumeProfileSource {
  private baseCache = new VolumeProfileBaseCache('panel-local::spot::spot::1', 1);
  private sharedBaseCache: VolumeProfileBaseCache | null = null;
  private maxTrades: number;
  private cachedProfile: {
    key: string;
    profile: VolumeProfile | null;
  } | null = null;

  constructor(maxTrades: number = DEFAULT_MAX_TRADES) {
    this.maxTrades = maxTrades;
    this.baseCache.setMaxTrades(maxTrades);
  }

  ingestTrade(trade: Trade) {
    const inserted = this.baseCache.ingestTrade(trade, 'live');
    if (inserted) {
      this.cachedProfile = null;
    }
  }

  hydrateTrades(trades: Trade[]) {
    const inserted = this.baseCache.hydrateTrades(trades);
    if (inserted > 0) {
      this.cachedProfile = null;
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
      this.cachedProfile = null;
    }
  }

  removeTradesInTimeRange(startMs: number, endMs: number) {
    const changed = this.baseCache.removeTradesInTimeRange(startMs, endMs);
    if (changed) {
      this.cachedProfile = null;
    }
  }

  reset() {
    this.cachedProfile = null;
  }

  pruneBefore(timeMs: number) {
    const changed = this.baseCache.pruneBefore(timeMs);
    if (changed) {
      this.cachedProfile = null;
    }
  }

  buildProfile({ candles, profileBucketSize, priceHigh, priceLow, debugContext }: VolumeProfileBuildRequest) {
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
    ].join(':');

    if (this.cachedProfile?.key === cacheKey) {
      if (debugContext) {
        console.debug('[VPROFILE_DEBUG] Render selected profile from cached engine result', {
          ...debugContext,
          candleCount: candles.length,
          selectedStartTime: debugContext.selectedStartTime ?? candles[0]?.time ?? null,
          selectedEndTime: debugContext.selectedEndTime ?? candles[candles.length - 1]?.time ?? null,
          profileBucketSize,
          visiblePriceRows: this.cachedProfile.profile?.rows.length ?? 0,
          totalVolume: this.cachedProfile.profile?.totalVol ?? 0,
        });
      }
      return this.cachedProfile.profile;
    }

    const profile = this.buildProfileFromRowsAndTrades(candles, startMs, endMs, profileBucketSize, priceHigh, priceLow, debugContext);
    this.cachedProfile = { key: cacheKey, profile };

    return profile;
  }

  setBaseCache(cache: VolumeProfileBaseCache) {
    if (this.sharedBaseCache && this.sharedBaseCache !== cache) {
      this.sharedBaseCache.release();
      this.sharedBaseCache = null;
    }
    this.baseCache = cache;
    this.baseCache.setMaxTrades(this.maxTrades);
    this.cachedProfile = null;
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
    this.baseCache = new VolumeProfileBaseCache('panel-local::spot::spot::1', 1);
    this.baseCache.setMaxTrades(this.maxTrades);
    this.cachedProfile = null;
  }

  private buildProfileFromRowsAndTrades(
    candles: Candle[],
    startMs: number,
    endMs: number,
    profileBucketSize: number,
    priceHigh?: number,
    priceLow?: number,
    debugContext?: VolumeProfileBuildRequest['debugContext'],
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

      const price = normalizePriceToBucket(row.bucketPrice, profileBucketSize);
      if (priceHigh !== undefined && price > priceHigh) continue;
      if (priceLow !== undefined && price < priceLow) continue;

      const profileRow = getOrCreateProfileRow(map, price);
      profileRow.bidVol += row.bidVol;
      profileRow.askVol += row.askVol;
      profileRow.totalVol += row.totalVol;
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

    const profile = buildVolumeProfileFromRowMap(map);
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

  return buildVolumeProfileFromRowMap(map);
}

function buildVolumeProfileFromRowMap(map: Map<number, ProfileRow>): VolumeProfile | null {
  if (map.size === 0) return null;

  const rows = Array.from(map.values()).sort((a, b) => a.price - b.price);
  const totalVol = rows.reduce((sum, row) => sum + row.totalVol, 0);
  const maxVol = rows.reduce((max, row) => Math.max(max, row.totalVol), 0);
  const maxAbsDelta = rows.reduce((max, row) => Math.max(max, Math.abs(row.askVol - row.bidVol)), 0);
  const poc = findPOC(rows);
  const { vaHigh, vaLow } = findValueArea(rows, totalVol);
  const lvns = findLowVolumeNodes(rows);

  return {
    rows,
    totalVol,
    maxVol,
    maxAbsDelta,
    poc,
    vaHigh,
    vaLow,
    lvns,
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
  if (baseBucketSize > profileBucketSize) return false;

  const ratio = profileBucketSize / baseBucketSize;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

function getCandleTimeForTradeMs(tradeTimeMs: number, candles: Candle[]) {
  if (candles.length < 2) return candles[0]?.time ?? Math.floor(tradeTimeMs / 1000);

  const timeframeSeconds = Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time);
  return Math.floor((tradeTimeMs / 1000) / timeframeSeconds) * timeframeSeconds;
}

function getBaseCandleTimeForTradeMs(tradeTimeMs: number) {
  return Math.floor((tradeTimeMs / 1000) / BASE_PROFILE_TIMEFRAME_SECONDS) * BASE_PROFILE_TIMEFRAME_SECONDS;
}

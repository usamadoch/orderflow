import { Candle } from '../../types/candle';
import {
  getCoverageFromTimes,
  recordCacheAccess,
  recordCacheRestoreRequest,
  updateCacheMetric,
} from '../debug/marketMetrics';
import type { ContractType } from '../store/chart';
import { subscribeCandleStream } from './feedRegistry';

export const MAX_SHARED_CANDLES = 500;

export interface CandleCacheKeyParts {
  symbol: string;
  contractType: ContractType;
  timeframe: string;
}

export type CandleCacheUpdateReason = 'snapshot' | 'history-restored' | 'live';

export interface CandleCacheSnapshot {
  key: string;
  candles: Candle[];
  candle?: Candle;
  reason: CandleCacheUpdateReason;
  candleCount: number;
  loadedRanges: Array<{ startTime: number; endTime: number }>;
}

export interface CandleHistoryRestoreResult {
  candles: Candle[];
  source: 'Binance' | 'stored' | 'stored+Binance' | 'cache' | 'none';
  storedCandles: number;
  binanceCandles: number;
  reused?: boolean;
}

type CandleCacheSubscriber = (snapshot: CandleCacheSnapshot) => void;

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function getCandleCacheKey({ contractType, symbol, timeframe }: CandleCacheKeyParts) {
  return `${contractType}::${normalizeSymbol(symbol)}::${timeframe}`;
}

function cloneCandle(candle: Candle): Candle {
  return { ...candle };
}

function cloneCandles(candles: Candle[]) {
  return candles.map(cloneCandle);
}

function mergeCandles(existing: Candle[], incoming: Candle[]) {
  const byTime = new Map<number, Candle>();

  for (const candle of existing) {
    byTime.set(candle.time, cloneCandle(candle));
  }

  for (const candle of incoming) {
    const current = byTime.get(candle.time);
    if (current?.isClosed && !candle.isClosed) continue;
    byTime.set(candle.time, cloneCandle(candle));
  }

  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_SHARED_CANDLES);
}

function getRange(candles: Candle[]) {
  if (candles.length === 0) return null;
  return {
    startTime: candles[0].time,
    endTime: candles[candles.length - 1].time,
  };
}

function log(message: string, details: Record<string, unknown>) {
  const cacheKey = String(details.cacheKey ?? 'n/a');
  const subscriberCount = String(details.subscriberCount ?? 'n/a');

  // console.log(
  //   `[CANDLE_CACHE] ${message} | key=${cacheKey} | subscribers=${subscriberCount}`,
  //   details,
  // );
}

export class CandleCache {
  private candles: Candle[] = [];
  private subscribers = new Set<CandleCacheSubscriber>();
  private loadedRanges: Array<{ startTime: number; endTime: number }> = [];
  private restorePromise: Promise<CandleHistoryRestoreResult> | null = null;
  private historyRestored = false;
  private unsubscribeLive: (() => void) | null = null;

  constructor(
    readonly key: string,
    private readonly parts: CandleCacheKeyParts,
  ) {}

  get candleCount() {
    return this.candles.length;
  }

  get subscriberCount() {
    return this.subscribers.size;
  }

  getLoadedRanges() {
    return this.loadedRanges.map((range) => ({ ...range }));
  }

  private getMetricDetails() {
    return {
      activeCacheKey: this.key,
      candleCount: this.candles.length,
      subscriberCount: this.subscribers.size,
      contractType: this.parts.contractType,
      symbol: this.parts.symbol,
      timeframe: this.parts.timeframe,
      coverageRange: getCoverageFromTimes(this.candles.map((candle) => candle.time)),
      loadedRanges: this.getLoadedRanges(),
      historyRestored: this.historyRestored,
      restoreInFlight: Boolean(this.restorePromise),
      approximateMemoryBytes: this.candles.length * 96,
    };
  }

  getSnapshot(reason: CandleCacheUpdateReason = 'snapshot', candle?: Candle): CandleCacheSnapshot {
    return {
      key: this.key,
      candles: cloneCandles(this.candles),
      candle: candle ? cloneCandle(candle) : undefined,
      reason,
      candleCount: this.candles.length,
      loadedRanges: this.getLoadedRanges(),
    };
  }

  subscribe(subscriber: CandleCacheSubscriber) {
    this.subscribers.add(subscriber);
    this.ensureLiveStream();
    updateCacheMetric('candle', this.key, this.getMetricDetails());
    log('subscriber added', {
      cacheKey: this.key,
      subscriberCount: this.subscribers.size,
      candleCount: this.candleCount,
      loadedRanges: this.getLoadedRanges(),
    });

    if (this.candles.length > 0) {
      subscriber(this.getSnapshot());
    }

    return () => {
      this.subscribers.delete(subscriber);
      updateCacheMetric('candle', this.key, this.getMetricDetails());
      log('subscriber removed', {
        cacheKey: this.key,
        subscriberCount: this.subscribers.size,
        candleCount: this.candleCount,
      });

      if (this.subscribers.size === 0 && this.unsubscribeLive) {
        this.unsubscribeLive();
        this.unsubscribeLive = null;
        updateCacheMetric('candle', this.key, this.getMetricDetails());
        log('live stream detached after last subscriber', {
          cacheKey: this.key,
          subscriberCount: 0,
          candleCount: this.candleCount,
        });
      }
    };
  }

  async restoreHistory(restore: () => Promise<CandleHistoryRestoreResult>) {
    if (this.historyRestored && this.candles.length > 0) {
      recordCacheAccess('candle', this.key, true, this.getMetricDetails());
      log('history restored from existing cache', {
        cacheKey: this.key,
        subscriberCount: this.subscribers.size,
        candleCount: this.candleCount,
        loadedRanges: this.getLoadedRanges(),
      });

      return {
        candles: cloneCandles(this.candles),
        source: 'cache' as const,
        storedCandles: 0,
        binanceCandles: 0,
        reused: true,
      };
    }

    if (this.restorePromise) {
      recordCacheRestoreRequest('candle', this.key, true, this.getMetricDetails());
      log('in-flight restore reused', {
        cacheKey: this.key,
        subscriberCount: this.subscribers.size,
        candleCount: this.candleCount,
      });
      return this.restorePromise.then((result) => ({
        ...result,
        reused: true,
      }));
    }

    log('history restore started', {
      cacheKey: this.key,
      subscriberCount: this.subscribers.size,
      candleCount: this.candleCount,
      loadedRanges: this.getLoadedRanges(),
    });

    recordCacheAccess('candle', this.key, false, this.getMetricDetails());
    recordCacheRestoreRequest('candle', this.key, false, this.getMetricDetails());
    this.restorePromise = restore()
      .then((result) => {
        if (result.candles.length > 0) {
          this.candles = mergeCandles(this.candles, result.candles);
          this.rememberLoadedRange(this.candles);
          this.notify('history-restored');
        }

        this.historyRestored = true;
        updateCacheMetric('candle', this.key, this.getMetricDetails());
        log('history restored', {
          cacheKey: this.key,
          subscriberCount: this.subscribers.size,
          source: result.source,
          storedCandles: result.storedCandles,
          binanceCandles: result.binanceCandles,
          candleCount: this.candleCount,
          loadedRanges: this.getLoadedRanges(),
        });

        return {
          ...result,
          candles: cloneCandles(this.candles),
          reused: false,
        };
      })
      .finally(() => {
        this.restorePromise = null;
        updateCacheMetric('candle', this.key, this.getMetricDetails());
      });

    return this.restorePromise;
  }

  private ensureLiveStream() {
    if (this.unsubscribeLive) return;

    this.unsubscribeLive = subscribeCandleStream(
      this.parts.contractType,
      this.parts.symbol,
      this.parts.timeframe,
      (candle) => this.ingestLiveCandle(candle),
    );
    log('live stream attached', {
      cacheKey: this.key,
      subscriberCount: this.subscribers.size,
      candleCount: this.candleCount,
    });
  }

  private ingestLiveCandle(candle: Candle) {
    this.candles = mergeCandles(this.candles, [candle]);
    this.rememberLoadedRange(this.candles);
    updateCacheMetric('candle', this.key, this.getMetricDetails());

    log('live candle updated', {
      cacheKey: this.key,
      subscriberCount: this.subscribers.size,
      candleTime: candle.time,
      isClosed: candle.isClosed,
      candleCount: this.candleCount,
      loadedRanges: this.getLoadedRanges(),
    });

    this.notify('live', candle);
  }

  private notify(reason: CandleCacheUpdateReason, candle?: Candle) {
    if (this.subscribers.size === 0) return;

    const snapshot = this.getSnapshot(reason, candle);
    log('notifying subscribers', {
      cacheKey: this.key,
      subscriberCount: this.subscribers.size,
      reason,
      candleTime: candle?.time ?? null,
      candleCount: this.candleCount,
    });
    for (const subscriber of Array.from(this.subscribers)) {
      subscriber(snapshot);
    }
  }

  private rememberLoadedRange(candles: Candle[]) {
    const range = getRange(candles);
    if (!range) return;

    this.loadedRanges.push(range);
    if (this.loadedRanges.length > 100) {
      this.loadedRanges = this.loadedRanges.slice(-100);
    }
  }
}

const sharedCandleCaches = new Map<string, CandleCache>();

export function getSharedCandleCache(parts: CandleCacheKeyParts) {
  const normalizedParts = {
    ...parts,
    symbol: normalizeSymbol(parts.symbol),
  };
  const key = getCandleCacheKey(normalizedParts);
  let cache = sharedCandleCaches.get(key);
  if (!cache) {
    cache = new CandleCache(key, normalizedParts);
    sharedCandleCaches.set(key, cache);
    updateCacheMetric('candle', key, {
      activeCacheKey: key,
      candleCount: 0,
      subscriberCount: 0,
      contractType: normalizedParts.contractType,
      symbol: normalizedParts.symbol,
      timeframe: normalizedParts.timeframe,
      coverageRange: null,
      loadedRanges: [],
      historyRestored: false,
      restoreInFlight: false,
      approximateMemoryBytes: 0,
      created: true,
    });
    log('cache created', {
      cacheKey: key,
      subscriberCount: 0,
      symbol: normalizedParts.symbol,
      contractType: normalizedParts.contractType,
      timeframe: normalizedParts.timeframe,
      maxCandles: MAX_SHARED_CANDLES,
    });
    return cache;
  }

  updateCacheMetric('candle', key, {
    activeCacheKey: key,
    candleCount: cache.candleCount,
    subscriberCount: cache.subscriberCount,
    contractType: normalizedParts.contractType,
    symbol: normalizedParts.symbol,
    timeframe: normalizedParts.timeframe,
    loadedRanges: cache.getLoadedRanges(),
    reused: true,
  });

  log('cache reused', {
    cacheKey: key,
    subscriberCount: cache.subscriberCount,
    symbol: normalizedParts.symbol,
    contractType: normalizedParts.contractType,
    timeframe: normalizedParts.timeframe,
    candleCount: cache.candleCount,
    loadedRanges: cache.getLoadedRanges(),
  });

  return cache;
}

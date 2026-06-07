import type { AggregateBubbleMarketSource, BubbleEvent, BubbleEventContractType, BubbleSizeBy, BubbleSource } from '../../types/bubble';
import type { VolumeBarsInputData, VolumeBarsMarketSource } from '../store/chart';

type StreamType = 'kline' | 'aggTrade' | 'depth';
type CacheKind = 'footprint' | 'volumeProfile' | 'candle';
type RestoreKind = 'candles' | 'rawTrades' | 'footprint' | 'volumeProfile' | 'orderbook' | 'storage' | 'aggregateBubbles';

interface CoverageRange {
  startTime: number;
  endTime: number;
}

interface StreamMetric {
  key: string;
  streamType: StreamType;
  subscriberCount: number;
  createdCount: number;
  reusedCount: number;
  closedCount: number;
  eventCount: number;
  lastEventAt: number | null;
  recentEventTimes: number[];
}

interface CacheMetric {
  key: string;
  kind: CacheKind;
  active: boolean;
  hitCount: number;
  missCount: number;
  restoreRequestCount: number;
  restoreDedupeCount: number;
  liveTradeDedupeCount: number;
  cleanupCount: number;
  evictedCount: number;
  slicesRemoved: number;
  rowsRemoved: number;
  memoryBytesRemoved: number;
  lastCleanupAt: number | null;
  lastUpdatedAt: number | null;
  details: Record<string, unknown>;
}

interface RestoreMetric {
  kind: RestoreKind;
  key: string;
  timestamp: number;
  rowsFetched?: number;
  rowsWritten?: number;
  distinctCandleTimeCount?: number;
  failedRows?: number;
  skippedRows?: number;
  details?: Record<string, unknown>;
}

interface AggregateBubbleEventSummary {
  time: number;
  price: number;
  volume: number;
  side: BubbleEvent['side'];
  source: BubbleEvent['source'];
  symbol: string;
  contractType: BubbleEvent['contractType'];
  tradeCount: number | null;
}

interface AggregateBubbleRenderedEventSummary extends AggregateBubbleEventSummary {
  renderedValue: number;
  renderedValueSource: BubbleSizeBy;
  tradeCountFallback: boolean;
  renderedX: number;
  renderedY: number;
  nearestCandleTime: number | null;
  candleHigh: number | null;
  candleLow: number | null;
  nearestFootprintBucket: number | null;
  nearestFootprintBidVol: number | null;
  nearestFootprintAskVol: number | null;
}

interface AggregateBubbleFilteredEventSummary extends AggregateBubbleEventSummary {
  reason: string;
  eventSeconds: number | null;
}

interface AggregateBubbleStorageThresholds {
  minVolume: number;
  minTradeCount: number;
  minTradeCountVolume: number;
}

interface AggregateBubbleRestoreDebugState {
  duplicateSkippedCount: number;
  restoreQueryRange: {
    startTime: number;
    endTime: number;
  } | null;
  storageThresholds: AggregateBubbleStorageThresholds | null;
}

export interface AggregateBubbleDebugSnapshot {
  panelId: string;
  bubbleSource: BubbleSource;
  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  activeChartMarketSource: {
    contractType: BubbleEventContractType;
    dataSourceMode: BubbleEventContractType | 'both';
  };
  bufferSize: number;
  maxBufferSize: number;
  restoredEventCount: number;
  liveEventCount: number;
  totalHydratedCount: number;
  duplicateSkippedCount: number;
  restoreQueryRange: {
    startTime: number;
    endTime: number;
  } | null;
  restoredSpotCount: number;
  restoredFuturesCount: number;
  minRestoredEventTime: number | null;
  maxRestoredEventTime: number | null;
  storageThresholds: AggregateBubbleStorageThresholds | null;
  currentRenderedCountAfterRestore: number | null;
  visibleEventCount: number;
  renderedCount: number;
  totalEventCountBySource: Record<BubbleEventContractType, number>;
  visibleEventCountBySource: Record<BubbleEventContractType, number>;
  renderedCountBySource: Record<BubbleEventContractType, number>;
  visibleEventCountBySizeMode: Record<BubbleSizeBy, number>;
  renderedCountBySizeMode: Record<BubbleSizeBy, number>;
  filteredCount: number;
  filterReasons: Record<string, number>;
  tradeCountFallbackCount: number;
  tradeCountFallbackPolicy: string | null;
  latestEvent: AggregateBubbleEventSummary | null;
  latestRendered: AggregateBubbleRenderedEventSummary | null;
  latestFiltered: AggregateBubbleFilteredEventSummary | null;
  visibleWindow: {
    startTime: number;
    endTime: number;
  } | null;
  settings: {
    sizeBy: BubbleSizeBy;
    marketSource: AggregateBubbleMarketSource;
    resolvedMarketSource: BubbleEventContractType | 'both';
    minVolume: number;
    minOrders: number;
    thresholdMode: 'absolute' | 'relative';
    side: 'both' | 'buy' | 'sell';
    scaleMode: 'linear' | 'sqrt' | 'log';
    minRadius: number;
    maxRadius: number;
    actualThreshold: number | null;
    actualThresholdMode: BubbleSizeBy | null;
  };
  updatedAt: number;
}

export interface VolumeBarsDebugSnapshot {
  panelId: string;
  volumeBarsEnabled: boolean;
  inputData: VolumeBarsInputData;
  marketSource: VolumeBarsMarketSource;
  visibleBarsCount: number;
  maxVisibleValue: number;
  averageValue: number | null;
  unavailableReason: string | null;
  updatedAt: number;
}

export interface MarketDebugSnapshot {
  enabled: boolean;
  generatedAt: number;
  streams: Array<Omit<StreamMetric, 'recentEventTimes'> & { eventRatePerSecond: number }>;
  caches: {
    footprint: CacheMetric[];
    volumeProfile: CacheMetric[];
    candle: CacheMetric[];
  };
  storage: {
    recentRestoreCalls: RestoreMetric[];
  };
  aggregateBubbles: Record<string, AggregateBubbleDebugSnapshot>;
  volumeBars: Record<string, VolumeBarsDebugSnapshot>;
  totals: {
    activeStreams: number;
    activeCaches: number;
    streamEvents: number;
    cacheHits: number;
    cacheMisses: number;
    restoreRequests: number;
    restoreDedupe: number;
    liveTradeDedupe: number;
    cacheCleanupRuns: number;
    cacheKeysEvicted: number;
    cacheSlicesRemoved: number;
    cacheRowsRemoved: number;
    cacheMemoryBytesRemoved: number;
  };
}

declare global {
  interface Window {
    __MARKET_DEBUG__?: {
      getSnapshot: () => MarketDebugSnapshot;
      reset: () => void;
    };
  }
}

const EVENT_RATE_WINDOW_MS = 10_000;
const MAX_EVENT_TIMES_PER_STREAM = 1_000;
const MAX_RECENT_RESTORE_CALLS = 80;

const streams = new Map<string, StreamMetric>();
const caches = new Map<string, CacheMetric>();
const recentRestoreCalls: RestoreMetric[] = [];
const aggregateBubbleDebug = new Map<string, AggregateBubbleDebugSnapshot>();
const aggregateBubbleRestoreDebug = new Map<string, AggregateBubbleRestoreDebugState>();
const volumeBarsDebug = new Map<string, VolumeBarsDebugSnapshot>();

function isExplicitlyEnabled() {
  return process.env.NEXT_PUBLIC_MARKET_DEBUG === 'true' || process.env.MARKET_DEBUG === 'true';
}

export function isMarketMetricsEnabled() {
  return process.env.NODE_ENV === 'development' || isExplicitlyEnabled();
}

function now() {
  return Date.now();
}

function pruneEventTimes(metric: StreamMetric, timestamp: number) {
  metric.recentEventTimes = metric.recentEventTimes
    .filter((eventTime) => timestamp - eventTime <= EVENT_RATE_WINDOW_MS)
    .slice(-MAX_EVENT_TIMES_PER_STREAM);
}

function getStreamMetric(streamType: StreamType, key: string) {
  const metricKey = `${streamType}:${key}`;
  let metric = streams.get(metricKey);
  if (!metric) {
    metric = {
      key,
      streamType,
      subscriberCount: 0,
      createdCount: 0,
      reusedCount: 0,
      closedCount: 0,
      eventCount: 0,
      lastEventAt: null,
      recentEventTimes: [],
    };
    streams.set(metricKey, metric);
  }
  return metric;
}

function getCacheMetric(kind: CacheKind, key: string) {
  const metricKey = `${kind}:${key}`;
  let metric = caches.get(metricKey);
  if (!metric) {
    metric = {
      key,
      kind,
      active: true,
      hitCount: 0,
      missCount: 0,
      restoreRequestCount: 0,
      restoreDedupeCount: 0,
      liveTradeDedupeCount: 0,
      cleanupCount: 0,
      evictedCount: 0,
      slicesRemoved: 0,
      rowsRemoved: 0,
      memoryBytesRemoved: 0,
      lastCleanupAt: null,
      lastUpdatedAt: null,
      details: {},
    };
    caches.set(metricKey, metric);
  }
  return metric;
}

function attachBrowserApi() {
  if (typeof window === 'undefined' || !isMarketMetricsEnabled()) return;
  if (window.__MARKET_DEBUG__) return;

  window.__MARKET_DEBUG__ = {
    getSnapshot,
    reset,
  };
}

function markCacheUpdated(metric: CacheMetric, details?: Record<string, unknown>) {
  metric.active = true;
  metric.lastUpdatedAt = now();
  if (details) {
    metric.details = {
      ...metric.details,
      ...details,
    };
  }
}

export function recordStreamCreated(streamType: StreamType, key: string, subscriberCount = 0) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getStreamMetric(streamType, key);
  metric.createdCount += 1;
  metric.subscriberCount = subscriberCount;
}

export function recordStreamReused(streamType: StreamType, key: string, subscriberCount = 0) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getStreamMetric(streamType, key);
  metric.reusedCount += 1;
  metric.subscriberCount = subscriberCount;
}

export function recordStreamClosed(streamType: StreamType, key: string) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getStreamMetric(streamType, key);
  metric.closedCount += 1;
  metric.subscriberCount = 0;
}

export function recordStreamSubscriberCount(streamType: StreamType, key: string, subscriberCount: number) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  getStreamMetric(streamType, key).subscriberCount = subscriberCount;
}

export function recordStreamEvent(streamType: StreamType, key: string, eventTimestamp?: number) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const timestamp = eventTimestamp ?? now();
  const metric = getStreamMetric(streamType, key);
  metric.eventCount += 1;
  metric.lastEventAt = timestamp;
  metric.recentEventTimes.push(timestamp);
  pruneEventTimes(metric, timestamp);
}

export function updateCacheMetric(
  kind: CacheKind,
  key: string,
  details: Record<string, unknown>,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  markCacheUpdated(getCacheMetric(kind, key), details);
}

export function recordCacheAccess(
  kind: CacheKind,
  key: string,
  hit: boolean,
  details?: Record<string, unknown>,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getCacheMetric(kind, key);
  if (hit) metric.hitCount += 1;
  else metric.missCount += 1;
  markCacheUpdated(metric, details);
}

export function recordCacheRestoreRequest(
  kind: CacheKind,
  key: string,
  deduped: boolean,
  details?: Record<string, unknown>,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getCacheMetric(kind, key);
  metric.restoreRequestCount += 1;
  if (deduped) metric.restoreDedupeCount += 1;
  markCacheUpdated(metric, details);
}

export function recordLiveTradeDedupe(
  kind: CacheKind,
  key: string,
  details?: Record<string, unknown>,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getCacheMetric(kind, key);
  metric.liveTradeDedupeCount += 1;
  markCacheUpdated(metric, details);
}

export function recordCacheCleanup(
  kind: CacheKind,
  key: string,
  details: {
    evicted?: boolean;
    slicesRemoved?: number;
    rowsRemoved?: number;
    approximateMemoryBytesBefore?: number;
    approximateMemoryBytesAfter?: number;
  } & Record<string, unknown>,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const metric = getCacheMetric(kind, key);
  const timestamp = now();
  const slicesRemoved = Number(details.slicesRemoved ?? 0);
  const rowsRemoved = Number(details.rowsRemoved ?? 0);
  const memoryBefore = Number(details.approximateMemoryBytesBefore ?? 0);
  const memoryAfter = Number(details.approximateMemoryBytesAfter ?? 0);

  metric.cleanupCount += 1;
  metric.slicesRemoved += Number.isFinite(slicesRemoved) ? slicesRemoved : 0;
  metric.rowsRemoved += Number.isFinite(rowsRemoved) ? rowsRemoved : 0;
  metric.memoryBytesRemoved += Math.max(0, memoryBefore - memoryAfter);
  metric.lastCleanupAt = timestamp;
  metric.lastUpdatedAt = timestamp;

  if (details.evicted) {
    metric.evictedCount += 1;
    metric.active = false;
  } else {
    metric.active = true;
  }

  metric.details = {
    ...metric.details,
    ...details,
    lastCleanupTimestamp: timestamp,
  };
}

export function recordRestoreDiagnostic(call: RestoreMetric) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  recentRestoreCalls.push({
    ...call,
    timestamp: call.timestamp || now(),
  });
  while (recentRestoreCalls.length > MAX_RECENT_RESTORE_CALLS) {
    recentRestoreCalls.shift();
  }
}

export function recordAggregateBubbleDebug(snapshot: Omit<AggregateBubbleDebugSnapshot, 'updatedAt'>) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  const restoreDebug = aggregateBubbleRestoreDebug.get(snapshot.panelId);
  aggregateBubbleDebug.set(snapshot.panelId, {
    ...snapshot,
    duplicateSkippedCount: restoreDebug?.duplicateSkippedCount ?? snapshot.duplicateSkippedCount,
    restoreQueryRange: restoreDebug?.restoreQueryRange ?? snapshot.restoreQueryRange,
    storageThresholds: restoreDebug?.storageThresholds ?? snapshot.storageThresholds,
    currentRenderedCountAfterRestore: restoreDebug ? snapshot.renderedCount : snapshot.currentRenderedCountAfterRestore,
    updatedAt: now(),
  });
}

export function recordAggregateBubbleRestoreDebug(
  panelId: string,
  state: AggregateBubbleRestoreDebugState,
) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  aggregateBubbleRestoreDebug.set(panelId, state);
}

export function recordVolumeBarsDebug(snapshot: Omit<VolumeBarsDebugSnapshot, 'updatedAt'>) {
  if (!isMarketMetricsEnabled()) return;
  attachBrowserApi();
  volumeBarsDebug.set(snapshot.panelId, {
    ...snapshot,
    updatedAt: now(),
  });
}

export function getCoverageFromTimes(times: number[]): CoverageRange | null {
  if (times.length === 0) return null;
  return {
    startTime: Math.min(...times),
    endTime: Math.max(...times),
  };
}

export function getSnapshot(): MarketDebugSnapshot {
  attachBrowserApi();
  const generatedAt = now();
  const streamSnapshots = Array.from(streams.values()).map((metric) => {
    pruneEventTimes(metric, generatedAt);
    const oldestEventTime = metric.recentEventTimes[0];
    const elapsedSeconds = oldestEventTime === undefined
      ? EVENT_RATE_WINDOW_MS / 1000
      : Math.max(1, (generatedAt - oldestEventTime) / 1000);

    return {
      key: metric.key,
      streamType: metric.streamType,
      subscriberCount: metric.subscriberCount,
      createdCount: metric.createdCount,
      reusedCount: metric.reusedCount,
      closedCount: metric.closedCount,
      eventCount: metric.eventCount,
      lastEventAt: metric.lastEventAt,
      eventRatePerSecond: metric.recentEventTimes.length / elapsedSeconds,
    };
  });

  const cacheSnapshots = Array.from(caches.values()).map((metric) => ({
    key: metric.key,
    kind: metric.kind,
    active: metric.active,
    hitCount: metric.hitCount,
    missCount: metric.missCount,
    restoreRequestCount: metric.restoreRequestCount,
    restoreDedupeCount: metric.restoreDedupeCount,
    liveTradeDedupeCount: metric.liveTradeDedupeCount,
    cleanupCount: metric.cleanupCount,
    evictedCount: metric.evictedCount,
    slicesRemoved: metric.slicesRemoved,
    rowsRemoved: metric.rowsRemoved,
    memoryBytesRemoved: metric.memoryBytesRemoved,
    lastCleanupAt: metric.lastCleanupAt,
    lastUpdatedAt: metric.lastUpdatedAt,
    details: { ...metric.details },
  }));

  const totals = cacheSnapshots.reduce(
    (acc, cache) => {
      acc.activeCaches += cache.active ? 1 : 0;
      acc.cacheHits += cache.hitCount;
      acc.cacheMisses += cache.missCount;
      acc.restoreRequests += cache.restoreRequestCount;
      acc.restoreDedupe += cache.restoreDedupeCount;
      acc.liveTradeDedupe += cache.liveTradeDedupeCount;
      acc.cacheCleanupRuns += cache.cleanupCount;
      acc.cacheKeysEvicted += cache.evictedCount;
      acc.cacheSlicesRemoved += cache.slicesRemoved;
      acc.cacheRowsRemoved += cache.rowsRemoved;
      acc.cacheMemoryBytesRemoved += cache.memoryBytesRemoved;
      return acc;
    },
    {
      activeStreams: streamSnapshots.filter((stream) => stream.subscriberCount > 0).length,
      activeCaches: 0,
      streamEvents: streamSnapshots.reduce((total, stream) => total + stream.eventCount, 0),
      cacheHits: 0,
      cacheMisses: 0,
      restoreRequests: 0,
      restoreDedupe: 0,
      liveTradeDedupe: 0,
      cacheCleanupRuns: 0,
      cacheKeysEvicted: 0,
      cacheSlicesRemoved: 0,
      cacheRowsRemoved: 0,
      cacheMemoryBytesRemoved: 0,
    },
  );

  return {
    enabled: isMarketMetricsEnabled(),
    generatedAt,
    streams: streamSnapshots,
    caches: {
      footprint: cacheSnapshots.filter((cache) => cache.kind === 'footprint'),
      volumeProfile: cacheSnapshots.filter((cache) => cache.kind === 'volumeProfile'),
      candle: cacheSnapshots.filter((cache) => cache.kind === 'candle'),
    },
    storage: {
      recentRestoreCalls: recentRestoreCalls.map((call) => ({
        ...call,
        details: call.details ? { ...call.details } : undefined,
      })),
    },
    aggregateBubbles: Object.fromEntries(
      Array.from(aggregateBubbleDebug.entries()).map(([panelId, snapshot]) => [
        panelId,
        {
          ...snapshot,
          activeChartMarketSource: { ...snapshot.activeChartMarketSource },
          totalEventCountBySource: { ...snapshot.totalEventCountBySource },
          visibleEventCountBySource: { ...snapshot.visibleEventCountBySource },
          renderedCountBySource: { ...snapshot.renderedCountBySource },
          visibleEventCountBySizeMode: { ...snapshot.visibleEventCountBySizeMode },
          renderedCountBySizeMode: { ...snapshot.renderedCountBySizeMode },
          filterReasons: { ...snapshot.filterReasons },
          latestEvent: snapshot.latestEvent ? { ...snapshot.latestEvent } : null,
          latestRendered: snapshot.latestRendered ? { ...snapshot.latestRendered } : null,
          latestFiltered: snapshot.latestFiltered ? { ...snapshot.latestFiltered } : null,
          visibleWindow: snapshot.visibleWindow ? { ...snapshot.visibleWindow } : null,
          restoreQueryRange: snapshot.restoreQueryRange ? { ...snapshot.restoreQueryRange } : null,
          storageThresholds: snapshot.storageThresholds ? { ...snapshot.storageThresholds } : null,
          settings: { ...snapshot.settings },
        },
      ]),
    ),
    volumeBars: Object.fromEntries(
      Array.from(volumeBarsDebug.entries()).map(([panelId, snapshot]) => [
        panelId,
        { ...snapshot },
      ]),
    ),
    totals,
  };
}

export function reset() {
  streams.clear();
  caches.clear();
  recentRestoreCalls.length = 0;
  aggregateBubbleDebug.clear();
  aggregateBubbleRestoreDebug.clear();
  volumeBarsDebug.clear();
  attachBrowserApi();
}

attachBrowserApi();

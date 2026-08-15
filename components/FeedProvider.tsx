'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChartStore, PanelId, type HistoryRestoreStatus, type PanelState } from '../lib/store/chart';
import { useChartRuntimeStore } from '../lib/store/chartRuntime';
import {
  AggregationEngine,
  BASE_FOOTPRINT_BUCKET_SIZE,
  BASE_FOOTPRINT_TIMEFRAME,
  BASE_FOOTPRINT_TIMEFRAME_SECONDS,
} from '../lib/aggregation/engine';
import {
  fetchSharedHistory,
  fetchSharedOrderbookSnapshot,
  subscribeDepthStream,
  subscribeTradeStream,
} from '../lib/feeds/feedRegistry';
import { CandleHistoryRestoreResult, getSharedCandleCache } from '../lib/feeds/candleCache';
import { buildAbsorptionMap, scoreLatestCandle } from '../lib/absorption/engine';
import { buildExhaustionMap, scoreLatestExhaustion } from '../lib/exhaustion/engine';
import { IcebergEngine } from '../lib/iceberg/engine';
import { buildLiquidityVacuumZones } from '../lib/liquidityVacuum/engine';
import { getCandleTimeForTrade, normalizePriceToBucket } from '../lib/utils/aggregation';
import { ChartEngineContext } from './ChartEngineContext';
import { FineProfileRow, RawTradeVolumeProfileEngine } from '../lib/volumeProfile/profileEngine';
import { Candle } from '../types/candle';
import { Trade } from '../types/trade';
import type { AggregateBubbleMarketSource, BubbleEvent } from '../types/bubble';
import { FootprintCell } from '../types/footprint';
import { AbsorptionResult } from '../types/absorption';
import { ExhaustionResult } from '../types/exhaustion';
import { IcebergLevel } from '../types/iceberg';
import { LiquidityVacuumZone } from '../types/liquidityVacuum';
import { OrderbookManager, DepthUpdate } from '../lib/liquidity/orderbook';
import { aggregateOrderbook } from '../lib/liquidity/aggregation';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { storeBaseFootprintAction, storeClosedCandleAction, storeFineProfileRowsAction, storeRawTradesAction } from '../lib/actions/storageActions';
import { FINE_PROFILE_STORAGE_TIMEFRAME, getFineProfileBaseBucketSize } from '../lib/config/markets';
import { recordAggregateBubbleRestoreDebug, recordRestoreDiagnostic } from '../lib/debug/marketMetrics';

interface PanelFeedProviderProps {
  panelId: PanelId;
  children: React.ReactNode;
}

const RAW_TRADE_FLUSH_MS = 2000;
const RAW_TRADE_FLUSH_SIZE = 500;
const PROFILE_REDRAW_MS = 500;
const HYDRATION_CHUNK_SIZE = 1000;
const RAW_TRADE_HISTORY_PAGE_SIZE = 50000;
const RAW_TRADE_HISTORY_MAX_PAGES = 10;
const FINE_PROFILE_FLUSH_SIZE = 1000;
const FINE_PROFILE_DEFAULT_RESTORE_SECONDS = 4 * 60 * 60;
const FINE_PROFILE_RESTORE_CHUNK_SECONDS = 2 * 60 * 60;
const FINE_PROFILE_LAZY_VISIBLE_BARS = 160;
const FINE_PROFILE_LAZY_SCROLL_THRESHOLD_BARS = 20;
const AGGREGATE_BUBBLE_RESTORE_SECONDS = 6 * 60 * 60;
const AGGREGATE_BUBBLE_RESTORE_LIMIT = 10000;
const FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS = 2 * 60 * 60;
const FOOTPRINT_RESTORE_MAX_TOTAL_SECONDS = FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS * 2;
const FOOTPRINT_RESTORE_ASSUMED_DRAWABLE_WIDTH_PX = 1200;
const FOOTPRINT_RESTORE_MIN_VISIBLE_BARS = 40;
const FOOTPRINT_RESTORE_MAX_VISIBLE_BARS = 180;
const FOOTPRINT_RESTORE_BUFFER_BARS = 10;
const MAX_DEDUPE_KEYS = 100000;
const ENABLE_BROWSER_MARKET_WRITES = process.env.NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES === 'true';
const ENABLE_RAW_TRADE_RESTORE = process.env.NEXT_PUBLIC_ENABLE_RAW_TRADE_RESTORE === 'true';

const queuedRawTradeStorageKeys = new Set<string>();
const closedCandleStorageKeys = new Set<string>();
const queuedFineProfileCandleKeys = new Set<string>();

type TradeSource = 'spot' | 'futures';
type FootprintWorkReason =
  | 'chart-mode-footprint'
  | 'footprint-cell-bubbles'
  | 'cvd'
  | 'absorption'
  | 'exhaustion'
  | 'iceberg'
  | 'liquidity-vacuum'
  | 'browser-market-writes';

interface FootprintWorkNeed {
  needed: boolean;
  reasons: FootprintWorkReason[];
}

function getFootprintWorkNeed(panel: PanelState): FootprintWorkNeed {
  const reasons: FootprintWorkReason[] = [];

  if (panel.chartMode === 'footprint') reasons.push('chart-mode-footprint');
  if (panel.bubblesEnabled && panel.bubbleSource === 'footprintCells') reasons.push('footprint-cell-bubbles');
  if (panel.cvdEnabled) reasons.push('cvd');
  if (panel.absorptionEnabled) reasons.push('absorption');
  if (panel.exhaustionEnabled) reasons.push('exhaustion');
  if (panel.icebergEnabled) reasons.push('iceberg');
  if (panel.liquidityVacuumEnabled) reasons.push('liquidity-vacuum');
  if (ENABLE_BROWSER_MARKET_WRITES) reasons.push('browser-market-writes');

  return {
    needed: reasons.length > 0,
    reasons,
  };
}

function getTradeSourcesForDataSourceMode(dataSourceMode: TradeSource | 'both'): TradeSource[] {
  return dataSourceMode === 'both' ? ['spot', 'futures'] : [dataSourceMode];
}

function getTradeSourcesForAggregateMarketSource(
  aggregateBubbleMarketSource: AggregateBubbleMarketSource,
  contractType: TradeSource,
  dataSourceMode: TradeSource | 'both',
) {
  if (aggregateBubbleMarketSource === 'active') {
    return getTradeSourcesForDataSourceMode(dataSourceMode || contractType);
  }

  return aggregateBubbleMarketSource === 'both'
    ? ['spot', 'futures'] as TradeSource[]
    : [aggregateBubbleMarketSource];
}

function needsAggregateEventsForVolumeBars(panel: PanelState) {
  return panel.volumeBarsEnabled && panel.volumeBarsInputData !== 'volume';
}

function needsAggregateEvents(panel: PanelState) {
  return (
    (panel.bubblesEnabled && panel.bubbleSource === 'aggregateTrades')
    || needsAggregateEventsForVolumeBars(panel)
  );
}

function getTradeDedupeKey(trade: Trade, source: TradeSource) {
  if (Number.isFinite(trade.id)) return `${source}:${trade.id}`;
  return `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker}`;
}

function getAggregateTradeCount(trade: Trade) {
  const firstTradeId = Number(trade.firstTradeId);
  const lastTradeId = Number(trade.lastTradeId);

  if (!Number.isFinite(firstTradeId) || !Number.isFinite(lastTradeId) || lastTradeId < firstTradeId) {
    return undefined;
  }

  return Math.floor(lastTradeId - firstTradeId + 1);
}

function createAggregateBubbleEvent(trade: Trade, source: TradeSource, symbol: string): BubbleEvent | null {
  if (!Number.isFinite(trade.time) || !Number.isFinite(trade.price) || !Number.isFinite(trade.quantity)) {
    return null;
  }

  const tradeCount = getAggregateTradeCount(trade);
  return {
    time: trade.time,
    price: trade.price,
    side: trade.isBuyerMaker ? 'sell' : 'buy',
    volume: trade.quantity,
    ...(tradeCount === undefined ? {} : { tradeCount }),
    source: 'aggregateTrade',
    symbol,
    contractType: source,
    ...(Number.isFinite(trade.id) ? { aggregateTradeId: trade.id } : {}),
    ...(Number.isFinite(trade.firstTradeId) ? { firstTradeId: trade.firstTradeId } : {}),
    ...(Number.isFinite(trade.lastTradeId) ? { lastTradeId: trade.lastTradeId } : {}),
    origin: 'live',
  };
}

function getTimeframeSeconds(timeframe: string) {
  if (timeframe.endsWith('m')) return parseInt(timeframe, 10) * 60;
  if (timeframe.endsWith('h')) return parseInt(timeframe, 10) * 3600;
  if (timeframe.endsWith('d')) return parseInt(timeframe, 10) * 86400;
  return 60;
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function rememberBounded(set: Set<string>, key: string) {
  set.add(key);

  while (set.size > MAX_DEDUPE_KEYS) {
    const oldest = set.values().next().value;
    if (oldest === undefined) break;
    set.delete(oldest);
  }
}

function claimRawTradeStorage(symbol: string, trade: Trade) {
  if (!Number.isFinite(trade.id)) return false;

  const key = `${symbol}:${trade.id}`;
  if (queuedRawTradeStorageKeys.has(key)) return false;

  rememberBounded(queuedRawTradeStorageKeys, key);
  return true;
}

function claimClosedCandleStorage(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  bucketSize: number,
) {
  const key = `${symbol}:${contractType}:${dataSourceMode}:${timeframe}:${candleTime}:${bucketSize}`;
  if (closedCandleStorageKeys.has(key)) return false;

  rememberBounded(closedCandleStorageKeys, key);
  return true;
}

function claimFineProfileStorage(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  baseBucketSize: number,
  bucketPrice: number,
) {
  const key = `${symbol}:${contractType}:${dataSourceMode}:${timeframe}:${candleTime}:${baseBucketSize}:${bucketPrice}`;
  if (queuedFineProfileCandleKeys.has(key)) return false;

  rememberBounded(queuedFineProfileCandleKeys, key);
  return true;
}

interface RawTradeHydrationStats {
  pages: number;
  fetched: number;
  hydrated: number;
  oldestTime: number | null;
  newestTime: number | null;
  reachedStart: boolean;
  hydratedCandleTimes: Set<number>;
}

interface FootprintHistoryRow {
  candleTime: number;
  bucketPrice: number;
  bidVol: number;
  askVol: number;
  delta?: number;
}

interface FootprintRestoreRange {
  startSeconds: number;
  endSeconds: number;
}

interface FootprintHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
  cellsHydrated: number;
  bucketMatches: number;
  bucketMisses: number;
  requestedRange: FootprintRestoreRange | null;
  clampedRange: FootprintRestoreRange | null;
  chunkCount: number;
  chunksFetched: number;
  chunksSkipped: number;
  rowsPerChunk: number[];
  skippedBecauseRangeTooLarge: boolean;
  restoreFailureReason: string | null;
}

interface FineProfileHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
  chunksFetched?: number;
  chunksSkipped?: number;
}

interface AggregateBubbleStorageThresholds {
  minVolume: number;
  minTradeCount: number;
  minTradeCountVolume: number;
}

interface AggregateBubbleHydrationStats {
  rowsFetched: number;
  rowsHydrated: number;
  duplicateSkipped: number;
  spotCount: number;
  futuresCount: number;
  oldestTime: number | null;
  newestTime: number | null;
  range: {
    startTime: number;
    endTime: number;
  } | null;
  thresholds: AggregateBubbleStorageThresholds | null;
}

function cloneFineProfileRows(rows: Iterable<FineProfileRow>) {
  return Array.from(rows, (row) => ({ ...row }));
}

function mergeHistoryCandles(existing: Candle[], incoming: Candle[]) {
  const byTime = new Map<number, Candle>();

  for (const candle of existing) {
    byTime.set(candle.time, candle);
  }

  for (const candle of incoming) {
    const current = byTime.get(candle.time);
    if (current?.isClosed && !candle.isClosed) continue;
    byTime.set(candle.time, candle);
  }

  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-500);
}

function getHistoryWindow(candles: Candle[], timeframeSeconds: number) {
  if (candles.length === 0) return null;

  const startSeconds = candles[0].time;
  const inferredSeconds = candles.length >= 2
    ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
    : timeframeSeconds;
  const endSeconds = candles[candles.length - 1].time + inferredSeconds;

  return {
    startSeconds,
    endSeconds,
    startMs: startSeconds * 1000,
    endMs: endSeconds * 1000,
  };
}

function getBaseFootprintWindow(candles: Candle[], timeframeSeconds: number) {
  const window = getHistoryWindow(candles, timeframeSeconds);
  if (!window) return null;

  const startSeconds = Math.floor(window.startSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS;
  const endSeconds = Math.ceil(window.endSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS;

  return {
    startSeconds,
    endSeconds,
    startMs: startSeconds * 1000,
    endMs: endSeconds * 1000,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function inferCandleSpanSeconds(candles: Candle[], index: number, fallbackSeconds: number) {
  const current = candles[index]?.time;
  const next = candles[index + 1]?.time;
  if (Number.isFinite(current) && Number.isFinite(next) && next > current) {
    return next - current;
  }

  const previous = candles[index - 1]?.time;
  if (Number.isFinite(current) && Number.isFinite(previous) && current > previous) {
    return current - previous;
  }

  return Math.max(BASE_FOOTPRINT_TIMEFRAME_SECONDS, fallbackSeconds);
}

function alignFootprintRange(startSeconds: number, endSeconds: number): FootprintRestoreRange {
  return {
    startSeconds: Math.floor(startSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS,
    endSeconds: Math.ceil(endSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS,
  };
}

function getFootprintRestorePlan(
  candles: Candle[],
  panel: PanelState,
  timeframeSeconds: number,
) {
  const historyRange = getBaseFootprintWindow(candles, timeframeSeconds);
  if (!historyRange || candles.length === 0) return null;

  const safeBarWidth = Math.max(1, Number.isFinite(panel.barWidth) ? panel.barWidth : 12);
  const safeScrollOffset = Math.max(0, Number.isFinite(panel.scrollOffset) ? panel.scrollOffset : 0);
  const approximateVisibleBars = clampNumber(
    Math.ceil(FOOTPRINT_RESTORE_ASSUMED_DRAWABLE_WIDTH_PX / safeBarWidth),
    FOOTPRINT_RESTORE_MIN_VISIBLE_BARS,
    FOOTPRINT_RESTORE_MAX_VISIBLE_BARS,
  );
  const rawLastVisibleIndex = candles.length - 1 - Math.floor(safeScrollOffset / safeBarWidth);
  const lastVisibleIndex = clampNumber(rawLastVisibleIndex, 0, candles.length - 1);
  const firstIndex = clampNumber(
    lastVisibleIndex - approximateVisibleBars - FOOTPRINT_RESTORE_BUFFER_BARS,
    0,
    lastVisibleIndex,
  );
  const lastIndex = clampNumber(
    lastVisibleIndex + FOOTPRINT_RESTORE_BUFFER_BARS,
    firstIndex,
    candles.length - 1,
  );
  const requestedRange = alignFootprintRange(
    candles[firstIndex].time,
    candles[lastIndex].time + inferCandleSpanSeconds(candles, lastIndex, timeframeSeconds),
  );
  const clampedStartSeconds = Math.max(
    requestedRange.startSeconds,
    requestedRange.endSeconds - FOOTPRINT_RESTORE_MAX_TOTAL_SECONDS,
  );
  const clampedRange = alignFootprintRange(clampedStartSeconds, requestedRange.endSeconds);

  return {
    historyRange: {
      startSeconds: historyRange.startSeconds,
      endSeconds: historyRange.endSeconds,
    },
    requestedRange,
    clampedRange,
    requestedVisibleBars: lastIndex - firstIndex + 1,
    approximateVisibleBars,
    skippedBecauseRangeTooLarge: requestedRange.endSeconds - requestedRange.startSeconds > FOOTPRINT_RESTORE_MAX_TOTAL_SECONDS,
  };
}

function getFootprintRestoreChunks(range: FootprintRestoreRange) {
  const chunks: FootprintRestoreRange[] = [];
  let cursor = range.startSeconds;

  while (cursor < range.endSeconds) {
    const next = Math.min(range.endSeconds, cursor + FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS);
    chunks.push({ startSeconds: cursor, endSeconds: next });
    cursor = next;
  }

  return chunks;
}

function getBaseCandleTimeForTrade(tradeTimeMs: number) {
  return getCandleTimeForTrade(tradeTimeMs, BASE_FOOTPRINT_TIMEFRAME_SECONDS);
}

function getFootprintCoverage(candles: Candle[], engine: AggregationEngine) {
  let footprintCandles = 0;
  let footprintCandlesWithCells = 0;

  for (const candle of candles) {
    const footprint = engine.getFootprintCandle(candle.time);
    if (!footprint) continue;

    footprintCandles += 1;
    if (footprint.cells.size > 0) {
      footprintCandlesWithCells += 1;
    }
  }

  return { footprintCandles, footprintCandlesWithCells };
}

function formatSeconds(seconds: number | null) {
  return seconds == null ? 'n/a' : new Date(seconds * 1000).toISOString();
}

function formatMilliseconds(milliseconds: number | null) {
  return milliseconds == null ? 'n/a' : new Date(milliseconds).toISOString();
}

function alignFineProfileRange(startSeconds: number, endSeconds: number) {
  return {
    startSeconds: Math.floor(startSeconds / 60) * 60,
    endSeconds: Math.ceil(endSeconds / 60) * 60,
  };
}

function getFineProfileRestoreChunks(startSeconds: number, endSeconds: number) {
  const aligned = alignFineProfileRange(startSeconds, endSeconds);
  const chunks: Array<{ startSeconds: number; endSeconds: number }> = [];

  for (
    let chunkStart = aligned.startSeconds;
    chunkStart < aligned.endSeconds;
    chunkStart += FINE_PROFILE_RESTORE_CHUNK_SECONDS
  ) {
    chunks.push({
      startSeconds: chunkStart,
      endSeconds: Math.min(aligned.endSeconds, chunkStart + FINE_PROFILE_RESTORE_CHUNK_SECONDS),
    });
  }

  return chunks;
}

function getAggregateBubbleEventKey(event: BubbleEvent) {
  if (Number.isFinite(event.aggregateTradeId)) {
    return `${event.symbol}:${event.contractType}:id:${event.aggregateTradeId}`;
  }

  return `${event.symbol}:${event.contractType}:${event.time}:${event.price}:${event.volume}:${event.side}`;
}

function getAggregateBubbleRestoreRange(candles: Candle[], timeframeSeconds: number) {
  const window = getHistoryWindow(candles, timeframeSeconds);
  if (!window) return null;

  const restoreEndSeconds = window.endSeconds;
  const restoreStartSeconds = Math.max(window.startSeconds, restoreEndSeconds - AGGREGATE_BUBBLE_RESTORE_SECONDS);

  return {
    startTime: restoreStartSeconds * 1000,
    endTime: restoreEndSeconds * 1000,
  };
}

function parseAggregateBubbleThresholds(response: Response): AggregateBubbleStorageThresholds | null {
  const minVolume = Number(response.headers.get('x-aggregate-bubble-min-volume'));
  const minTradeCount = Number(response.headers.get('x-aggregate-bubble-min-trade-count'));
  const minTradeCountVolume = Number(response.headers.get('x-aggregate-bubble-min-trade-count-volume'));

  if (!Number.isFinite(minVolume) || !Number.isFinite(minTradeCount) || !Number.isFinite(minTradeCountVolume)) {
    return null;
  }

  return { minVolume, minTradeCount, minTradeCountVolume };
}

export function PanelFeedProvider({ panelId, children }: PanelFeedProviderProps) {
  const pair = useChartStore(s => s.panels[panelId].pair);
  const timeframe = useChartStore(s => s.panels[panelId].timeframe);
  const bucketSize = useChartStore(s => s.panels[panelId].bucketSize);
  const autoBucketSize = useChartStore(s => s.panels[panelId].autoBucketSize);
  const chartMode = useChartStore(s => s.panels[panelId].chartMode);
  const contractType = useChartStore(s => s.panels[panelId].contractType);
  const dataSourceMode = useChartStore(s => s.panels[panelId].dataSourceMode);
  const bubblesEnabled = useChartStore(s => s.panels[panelId].bubblesEnabled);
  const bubbleSource = useChartStore(s => s.panels[panelId].bubbleSource);
  const volumeBarsEnabled = useChartStore(s => s.panels[panelId].volumeBarsEnabled);
  const volumeBarsInputData = useChartStore(s => s.panels[panelId].volumeBarsInputData);
  const tickSize = useChartStore(s => s.tickSize);
  const pushCandle = useChartRuntimeStore(s => s.pushCandle);
  const setConnected = useChartRuntimeStore(s => s.setConnected);
  const pushAllCandles = useChartRuntimeStore(s => s.pushAllCandles);
  const setLoadingHistory = useChartRuntimeStore(s => s.setLoadingHistory);
  const setHistoryRestoreStatus = useChartRuntimeStore(s => s.setHistoryRestoreStatus);
  const triggerFootprintRedraw = useChartRuntimeStore(s => s.triggerFootprintRedraw);
  const appendAggregateBubbleEvents = useChartRuntimeStore(s => s.appendAggregateBubbleEvents);
  const setComputedBucketSize = useChartStore(s => s.setComputedBucketSize);
  const setAbsorptionMap = useChartRuntimeStore(s => s.setAbsorptionMap);
  const setExhaustionMap = useChartRuntimeStore(s => s.setExhaustionMap);
  const exhaustionLookback = useChartStore(s => s.panels[panelId].exhaustionLookback);
  const setIcebergLevels = useChartRuntimeStore(s => s.setIcebergLevels);
  const icebergEnabled = useChartStore(s => s.panels[panelId].icebergEnabled);
  const icebergMinScore = useChartStore(s => s.panels[panelId].icebergMinScore);
  const icebergLookback = useChartStore(s => s.panels[panelId].icebergLookback);
  const setLiquidityVacuumZones = useChartRuntimeStore(s => s.setLiquidityVacuumZones);
  const liquidityVacuumEnabled = useChartStore(s => s.panels[panelId].liquidityVacuumEnabled);
  const liquidityVacuumMinScore = useChartStore(s => s.panels[panelId].liquidityVacuumMinScore);
  const liquidityVacuumMaxZones = useChartStore(s => s.panels[panelId].liquidityVacuumMaxZones);
  const setLiquidityZones = useChartRuntimeStore(s => s.setLiquidityZones);
  const resetPanelRuntime = useChartRuntimeStore(s => s.resetPanelRuntime);
  const liquidityEnabled = useChartStore(s => s.panels[panelId].liquidityEnabled);
  const liquidityHeatmapEnabled = useChartStore(s => s.panels[panelId].liquidityHeatmapEnabled);
  const liquidityBucketSize = useChartStore(s => s.panels[panelId].liquidityBucketSize);
  const liquidityHistoryDepth = useChartStore(s => s.panels[panelId].liquidityHistoryDepth);
  const minimumLiquidityThreshold = useChartStore(s => s.panels[panelId].minimumLiquidityThreshold);
  const liquidityRange = useChartStore(s => s.panels[panelId].liquidityRange);
  const absorptionEnabled = useChartStore(s => s.panels[panelId].absorptionEnabled);
  const exhaustionEnabled = useChartStore(s => s.panels[panelId].exhaustionEnabled);
  const cvdEnabled = useChartStore(s => s.panels[panelId].cvdEnabled);

  const connectedRef = useRef(false);
  const bucketSizeRef = useRef(bucketSize);
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const volumeProfileEngineRef = useRef(new RawTradeVolumeProfileEngine());
  const pendingFootprintRedrawRef = useRef(false);
  const pendingProfileRedrawRef = useRef(false);
  const pendingAggregateBubbleEventsRef = useRef<BubbleEvent[]>([]);
  const rawTradeQueueRef = useRef<Trade[]>([]);
  const fineProfileQueueRef = useRef<FineProfileRow[]>([]);
  const liveFineProfileRowsRef = useRef<Map<number, Map<number, FineProfileRow>>>(new Map());
  const contractPriceRef = useRef<number | null>(null);
  const processedTradeIdsRef = useRef<Set<string>>(new Set());
  const firstFullyCoveredCandleTimeRef = useRef<Record<TradeSource, number | null>>({ spot: null, futures: null });
  const latestTradeBaseCandleTimeRef = useRef<Record<TradeSource, number | null>>({ spot: null, futures: null });
  const lastProfileRevisionAtRef = useRef(0);
  const [volumeProfileRevision, setVolumeProfileRevision] = useState(0);
  const absorptionMapRef = useRef<Map<number, AbsorptionResult>>(new Map());
  const exhaustionMapRef = useRef<Map<number, ExhaustionResult>>(new Map());
  const icebergEngineRef = useRef<IcebergEngine>(new IcebergEngine(bucketSize, icebergLookback));
  const icebergLevelsRef = useRef<IcebergLevel[]>([]);
  const liquidityVacuumZonesRef = useRef<LiquidityVacuumZone[]>([]);
  const lastScoredCandleTimeRef = useRef<number | null>(null);
  // Orderbook manager per panel
  const orderbookRef = useRef<OrderbookManager>(new OrderbookManager());
  const pendingAggregationRef = useRef(false);
  const liquidityHistoryRef = useRef<LiquidityHistoryManager>(new LiquidityHistoryManager(liquidityBucketSize, liquidityHistoryDepth));
  const bubblesEnabledRef = useRef(bubblesEnabled);
  const bubbleSourceRef = useRef(bubbleSource);
  const aggregateEventsNeededRef = useRef(false);
  const footprintIngestionSkippedRef = useRef(0);
  const icebergDisabledNoopSkippedRef = useRef(0);
  const aggregateBubbleMarketSource = dataSourceMode;
  const volumeBarsMarketSource = dataSourceMode;

  useEffect(() => {
    bucketSizeRef.current = bucketSize;
  }, [bucketSize]);

  useEffect(() => {
    const aggregateEventsNeeded = needsAggregateEvents(useChartStore.getState().panels[panelId]);
    bubblesEnabledRef.current = bubblesEnabled;
    bubbleSourceRef.current = bubbleSource;
    aggregateEventsNeededRef.current = aggregateEventsNeeded;
    if (!aggregateEventsNeeded) {
      pendingAggregateBubbleEventsRef.current = [];
    }
  }, [bubblesEnabled, bubbleSource, contractType, dataSourceMode, panelId, volumeBarsEnabled, volumeBarsInputData]);

  const markProcessedTrade = useCallback((trade: Trade, source: TradeSource) => {
    const key = getTradeDedupeKey(trade, source);
    if (processedTradeIdsRef.current.has(key)) return false;

    processedTradeIdsRef.current.add(key);
    while (processedTradeIdsRef.current.size > MAX_DEDUPE_KEYS) {
      const oldest = processedTradeIdsRef.current.values().next().value;
      if (oldest === undefined) break;
      processedTradeIdsRef.current.delete(oldest);
    }

    return true;
  }, []);

  const getCurrentFootprintWorkNeed = useCallback(() => (
    getFootprintWorkNeed(useChartStore.getState().panels[panelId])
  ), [panelId]);

  const clearIcebergLevelsIfNeeded = useCallback((reason: string) => {
    if (icebergLevelsRef.current.length === 0) {
      icebergDisabledNoopSkippedRef.current += 1;
      return;
    }

    icebergLevelsRef.current = [];
    setIcebergLevels(panelId, []);
    recordRestoreDiagnostic({
      kind: 'footprint',
      key: `${panelId}:iceberg-disabled-clear`,
      timestamp: Date.now(),
      rowsFetched: 0,
      distinctCandleTimeCount: 0,
      details: {
        panelId,
        status: 'iceberg-disabled-cleared',
        reason,
      },
    });
  }, [panelId, setIcebergLevels]);

  useEffect(() => {
    const requiredSources = new Set<TradeSource>();
    if (bubblesEnabled && bubbleSource === 'aggregateTrades') {
      getTradeSourcesForAggregateMarketSource(
        aggregateBubbleMarketSource,
        contractType,
        dataSourceMode,
      ).forEach((source) => requiredSources.add(source));
    }

    if (requiredSources.size === 0) return;

    const footprintSources = getTradeSourcesForDataSourceMode(dataSourceMode);
    const aggregateOnlySources = Array.from(requiredSources).filter((source) => !footprintSources.includes(source));
    if (aggregateOnlySources.length === 0) return;

    const unsubscribers = aggregateOnlySources.map((source) => (
      subscribeTradeStream(source, pair, (trade) => {
        if (!markProcessedTrade(trade, source)) return;
        const event = createAggregateBubbleEvent(trade, source, pair);
        if (event) {
          pendingAggregateBubbleEventsRef.current.push(event);
        }
      })
    ));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [aggregateBubbleMarketSource, bubblesEnabled, bubbleSource, contractType, dataSourceMode, markProcessedTrade, pair]);

  const rebuildLiquidityVacuumZones = useCallback((candles = useChartRuntimeStore.getState().panels[panelId].candles || []) => {
    if (!liquidityVacuumEnabled) {
      if (liquidityVacuumZonesRef.current.length > 0) {
        liquidityVacuumZonesRef.current = [];
        setLiquidityVacuumZones(panelId, []);
      }
      return [];
    }

    const displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSizeRef.current);
    const zones = buildLiquidityVacuumZones(candles, engineRef.current, displayBucketSize, {
      minScore: liquidityVacuumMinScore,
      maxZones: liquidityVacuumMaxZones,
    });

    liquidityVacuumZonesRef.current = zones;
    setLiquidityVacuumZones(panelId, zones);
    return zones;
  }, [liquidityVacuumEnabled, liquidityVacuumMaxZones, liquidityVacuumMinScore, panelId, setLiquidityVacuumZones]);

  useEffect(() => {
    rebuildLiquidityVacuumZones();
  }, [rebuildLiquidityVacuumZones]);

  // Update history bucket size
  useEffect(() => {
    icebergEngineRef.current.setLookbackWindow(icebergLookback);
    if (!icebergEnabled) {
      clearIcebergLevelsIfNeeded('settings-update-disabled');
      return;
    }

    const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles || [];
    const levels = currentCandles.length > 0
      ? icebergEngineRef.current
        .update(currentCandles, engineRef.current)
        .filter(level => level.score >= icebergMinScore)
        .slice(0, 20)
      : [];
    icebergLevelsRef.current = levels;
    setIcebergLevels(panelId, levels);
  }, [icebergLookback, icebergEnabled, icebergMinScore, panelId, setIcebergLevels, clearIcebergLevelsIfNeeded]);

  useEffect(() => {
    liquidityHistoryRef.current.setBucketSize(liquidityBucketSize);
  }, [liquidityBucketSize]);

  useEffect(() => {
    liquidityHistoryRef.current.setMaxSnapshots(liquidityHistoryDepth);
  }, [liquidityHistoryDepth]);

  // Throttled redraw loop for footprint updates
  useEffect(() => {
    const interval = setInterval(() => {
      const hadFootprintUpdate = pendingFootprintRedrawRef.current;
      const hadProfileUpdate = pendingProfileRedrawRef.current;

      if (hadFootprintUpdate && chartMode === 'footprint') {
        triggerFootprintRedraw(panelId);
      }

      if (hadProfileUpdate) {
        const now = Date.now();
        if (now - lastProfileRevisionAtRef.current >= PROFILE_REDRAW_MS) {
          pendingProfileRedrawRef.current = false;
          lastProfileRevisionAtRef.current = now;
          setVolumeProfileRevision(now);
        }
      }

      if (!aggregateEventsNeededRef.current) {
        pendingAggregateBubbleEventsRef.current = [];
      } else if (pendingAggregateBubbleEventsRef.current.length > 0) {
        const pendingBubbleEvents = pendingAggregateBubbleEventsRef.current;
        pendingAggregateBubbleEventsRef.current = [];
        appendAggregateBubbleEvents(panelId, pendingBubbleEvents);
      }

      // Re-score provisional (live) candle on footprint updates
      if (hadFootprintUpdate || chartMode === 'footprint') {
        const candles = useChartRuntimeStore.getState().panels[panelId].candles || [];
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          if (!last.isClosed) {
            if (absorptionEnabled) {
              const newMap = scoreLatestCandle(candles, engineRef.current, absorptionMapRef.current);
              if (newMap !== absorptionMapRef.current) {
                absorptionMapRef.current = newMap;
                setAbsorptionMap(panelId, newMap);
              }
            } else if (absorptionMapRef.current.size > 0) {
              const emptyMap = new Map<number, AbsorptionResult>();
              absorptionMapRef.current = emptyMap;
              setAbsorptionMap(panelId, emptyMap);
            }

            if (exhaustionEnabled) {
              const newExhMap = scoreLatestExhaustion(candles, engineRef.current, absorptionMapRef.current, exhaustionMapRef.current, exhaustionLookback);
              if (newExhMap !== exhaustionMapRef.current) {
                exhaustionMapRef.current = newExhMap;
                setExhaustionMap(panelId, newExhMap);
              }
            } else if (exhaustionMapRef.current.size > 0) {
              const emptyMap = new Map<number, ExhaustionResult>();
              exhaustionMapRef.current = emptyMap;
              setExhaustionMap(panelId, emptyMap);
            }

            rebuildLiquidityVacuumZones(candles);
          }
        }
      }

      if (hadFootprintUpdate) {
        pendingFootprintRedrawRef.current = false;
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFootprintRedraw, appendAggregateBubbleEvents, chartMode, panelId, setAbsorptionMap, setExhaustionMap, rebuildLiquidityVacuumZones, absorptionEnabled, exhaustionEnabled, exhaustionLookback]);

  // Handle display bucket size updates without reconnecting socket or clearing base cells.
  useEffect(() => {
    const displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSize);
    engineRef.current.setDisplayBucketSize(displayBucketSize);
    icebergEngineRef.current.setBucketSize(displayBucketSize);
    const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles || [];
    // Rebuild signal maps against the current display aggregation only when visible/enabled.
    const newMap = absorptionEnabled
      ? buildAbsorptionMap(currentCandles, engineRef.current)
      : new Map<number, AbsorptionResult>();
    if (absorptionEnabled || absorptionMapRef.current.size > 0) {
      absorptionMapRef.current = newMap;
      setAbsorptionMap(panelId, newMap);
    }

    const newExhMap = exhaustionEnabled
      ? buildExhaustionMap(currentCandles, engineRef.current, newMap, exhaustionLookback)
      : new Map<number, ExhaustionResult>();
    if (exhaustionEnabled || exhaustionMapRef.current.size > 0) {
      exhaustionMapRef.current = newExhMap;
      setExhaustionMap(panelId, newExhMap);
    }

    if (icebergEnabled) {
      const levels = icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20);
      icebergLevelsRef.current = levels;
      setIcebergLevels(panelId, levels);
    } else {
      clearIcebergLevelsIfNeeded('bucket-update-disabled');
    }
    rebuildLiquidityVacuumZones(currentCandles);

    if (getCurrentFootprintWorkNeed().needed) {
      triggerFootprintRedraw(panelId);
    }
  }, [bucketSize, exhaustionLookback, icebergEnabled, icebergMinScore, triggerFootprintRedraw, panelId, setAbsorptionMap, setExhaustionMap, setIcebergLevels, rebuildLiquidityVacuumZones, absorptionEnabled, exhaustionEnabled, clearIcebergLevelsIfNeeded, getCurrentFootprintWorkNeed]);

  // Handle autoBucketSize toggle
  useEffect(() => {
    if (autoBucketSize) {
      const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles || [];
      if (currentCandles.length > 0) {
        const recentCandles = currentCandles.slice(-100);
        const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
        const targetTicks = avgRange / tickSize;
        const computedSize = Math.max(1, Math.round(targetTicks / 25));
        const displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, computedSize);

        if (displayBucketSize !== bucketSize) {
          setComputedBucketSize(panelId, displayBucketSize);
        }
      }
    }
  }, [autoBucketSize, tickSize, panelId, setComputedBucketSize, bucketSize]);

  useEffect(() => {
    let active = true;
    const fineProfileBaseBucketSize = getFineProfileBaseBucketSize(tickSize);
    resetPanelRuntime(panelId);
    connectedRef.current = false;
    setConnected(panelId, false);
    engineRef.current.reset();
    engineRef.current.setSharedBaseCache({ symbol: pair, contractType, dataSourceMode });
    volumeProfileEngineRef.current.reset();
    volumeProfileEngineRef.current.setSharedBaseCache({
      symbol: pair,
      contractType,
      dataSourceMode,
      baseBucketSize: fineProfileBaseBucketSize,
    });
    const footprintEngine = engineRef.current;
    const volumeProfileEngine = volumeProfileEngineRef.current;
    rawTradeQueueRef.current = [];
    fineProfileQueueRef.current = [];
    pendingAggregateBubbleEventsRef.current = [];
    liveFineProfileRowsRef.current = new Map();
    contractPriceRef.current = null;
    processedTradeIdsRef.current = new Set();
    firstFullyCoveredCandleTimeRef.current = { spot: null, futures: null };
    latestTradeBaseCandleTimeRef.current = { spot: null, futures: null };
    lastProfileRevisionAtRef.current = 0;
    pendingProfileRedrawRef.current = false;
    pendingFootprintRedrawRef.current = false;
    footprintIngestionSkippedRef.current = 0;
    icebergDisabledNoopSkippedRef.current = 0;
    absorptionMapRef.current = new Map();
    exhaustionMapRef.current = new Map();
    icebergEngineRef.current.reset();
    if (icebergLevelsRef.current.length > 0) {
      icebergLevelsRef.current = [];
      setIcebergLevels(panelId, []);
    }
    liquidityVacuumZonesRef.current = [];
    setLiquidityVacuumZones(panelId, []);
    lastScoredCandleTimeRef.current = null;
    useChartRuntimeStore.getState().setActiveMeasurement(panelId, null);
    liquidityHistoryRef.current.reset();

    const timeframeSeconds = getTimeframeSeconds(timeframe);
    engineRef.current.setDisplayTimeframeSeconds(timeframeSeconds);
    const activeTradeSources: TradeSource[] = dataSourceMode === 'both'
      ? ['spot', 'futures']
      : [dataSourceMode];
    const shouldUseSpotTrades = activeTradeSources.includes('spot');
    const shouldUseFuturesTrades = activeTradeSources.includes('futures');
    const shouldUseStoredHistory = true;
    const initialFootprintWorkNeed = getCurrentFootprintWorkNeed();
    const shouldHydrateRawTrades = ENABLE_RAW_TRADE_RESTORE && contractType === 'spot' && dataSourceMode === 'spot';
    const fineProfileStorageTimeframe = FINE_PROFILE_STORAGE_TIMEFRAME;
    const restoreStartedAt = Date.now();
    const candleCache = getSharedCandleCache({
      symbol: pair,
      contractType,
      timeframe,
    });

    const publishRestoreStatus = (status: Partial<HistoryRestoreStatus> & Pick<HistoryRestoreStatus, 'stage' | 'message'>) => {
      if (!active) return;

      setHistoryRestoreStatus(panelId, {
        startedAt: restoreStartedAt,
        updatedAt: Date.now(),
        liveConnected: connectedRef.current,
        candleCount: 0,
        storedCandleCount: 0,
        binanceCandleCount: 0,
        profileRowCount: 0,
        profileCandleCount: 0,
        footprintRowCount: 0,
        footprintCellCount: 0,
        footprintCandleCount: 0,
        rawTradeCount: 0,
        ...status,
      });
    };

    const getFirstFullyCoveredCandleTime = () => {
      const coverageTimes = activeTradeSources.map((source) => firstFullyCoveredCandleTimeRef.current[source]);
      if (coverageTimes.some((time) => time === null)) return null;
      return Math.max(...coverageTimes.map((time) => time ?? 0));
    };

    const getLiveFineProfileSliceCount = () => liveFineProfileRowsRef.current.size;

    const shouldHydrateStoredFineProfiles = () => {
      const panel = useChartStore.getState().panels[panelId];
      return Boolean(panel.defaultProfileEnabled || panel.customProfileRange);
    };

    const shouldRunProfileWork = () => shouldHydrateStoredFineProfiles() || ENABLE_BROWSER_MARKET_WRITES;

    const shouldHydrateStoredAggregateBubbles = () => {
      const panel = useChartStore.getState().panels[panelId];
      return needsAggregateEvents(panel);
    };

    const createEmptyRawTradeStats = (): RawTradeHydrationStats => ({
      pages: 0,
      fetched: 0,
      hydrated: 0,
      oldestTime: null,
      newestTime: null,
      reachedStart: false,
      hydratedCandleTimes: new Set(),
    });

    const createEmptyFineProfileStats = (): FineProfileHydrationStats => ({
      rowsFetched: 0,
      candlesHydrated: 0,
      chunksFetched: 0,
      chunksSkipped: 0,
    });

    const createEmptyFootprintStats = (): FootprintHydrationStats => ({
      rowsFetched: 0,
      candlesHydrated: 0,
      cellsHydrated: 0,
      bucketMatches: 0,
      bucketMisses: 0,
      requestedRange: null,
      clampedRange: null,
      chunkCount: 0,
      chunksFetched: 0,
      chunksSkipped: 0,
      rowsPerChunk: [],
      skippedBecauseRangeTooLarge: false,
      restoreFailureReason: null,
    });

    const getTradeClosedFineProfileTime = () => {
      const latestTimes = activeTradeSources.map((source) => latestTradeBaseCandleTimeRef.current[source]);
      if (latestTimes.some((time) => time === null)) return null;
      return Math.min(...latestTimes.map((time) => time ?? 0));
    };

    const getContractAlignedTrade = (trade: Trade, source: TradeSource): Trade & { source: TradeSource } | null => {
      const sourceTaggedTrade = { ...trade, source };
      if (source === contractType) return sourceTaggedTrade;

      const referencePrice = contractPriceRef.current;
      if (!Number.isFinite(referencePrice)) return null;

      return {
        ...sourceTaggedTrade,
        price: referencePrice as number,
      };
    };

    const markLiveConnected = () => {
      if (connectedRef.current) return;
      connectedRef.current = true;
      setConnected(panelId, true);

      const currentStatus = useChartRuntimeStore.getState().panels[panelId].historyRestoreStatus;
      if (currentStatus && currentStatus.stage !== 'complete' && currentStatus.stage !== 'error') {
        setHistoryRestoreStatus(panelId, {
          ...currentStatus,
          liveConnected: true,
          updatedAt: Date.now(),
        });
      }
    };

    const recomputeSignalState = () => {
      const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles || [];
      const absMap = absorptionEnabled
        ? buildAbsorptionMap(currentCandles, engineRef.current)
        : new Map<number, AbsorptionResult>();
      if (absorptionEnabled || absorptionMapRef.current.size > 0) {
        absorptionMapRef.current = absMap;
        setAbsorptionMap(panelId, absMap);
      }

      const exhMap = exhaustionEnabled
        ? buildExhaustionMap(currentCandles, engineRef.current, absMap, exhaustionLookback)
        : new Map<number, ExhaustionResult>();
      if (exhaustionEnabled || exhaustionMapRef.current.size > 0) {
        exhaustionMapRef.current = exhMap;
        setExhaustionMap(panelId, exhMap);
      }

      if (icebergEnabled) {
        const icebergLevels = icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20);
        icebergLevelsRef.current = icebergLevels;
        setIcebergLevels(panelId, icebergLevels);
      } else {
        clearIcebergLevelsIfNeeded('recompute-disabled');
      }
      rebuildLiquidityVacuumZones(currentCandles);
    };

    const flushRawTrades = () => {
      if (!ENABLE_BROWSER_MARKET_WRITES) {
        rawTradeQueueRef.current = [];
        return;
      }

      if (rawTradeQueueRef.current.length === 0) return;

      const batch = rawTradeQueueRef.current.splice(0, RAW_TRADE_FLUSH_SIZE);
      if (batch.length === 0) return;

      storeRawTradesAction(pair, batch)
        .then(() => {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:rawTrades`,
            timestamp: Date.now(),
            rowsWritten: batch.length,
            distinctCandleTimeCount: new Set(batch.map((trade) => getBaseCandleTimeForTrade(trade.time))).size,
            details: {
              panelId,
              storageType: 'rawTrades',
            },
          });
        })
        .catch((err) => {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:rawTrades`,
            timestamp: Date.now(),
            failedRows: batch.length,
            details: {
              panelId,
              storageType: 'rawTrades',
              error: err instanceof Error ? err.message : String(err),
            },
          });
          console.error('[Storage] Raw trade batch save request failed:', err);
        });
    };

    const flushFineProfileRows = () => {
      if (!ENABLE_BROWSER_MARKET_WRITES) {
        fineProfileQueueRef.current = [];
        return;
      }

      if (fineProfileQueueRef.current.length === 0) return;

      const batch = fineProfileQueueRef.current.splice(0, FINE_PROFILE_FLUSH_SIZE);
      if (batch.length === 0) return;

      const candles = new Set(batch.map((row) => row.candleTime));
      const bucketSizes = Array.from(new Set(batch.map((row) => row.baseBucketSize)));
      console.debug('[VPROFILE_DEBUG] Fine profile storage batch queued from client', {
        panelId,
        pair,
        contractType,
        dataSourceMode,
        timeframe: fineProfileStorageTimeframe,
        rows: batch.length,
        distinctCandleTimes: candles.size,
        minCandleTime: batch.reduce((min, row) => Math.min(min, row.candleTime), Number.POSITIVE_INFINITY),
        maxCandleTime: batch.reduce((max, row) => Math.max(max, row.candleTime), Number.NEGATIVE_INFINITY),
        tickSize,
        baseBucketSizes: bucketSizes,
      });

      storeFineProfileRowsAction(pair, contractType, dataSourceMode, fineProfileStorageTimeframe, batch)
        .then(() => {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
            timestamp: Date.now(),
            rowsWritten: batch.length,
            distinctCandleTimeCount: candles.size,
            details: {
              panelId,
              storageType: 'fineProfileRows',
              minCandleTime: batch.reduce((min, row) => Math.min(min, row.candleTime), Number.POSITIVE_INFINITY),
              maxCandleTime: batch.reduce((max, row) => Math.max(max, row.candleTime), Number.NEGATIVE_INFINITY),
              baseBucketSizes: bucketSizes,
            },
          });
        })
        .catch((err) => {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
            timestamp: Date.now(),
            failedRows: batch.length,
            distinctCandleTimeCount: candles.size,
            details: {
              panelId,
              storageType: 'fineProfileRows',
              error: err instanceof Error ? err.message : String(err),
            },
          });
          console.error('[Storage] Fine profile row batch save request failed:', err);
        });
    };

    const aggregateFineProfileTrade = (trade: Trade, candleTime: number) => {
      if (fineProfileBaseBucketSize <= 0) return;

      const bucketPrice = normalizePriceToBucket(trade.price, fineProfileBaseBucketSize);
      const candleRows = liveFineProfileRowsRef.current.get(candleTime) ?? new Map<number, FineProfileRow>();
      let row = candleRows.get(bucketPrice);

      if (!row) {
        row = {
          candleTime,
          baseBucketSize: fineProfileBaseBucketSize,
          bucketPrice,
          bidVol: 0,
          askVol: 0,
          totalVol: 0,
          tradeCount: 0,
        };
        candleRows.set(bucketPrice, row);
        liveFineProfileRowsRef.current.set(candleTime, candleRows);
      }

      if (trade.isBuyerMaker) {
        row.bidVol += trade.quantity;
      } else {
        row.askVol += trade.quantity;
      }

      row.totalVol += trade.quantity;
      row.tradeCount += 1;

      if (row.tradeCount === 1 || row.tradeCount % 100 === 0) {
        console.debug('[VPROFILE_DEBUG] Live fine profile row created/updated', {
          symbol: pair,
          contractType,
          dataSourceMode,
          baseCandleTime: candleTime,
          bucketPriceCount: candleRows.size,
          totalVolume: Array.from(candleRows.values()).reduce((sum, profileRow) => sum + profileRow.totalVol, 0),
          tradeCount: Array.from(candleRows.values()).reduce((sum, profileRow) => sum + profileRow.tradeCount, 0),
          tickSize,
          baseBucketSize: fineProfileBaseBucketSize,
        });
      }
    };

    const persistEligibleFineProfileRows = (closedBeforeTime: number | null, reason: string) => {
      const coverageStart = getFirstFullyCoveredCandleTime();
      const beforeSlices = getLiveFineProfileSliceCount();
      const stats = {
        slicesBefore: beforeSlices,
        slicesPersisted: 0,
        rowsQueued: 0,
        rowsSkippedDuplicate: 0,
        rowsSkippedPartial: 0,
        rowsSkippedOpen: 0,
      };

      if (beforeSlices === 0) return stats;

      if (coverageStart === null || closedBeforeTime === null) {
        stats.rowsSkippedPartial = Array.from(liveFineProfileRowsRef.current.values())
          .reduce((sum, rows) => sum + rows.size, 0);
        if (reason !== 'trade-advanced-1m') {
          console.debug('[VPROFILE_DEBUG] Fine profile 1m slice skipped before eligibility', {
            panelId,
            reason,
            pair,
            contractType,
            dataSourceMode,
            tickSize,
            baseBucketSize: fineProfileBaseBucketSize,
            slicesBefore: stats.slicesBefore,
            closedBeforeTime,
            currentStreamBaseTime: closedBeforeTime,
            isClosed: false,
            coverageStart,
            rowsSkippedPartial: stats.rowsSkippedPartial,
          });
        }
        if (ENABLE_BROWSER_MARKET_WRITES) {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
            timestamp: Date.now(),
            skippedRows: stats.rowsSkippedPartial,
            details: {
              panelId,
              storageType: 'fineProfileRows',
              reason,
              skipReason: 'coverage-not-ready',
              slicesBefore: stats.slicesBefore,
            },
          });
        }
        return stats;
      }

      for (const [candleTime, candleRows] of Array.from(liveFineProfileRowsRef.current.entries())) {
        if (candleTime < coverageStart) {
          stats.rowsSkippedPartial += candleRows.size;
          liveFineProfileRowsRef.current.delete(candleTime);
          continue;
        }

        if (candleTime >= closedBeforeTime) {
          stats.rowsSkippedOpen += candleRows.size;
          continue;
        }

        const rows = cloneFineProfileRows(candleRows.values());
        if (rows.length === 0) {
          liveFineProfileRowsRef.current.delete(candleTime);
          continue;
        }

        volumeProfileEngineRef.current.hydrateProfileRows(rows, 'closed-1m');
        liveFineProfileRowsRef.current.delete(candleTime);
        stats.slicesPersisted += 1;

        const storableRows = ENABLE_BROWSER_MARKET_WRITES
          ? rows.filter((row) => {
            const claimed = claimFineProfileStorage(
              pair,
              contractType,
              dataSourceMode,
              fineProfileStorageTimeframe,
              row.candleTime,
              row.baseBucketSize,
              row.bucketPrice,
            );
            if (!claimed) stats.rowsSkippedDuplicate += 1;
            return claimed;
          })
          : [];

        if (ENABLE_BROWSER_MARKET_WRITES && storableRows.length > 0) {
          fineProfileQueueRef.current.push(...storableRows);
          stats.rowsQueued += storableRows.length;
        }

        if (ENABLE_BROWSER_MARKET_WRITES) {
          console.debug('[VPROFILE_DEBUG] Fine profile 1m slice eligible and queued', {
            panelId,
            reason,
            pair,
            contractType,
            dataSourceMode,
            timeframe: fineProfileStorageTimeframe,
            baseCandleTime: candleTime,
            currentStreamBaseTime: closedBeforeTime,
            isClosed: candleTime < closedBeforeTime,
            coverageStatus: candleTime >= coverageStart ? 'covered' : 'partial',
            tickSize,
            baseBucketSize: fineProfileBaseBucketSize,
            rowsQueued: storableRows.length,
            rowsSkippedDuplicate: rows.length - storableRows.length,
          });
        }
      }

      if (stats.slicesPersisted > 0) {
        pendingProfileRedrawRef.current = true;

        if (ENABLE_BROWSER_MARKET_WRITES && fineProfileQueueRef.current.length >= FINE_PROFILE_FLUSH_SIZE) {
          flushFineProfileRows();
        }
      }

      if (stats.slicesPersisted > 0 || stats.rowsSkippedPartial > 0 || reason !== 'trade-advanced-1m') {
        console.debug('[VPROFILE_DEBUG] Fine profile 1m eligibility pass', {
          panelId,
          reason,
          pair,
          contractType,
          dataSourceMode,
          timeframe: fineProfileStorageTimeframe,
          tickSize,
          baseBucketSize: fineProfileBaseBucketSize,
          closedBeforeTime,
          currentStreamBaseTime: closedBeforeTime,
          coverageStart,
          ...stats,
          slicesRemaining: getLiveFineProfileSliceCount(),
          queuedRowsPending: fineProfileQueueRef.current.length,
        });
      }

      if (ENABLE_BROWSER_MARKET_WRITES && (stats.rowsQueued > 0 || stats.rowsSkippedDuplicate > 0 || stats.rowsSkippedPartial > 0 || stats.rowsSkippedOpen > 0)) {
        recordRestoreDiagnostic({
          kind: 'storage',
          key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
          timestamp: Date.now(),
          skippedRows: stats.rowsSkippedDuplicate + stats.rowsSkippedPartial + stats.rowsSkippedOpen,
          details: {
            panelId,
            storageType: 'fineProfileRows',
            reason,
            slicesPersisted: stats.slicesPersisted,
            rowsQueued: stats.rowsQueued,
            rowsSkippedDuplicate: stats.rowsSkippedDuplicate,
            rowsSkippedPartial: stats.rowsSkippedPartial,
            rowsSkippedOpen: stats.rowsSkippedOpen,
          },
        });
      }

      return stats;
    };

    const handleCandle = (candle: Candle) => {
      if (Number.isFinite(candle.close)) {
        contractPriceRef.current = candle.close;
      }

      markLiveConnected();
      engineRef.current.ingestCandle(candle);
      pushCandle(panelId, candle);

      if (candle.isClosed) {
        const footprintWork = getCurrentFootprintWorkNeed();
        const footprintWorkEnabled = footprintWork.needed;
        const firstFullyCoveredCandleTime = getFirstFullyCoveredCandleTime();
        const hasFullRealtimeFootprint = firstFullyCoveredCandleTime !== null
          && candle.time >= firstFullyCoveredCandleTime;
        const baseFootprints = footprintWorkEnabled && hasFullRealtimeFootprint
          ? engineRef.current.getBaseFootprintCandlesInRange(candle.time, candle.time + timeframeSeconds)
          : [];

        if (footprintWorkEnabled && !hasFullRealtimeFootprint) {
          recordRestoreDiagnostic({
            kind: 'storage',
            key: `${pair}:${contractType}:${dataSourceMode}:${timeframe}:footprint`,
            timestamp: Date.now(),
            skippedRows: 1,
            details: {
              panelId,
              storageType: 'baseFootprint',
              reason: 'partial-realtime-footprint',
              candleTime: candle.time,
            },
          });
          console.warn(`[Storage] Skipping partial realtime footprint for ${pair} ${timeframe} candle ${candle.time}`);
        }

        if (ENABLE_BROWSER_MARKET_WRITES && claimClosedCandleStorage(pair, contractType, dataSourceMode, timeframe, candle.time, 0)) {
          storeClosedCandleAction(
            pair,
            contractType,
            dataSourceMode,
            timeframe,
            candle,
            [],
            0,
            0,
            0,
          )
            .then(() => {
              recordRestoreDiagnostic({
                kind: 'storage',
                key: `${pair}:${contractType}:${dataSourceMode}:${timeframe}:candle`,
                timestamp: Date.now(),
                rowsWritten: 1,
                distinctCandleTimeCount: 1,
                details: {
                  panelId,
                  storageType: 'closedCandle',
                  candleTime: candle.time,
                },
              });
            })
            .catch((err) => {
              recordRestoreDiagnostic({
                kind: 'storage',
                key: `${pair}:${contractType}:${dataSourceMode}:${timeframe}:candle`,
                timestamp: Date.now(),
                failedRows: 1,
                distinctCandleTimeCount: 1,
                details: {
                  panelId,
                  storageType: 'closedCandle',
                  candleTime: candle.time,
                  error: err instanceof Error ? err.message : String(err),
                },
              });
              console.error('[Storage] Candle snapshot save request failed:', err);
            });
        }

        if (footprintWorkEnabled && hasFullRealtimeFootprint && ENABLE_BROWSER_MARKET_WRITES) {
          for (const baseFootprint of baseFootprints) {
            if (baseFootprint.cells.size === 0) continue;
            if (!claimClosedCandleStorage(pair, contractType, dataSourceMode, BASE_FOOTPRINT_TIMEFRAME, baseFootprint.time, BASE_FOOTPRINT_BUCKET_SIZE)) {
              continue;
            }

            const cells = Array.from(baseFootprint.cells.entries()).map(([bucketPrice, cell]) => ({
              bucketPrice,
              bidVol: cell.bidVol,
              askVol: cell.askVol,
            }));

            storeBaseFootprintAction(
              pair,
              contractType,
              dataSourceMode,
              baseFootprint.time,
              cells,
            )
              .then(() => {
                recordRestoreDiagnostic({
                  kind: 'storage',
                  key: `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`,
                  timestamp: Date.now(),
                  rowsWritten: cells.length,
                  distinctCandleTimeCount: 1,
                  details: {
                    panelId,
                    storageType: 'baseFootprint',
                    candleTime: baseFootprint.time,
                    baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
                  },
                });
              })
              .catch((err) => {
                recordRestoreDiagnostic({
                  kind: 'storage',
                  key: `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`,
                  timestamp: Date.now(),
                  failedRows: cells.length,
                  distinctCandleTimeCount: 1,
                  details: {
                    panelId,
                    storageType: 'baseFootprint',
                    candleTime: baseFootprint.time,
                    baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
                    error: err instanceof Error ? err.message : String(err),
                  },
                });
                console.error('[Storage] Base footprint save request failed:', err);
              });
          }
        }

        const profileRangeEnd = candle.time + timeframeSeconds;
        const profileWorkEnabled = shouldRunProfileWork();
        if (profileWorkEnabled) {
          persistEligibleFineProfileRows(profileRangeEnd, 'selected-candle-close');
        } else {
          liveFineProfileRowsRef.current.clear();
        }

        if (profileWorkEnabled && !hasFullRealtimeFootprint) {
          volumeProfileEngineRef.current.removeTradesInTimeRange(
            candle.time * 1000,
            profileRangeEnd * 1000,
          );
          pendingProfileRedrawRef.current = true;
        }
      }

      // Score closed candles incrementally
      if (candle.isClosed && candle.time !== lastScoredCandleTimeRef.current) {
        lastScoredCandleTimeRef.current = candle.time;
        const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles || [];
        const newMap = absorptionEnabled
          ? scoreLatestCandle(currentCandles, engineRef.current, absorptionMapRef.current)
          : new Map<number, AbsorptionResult>();
        if (absorptionEnabled || absorptionMapRef.current.size > 0) {
          absorptionMapRef.current = newMap;
          setAbsorptionMap(panelId, newMap);
        }

        const newExhMap = exhaustionEnabled
          ? scoreLatestExhaustion(currentCandles, engineRef.current, newMap, exhaustionMapRef.current, exhaustionLookback)
          : new Map<number, ExhaustionResult>();
        if (exhaustionEnabled || exhaustionMapRef.current.size > 0) {
          exhaustionMapRef.current = newExhMap;
          setExhaustionMap(panelId, newExhMap);
        }

        const icebergLevels = icebergEnabled
          ? icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20)
          : [];
        if (icebergEnabled || icebergLevelsRef.current.length > 0) {
          icebergLevelsRef.current = icebergLevels;
          setIcebergLevels(panelId, icebergLevels);
        }
        rebuildLiquidityVacuumZones(currentCandles);
        if (icebergEnabled) {
          console.log(`--- Iceberg Levels (${panelId} panel) ---`);
          if (icebergLevels.length === 0) {
            console.log('No iceberg levels detected.');
          } else {
            console.table(icebergLevels.map(level => ({
              price: level.price,
              score: level.score,
              rank: level.rank,
              side: level.side,
              totalVolume: level.totalVolume.toFixed(2),
              candleCount: level.candleCount,
              reasons: level.reasons.join('; '),
            })));
          }
        }

        const panelState = useChartStore.getState().panels[panelId];
        if (panelState.liquidityHeatmapEnabled && panelState.liquidityHistoryEnabled) {
          liquidityHistoryRef.current.captureSnapshot(candle.time, orderbookRef.current);
        }
      }
    };

    const handleTrade = (trade: Trade, source: TradeSource) => {
      if (!markProcessedTrade(trade, source)) return;
      markLiveConnected();
      if (aggregateEventsNeededRef.current) {
        const event = createAggregateBubbleEvent(trade, source, pair);
        if (event) {
          pendingAggregateBubbleEventsRef.current.push(event);
        }
      }
      const alignedTrade = getContractAlignedTrade(trade, source);
      if (!alignedTrade) return;

      const baseCandleTime = getBaseCandleTimeForTrade(trade.time);
      const profileWorkEnabled = shouldRunProfileWork();
      const footprintWork = getCurrentFootprintWorkNeed();
      const footprintWorkEnabled = footprintWork.needed;
      if ((footprintWorkEnabled || profileWorkEnabled) && firstFullyCoveredCandleTimeRef.current[source] === null) {
        firstFullyCoveredCandleTimeRef.current[source] = baseCandleTime + BASE_FOOTPRINT_TIMEFRAME_SECONDS;
      }
      const previousSourceBaseTime = latestTradeBaseCandleTimeRef.current[source];
      if (footprintWorkEnabled || profileWorkEnabled) {
        latestTradeBaseCandleTimeRef.current[source] = previousSourceBaseTime === null
          ? baseCandleTime
          : Math.max(previousSourceBaseTime, baseCandleTime);
      }
      if (profileWorkEnabled) {
        persistEligibleFineProfileRows(getTradeClosedFineProfileTime(), 'trade-advanced-1m');
      }

      if (footprintWorkEnabled) {
        engineRef.current.ingestTrade(alignedTrade, baseCandleTime);
      } else {
        footprintIngestionSkippedRef.current += 1;
      }

      if (profileWorkEnabled) {
        volumeProfileEngineRef.current.ingestTrade(alignedTrade);
        aggregateFineProfileTrade(alignedTrade, baseCandleTime);
      }

      if (ENABLE_BROWSER_MARKET_WRITES && contractType === 'spot' && source === 'spot' && claimRawTradeStorage(pair, trade)) {
        rawTradeQueueRef.current.push(trade);
      }

      if (profileWorkEnabled) {
        pendingProfileRedrawRef.current = true;
      }
      if (footprintWorkEnabled) {
        pendingFootprintRedrawRef.current = true;
      }

      if (rawTradeQueueRef.current.length >= RAW_TRADE_FLUSH_SIZE) {
        flushRawTrades();
      }
    };

    const handleSpotTrade = (trade: Trade) => handleTrade(trade, 'spot');
    const handleFuturesTrade = (trade: Trade) => handleTrade(trade, 'futures');

    const fetchStoredHistory = async () => {
      const params = new URLSearchParams({
        symbol: pair,
        contractType,
        timeframe,
        limit: '500',
      });
      const response = await fetch(`/api/history/candles?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`History API returned ${response.status}`);
      }

      const candles = await response.json() as Candle[];
      recordRestoreDiagnostic({
        kind: 'candles',
        key: `${pair}:${timeframe}:stored`,
        timestamp: Date.now(),
        rowsFetched: candles.length,
        distinctCandleTimeCount: new Set(candles.map((candle) => candle.time)).size,
        details: {
          panelId,
          source: 'stored-history-api',
          symbol: pair,
          contractType,
          timeframe,
          minCandleTime: candles[0]?.time ?? null,
          maxCandleTime: candles[candles.length - 1]?.time ?? null,
        },
      });

      return candles;
    };

    const hydrateStoredRawTrades = async (candles: Candle[]): Promise<RawTradeHydrationStats> => {
      const stats: RawTradeHydrationStats = {
        pages: 0,
        fetched: 0,
        hydrated: 0,
        oldestTime: null,
        newestTime: null,
        reachedStart: false,
        hydratedCandleTimes: new Set(),
      };
      const window = getHistoryWindow(candles, timeframeSeconds);
      if (!window) return stats;
      const recordRawTradeRestore = (status: string) => {
        recordRestoreDiagnostic({
          kind: 'rawTrades',
          key: `${pair}:rawTrades:${window.startMs}:${window.endMs}`,
          timestamp: Date.now(),
          rowsFetched: stats.fetched,
          distinctCandleTimeCount: stats.hydratedCandleTimes.size,
          failedRows: status === 'failed' ? Math.max(1, RAW_TRADE_HISTORY_PAGE_SIZE - stats.fetched) : 0,
          skippedRows: Math.max(0, stats.fetched - stats.hydrated),
          details: {
            panelId,
            status,
            pages: stats.pages,
            hydratedRows: stats.hydrated,
            oldestTime: stats.oldestTime,
            newestTime: stats.newestTime,
            reachedStart: stats.reachedStart,
          },
        });
      };

      let cursorTime: number | null = null;
      let cursorId: number | null = null;
      const profileTrades: Trade[] = [];

      while (active && stats.pages < RAW_TRADE_HISTORY_MAX_PAGES) {
        const params = new URLSearchParams({
          symbol: pair,
          start: String(window.startMs),
          end: String(window.endMs),
          limit: String(RAW_TRADE_HISTORY_PAGE_SIZE),
          order: 'desc',
        });

        if (cursorTime !== null && cursorId !== null) {
          params.set('cursorTime', String(cursorTime));
          params.set('cursorId', String(cursorId));
        }

        const response = await fetch(`/api/history/trades?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          console.warn(`[HistoryRestore:${panelId}] Raw trade page failed with ${response.status}`);
          recordRawTradeRestore('failed');
          return stats;
        }

        const trades = await response.json() as Trade[];
        if (trades.length === 0) {
          stats.reachedStart = true;
          recordRawTradeRestore('empty-page');
          return stats;
        }

        stats.pages += 1;
        stats.fetched += trades.length;

        for (let i = 0; i < trades.length; i += 1) {
          if (!active) return stats;
          if (i > 0 && i % HYDRATION_CHUNK_SIZE === 0) {
            await yieldToBrowser();
          }

          const trade = trades[i];
          const candleTime = getBaseCandleTimeForTrade(trade.time);
          stats.oldestTime = stats.oldestTime === null ? trade.time : Math.min(stats.oldestTime, trade.time);
          stats.newestTime = stats.newestTime === null ? trade.time : Math.max(stats.newestTime, trade.time);

          if (!markProcessedTrade(trade, 'spot')) continue;

          const hydratedTrade = { ...trade, source: 'spot' } as Trade & { source: TradeSource };
          if (getCurrentFootprintWorkNeed().needed) {
            engineRef.current.ingestTrade(hydratedTrade, candleTime);
          }
          profileTrades.push(hydratedTrade);
          stats.hydrated += 1;
          stats.hydratedCandleTimes.add(candleTime);
        }

        const lastTrade = trades[trades.length - 1];
        if (trades.length < RAW_TRADE_HISTORY_PAGE_SIZE || lastTrade.time <= window.startMs) {
          stats.reachedStart = true;
          break;
        }

        if (!Number.isFinite(lastTrade.id)) {
          console.warn(`[HistoryRestore:${panelId}] Raw trade pagination stopped because a cursor id was missing`);
          break;
        }

        cursorTime = lastTrade.time;
        cursorId = lastTrade.id!;
      }

      if (stats.hydrated > 0) {
        volumeProfileEngineRef.current.hydrateTrades(profileTrades);
        if (getCurrentFootprintWorkNeed().needed) {
          pendingFootprintRedrawRef.current = true;
        }
        pendingProfileRedrawRef.current = true;
      }

      if (!stats.reachedStart && stats.pages >= RAW_TRADE_HISTORY_MAX_PAGES) {
        console.warn(
          `[HistoryRestore:${panelId}] Raw trade hydration hit ${RAW_TRADE_HISTORY_MAX_PAGES} pages before covering the full candle window`,
        );
      }

      recordRawTradeRestore(stats.reachedStart ? 'complete' : 'partial');
      return stats;
    };

    const hydrateStoredAggregateBubbles = async (candles: Candle[]): Promise<AggregateBubbleHydrationStats> => {
      const stats: AggregateBubbleHydrationStats = {
        rowsFetched: 0,
        rowsHydrated: 0,
        duplicateSkipped: 0,
        spotCount: 0,
        futuresCount: 0,
        oldestTime: null,
        newestTime: null,
        range: getAggregateBubbleRestoreRange(candles, timeframeSeconds),
        thresholds: null,
      };

      if (!shouldHydrateStoredAggregateBubbles()) {
        recordRestoreDiagnostic({
          kind: 'aggregateBubbles',
          key: `${pair}:aggregateBubbles:skipped-disabled`,
          timestamp: Date.now(),
          rowsFetched: 0,
          distinctCandleTimeCount: 0,
          details: {
            panelId,
            status: 'skipped-disabled',
            reason: 'bubbles-disabled',
            aggregateBubbleRestoreSkipped: true,
          },
        });
        return stats;
      }

      if (!stats.range) return stats;

      const params = new URLSearchParams({
        symbol: pair,
        marketSource: 'both',
        activeContractType: contractType,
        startTime: String(stats.range.startTime),
        endTime: String(stats.range.endTime),
        limit: String(AGGREGATE_BUBBLE_RESTORE_LIMIT),
      });

      const recordAggregateBubbleRestore = (status: string) => {
        recordAggregateBubbleRestoreDebug(panelId, {
          duplicateSkippedCount: stats.duplicateSkipped,
          restoreQueryRange: stats.range,
          storageThresholds: stats.thresholds,
        });
        recordRestoreDiagnostic({
          kind: 'aggregateBubbles',
          key: `${pair}:aggregateBubbles:${stats.range?.startTime ?? 0}:${stats.range?.endTime ?? 0}`,
          timestamp: Date.now(),
          rowsFetched: stats.rowsFetched,
          distinctCandleTimeCount: new Set(
            useChartRuntimeStore.getState().panels[panelId].aggregateBubbleEvents
              .filter((event) => event.origin === 'restored')
              .map((event) => Math.floor(event.time / 1000)),
          ).size,
          skippedRows: stats.duplicateSkipped,
          details: {
            panelId,
            status,
            rowsHydrated: stats.rowsHydrated,
            spotCount: stats.spotCount,
            futuresCount: stats.futuresCount,
            oldestTime: stats.oldestTime,
            newestTime: stats.newestTime,
            thresholds: stats.thresholds,
            range: stats.range,
          },
        });
      };

      try {
        const response = await fetch(`/api/history/aggregate-bubbles?${params.toString()}`, {
          cache: 'no-store',
        });

        stats.thresholds = parseAggregateBubbleThresholds(response);

        if (!response.ok) {
          console.warn(`[HistoryRestore:${panelId}] Aggregate bubble restore failed with ${response.status}`);
          recordAggregateBubbleRestore('failed');
          return stats;
        }

        const rows = await response.json() as BubbleEvent[];
        const existingKeys = new Set(
          useChartRuntimeStore.getState().panels[panelId].aggregateBubbleEvents.map(getAggregateBubbleEventKey),
        );
        const restoredEvents: BubbleEvent[] = [];

        stats.rowsFetched = rows.length;

        for (let i = 0; i < rows.length; i += 1) {
          if (!active) return stats;
          if (i > 0 && i % HYDRATION_CHUNK_SIZE === 0) {
            await yieldToBrowser();
          }

          const row = rows[i];
          if (
            row.source !== 'aggregateTrade'
            || (row.contractType !== 'spot' && row.contractType !== 'futures')
            || (row.side !== 'buy' && row.side !== 'sell')
            || !Number.isFinite(row.time)
            || !Number.isFinite(row.price)
            || !Number.isFinite(row.volume)
          ) {
            continue;
          }

          const event: BubbleEvent = {
            ...row,
            origin: 'restored',
          };
          const key = getAggregateBubbleEventKey(event);
          if (existingKeys.has(key)) {
            stats.duplicateSkipped += 1;
            continue;
          }

          existingKeys.add(key);
          restoredEvents.push(event);
          stats.rowsHydrated += 1;
          if (event.contractType === 'spot') stats.spotCount += 1;
          if (event.contractType === 'futures') stats.futuresCount += 1;
          stats.oldestTime = stats.oldestTime === null ? event.time : Math.min(stats.oldestTime, event.time);
          stats.newestTime = stats.newestTime === null ? event.time : Math.max(stats.newestTime, event.time);
        }

        if (restoredEvents.length > 0) {
          appendAggregateBubbleEvents(panelId, restoredEvents);
        }

        recordAggregateBubbleRestore('complete');
        return stats;
      } catch (error) {
        console.warn(`[HistoryRestore:${panelId}] Aggregate bubble restore failed`, error);
        recordAggregateBubbleRestore('failed');
        return stats;
      }
    };

    const hydrateStoredFootprintRange = async (
      startSeconds: number,
      endSeconds: number,
    ): Promise<FootprintHydrationStats> => {
      const stats: FootprintHydrationStats = {
        rowsFetched: 0,
        candlesHydrated: 0,
        cellsHydrated: 0,
        bucketMatches: 0,
        bucketMisses: 0,
        requestedRange: null,
        clampedRange: null,
        chunkCount: 0,
        chunksFetched: 0,
        chunksSkipped: 0,
        rowsPerChunk: [],
        skippedBecauseRangeTooLarge: false,
        restoreFailureReason: null,
      };

      if (endSeconds <= startSeconds) return stats;

      const footprintCache = engineRef.current.getBaseCache();
      const restoreKey = `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`;
      const clampedRange = alignFootprintRange(startSeconds, endSeconds);
      stats.requestedRange = { startSeconds, endSeconds };
      stats.clampedRange = clampedRange;

      const chunks = getFootprintRestoreChunks(clampedRange);
      stats.chunkCount = chunks.length;

      for (let index = 0; index < chunks.length; index += 1) {
        if (!active) break;

        const chunk = chunks[index];
        const candidateTimes = footprintCache.getMissingBaseCandleTimes(chunk.startSeconds, chunk.endSeconds);
        if (candidateTimes.length === 0) {
          stats.chunksSkipped += 1;
          stats.rowsPerChunk.push(0);
          recordRestoreDiagnostic({
            kind: 'footprint',
            key: restoreKey,
            timestamp: Date.now(),
            rowsFetched: 0,
            distinctCandleTimeCount: 0,
            details: {
              panelId,
              status: 'cache-covered',
              sourceKey: footprintCache.key,
              requestedRange: stats.requestedRange,
              clampedRange: stats.clampedRange,
              chunkIndex: index + 1,
              chunkCount: chunks.length,
              chunkStart: chunk.startSeconds,
              chunkEnd: chunk.endSeconds,
              baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
            },
          });
          continue;
        }

        try {
          const chunkStats = await footprintCache.runRestoreOnce(chunk.startSeconds, chunk.endSeconds, async () => {
            const restoredChunkStats = {
              rowsFetched: 0,
              candlesHydrated: 0,
              cellsHydrated: 0,
              bucketMatches: 0,
              bucketMisses: 0,
            };
            const params = new URLSearchParams({
              symbol: pair,
              contractType,
              dataSourceMode,
              timeframe: BASE_FOOTPRINT_TIMEFRAME,
              start: String(chunk.startSeconds),
              end: String(chunk.endSeconds),
              bucketSize: String(BASE_FOOTPRINT_BUCKET_SIZE),
            });
            const response = await fetch(`/api/history/footprint?${params.toString()}`, {
              cache: 'no-store',
            });

            if (!response.ok) {
              let failureReason = `Footprint row restore failed with ${response.status}`;
              try {
                const body = await response.json() as { error?: string };
                if (body.error) failureReason = body.error;
              } catch {
                // Keep the HTTP status message when the response body is not JSON.
              }
              throw new Error(failureReason);
            }

            const rows = await response.json() as FootprintHistoryRow[];
            restoredChunkStats.rowsFetched = rows.length;

            const rowsByCandle = new Map<number, FootprintHistoryRow[]>();
            for (const row of rows) {
              const current = rowsByCandle.get(row.candleTime) ?? [];
              current.push(row);
              rowsByCandle.set(row.candleTime, current);
            }

            const candidateTimeSet = new Set(candidateTimes);
            restoredChunkStats.bucketMatches = candidateTimes.filter((time) => rowsByCandle.has(time)).length;
            restoredChunkStats.bucketMisses = Math.max(0, candidateTimes.length - restoredChunkStats.bucketMatches);

            for (const candleTime of candidateTimes) {
              if (!active) return restoredChunkStats;

              const candleRows = rowsByCandle.get(candleTime);
              if (!candleRows || candleRows.length === 0) continue;
              if (!candidateTimeSet.has(candleTime)) continue;

              const cells = new Map<number, FootprintCell>();
              let delta = 0;

              for (const row of candleRows) {
                cells.set(row.bucketPrice, {
                  bidVol: row.bidVol,
                  askVol: row.askVol,
                });
                delta += row.delta ?? row.askVol - row.bidVol;
              }

              engineRef.current.hydrateBaseFootprintCandle(candleTime, cells, undefined, delta);
              restoredChunkStats.candlesHydrated += 1;
              restoredChunkStats.cellsHydrated += cells.size;

              if (restoredChunkStats.candlesHydrated % HYDRATION_CHUNK_SIZE === 0) {
                await yieldToBrowser();
              }
            }

            recordRestoreDiagnostic({
              kind: 'footprint',
              key: restoreKey,
              timestamp: Date.now(),
              rowsFetched: restoredChunkStats.rowsFetched,
              distinctCandleTimeCount: restoredChunkStats.candlesHydrated,
              skippedRows: restoredChunkStats.bucketMisses,
              details: {
                panelId,
                status: 'chunk-complete',
                sourceKey: footprintCache.key,
                requestedRange: stats.requestedRange,
                clampedRange: stats.clampedRange,
                chunkIndex: index + 1,
                chunkCount: chunks.length,
                chunkStart: chunk.startSeconds,
                chunkEnd: chunk.endSeconds,
                candidateCandles: candidateTimes.length,
                cellsHydrated: restoredChunkStats.cellsHydrated,
                bucketMatches: restoredChunkStats.bucketMatches,
                bucketMisses: restoredChunkStats.bucketMisses,
                rowsPerChunk: restoredChunkStats.rowsFetched,
                baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
              },
            });

            return restoredChunkStats;
          });

          stats.rowsFetched += chunkStats.rowsFetched;
          stats.candlesHydrated += chunkStats.candlesHydrated;
          stats.cellsHydrated += chunkStats.cellsHydrated;
          stats.bucketMatches += chunkStats.bucketMatches;
          stats.bucketMisses += chunkStats.bucketMisses;
          stats.rowsPerChunk.push(chunkStats.rowsFetched);
          stats.chunksFetched += 1;
        } catch (error) {
          const failureReason = error instanceof Error ? error.message : String(error);
          stats.restoreFailureReason = stats.restoreFailureReason ?? failureReason;
          stats.rowsPerChunk.push(0);
          recordRestoreDiagnostic({
            kind: 'footprint',
            key: restoreKey,
            timestamp: Date.now(),
            failedRows: candidateTimes.length,
            details: {
              panelId,
              status: 'failed',
              sourceKey: footprintCache.key,
              requestedRange: stats.requestedRange,
              clampedRange: stats.clampedRange,
              chunkIndex: index + 1,
              chunkCount: chunks.length,
              chunkStart: chunk.startSeconds,
              chunkEnd: chunk.endSeconds,
              candidateCandles: candidateTimes.length,
              restoreFailureReason: failureReason,
              baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
            },
          });
          console.warn(`[HistoryRestore:${panelId}] Stored footprint chunk ${index + 1}/${chunks.length} failed: ${failureReason}`);
        }

        await yieldToBrowser();
      }

      if (stats.candlesHydrated > 0) {
        pendingFootprintRedrawRef.current = true;
        pendingProfileRedrawRef.current = true;
      }

      return stats;
    };

    const hydrateStoredFootprints = async (candles: Candle[]): Promise<FootprintHydrationStats> => {
      const plan = getFootprintRestorePlan(
        candles,
        useChartStore.getState().panels[panelId],
        timeframeSeconds,
      );

      if (!plan || plan.clampedRange.endSeconds <= plan.clampedRange.startSeconds) {
        return {
          rowsFetched: 0, candlesHydrated: 0, cellsHydrated: 0, bucketMatches: 0, bucketMisses: 0,
          requestedRange: null, clampedRange: null, chunkCount: 0, chunksFetched: 0, chunksSkipped: 0,
          rowsPerChunk: [], skippedBecauseRangeTooLarge: false, restoreFailureReason: null,
        };
      }

      const stats = await hydrateStoredFootprintRange(plan.clampedRange.startSeconds, plan.clampedRange.endSeconds);
      stats.skippedBecauseRangeTooLarge = plan.skippedBecauseRangeTooLarge;
      stats.requestedRange = plan.requestedRange;
      
      if (plan.skippedBecauseRangeTooLarge) {
        const restoreKey = `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`;
        recordRestoreDiagnostic({
          kind: 'footprint',
          key: restoreKey,
          timestamp: Date.now(),
          rowsFetched: 0,
          distinctCandleTimeCount: 0,
          skippedRows: Math.max(0, Math.floor((plan.clampedRange.startSeconds - plan.requestedRange.startSeconds) / BASE_FOOTPRINT_TIMEFRAME_SECONDS)),
          details: {
            panelId,
            status: 'range-clamped',
            historyRange: plan.historyRange,
            requestedRange: plan.requestedRange,
            clampedRange: plan.clampedRange,
            requestedVisibleBars: plan.requestedVisibleBars,
            approximateVisibleBars: plan.approximateVisibleBars,
            maxTotalSeconds: FOOTPRINT_RESTORE_MAX_TOTAL_SECONDS,
            maxChunkSeconds: FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS,
            skippedBecauseRangeTooLarge: true,
          },
        });
      }

      return stats;
    };

    const hydrateStoredFineProfileRange = async (
      startSeconds: number,
      endSeconds: number,
      reason: 'default' | 'lazy' | 'custom',
    ): Promise<FineProfileHydrationStats> => {
      const stats: FineProfileHydrationStats = {
        rowsFetched: 0,
        candlesHydrated: 0,
        chunksFetched: 0,
        chunksSkipped: 0,
      };
      if (endSeconds <= startSeconds || fineProfileBaseBucketSize <= 0) return stats;

      const profileCache = volumeProfileEngineRef.current.getBaseCache();
      const chunks = getFineProfileRestoreChunks(startSeconds, endSeconds);
      const hydratedCandleTimes = new Set<number>();

      for (let index = 0; index < chunks.length; index += 1) {
        if (!active) break;

        const chunk = chunks[index];
        const candidateTimes = profileCache.getMissingBaseCandleTimes(chunk.startSeconds, chunk.endSeconds);
        if (candidateTimes.length === 0) {
          stats.chunksSkipped = (stats.chunksSkipped ?? 0) + 1;
          recordRestoreDiagnostic({
            kind: 'volumeProfile',
            key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
            timestamp: Date.now(),
            rowsFetched: 0,
            distinctCandleTimeCount: 0,
            details: {
              panelId,
              status: 'cache-covered',
              reason,
              sourceKey: profileCache.key,
              start: chunk.startSeconds,
              end: chunk.endSeconds,
              tickSize,
              baseBucketSize: fineProfileBaseBucketSize,
            },
          });
          continue;
        }

        const chunkLabel = chunks.length > 1 ? ` ${index + 1}/${chunks.length}` : '';
        publishRestoreStatus({
          stage: 'volumeProfile',
          message: reason === 'custom'
            ? `Loading custom profile${chunkLabel}...`
            : `Loading profile history${chunkLabel}...`,
          candleCount: useChartRuntimeStore.getState().panels[panelId].candles.length,
          profileRowCount: stats.rowsFetched,
          profileCandleCount: stats.candlesHydrated,
        });

        const restoredChunkStats = await profileCache.runRestoreOnce(chunk.startSeconds, chunk.endSeconds, async () => {
          const params = new URLSearchParams({
            symbol: pair,
            timeframe: fineProfileStorageTimeframe,
            contractType,
            dataSourceMode,
            start: String(chunk.startSeconds),
            end: String(chunk.endSeconds),
            baseBucketSize: String(fineProfileBaseBucketSize),
          });
          const response = await fetch(`/api/history/profile?${params.toString()}`, {
            cache: 'no-store',
          });

          if (!response.ok) {
            recordRestoreDiagnostic({
              kind: 'volumeProfile',
              key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
              timestamp: Date.now(),
              failedRows: candidateTimes.length,
              details: {
                panelId,
                status: response.status,
                reason,
                sourceKey: profileCache.key,
                start: chunk.startSeconds,
                end: chunk.endSeconds,
                tickSize,
                baseBucketSize: fineProfileBaseBucketSize,
              },
            });
            throw new Error(`Fine profile row restore failed with ${response.status}`);
          }

          const rows = await response.json() as FineProfileRow[];
          const chunkCandleTimes = new Set(rows.map((row) => row.candleTime));

          if (rows.length > 0) {
            volumeProfileEngineRef.current.hydrateProfileRows(rows, 'restore');
            pendingProfileRedrawRef.current = true;
            rows.forEach((row) => hydratedCandleTimes.add(row.candleTime));
          }

          console.debug('[VPROFILE_CACHE] Fine profile restore chunk hydrated in shared cache', {
            panelId,
            pair,
            contractType,
            dataSourceMode,
            reason,
            sourceKey: profileCache.key,
            requestedChartTimeframe: timeframe,
            storageTimeframe: fineProfileStorageTimeframe,
            tickSize,
            baseBucketSize: fineProfileBaseBucketSize,
            start: chunk.startSeconds,
            end: chunk.endSeconds,
            candidateCandles: candidateTimes.length,
            rowsFetched: rows.length,
            distinctCandleTimes: chunkCandleTimes.size,
            minCandleTime: rows.length > 0 ? Math.min(...rows.map((row) => row.candleTime)) : null,
            maxCandleTime: rows.length > 0 ? Math.max(...rows.map((row) => row.candleTime)) : null,
            rowCount: profileCache.rowCount,
            coverageRange: profileCache.getLoadedRanges(),
          });

          recordRestoreDiagnostic({
            kind: 'volumeProfile',
            key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
            timestamp: Date.now(),
            rowsFetched: rows.length,
            distinctCandleTimeCount: chunkCandleTimes.size,
            skippedRows: Math.max(0, candidateTimes.length - chunkCandleTimes.size),
            details: {
              panelId,
              reason,
              sourceKey: profileCache.key,
              start: chunk.startSeconds,
              end: chunk.endSeconds,
              candidateCandles: candidateTimes.length,
              tickSize,
              baseBucketSize: fineProfileBaseBucketSize,
              minCandleTime: rows.length > 0 ? Math.min(...rows.map((row) => row.candleTime)) : null,
              maxCandleTime: rows.length > 0 ? Math.max(...rows.map((row) => row.candleTime)) : null,
            },
          });

          return {
            rowsFetched: rows.length,
            candlesHydrated: chunkCandleTimes.size,
            chunksFetched: 1,
            chunksSkipped: 0,
          };
        });

        stats.rowsFetched += restoredChunkStats.rowsFetched;
        stats.candlesHydrated = hydratedCandleTimes.size || stats.candlesHydrated + restoredChunkStats.candlesHydrated;
        stats.chunksFetched = (stats.chunksFetched ?? 0) + (restoredChunkStats.chunksFetched ?? 0);

        if ((stats.chunksFetched ?? 0) % 2 === 0) {
          await yieldToBrowser();
        }
      }

      if (stats.candlesHydrated > 0) {
        pendingProfileRedrawRef.current = true;
      }

      return stats;
    };

    const hydrateStoredFineProfileRows = async (candles: Candle[]): Promise<FineProfileHydrationStats> => {
      const window = getHistoryWindow(candles, timeframeSeconds);
      if (!window) {
        return {
          rowsFetched: 0,
          candlesHydrated: 0,
          chunksFetched: 0,
          chunksSkipped: 0,
        };
      }

      const recentEnd = window.endSeconds;
      const recentStart = Math.max(window.startSeconds, recentEnd - FINE_PROFILE_DEFAULT_RESTORE_SECONDS);
      return hydrateStoredFineProfileRange(recentStart, recentEnd, 'default');
    };

    let lazyProfileRestoreRunning = false;
    let lastLazyProfileRestoreKey = '';

    const getCustomProfileRestoreWindow = () => {
      const panel = useChartStore.getState().panels[panelId];
      const range = panel.customProfileRange;
      const candles = useChartRuntimeStore.getState().panels[panelId].candles;
      if (!range || candles.length === 0) return null;

      const firstTime = range.firstTime ?? candles[range.firstIndex]?.time;
      const lastTime = range.lastTime ?? candles[range.lastIndex]?.time;
      if (firstTime === undefined || lastTime === undefined) return null;

      return alignFineProfileRange(
        Math.min(firstTime, lastTime),
        Math.max(firstTime, lastTime) + timeframeSeconds,
      );
    };

    const getScrolledProfileRestoreWindow = () => {
      const panel = useChartStore.getState().panels[panelId];
      const candles = useChartRuntimeStore.getState().panels[panelId].candles;
      if (!panel.defaultProfileEnabled || candles.length === 0) return null;

      const safeBarWidth = Math.max(1, Number.isFinite(panel.barWidth) ? panel.barWidth : 1);
      const barsFromLatest = Math.max(0, Math.floor(panel.scrollOffset / safeBarWidth));
      if (barsFromLatest < FINE_PROFILE_LAZY_SCROLL_THRESHOLD_BARS) return null;

      const rightIndex = Math.max(0, candles.length - 1 - barsFromLatest);
      const leftIndex = Math.max(0, rightIndex - FINE_PROFILE_LAZY_VISIBLE_BARS);
      const firstTime = candles[leftIndex]?.time;
      const lastTime = candles[rightIndex]?.time;
      if (firstTime === undefined || lastTime === undefined) return null;

      return alignFineProfileRange(firstTime, lastTime + timeframeSeconds);
    };

    const getDefaultProfileRestoreWindow = () => {
      const panel = useChartStore.getState().panels[panelId];
      if (!panel.defaultProfileEnabled) return null;

      const window = getHistoryWindow(useChartRuntimeStore.getState().panels[panelId].candles, timeframeSeconds);
      if (!window) return null;

      const range = alignFineProfileRange(
        Math.max(window.startSeconds, window.endSeconds - FINE_PROFILE_DEFAULT_RESTORE_SECONDS),
        window.endSeconds,
      );
      const profileCache = volumeProfileEngineRef.current.getBaseCache();
      return profileCache.getMissingBaseCandleTimes(range.startSeconds, range.endSeconds).length > 0
        ? range
        : null;
    };

    const restoreLazyProfileRange = async (
      range: { startSeconds: number; endSeconds: number },
      reason: 'default' | 'lazy' | 'custom',
    ) => {
      if (lazyProfileRestoreRunning || range.endSeconds <= range.startSeconds) return;

      const restoreKey = `${reason}:${range.startSeconds}:${range.endSeconds}`;
      if (restoreKey === lastLazyProfileRestoreKey) return;

      lazyProfileRestoreRunning = true;
      try {
        const stats = await hydrateStoredFineProfileRange(range.startSeconds, range.endSeconds, reason);
        lastLazyProfileRestoreKey = restoreKey;

        if (!active) return;
        if ((stats.chunksFetched ?? 0) > 0) {
          publishRestoreStatus({
            stage: 'complete',
            message: reason === 'custom' ? 'Loaded custom profile' : 'Loaded profile history',
            candleCount: useChartRuntimeStore.getState().panels[panelId].candles.length,
            profileRowCount: stats.rowsFetched,
            profileCandleCount: stats.candlesHydrated,
          });
        }
      } catch (error) {
        console.warn(`[HistoryRestore:${panelId}] ${reason} fine profile restore failed`, error);
        publishRestoreStatus({
          stage: 'error',
          message: reason === 'custom' ? 'Custom profile load failed' : 'Profile history load failed',
          candleCount: useChartRuntimeStore.getState().panels[panelId].candles.length,
        });
      } finally {
        lazyProfileRestoreRunning = false;
      }
    };

    let lazyFootprintRestoreRunning = false;
    let lastLazyFootprintRestoreKey = '';

    const getScrolledFootprintRestoreWindow = () => {
      const panel = useChartStore.getState().panels[panelId];
      const candles = useChartRuntimeStore.getState().panels[panelId].candles;
      if (!getCurrentFootprintWorkNeed().needed || candles.length === 0) return null;

      const safeBarWidth = Math.max(1, Number.isFinite(panel.barWidth) ? panel.barWidth : 1);
      const barsFromLatest = Math.max(0, Math.floor(panel.scrollOffset / safeBarWidth));
      
      const rightIndex = Math.max(0, candles.length - 1 - barsFromLatest + 20);
      const leftIndex = Math.max(0, rightIndex - 300);
      
      const firstTime = candles[leftIndex]?.time;
      const lastTime = candles[rightIndex]?.time;
      if (firstTime === undefined || lastTime === undefined) return null;

      const range = alignFootprintRange(firstTime, lastTime + timeframeSeconds);
      const footprintCache = engineRef.current.getBaseCache();
      const missingTimes = footprintCache.getMissingBaseCandleTimes(range.startSeconds, range.endSeconds);

      return missingTimes.length > 0 ? range : null;
    };

    const restoreLazyFootprintRange = async (
      range: { startSeconds: number; endSeconds: number },
      reason: 'lazy'
    ) => {
      if (lazyFootprintRestoreRunning || range.endSeconds <= range.startSeconds) return;

      const restoreKey = `${reason}:${range.startSeconds}:${range.endSeconds}`;
      if (restoreKey === lastLazyFootprintRestoreKey) return;

      lazyFootprintRestoreRunning = true;
      try {
        publishRestoreStatus({
          stage: 'candles',
          message: 'Loading older footprints...',
        });
        
        const stats = await hydrateStoredFootprintRange(range.startSeconds, range.endSeconds);
        lastLazyFootprintRestoreKey = restoreKey;

        if (stats.chunksFetched > 0 && active) {
          publishRestoreStatus({
            stage: 'complete',
            message: 'Loaded older footprints',
            candleCount: useChartRuntimeStore.getState().panels[panelId].candles.length,
          });
        }
      } catch (error) {
        console.warn(`[HistoryRestore:${panelId}] ${reason} footprint restore failed`, error);
        publishRestoreStatus({
          stage: 'error',
          message: 'Footprint load failed',
        });
      } finally {
        lazyFootprintRestoreRunning = false;
      }
    };

    let lazyCandlesRestoreRunning = false;
    let lastLazyCandlesRestoreKey = 0;

    const getScrolledCandlesRestoreWindow = () => {
      const panel = useChartStore.getState().panels[panelId];
      const candles = useChartRuntimeStore.getState().panels[panelId].candles;
      if (candles.length === 0) return null;

      const safeBarWidth = Math.max(1, Number.isFinite(panel.barWidth) ? panel.barWidth : 1);
      const barsFromLatest = Math.max(0, Math.floor(panel.scrollOffset / safeBarWidth));

      if (candles.length - barsFromLatest < 150) {
        return candles[0].time;
      }
      return null;
    };

    const restoreLazyCandlesRange = async (until: number) => {
      if (lazyCandlesRestoreRunning) return;
      if (until === lastLazyCandlesRestoreKey) return;

      lazyCandlesRestoreRunning = true;
      try {
        const params = new URLSearchParams({
          symbol: pair,
          contractType,
          timeframe,
          until: String(until),
          limit: '500',
        });
        const response = await fetch(`/api/history/candles?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) return;

        const fetchedCandles = await response.json() as Candle[];
        if (fetchedCandles.length > 0) {
          lastLazyCandlesRestoreKey = until;
          const currentCandles = useChartRuntimeStore.getState().panels[panelId].candles;
          const existingTimes = new Set(currentCandles.map((c) => c.time));
          const newCandles = fetchedCandles.filter((c) => !existingTimes.has(c.time));
          if (newCandles.length > 0) {
            pushAllCandles(panelId, [...newCandles, ...currentCandles].sort((a, b) => a.time - b.time));
          }
        } else {
          // If no more history, prevent refetching
          lastLazyCandlesRestoreKey = until;
        }
      } catch (error) {
        console.warn(`[HistoryRestore:${panelId}] lazy candles restore failed`, error);
      } finally {
        lazyCandlesRestoreRunning = false;
      }
    };

    const feedUnsubscribers: Array<() => void> = [];

    const init = async () => {
      try {
        publishRestoreStatus({
          stage: 'connecting',
          message: 'Connecting live feed...',
        });
        console.log(`[PanelFeed:${panelId}] Connecting ${contractType} candles and ${dataSourceMode} aggTrades for ${pair} ${timeframe}...`);
        feedUnsubscribers.push(candleCache.subscribe((snapshot) => {
          if (!active) return;

          if (snapshot.reason === 'live' && snapshot.candle) {
            // console.log(`[CANDLE_CACHE_VERIFY:${panelId}] live candle from shared cache`, {
            //   candleCacheKey: snapshot.key,
            //   pair,
            //   contractType,
            //   timeframe,
            //   candleTime: snapshot.candle.time,
            //   isClosed: snapshot.candle.isClosed,
            //   candleCount: snapshot.candleCount,
            //   subscriberPanel: panelId,
            // });
            handleCandle(snapshot.candle);
            return;
          }

          console.log(`[CANDLE_CACHE_VERIFY:${panelId}] syncing candle snapshot from shared cache`, {
            candleCacheKey: snapshot.key,
            pair,
            contractType,
            timeframe,
            reason: snapshot.reason,
            candleCount: snapshot.candleCount,
            firstCandleTime: snapshot.candles[0]?.time ?? null,
            lastCandleTime: snapshot.candles[snapshot.candles.length - 1]?.time ?? null,
            subscriberPanel: panelId,
          });
          pushAllCandles(panelId, snapshot.candles);
          const lastCandle = snapshot.candles[snapshot.candles.length - 1];
          if (Number.isFinite(lastCandle?.close)) {
            contractPriceRef.current = lastCandle.close;
          }
        }));
        const selectedTradeStreamsNeeded =
          getCurrentFootprintWorkNeed().needed
          || shouldRunProfileWork()
          || shouldHydrateStoredAggregateBubbles();

        if (selectedTradeStreamsNeeded && shouldUseSpotTrades) {
          feedUnsubscribers.push(subscribeTradeStream('spot', pair, handleSpotTrade));
        }
        if (selectedTradeStreamsNeeded && shouldUseFuturesTrades) {
          feedUnsubscribers.push(subscribeTradeStream('futures', pair, handleFuturesTrade));
        }

        setLoadingHistory(panelId, true);
        publishRestoreStatus({
          stage: 'candles',
          message: 'Restoring candles...',
        });
        console.log(`[PanelFeed:${panelId}] Restoring stored history for ${pair} ${timeframe} in background...`);
        const historyResult: CandleHistoryRestoreResult = await candleCache.restoreHistory(async () => {
          let restoredHistory: Candle[] = [];
          let storedHistory: Candle[] = [];
          let binanceHistory: Candle[] = [];
          let source: CandleHistoryRestoreResult['source'] = 'none';

          if (shouldUseStoredHistory) {
            try {
              publishRestoreStatus({
                stage: 'candles',
                message: 'Restoring candles from storage...',
              });
              storedHistory = await fetchStoredHistory();
              if (storedHistory.length > 0) {
                restoredHistory = storedHistory;
                source = 'stored';
                pushAllCandles(panelId, storedHistory);
                publishRestoreStatus({
                  stage: 'candles',
                  message: `Restored ${storedHistory.length} stored candles`,
                  candleCount: storedHistory.length,
                  storedCandleCount: storedHistory.length,
                  source,
                });
                await yieldToBrowser();
              }
            } catch (err) {
              console.warn('[History] Could not load stored candles:', err);
            }
          }

          console.log(`[PanelFeed:${panelId}] Fetching Binance ${contractType} history for ${pair} ${timeframe} in background...`);
          publishRestoreStatus({
            stage: 'candles',
            message: storedHistory.length > 0 ? 'Merging exchange candles...' : 'Fetching recent exchange candles...',
            candleCount: restoredHistory.length,
            storedCandleCount: storedHistory.length,
            source,
          });
          try {
            binanceHistory = await fetchSharedHistory(contractType, pair, timeframe);
          } catch (err) {
            console.warn('[History] Could not load Binance candles:', err);
          }

          if (binanceHistory.length > 0) {
            restoredHistory = mergeHistoryCandles(restoredHistory, binanceHistory);
            source = storedHistory.length > 0 ? 'stored+Binance' : 'Binance';
            pushAllCandles(panelId, restoredHistory);
            publishRestoreStatus({
              stage: 'candles',
              message: `Restored ${restoredHistory.length} candles`,
              candleCount: restoredHistory.length,
              storedCandleCount: storedHistory.length,
              binanceCandleCount: binanceHistory.length,
              source,
            });
            await yieldToBrowser();
          }

          return {
            candles: restoredHistory,
            source,
            storedCandles: storedHistory.length,
            binanceCandles: binanceHistory.length,
          };
        });
        const history = historyResult.candles;
        const historySource = historyResult.source;
        publishRestoreStatus({
          stage: 'candles',
          message: `Restored ${history.length} candles`,
          candleCount: history.length,
          storedCandleCount: historyResult.storedCandles ?? 0,
          binanceCandleCount: historyResult.binanceCandles ?? 0,
          source: historySource,
        });
        console.log(`[CANDLE_CACHE_VERIFY:${panelId}] restore result`, {
          candleCacheKey: candleCache.key,
          pair,
          contractType,
          timeframe,
          source: historyResult.source,
          reused: historyResult.reused ?? false,
          restoredCandles: history.length,
          storedCandles: historyResult.storedCandles,
          binanceCandles: historyResult.binanceCandles,
          subscriberPanel: panelId,
        });

        if (!active) return;

        if (history.length > 0) {
          const lastHistoryCandle = history[history.length - 1];
          if (Number.isFinite(lastHistoryCandle?.close)) {
            contractPriceRef.current = lastHistoryCandle.close;
          }
          const restoreWindow = getHistoryWindow(history, timeframeSeconds);
          let displayBucketSize = Math.max(
            BASE_FOOTPRINT_BUCKET_SIZE,
            useChartStore.getState().panels[panelId].bucketSize,
          );

          // Auto Bucket Size Calculation
          if (autoBucketSize) {
            const recentCandles = history.slice(-100); // use last 100 candles for avg
            const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
            const targetTicks = avgRange / tickSize;
            // Aim for ~25 rows per footprint
            const computedSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, Math.round(targetTicks / 25));
            displayBucketSize = computedSize;
            setComputedBucketSize(panelId, computedSize);
            engineRef.current.setDisplayBucketSize(computedSize);
          }

          history.forEach(c => engineRef.current.ingestCandle(c));
          const profileRestoreNeeded = shouldHydrateStoredFineProfiles();
          publishRestoreStatus({
            stage: 'volumeProfile',
            message: profileRestoreNeeded ? 'Restoring Volume Profile...' : 'Profile restore skipped; profile disabled',
            candleCount: history.length,
            storedCandleCount: historyResult.storedCandles ?? 0,
            binanceCandleCount: historyResult.binanceCandles ?? 0,
            source: historySource,
            profileRestoreSkipped: !profileRestoreNeeded,
          });
          const fineProfileStats = profileRestoreNeeded
            ? await hydrateStoredFineProfileRows(history)
            : createEmptyFineProfileStats();
          if (!profileRestoreNeeded) {
            recordRestoreDiagnostic({
              kind: 'volumeProfile',
              key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
              timestamp: Date.now(),
              rowsFetched: 0,
              distinctCandleTimeCount: 0,
              skippedRows: 0,
              details: {
                panelId,
                status: 'skipped-disabled',
                reason: 'profile-disabled',
                profileRestoreSkipped: true,
              },
            });
          }
          const rawTradeRestoreSkipped = !shouldHydrateRawTrades;
          if (rawTradeRestoreSkipped) {
            const rawSkipReason = ENABLE_RAW_TRADE_RESTORE
              ? 'source-not-supported'
              : 'disabled-by-default';
            recordRestoreDiagnostic({
              kind: 'rawTrades',
              key: `${pair}:rawTrades:skipped`,
              timestamp: Date.now(),
              rowsFetched: 0,
              distinctCandleTimeCount: 0,
              skippedRows: 0,
              details: {
                panelId,
                status: 'skipped',
                reason: rawSkipReason,
                rawTradeRestoreSkipped: true,
                enableFlag: 'NEXT_PUBLIC_ENABLE_RAW_TRADE_RESTORE',
              },
            });
          }
          publishRestoreStatus({
            stage: shouldHydrateRawTrades ? 'rawTrades' : 'footprint',
            message: shouldHydrateRawTrades ? 'Restoring raw trades...' : 'Raw trade restore skipped; restoring footprint...',
            candleCount: history.length,
            storedCandleCount: historyResult.storedCandles ?? 0,
            binanceCandleCount: historyResult.binanceCandles ?? 0,
            profileRowCount: fineProfileStats.rowsFetched,
            profileCandleCount: fineProfileStats.candlesHydrated,
            source: historySource,
            profileRestoreSkipped: !profileRestoreNeeded,
            rawTradeRestoreSkipped,
            needsFootprintWork: initialFootprintWorkNeed.needed,
            footprintWorkReasons: initialFootprintWorkNeed.reasons,
          });
          const rawStats = shouldHydrateRawTrades
            ? await hydrateStoredRawTrades(history)
            : createEmptyRawTradeStats();
          const aggregateBubbleStats = await hydrateStoredAggregateBubbles(history);
          const footprintWorkForRestore = getCurrentFootprintWorkNeed();
          const footprintRestoreSkipped = !footprintWorkForRestore.needed;
          if (footprintRestoreSkipped) {
            recordRestoreDiagnostic({
              kind: 'footprint',
              key: `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint:skipped`,
              timestamp: Date.now(),
              rowsFetched: 0,
              distinctCandleTimeCount: 0,
              skippedRows: 0,
              details: {
                panelId,
                status: 'skipped-disabled',
                reason: 'footprint-not-needed',
                needsFootprintWork: false,
                footprintWorkReasons: footprintWorkForRestore.reasons,
                footprintRestoreSkipped: true,
              },
            });
          }
          publishRestoreStatus({
            stage: 'footprint',
            message: footprintRestoreSkipped ? 'Footprint restore skipped; footprint not needed' : 'Restoring footprint...',
            candleCount: history.length,
            storedCandleCount: historyResult.storedCandles ?? 0,
            binanceCandleCount: historyResult.binanceCandles ?? 0,
            profileRowCount: fineProfileStats.rowsFetched,
            profileCandleCount: fineProfileStats.candlesHydrated,
            rawTradeCount: rawStats.hydrated,
            source: historySource,
            profileRestoreSkipped: !profileRestoreNeeded,
            rawTradeRestoreSkipped,
            needsFootprintWork: footprintWorkForRestore.needed,
            footprintWorkReasons: footprintWorkForRestore.reasons,
            footprintRestoreSkipped,
          });
          const footprintStats = footprintWorkForRestore.needed
            ? await hydrateStoredFootprints(history)
            : createEmptyFootprintStats();
          publishRestoreStatus({
            stage: 'footprint',
            message: footprintRestoreSkipped
              ? 'Footprint restore skipped; footprint not needed'
              : footprintStats.restoreFailureReason
                ? `Footprint restore incomplete (${footprintStats.chunksFetched}/${footprintStats.chunkCount} chunks)`
                : `Restored ${footprintStats.rowsFetched} footprint rows`,
            candleCount: history.length,
            storedCandleCount: historyResult.storedCandles ?? 0,
            binanceCandleCount: historyResult.binanceCandles ?? 0,
            profileRowCount: fineProfileStats.rowsFetched,
            profileCandleCount: fineProfileStats.candlesHydrated,
            rawTradeCount: rawStats.hydrated,
            footprintRowCount: footprintStats.rowsFetched,
            footprintCellCount: footprintStats.cellsHydrated,
            footprintCandleCount: footprintStats.candlesHydrated,
            source: historySource,
            profileRestoreSkipped: !profileRestoreNeeded,
            rawTradeRestoreSkipped,
            needsFootprintWork: footprintWorkForRestore.needed,
            footprintWorkReasons: footprintWorkForRestore.reasons,
            footprintRestoreSkipped,
            footprintRequestedRange: footprintStats.requestedRange,
            footprintClampedRange: footprintStats.clampedRange,
            footprintChunkCount: footprintStats.chunkCount,
            footprintRowsPerChunk: footprintStats.rowsPerChunk,
            footprintRangeTooLargeSkipped: footprintStats.skippedBecauseRangeTooLarge,
            footprintRestoreFailureReason: footprintStats.restoreFailureReason,
          });
          if (!active) return;

          recomputeSignalState();
          const coverage = footprintWorkForRestore.needed
            ? getFootprintCoverage(history, engineRef.current)
            : { footprintCandles: 0, footprintCandlesWithCells: 0 };
          console.log(`[HistoryRestore:${panelId}] Restore diagnostics`, {
            pair,
            timeframe,
            contractType,
            dataSourceMode,
            source: historySource,
            candleCacheKey: candleCache.key,
            candleCacheReused: historyResult.reused ?? false,
            storedCandles: historyResult.storedCandles,
            binanceCandles: historyResult.binanceCandles,
            mergedCandles: history.length,
            rangeStart: restoreWindow ? formatSeconds(restoreWindow.startSeconds) : 'n/a',
            rangeEnd: restoreWindow ? formatSeconds(restoreWindow.endSeconds) : 'n/a',
            footprintBaseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
            displayBucketSize,
            rawTradePages: rawStats.pages,
            rawTradesFetched: rawStats.fetched,
            rawTradesHydrated: rawStats.hydrated,
            rawTradeCandlesHydrated: rawStats.hydratedCandleTimes.size,
            rawTradeRangeStart: formatMilliseconds(rawStats.oldestTime),
            rawTradeRangeEnd: formatMilliseconds(rawStats.newestTime),
            rawTradeReachedStart: rawStats.reachedStart,
            rawTradeRestoreSkipped,
            aggregateBubblesFetched: aggregateBubbleStats.rowsFetched,
            aggregateBubblesHydrated: aggregateBubbleStats.rowsHydrated,
            aggregateBubbleDuplicatesSkipped: aggregateBubbleStats.duplicateSkipped,
            aggregateBubbleSpotCount: aggregateBubbleStats.spotCount,
            aggregateBubbleFuturesCount: aggregateBubbleStats.futuresCount,
            aggregateBubbleRangeStart: formatMilliseconds(aggregateBubbleStats.range?.startTime ?? null),
            aggregateBubbleRangeEnd: formatMilliseconds(aggregateBubbleStats.range?.endTime ?? null),
            fineProfileRowsFetched: fineProfileStats.rowsFetched,
            fineProfileCandlesHydrated: fineProfileStats.candlesHydrated,
            profileRestoreSkipped: !profileRestoreNeeded,
            needsFootprintWork: footprintWorkForRestore.needed,
            footprintWorkReasons: footprintWorkForRestore.reasons,
            footprintRestoreSkipped,
            footprintRequestedRange: footprintStats.requestedRange,
            footprintClampedRange: footprintStats.clampedRange,
            footprintChunkCount: footprintStats.chunkCount,
            footprintChunksFetched: footprintStats.chunksFetched,
            footprintChunksSkipped: footprintStats.chunksSkipped,
            footprintRowsPerChunk: footprintStats.rowsPerChunk,
            footprintRangeTooLargeSkipped: footprintStats.skippedBecauseRangeTooLarge,
            footprintRestoreFailureReason: footprintStats.restoreFailureReason,
            footprintRowsFetched: footprintStats.rowsFetched,
            footprintCellsHydrated: footprintStats.cellsHydrated,
            footprintCandlesHydrated: footprintStats.candlesHydrated,
            footprintBucketMatches: footprintStats.bucketMatches,
            footprintBucketMisses: footprintStats.bucketMisses,
            finalFootprintCandles: coverage.footprintCandles,
            finalFootprintCandlesWithCells: coverage.footprintCandlesWithCells,
          });
          recordRestoreDiagnostic({
            kind: 'candles',
            key: `${pair}:${contractType}:${dataSourceMode}:${timeframe}:panel-restore`,
            timestamp: Date.now(),
            rowsFetched: history.length,
            distinctCandleTimeCount: new Set(history.map((candle) => candle.time)).size,
            details: {
              panelId,
              source: historySource,
              candleCacheKey: candleCache.key,
              candleCacheReused: historyResult.reused ?? false,
              storedCandles: historyResult.storedCandles,
              binanceCandles: historyResult.binanceCandles,
              rawTradesFetched: rawStats.fetched,
              rawTradesHydrated: rawStats.hydrated,
              rawTradeRestoreSkipped,
              aggregateBubblesFetched: aggregateBubbleStats.rowsFetched,
              aggregateBubblesHydrated: aggregateBubbleStats.rowsHydrated,
              aggregateBubbleDuplicatesSkipped: aggregateBubbleStats.duplicateSkipped,
              fineProfileRowsFetched: fineProfileStats.rowsFetched,
              profileRestoreSkipped: !profileRestoreNeeded,
              needsFootprintWork: footprintWorkForRestore.needed,
              footprintWorkReasons: footprintWorkForRestore.reasons,
              footprintRestoreSkipped,
              footprintRequestedRange: footprintStats.requestedRange,
              footprintClampedRange: footprintStats.clampedRange,
              footprintChunkCount: footprintStats.chunkCount,
              footprintChunksFetched: footprintStats.chunksFetched,
              footprintChunksSkipped: footprintStats.chunksSkipped,
              footprintRowsPerChunk: footprintStats.rowsPerChunk,
              footprintRangeTooLargeSkipped: footprintStats.skippedBecauseRangeTooLarge,
              footprintRestoreFailureReason: footprintStats.restoreFailureReason,
              footprintRowsFetched: footprintStats.rowsFetched,
              footprintCellsHydrated: footprintStats.cellsHydrated,
              footprintCandlesHydrated: footprintStats.candlesHydrated,
              finalFootprintCandles: coverage.footprintCandles,
              finalFootprintCandlesWithCells: coverage.footprintCandlesWithCells,
            },
          });
        }

        console.log(`[PanelFeed:${panelId}] ${historySource} history merged (${history.length} candles). Live streams already running.`);
        const latestRestoreStatus = useChartRuntimeStore.getState().panels[panelId].historyRestoreStatus;
        publishRestoreStatus({
          stage: 'complete',
          message: latestRestoreStatus?.footprintRestoreFailureReason
            ? `Restored ${history.length} candles; footprint incomplete`
            : `Restored ${history.length} candles`,
          candleCount: history.length,
          storedCandleCount: historyResult.storedCandles ?? 0,
          binanceCandleCount: historyResult.binanceCandles ?? 0,
          profileRowCount: latestRestoreStatus?.profileRowCount ?? 0,
          profileCandleCount: latestRestoreStatus?.profileCandleCount ?? 0,
          rawTradeCount: latestRestoreStatus?.rawTradeCount ?? 0,
          footprintRowCount: latestRestoreStatus?.footprintRowCount ?? 0,
          footprintCellCount: latestRestoreStatus?.footprintCellCount ?? 0,
          footprintCandleCount: latestRestoreStatus?.footprintCandleCount ?? 0,
          profileRestoreSkipped: latestRestoreStatus?.profileRestoreSkipped,
          rawTradeRestoreSkipped: latestRestoreStatus?.rawTradeRestoreSkipped,
          footprintRestoreSkipped: latestRestoreStatus?.footprintRestoreSkipped,
          needsFootprintWork: latestRestoreStatus?.needsFootprintWork,
          footprintWorkReasons: latestRestoreStatus?.footprintWorkReasons,
          footprintIngestionSkipped: footprintIngestionSkippedRef.current,
          icebergDisabledNoopSkipped: icebergDisabledNoopSkippedRef.current,
          footprintRequestedRange: latestRestoreStatus?.footprintRequestedRange,
          footprintClampedRange: latestRestoreStatus?.footprintClampedRange,
          footprintChunkCount: latestRestoreStatus?.footprintChunkCount,
          footprintRowsPerChunk: latestRestoreStatus?.footprintRowsPerChunk,
          footprintRangeTooLargeSkipped: latestRestoreStatus?.footprintRangeTooLargeSkipped,
          footprintRestoreFailureReason: latestRestoreStatus?.footprintRestoreFailureReason,
          source: historySource,
        });
        setLoadingHistory(panelId, false);
      } catch (err) {
        console.error(`[PanelFeed:${panelId}] Initialization failed:`, err);
        if (active) {
          publishRestoreStatus({
            stage: 'error',
            message: 'History restore failed',
          });
          setLoadingHistory(panelId, false);
        }
      }
    };

    init();

    // --- Orderbook lifecycle ---
    let aggregationInterval: NodeJS.Timeout | null = null;
    const rawTradeFlushInterval = setInterval(() => {
      flushRawTrades();
      flushFineProfileRows();
    }, RAW_TRADE_FLUSH_MS);
    const lazyProfileRestoreInterval = setInterval(() => {
      const customRange = getCustomProfileRestoreWindow();
      if (customRange) {
        void restoreLazyProfileRange(customRange, 'custom');
        return;
      }

      const defaultRange = getDefaultProfileRestoreWindow();
      if (defaultRange) {
        void restoreLazyProfileRange(defaultRange, 'default');
        return;
      }

      const scrolledCandleUntil = getScrolledCandlesRestoreWindow();
      if (scrolledCandleUntil) {
        void restoreLazyCandlesRange(scrolledCandleUntil);
      }

      const scrolledFootprintRange = getScrolledFootprintRestoreWindow();
      if (scrolledFootprintRange) {
        void restoreLazyFootprintRange(scrolledFootprintRange, 'lazy');
      }

      const scrolledRange = getScrolledProfileRestoreWindow();
      if (scrolledRange) {
        void restoreLazyProfileRange(scrolledRange, 'lazy');
      }
    }, 1200);
    const obManager = orderbookRef.current;

    const initOrderbook = async () => {
      try {
        const panelState = useChartStore.getState().panels[panelId];
        if (!panelState.liquidityEnabled && !panelState.liquidityHeatmapEnabled) {
          pendingAggregationRef.current = false;
          return;
        }

        console.log(`[PanelFeed:${panelId}] Fetching orderbook snapshot for ${pair}...`);
        const snapshot = await fetchSharedOrderbookSnapshot(pair, 500);
        if (!active) return;

        obManager.initFromSnapshot(snapshot);
        console.log(`[PanelFeed:${panelId}] Orderbook snapshot loaded (${snapshot.bids.length} bids, ${snapshot.asks.length} asks)`);

        // Subscribe to incremental updates
        feedUnsubscribers.push(
          subscribeDepthStream(pair, (update: DepthUpdate) => {
            obManager.applyUpdate(update);
            if (useChartStore.getState().panels[panelId].liquidityEnabled) {
              pendingAggregationRef.current = true;
            }
          })
        );

        // Throttled aggregation at 500ms
        aggregationInterval = setInterval(() => {
          if (!pendingAggregationRef.current) return;
          pendingAggregationRef.current = false;

          if (!obManager.isReady()) return;

          const panelState = useChartStore.getState().panels[panelId];
          if (!panelState.liquidityEnabled) return;

          const midPrice = obManager.getMidPrice();
          if (midPrice === null) return;

          const zones = aggregateOrderbook(
            obManager.getAllBids(),
            obManager.getAllAsks(),
            midPrice,
            {
              liquidityBucketSize: panelState.liquidityBucketSize,
              minimumLiquidityThreshold: panelState.minimumLiquidityThreshold,
              liquidityRange: panelState.liquidityRange,
            }
          );

          setLiquidityZones(panelId, zones);
        }, 500);
      } catch (err) {
        console.error(`[PanelFeed:${panelId}] Orderbook init failed:`, err);
      }
    };

    initOrderbook();

    return () => {
      active = false;
      feedUnsubscribers.forEach((unsubscribe) => unsubscribe());
      console.debug('[VPROFILE_DEBUG] Live fine profile 1m slices before feed cleanup', {
        panelId,
        pair,
        contractType,
        dataSourceMode,
        timeframe,
        storageTimeframe: fineProfileStorageTimeframe,
        tickSize,
        baseBucketSize: fineProfileBaseBucketSize,
        liveSlices: getLiveFineProfileSliceCount(),
        queuedRowsPending: fineProfileQueueRef.current.length,
        closedBeforeTime: getTradeClosedFineProfileTime(),
        coverageStart: getFirstFullyCoveredCandleTime(),
      });
      persistEligibleFineProfileRows(getTradeClosedFineProfileTime(), 'cleanup-before-reset');
      flushRawTrades();
      flushFineProfileRows();
      if (footprintIngestionSkippedRef.current > 0 || icebergDisabledNoopSkippedRef.current > 0) {
        recordRestoreDiagnostic({
          kind: 'footprint',
          key: `${pair}:${contractType}:${dataSourceMode}:${timeframe}:hidden-work-skips`,
          timestamp: Date.now(),
          rowsFetched: 0,
          distinctCandleTimeCount: 0,
          skippedRows: footprintIngestionSkippedRef.current,
          details: {
            panelId,
            needsFootprintWork: getCurrentFootprintWorkNeed().needed,
            footprintWorkReasons: getCurrentFootprintWorkNeed().reasons,
            footprintIngestionSkipped: footprintIngestionSkippedRef.current,
            icebergDisabledNoopSkipped: icebergDisabledNoopSkippedRef.current,
          },
        });
      }
      clearInterval(rawTradeFlushInterval);
      clearInterval(lazyProfileRestoreInterval);
      if (aggregationInterval) clearInterval(aggregationInterval);
      obManager.reset();
      setLiquidityZones(panelId, []);
      setConnected(panelId, false);
      setLoadingHistory(panelId, false);
      setHistoryRestoreStatus(panelId, null);
      connectedRef.current = false;
      footprintEngine.releaseSharedBaseCache();
      volumeProfileEngine.releaseSharedBaseCache();
    };
  }, [pair, timeframe, panelId, exhaustionLookback, icebergEnabled, icebergMinScore, pushCandle, setConnected, pushAllCandles, setLoadingHistory, setHistoryRestoreStatus, setAbsorptionMap, setExhaustionMap, setIcebergLevels, setLiquidityVacuumZones, autoBucketSize, setComputedBucketSize, tickSize, setLiquidityZones, liquidityEnabled, liquidityHeatmapEnabled, liquidityBucketSize, minimumLiquidityThreshold, liquidityRange, contractType, dataSourceMode, markProcessedTrade, appendAggregateBubbleEvents, rebuildLiquidityVacuumZones, absorptionEnabled, exhaustionEnabled, bubblesEnabled, bubbleSource, volumeBarsEnabled, volumeBarsInputData, volumeBarsMarketSource, cvdEnabled, clearIcebergLevelsIfNeeded, getCurrentFootprintWorkNeed, resetPanelRuntime]);
  // Register protected ranges for Volume Profile cache to prevent eviction
  useEffect(() => {
    return useChartStore.subscribe((state) => {
      const panel = state.panels[panelId];
      const runtimePanel = useChartRuntimeStore.getState().panels[panelId];
      
      const ranges: Array<{ startSeconds: number; endSeconds: number }> = [];
      const timeframeSeconds = getTimeframeSeconds(panel.timeframe);
      
      if (panel.customProfileRange && runtimePanel.candles.length > 0) {
        const range = panel.customProfileRange;
        const firstTime = range.firstTime ?? runtimePanel.candles[range.firstIndex]?.time;
        const lastTime = range.lastTime ?? runtimePanel.candles[range.lastIndex]?.time;
        if (firstTime !== undefined && lastTime !== undefined) {
          ranges.push({
            startSeconds: Math.min(firstTime, lastTime),
            endSeconds: Math.max(firstTime, lastTime) + timeframeSeconds,
          });
        }
      }
      
      if (panel.defaultProfileEnabled && runtimePanel.candles.length > 0) {
        // Simple history window fallback since getHistoryWindow is internal to another effect
        const visibleCandles = runtimePanel.candles;
        if (visibleCandles.length > 0) {
          const lastCandle = visibleCandles[visibleCandles.length - 1];
          const firstCandle = visibleCandles[0];
          const endSeconds = (lastCandle.time / 1000) + timeframeSeconds;
          const startSeconds = (firstCandle.time / 1000);
          
          ranges.push({
            startSeconds: Math.max(startSeconds, endSeconds - FINE_PROFILE_DEFAULT_RESTORE_SECONDS),
            endSeconds: endSeconds,
          });
        }
      }
      
      volumeProfileEngineRef.current.setProtectedRanges(panelId, ranges);
    });
  }, [panelId]);

  // Clear protected ranges on unmount
  useEffect(() => {
    return () => {
      volumeProfileEngineRef.current.setProtectedRanges(panelId, []);
    };
  }, [panelId]);

  // Temporary Verification Hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'h') {
        const activePanel = useChartStore.getState().activePanel;
        if (activePanel === panelId) {
          console.log(`--- Liquidity History (${panelId} panel) ---`);
          const history = liquidityHistoryRef.current.getHistory();
          console.log(`Snapshot count: ${history.length}`);
          if (history.length > 0) {
            const firstSnapshot = history[0];
            console.log(`First snapshot zones:`, firstSnapshot.zones.length);
            const firstBid = firstSnapshot.zones.find(z => z.side === 'bid');
            if (firstBid) {
              const priceHistory = liquidityHistoryRef.current.getPriceHistory(firstBid.price, 'bid');
              console.log(`Price History for ${firstBid.price} (bid):`, priceHistory);
              if (priceHistory.length > 0) {
                import('../lib/liquidity/analysis').then(({ getLiquidityBehavior }) => {
                  console.log(`Behavior for ${firstBid.price}:`, getLiquidityBehavior(priceHistory));
                });
              }
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelId]);

  return (
    <ChartEngineContext.Provider
      value={{
        engine: engineRef.current,
        liquidityHistory: liquidityHistoryRef.current,
        icebergEngine: icebergEngineRef.current,
        volumeProfileEngine: volumeProfileEngineRef.current,
        volumeProfileRevision,
      }}
    >
      {children}
    </ChartEngineContext.Provider>
  );
}

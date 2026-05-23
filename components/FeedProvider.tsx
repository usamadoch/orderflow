'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChartStore, PanelId } from '../lib/store/chart';
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
import { FootprintCell } from '../types/footprint';
import { AbsorptionResult } from '../types/absorption';
import { ExhaustionResult } from '../types/exhaustion';
import { IcebergLevel } from '../types/iceberg';
import { LiquidityVacuumZone } from '../types/liquidityVacuum';
import { OrderbookManager, DepthUpdate } from '../lib/liquidity/orderbook';
import { aggregateOrderbook } from '../lib/liquidity/aggregation';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { storeBaseFootprintAction, storeClosedCandleAction, storeFineProfileRowsAction, storeRawTradesAction } from '../lib/actions/storageActions';
import { FINE_PROFILE_STORAGE_TIMEFRAME } from '../lib/config/markets';
import { recordRestoreDiagnostic } from '../lib/debug/marketMetrics';

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
const MAX_DEDUPE_KEYS = 100000;

const queuedRawTradeStorageKeys = new Set<string>();
const closedCandleStorageKeys = new Set<string>();
const queuedFineProfileCandleKeys = new Set<string>();

type TradeSource = 'spot' | 'futures';

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

interface FootprintHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
  cellsHydrated: number;
  bucketMatches: number;
  bucketMisses: number;
}

interface FineProfileHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
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

export function PanelFeedProvider({ panelId, children }: PanelFeedProviderProps) {
  const pair = useChartStore(s => s.panels[panelId].pair);
  const timeframe = useChartStore(s => s.panels[panelId].timeframe);
  const bucketSize = useChartStore(s => s.panels[panelId].bucketSize);
  const autoBucketSize = useChartStore(s => s.panels[panelId].autoBucketSize);
  const chartMode = useChartStore(s => s.panels[panelId].chartMode);
  const contractType = useChartStore(s => s.panels[panelId].contractType);
  const dataSourceMode = useChartStore(s => s.panels[panelId].dataSourceMode);
  const tickSize = useChartStore(s => s.tickSize);
  const pushCandle = useChartStore(s => s.pushCandle);
  const setConnected = useChartStore(s => s.setConnected);
  const pushAllCandles = useChartStore(s => s.pushAllCandles);
  const setLoadingHistory = useChartStore(s => s.setLoadingHistory);
  const triggerFootprintRedraw = useChartStore(s => s.triggerFootprintRedraw);
  const setComputedBucketSize = useChartStore(s => s.setComputedBucketSize);
  const setAbsorptionMap = useChartStore(s => s.setAbsorptionMap);
  const setExhaustionMap = useChartStore(s => s.setExhaustionMap);
  const exhaustionLookback = useChartStore(s => s.panels[panelId].exhaustionLookback);
  const setIcebergLevels = useChartStore(s => s.setIcebergLevels);
  const icebergEnabled = useChartStore(s => s.panels[panelId].icebergEnabled);
  const icebergMinScore = useChartStore(s => s.panels[panelId].icebergMinScore);
  const icebergLookback = useChartStore(s => s.panels[panelId].icebergLookback);
  const setLiquidityVacuumZones = useChartStore(s => s.setLiquidityVacuumZones);
  const liquidityVacuumEnabled = useChartStore(s => s.panels[panelId].liquidityVacuumEnabled);
  const liquidityVacuumMinScore = useChartStore(s => s.panels[panelId].liquidityVacuumMinScore);
  const liquidityVacuumMaxZones = useChartStore(s => s.panels[panelId].liquidityVacuumMaxZones);
  const setLiquidityZones = useChartStore(s => s.setLiquidityZones);
  const liquidityEnabled = useChartStore(s => s.panels[panelId].liquidityEnabled);
  const liquidityBucketSize = useChartStore(s => s.panels[panelId].liquidityBucketSize);
  const liquidityHistoryDepth = useChartStore(s => s.panels[panelId].liquidityHistoryDepth);
  const minimumLiquidityThreshold = useChartStore(s => s.panels[panelId].minimumLiquidityThreshold);
  const liquidityRange = useChartStore(s => s.panels[panelId].liquidityRange);

  const connectedRef = useRef(false);
  const bucketSizeRef = useRef(bucketSize);
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const volumeProfileEngineRef = useRef(new RawTradeVolumeProfileEngine());
  const pendingFootprintRedrawRef = useRef(false);
  const pendingProfileRedrawRef = useRef(false);
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

  useEffect(() => {
    bucketSizeRef.current = bucketSize;
  }, [bucketSize]);

  const rebuildLiquidityVacuumZones = useCallback((candles = useChartStore.getState().panels[panelId].candles || []) => {
    const displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSizeRef.current);
    const zones = liquidityVacuumEnabled
      ? buildLiquidityVacuumZones(candles, engineRef.current, displayBucketSize, {
        minScore: liquidityVacuumMinScore,
        maxZones: liquidityVacuumMaxZones,
      })
      : [];

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
    const currentCandles = useChartStore.getState().panels[panelId].candles || [];
    const levels = currentCandles.length > 0 && icebergEnabled
      ? icebergEngineRef.current
        .update(currentCandles, engineRef.current)
        .filter(level => level.score >= icebergMinScore)
        .slice(0, 20)
      : [];
    icebergLevelsRef.current = levels;
    setIcebergLevels(panelId, levels);
  }, [icebergLookback, icebergEnabled, icebergMinScore, panelId, setIcebergLevels]);

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

      // Re-score provisional (live) candle on footprint updates
      if (hadFootprintUpdate || chartMode === 'footprint') {
        const candles = useChartStore.getState().panels[panelId].candles || [];
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          if (!last.isClosed) {
            const newMap = scoreLatestCandle(candles, engineRef.current, absorptionMapRef.current);
            if (newMap !== absorptionMapRef.current) {
              absorptionMapRef.current = newMap;
              setAbsorptionMap(panelId, newMap);
            }

            const newExhMap = scoreLatestExhaustion(candles, engineRef.current, absorptionMapRef.current, exhaustionMapRef.current, exhaustionLookback);
            if (newExhMap !== exhaustionMapRef.current) {
              exhaustionMapRef.current = newExhMap;
              setExhaustionMap(panelId, newExhMap);
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
  }, [triggerFootprintRedraw, chartMode, panelId, setAbsorptionMap, rebuildLiquidityVacuumZones]);

  // Handle display bucket size updates without reconnecting socket or clearing base cells.
  useEffect(() => {
    const displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSize);
    engineRef.current.setDisplayBucketSize(displayBucketSize);
    icebergEngineRef.current.setBucketSize(displayBucketSize);
    const currentCandles = useChartStore.getState().panels[panelId].candles || [];
    // Rebuild signal maps against the current display aggregation.
    const newMap = buildAbsorptionMap(currentCandles, engineRef.current);
    absorptionMapRef.current = newMap;
    setAbsorptionMap(panelId, newMap);

    const newExhMap = buildExhaustionMap(currentCandles, engineRef.current, newMap, exhaustionLookback);
    exhaustionMapRef.current = newExhMap;
    setExhaustionMap(panelId, newExhMap);

    const levels = icebergEnabled
      ? icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20)
      : [];
    icebergLevelsRef.current = levels;
    setIcebergLevels(panelId, levels);
    rebuildLiquidityVacuumZones(currentCandles);

    triggerFootprintRedraw(panelId);
  }, [bucketSize, exhaustionLookback, icebergEnabled, icebergMinScore, triggerFootprintRedraw, panelId, setAbsorptionMap, setExhaustionMap, setIcebergLevels, rebuildLiquidityVacuumZones]);

  // Handle autoBucketSize toggle
  useEffect(() => {
    if (autoBucketSize) {
      const currentCandles = useChartStore.getState().panels[panelId].candles || [];
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
    connectedRef.current = false;
    setConnected(panelId, false);
    engineRef.current.reset();
    engineRef.current.setSharedBaseCache({ symbol: pair, contractType, dataSourceMode });
    volumeProfileEngineRef.current.reset();
    volumeProfileEngineRef.current.setSharedBaseCache({
      symbol: pair,
      contractType,
      dataSourceMode,
      baseBucketSize: tickSize,
    });
    rawTradeQueueRef.current = [];
    fineProfileQueueRef.current = [];
    liveFineProfileRowsRef.current = new Map();
    contractPriceRef.current = null;
    processedTradeIdsRef.current = new Set();
    firstFullyCoveredCandleTimeRef.current = { spot: null, futures: null };
    latestTradeBaseCandleTimeRef.current = { spot: null, futures: null };
    lastProfileRevisionAtRef.current = 0;
    pendingProfileRedrawRef.current = false;
    absorptionMapRef.current = new Map();
    exhaustionMapRef.current = new Map();
    icebergEngineRef.current.reset();
    icebergLevelsRef.current = [];
    setIcebergLevels(panelId, []);
    liquidityVacuumZonesRef.current = [];
    setLiquidityVacuumZones(panelId, []);
    lastScoredCandleTimeRef.current = null;
    useChartStore.getState().setActiveMeasurement(panelId, null);
    liquidityHistoryRef.current.reset();

    const timeframeSeconds = getTimeframeSeconds(timeframe);
    engineRef.current.setDisplayTimeframeSeconds(timeframeSeconds);
    const activeTradeSources: TradeSource[] = dataSourceMode === 'both'
      ? ['spot', 'futures']
      : [dataSourceMode];
    const shouldUseSpotTrades = activeTradeSources.includes('spot');
    const shouldUseFuturesTrades = activeTradeSources.includes('futures');
    const shouldUseStoredHistory = contractType === 'spot';
    const shouldHydrateStoredFootprints = true;
    const shouldHydrateStoredFineProfiles = true;
    const shouldHydrateRawTrades = contractType === 'spot' && dataSourceMode === 'spot';
    const fineProfileStorageTimeframe = FINE_PROFILE_STORAGE_TIMEFRAME;
    const candleCache = getSharedCandleCache({
      symbol: pair,
      contractType,
      timeframe,
    });

    const getFirstFullyCoveredCandleTime = () => {
      const coverageTimes = activeTradeSources.map((source) => firstFullyCoveredCandleTimeRef.current[source]);
      if (coverageTimes.some((time) => time === null)) return null;
      return Math.max(...coverageTimes.map((time) => time ?? 0));
    };

    const getLiveFineProfileSliceCount = () => liveFineProfileRowsRef.current.size;

    const getTradeClosedFineProfileTime = () => {
      const latestTimes = activeTradeSources.map((source) => latestTradeBaseCandleTimeRef.current[source]);
      if (latestTimes.some((time) => time === null)) return null;
      return Math.min(...latestTimes.map((time) => time ?? 0));
    };

    const getTradeDedupeKey = (trade: Trade, source: TradeSource) => {
      if (Number.isFinite(trade.id)) return `${source}:${trade.id}`;
      return `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker}`;
    };

    const markProcessedTrade = (trade: Trade, source: TradeSource) => {
      const key = getTradeDedupeKey(trade, source);
      if (processedTradeIdsRef.current.has(key)) return false;

      processedTradeIdsRef.current.add(key);
      while (processedTradeIdsRef.current.size > MAX_DEDUPE_KEYS) {
        const oldest = processedTradeIdsRef.current.values().next().value;
        if (oldest === undefined) break;
        processedTradeIdsRef.current.delete(oldest);
      }

      return true;
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
    };

    const recomputeSignalState = () => {
      const currentCandles = useChartStore.getState().panels[panelId].candles || [];
      const absMap = buildAbsorptionMap(currentCandles, engineRef.current);
      absorptionMapRef.current = absMap;
      setAbsorptionMap(panelId, absMap);

      const exhMap = buildExhaustionMap(currentCandles, engineRef.current, absMap, exhaustionLookback);
      exhaustionMapRef.current = exhMap;
      setExhaustionMap(panelId, exhMap);

      const icebergLevels = icebergEnabled
        ? icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20)
        : [];
      icebergLevelsRef.current = icebergLevels;
      setIcebergLevels(panelId, icebergLevels);
      rebuildLiquidityVacuumZones(currentCandles);
    };

    const flushRawTrades = () => {
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
      if (tickSize <= 0) return;

      const bucketPrice = normalizePriceToBucket(trade.price, tickSize);
      const candleRows = liveFineProfileRowsRef.current.get(candleTime) ?? new Map<number, FineProfileRow>();
      let row = candleRows.get(bucketPrice);

      if (!row) {
        row = {
          candleTime,
          baseBucketSize: tickSize,
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
          baseBucketSize: tickSize,
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
            slicesBefore: stats.slicesBefore,
            closedBeforeTime,
            currentStreamBaseTime: closedBeforeTime,
            isClosed: false,
            coverageStart,
            rowsSkippedPartial: stats.rowsSkippedPartial,
          });
        }
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

        const storableRows = rows.filter((row) => {
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
        });

        if (storableRows.length > 0) {
          fineProfileQueueRef.current.push(...storableRows);
          stats.rowsQueued += storableRows.length;
        }

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
          baseBucketSize: tickSize,
          rowsQueued: storableRows.length,
          rowsSkippedDuplicate: rows.length - storableRows.length,
        });
      }

      if (stats.slicesPersisted > 0) {
        pendingProfileRedrawRef.current = true;

        if (fineProfileQueueRef.current.length >= FINE_PROFILE_FLUSH_SIZE) {
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
          closedBeforeTime,
          currentStreamBaseTime: closedBeforeTime,
          coverageStart,
          ...stats,
          slicesRemaining: getLiveFineProfileSliceCount(),
          queuedRowsPending: fineProfileQueueRef.current.length,
        });
      }

      if (stats.rowsQueued > 0 || stats.rowsSkippedDuplicate > 0 || stats.rowsSkippedPartial > 0 || stats.rowsSkippedOpen > 0) {
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
        const firstFullyCoveredCandleTime = getFirstFullyCoveredCandleTime();
        const hasFullRealtimeFootprint = firstFullyCoveredCandleTime !== null
          && candle.time >= firstFullyCoveredCandleTime;
        const baseFootprints = hasFullRealtimeFootprint
          ? engineRef.current.getBaseFootprintCandlesInRange(candle.time, candle.time + timeframeSeconds)
          : [];

        if (!hasFullRealtimeFootprint) {
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

        if (contractType === 'spot' && claimClosedCandleStorage(pair, contractType, dataSourceMode, timeframe, candle.time, 0)) {
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

        if (hasFullRealtimeFootprint) {
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
        persistEligibleFineProfileRows(profileRangeEnd, 'selected-candle-close');

        if (!hasFullRealtimeFootprint) {
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
        const currentCandles = useChartStore.getState().panels[panelId].candles || [];
        const newMap = scoreLatestCandle(currentCandles, engineRef.current, absorptionMapRef.current);
        absorptionMapRef.current = newMap;
        setAbsorptionMap(panelId, newMap);

        const newExhMap = scoreLatestExhaustion(currentCandles, engineRef.current, newMap, exhaustionMapRef.current, exhaustionLookback);
        exhaustionMapRef.current = newExhMap;
        setExhaustionMap(panelId, newExhMap);

        const icebergLevels = icebergEnabled
          ? icebergEngineRef.current.update(currentCandles, engineRef.current).filter(level => level.score >= icebergMinScore).slice(0, 20)
          : [];
        icebergLevelsRef.current = icebergLevels;
        setIcebergLevels(panelId, icebergLevels);
        rebuildLiquidityVacuumZones(currentCandles);
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

        const panelState = useChartStore.getState().panels[panelId];
        if (panelState.liquidityHistoryEnabled) {
          liquidityHistoryRef.current.captureSnapshot(candle.time, orderbookRef.current);
        }
      }
    };

    const handleTrade = (trade: Trade, source: TradeSource) => {
      if (!markProcessedTrade(trade, source)) return;
      markLiveConnected();
      const alignedTrade = getContractAlignedTrade(trade, source);
      if (!alignedTrade) return;

      const baseCandleTime = getBaseCandleTimeForTrade(trade.time);
      if (firstFullyCoveredCandleTimeRef.current[source] === null) {
        firstFullyCoveredCandleTimeRef.current[source] = baseCandleTime + BASE_FOOTPRINT_TIMEFRAME_SECONDS;
      }
      const previousSourceBaseTime = latestTradeBaseCandleTimeRef.current[source];
      latestTradeBaseCandleTimeRef.current[source] = previousSourceBaseTime === null
        ? baseCandleTime
        : Math.max(previousSourceBaseTime, baseCandleTime);
      persistEligibleFineProfileRows(getTradeClosedFineProfileTime(), 'trade-advanced-1m');

      engineRef.current.ingestTrade(alignedTrade, baseCandleTime);
      volumeProfileEngineRef.current.ingestTrade(alignedTrade);
      aggregateFineProfileTrade(alignedTrade, baseCandleTime);

      if (contractType === 'spot' && source === 'spot' && claimRawTradeStorage(pair, trade)) {
        rawTradeQueueRef.current.push(trade);
      }

      pendingProfileRedrawRef.current = true;
      pendingFootprintRedrawRef.current = true;

      if (rawTradeQueueRef.current.length >= RAW_TRADE_FLUSH_SIZE) {
        flushRawTrades();
      }
    };

    const handleSpotTrade = (trade: Trade) => handleTrade(trade, 'spot');
    const handleFuturesTrade = (trade: Trade) => handleTrade(trade, 'futures');

    const fetchStoredHistory = async () => {
      const params = new URLSearchParams({
        symbol: pair,
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
          engineRef.current.ingestTrade(hydratedTrade, candleTime);
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
        pendingFootprintRedrawRef.current = true;
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

    const hydrateStoredFootprints = async (candles: Candle[]): Promise<FootprintHydrationStats> => {
      const stats: FootprintHydrationStats = {
        rowsFetched: 0,
        candlesHydrated: 0,
        cellsHydrated: 0,
        bucketMatches: 0,
        bucketMisses: 0,
      };
      const window = getBaseFootprintWindow(candles, timeframeSeconds);
      if (!window) return stats;

      const candidateTimes = engineRef.current.getMissingBaseCandleTimes(window.startSeconds, window.endSeconds);
      if (candidateTimes.length === 0) return stats;

      const restoredStats = await engineRef.current.getBaseCache().runRestoreOnce(window.startSeconds, window.endSeconds, async () => {
        const params = new URLSearchParams({
          symbol: pair,
          contractType,
          dataSourceMode,
          timeframe: BASE_FOOTPRINT_TIMEFRAME,
          start: String(window.startSeconds),
          end: String(window.endSeconds),
          bucketSize: String(BASE_FOOTPRINT_BUCKET_SIZE),
        });
        const response = await fetch(`/api/history/footprint?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          recordRestoreDiagnostic({
            kind: 'footprint',
            key: `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`,
            timestamp: Date.now(),
            failedRows: candidateTimes.length,
            details: {
              panelId,
              status: response.status,
              start: window.startSeconds,
              end: window.endSeconds,
              baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
            },
          });
          console.warn(`[HistoryRestore:${panelId}] Stored footprint fallback failed with ${response.status}`);
          return stats;
        }

        const rows = await response.json() as FootprintHistoryRow[];
        stats.rowsFetched = rows.length;

        const rowsByCandle = new Map<number, FootprintHistoryRow[]>();
        for (const row of rows) {
          const current = rowsByCandle.get(row.candleTime) ?? [];
          current.push(row);
          rowsByCandle.set(row.candleTime, current);
        }

        const candidateTimeSet = new Set(candidateTimes);
        stats.bucketMatches = candidateTimes.filter((time) => rowsByCandle.has(time)).length;
        stats.bucketMisses = Math.max(0, candidateTimes.length - stats.bucketMatches);

        for (const candleTime of candidateTimes) {
          if (!active) return stats;

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
          stats.candlesHydrated += 1;
          stats.cellsHydrated += cells.size;

          if (stats.candlesHydrated % HYDRATION_CHUNK_SIZE === 0) {
            await yieldToBrowser();
          }
        }

        recordRestoreDiagnostic({
          kind: 'footprint',
          key: `${pair}:${contractType}:${dataSourceMode}:${BASE_FOOTPRINT_TIMEFRAME}:footprint`,
          timestamp: Date.now(),
          rowsFetched: stats.rowsFetched,
          distinctCandleTimeCount: stats.candlesHydrated,
          skippedRows: stats.bucketMisses,
          details: {
            panelId,
            start: window.startSeconds,
            end: window.endSeconds,
            candidateCandles: candidateTimes.length,
            cellsHydrated: stats.cellsHydrated,
            bucketMatches: stats.bucketMatches,
            bucketMisses: stats.bucketMisses,
            baseBucketSize: BASE_FOOTPRINT_BUCKET_SIZE,
          },
        });

        return stats;
      });

      if (restoredStats.candlesHydrated > 0) {
        pendingFootprintRedrawRef.current = true;
        pendingProfileRedrawRef.current = true;
      }

      return restoredStats;
    };

    const hydrateStoredFineProfileRows = async (candles: Candle[]): Promise<FineProfileHydrationStats> => {
      const stats: FineProfileHydrationStats = {
        rowsFetched: 0,
        candlesHydrated: 0,
      };
      const window = getHistoryWindow(candles, timeframeSeconds);
      if (!window || tickSize <= 0) return stats;

      const profileCache = volumeProfileEngineRef.current.getBaseCache();
      const candidateTimes = profileCache.getMissingBaseCandleTimes(window.startSeconds, window.endSeconds);
      if (candidateTimes.length === 0) {
        recordRestoreDiagnostic({
          kind: 'volumeProfile',
          key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
          timestamp: Date.now(),
          rowsFetched: 0,
          distinctCandleTimeCount: 0,
          details: {
            panelId,
            status: 'cache-covered',
            sourceKey: profileCache.key,
            start: window.startSeconds,
            end: window.endSeconds,
            baseBucketSize: tickSize,
          },
        });
        console.debug('[VPROFILE_CACHE] Fine profile restore skipped because shared base cache already covers range', {
          panelId,
          pair,
          contractType,
          dataSourceMode,
          sourceKey: profileCache.key,
          requestedChartTimeframe: timeframe,
          storageTimeframe: fineProfileStorageTimeframe,
          baseBucketSize: tickSize,
          start: window.startSeconds,
          end: window.endSeconds,
          rowCount: profileCache.rowCount,
          coverageRange: profileCache.getLoadedRanges(),
        });
        return stats;
      }

      const restoredStats = await profileCache.runRestoreOnce(window.startSeconds, window.endSeconds, async () => {
        const params = new URLSearchParams({
          symbol: pair,
          timeframe: fineProfileStorageTimeframe,
          contractType,
          dataSourceMode,
          start: String(window.startSeconds),
          end: String(window.endSeconds),
          baseBucketSize: String(tickSize),
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
              sourceKey: profileCache.key,
              start: window.startSeconds,
              end: window.endSeconds,
              baseBucketSize: tickSize,
            },
          });
          console.warn(`[HistoryRestore:${panelId}] Fine profile row restore failed with ${response.status}`);
          return stats;
        }

        const rows = await response.json() as FineProfileRow[];
        stats.rowsFetched = rows.length;
        stats.candlesHydrated = new Set(rows.map((row) => row.candleTime)).size;

        if (rows.length > 0) {
          volumeProfileEngineRef.current.hydrateProfileRows(rows, 'restore');
          pendingProfileRedrawRef.current = true;
        }

        console.debug('[VPROFILE_CACHE] Fine profile restore hydrated in shared cache', {
          panelId,
          pair,
          contractType,
          dataSourceMode,
          sourceKey: profileCache.key,
          requestedChartTimeframe: timeframe,
          storageTimeframe: fineProfileStorageTimeframe,
          baseBucketSize: tickSize,
          start: window.startSeconds,
          end: window.endSeconds,
          candidateCandles: candidateTimes.length,
          rowsFetched: stats.rowsFetched,
          distinctCandleTimes: stats.candlesHydrated,
          minCandleTime: rows.length > 0 ? Math.min(...rows.map((row) => row.candleTime)) : null,
          maxCandleTime: rows.length > 0 ? Math.max(...rows.map((row) => row.candleTime)) : null,
          rowCount: profileCache.rowCount,
          coverageRange: profileCache.getLoadedRanges(),
        });

        recordRestoreDiagnostic({
          kind: 'volumeProfile',
          key: `${pair}:${contractType}:${dataSourceMode}:${fineProfileStorageTimeframe}:fineProfile`,
          timestamp: Date.now(),
          rowsFetched: stats.rowsFetched,
          distinctCandleTimeCount: stats.candlesHydrated,
          skippedRows: Math.max(0, candidateTimes.length - stats.candlesHydrated),
          details: {
            panelId,
            sourceKey: profileCache.key,
            start: window.startSeconds,
            end: window.endSeconds,
            candidateCandles: candidateTimes.length,
            baseBucketSize: tickSize,
            minCandleTime: rows.length > 0 ? Math.min(...rows.map((row) => row.candleTime)) : null,
            maxCandleTime: rows.length > 0 ? Math.max(...rows.map((row) => row.candleTime)) : null,
          },
        });

        return stats;
      });

      if (restoredStats.candlesHydrated > 0) {
        pendingProfileRedrawRef.current = true;
      }

      return restoredStats;
    };

    const feedUnsubscribers: Array<() => void> = [];

    const init = async () => {
      try {
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
        if (shouldUseSpotTrades) {
          feedUnsubscribers.push(subscribeTradeStream('spot', pair, handleSpotTrade));
        }
        if (shouldUseFuturesTrades) {
          feedUnsubscribers.push(subscribeTradeStream('futures', pair, handleFuturesTrade));
        }

        setLoadingHistory(panelId, true);
        console.log(`[PanelFeed:${panelId}] Restoring stored history for ${pair} ${timeframe} in background...`);
        const historyResult: CandleHistoryRestoreResult = await candleCache.restoreHistory(async () => {
          let restoredHistory: Candle[] = [];
          let storedHistory: Candle[] = [];
          let binanceHistory: Candle[] = [];
          let source: CandleHistoryRestoreResult['source'] = 'none';

          if (shouldUseStoredHistory) {
            try {
              storedHistory = await fetchStoredHistory();
              if (storedHistory.length > 0) {
                restoredHistory = storedHistory;
                source = 'stored';
              }
            } catch (err) {
              console.warn('[History] Could not load stored candles:', err);
            }
          }

          console.log(`[PanelFeed:${panelId}] Fetching Binance ${contractType} history for ${pair} ${timeframe} in background...`);
          try {
            binanceHistory = await fetchSharedHistory(contractType, pair, timeframe);
          } catch (err) {
            console.warn('[History] Could not load Binance candles:', err);
          }

          if (binanceHistory.length > 0) {
            restoredHistory = mergeHistoryCandles(restoredHistory, binanceHistory);
            source = storedHistory.length > 0 ? 'stored+Binance' : 'Binance';
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
          const fineProfileStats = shouldHydrateStoredFineProfiles
            ? await hydrateStoredFineProfileRows(history)
            : { rowsFetched: 0, candlesHydrated: 0 };
          const rawStats = shouldHydrateRawTrades
            ? await hydrateStoredRawTrades(history)
            : {
              pages: 0,
              fetched: 0,
              hydrated: 0,
              oldestTime: null,
              newestTime: null,
              reachedStart: false,
              hydratedCandleTimes: new Set<number>(),
            };
          const footprintStats = shouldHydrateStoredFootprints
            ? await hydrateStoredFootprints(history)
            : {
              rowsFetched: 0,
              candlesHydrated: 0,
              cellsHydrated: 0,
              bucketMatches: 0,
              bucketMisses: 0,
            };
          if (!active) return;

          recomputeSignalState();
          const coverage = getFootprintCoverage(history, engineRef.current);
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
            fineProfileRowsFetched: fineProfileStats.rowsFetched,
            fineProfileCandlesHydrated: fineProfileStats.candlesHydrated,
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
              fineProfileRowsFetched: fineProfileStats.rowsFetched,
              footprintRowsFetched: footprintStats.rowsFetched,
              footprintCellsHydrated: footprintStats.cellsHydrated,
              footprintCandlesHydrated: footprintStats.candlesHydrated,
              finalFootprintCandles: coverage.footprintCandles,
              finalFootprintCandlesWithCells: coverage.footprintCandlesWithCells,
            },
          });
        }

        console.log(`[PanelFeed:${panelId}] ${historySource} history merged (${history.length} candles). Live streams already running.`);
        setLoadingHistory(panelId, false);
      } catch (err) {
        console.error(`[PanelFeed:${panelId}] Initialization failed:`, err);
        if (active) setLoadingHistory(panelId, false);
      }
    };

    init();

    // --- Orderbook lifecycle ---
    let aggregationInterval: NodeJS.Timeout | null = null;
    const rawTradeFlushInterval = setInterval(() => {
      flushRawTrades();
      flushFineProfileRows();
    }, RAW_TRADE_FLUSH_MS);
    const obManager = orderbookRef.current;

    const initOrderbook = async () => {
      try {
        console.log(`[PanelFeed:${panelId}] Fetching orderbook snapshot for ${pair}...`);
        const snapshot = await fetchSharedOrderbookSnapshot(pair, 500);
        if (!active) return;

        obManager.initFromSnapshot(snapshot);
        console.log(`[PanelFeed:${panelId}] Orderbook snapshot loaded (${snapshot.bids.length} bids, ${snapshot.asks.length} asks)`);

        // Subscribe to incremental updates
        feedUnsubscribers.push(
          subscribeDepthStream(pair, (update: DepthUpdate) => {
            obManager.applyUpdate(update);
            pendingAggregationRef.current = true;
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
        liveSlices: getLiveFineProfileSliceCount(),
        queuedRowsPending: fineProfileQueueRef.current.length,
        closedBeforeTime: getTradeClosedFineProfileTime(),
        coverageStart: getFirstFullyCoveredCandleTime(),
      });
      persistEligibleFineProfileRows(getTradeClosedFineProfileTime(), 'cleanup-before-reset');
      flushRawTrades();
      flushFineProfileRows();
      clearInterval(rawTradeFlushInterval);
      if (aggregationInterval) clearInterval(aggregationInterval);
      obManager.reset();
      setLiquidityZones(panelId, []);
      setConnected(panelId, false);
      connectedRef.current = false;
    };
  }, [pair, timeframe, panelId, exhaustionLookback, icebergEnabled, icebergMinScore, pushCandle, setConnected, pushAllCandles, setLoadingHistory, setAbsorptionMap, setExhaustionMap, setIcebergLevels, setLiquidityVacuumZones, autoBucketSize, setComputedBucketSize, tickSize, setLiquidityZones, liquidityEnabled, liquidityBucketSize, minimumLiquidityThreshold, liquidityRange, contractType, dataSourceMode, rebuildLiquidityVacuumZones]);

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

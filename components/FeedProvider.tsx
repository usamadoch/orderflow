'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChartStore, PanelId } from '../lib/store/chart';
import { feedAdapter } from '../lib/feeds';
import { AggregationEngine } from '../lib/aggregation/engine';
import { buildAbsorptionMap, scoreLatestCandle } from '../lib/absorption/engine';
import { buildExhaustionMap, scoreLatestExhaustion } from '../lib/exhaustion/engine';
import { IcebergEngine } from '../lib/iceberg/engine';
import { buildLiquidityVacuumZones } from '../lib/liquidityVacuum/engine';
import { getCandleTimeForTrade } from '../lib/utils/aggregation';
import { ChartEngineContext } from './ChartEngineContext';
import { RawTradeVolumeProfileEngine } from '../lib/volumeProfile/profileEngine';
import { Candle } from '../types/candle';
import { Trade } from '../types/trade';
import { AbsorptionResult } from '../types/absorption';
import { ExhaustionResult } from '../types/exhaustion';
import { IcebergLevel } from '../types/iceberg';
import { LiquidityVacuumZone } from '../types/liquidityVacuum';
import { OrderbookManager, DepthUpdate } from '../lib/liquidity/orderbook';
import { aggregateOrderbook } from '../lib/liquidity/aggregation';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { storeClosedCandleAction, storeRawTradesAction } from '../lib/actions/storageActions';

interface PanelFeedProviderProps {
  panelId: PanelId;
  children: React.ReactNode;
}

const RAW_TRADE_FLUSH_MS = 2000;
const RAW_TRADE_FLUSH_SIZE = 500;
const PROFILE_REDRAW_MS = 500;
const HYDRATION_CHUNK_SIZE = 1000;
const MAX_DEDUPE_KEYS = 100000;

const queuedRawTradeStorageKeys = new Set<string>();
const closedCandleStorageKeys = new Set<string>();

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

function claimClosedCandleStorage(symbol: string, timeframe: string, candleTime: number, bucketSize: number) {
  const key = `${symbol}:${timeframe}:${candleTime}:${bucketSize}`;
  if (closedCandleStorageKeys.has(key)) return false;

  rememberBounded(closedCandleStorageKeys, key);
  return true;
}

export function PanelFeedProvider({ panelId, children }: PanelFeedProviderProps) {
  const pair = useChartStore(s => s.panels[panelId].pair);
  const timeframe = useChartStore(s => s.panels[panelId].timeframe);
  const bucketSize = useChartStore(s => s.panels[panelId].bucketSize);
  const autoBucketSize = useChartStore(s => s.panels[panelId].autoBucketSize);
  const chartMode = useChartStore(s => s.panels[panelId].chartMode);
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
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const volumeProfileEngineRef = useRef(new RawTradeVolumeProfileEngine());
  const pendingFootprintRedrawRef = useRef(false);
  const pendingProfileRedrawRef = useRef(false);
  const rawTradeQueueRef = useRef<Trade[]>([]);
  const processedTradeIdsRef = useRef<Set<number>>(new Set());
  const firstFullyCoveredCandleTimeRef = useRef<number | null>(null);
  const lastProfileRevisionAtRef = useRef(0);
  const [volumeProfileRevision, setVolumeProfileRevision] = useState(0);
  const absorptionMapRef = useRef<Map<number, AbsorptionResult>>(new Map());
  const exhaustionMapRef = useRef<Map<number, ExhaustionResult>>(new Map());
  const icebergEngineRef = useRef<IcebergEngine>(new IcebergEngine(bucketSize, icebergLookback));
  const icebergLevelsRef = useRef<IcebergLevel[]>([]);
  const liquidityVacuumZonesRef = useRef<LiquidityVacuumZone[]>([]);
  const lastScoredCandleTimeRef = useRef<number | null>(null);
  // Each panel needs its own adapter instance for independent connections
  const adapterRef = useRef(feedAdapter.clone());
  // Orderbook manager per panel
  const orderbookRef = useRef<OrderbookManager>(new OrderbookManager());
  const pendingAggregationRef = useRef(false);
  const liquidityHistoryRef = useRef<LiquidityHistoryManager>(new LiquidityHistoryManager(liquidityBucketSize, liquidityHistoryDepth));

  const rebuildLiquidityVacuumZones = useCallback((candles = useChartStore.getState().panels[panelId].candles || []) => {
    const zones = liquidityVacuumEnabled
      ? buildLiquidityVacuumZones(candles, engineRef.current, bucketSize, {
        minScore: liquidityVacuumMinScore,
        maxZones: liquidityVacuumMaxZones,
      })
      : [];

    liquidityVacuumZonesRef.current = zones;
    setLiquidityVacuumZones(panelId, zones);
    return zones;
  }, [bucketSize, liquidityVacuumEnabled, liquidityVacuumMaxZones, liquidityVacuumMinScore, panelId, setLiquidityVacuumZones]);

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

  // Handle engine bucket size updates without reconnecting socket
  useEffect(() => {
    engineRef.current.reset(bucketSize);
    icebergEngineRef.current.setBucketSize(bucketSize);
    const currentCandles = useChartStore.getState().panels[panelId].candles || [];
    currentCandles.forEach(c => engineRef.current.ingestCandle(c));
    // Rebuild absorption map with new bucket size
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
        
        if (computedSize !== bucketSize) {
          setComputedBucketSize(panelId, computedSize);
          // the bucketSize effect will catch this and reset the engine
        }
      }
    }
  }, [autoBucketSize, tickSize, panelId, setComputedBucketSize, bucketSize]);

  useEffect(() => {
    let active = true;
    connectedRef.current = false;
    setConnected(panelId, false);
    engineRef.current.reset();
    volumeProfileEngineRef.current.reset();
    rawTradeQueueRef.current = [];
    processedTradeIdsRef.current = new Set();
    firstFullyCoveredCandleTimeRef.current = null;
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

    const adapter = adapterRef.current;
    adapter.disconnect();

    const timeframeSeconds = getTimeframeSeconds(timeframe);

    const markProcessedTrade = (trade: Trade) => {
      if (!Number.isFinite(trade.id)) return true;

      const id = trade.id!;
      if (processedTradeIdsRef.current.has(id)) return false;

      processedTradeIdsRef.current.add(id);
      while (processedTradeIdsRef.current.size > MAX_DEDUPE_KEYS) {
        const oldest = processedTradeIdsRef.current.values().next().value;
        if (oldest === undefined) break;
        processedTradeIdsRef.current.delete(oldest);
      }

      return true;
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

      storeRawTradesAction(pair, batch).catch((err) => {
        console.error('[Storage] Raw trade batch save request failed:', err);
      });
    };

    const handleCandle = (candle: Candle) => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        setConnected(panelId, true);
      }
      engineRef.current.ingestCandle(candle);
      pushCandle(panelId, candle);

      if (candle.isClosed) {
        const footprint = engineRef.current.getFootprintCandle(candle.time);
        const hasFullRealtimeFootprint = firstFullyCoveredCandleTimeRef.current !== null
          && candle.time >= firstFullyCoveredCandleTimeRef.current;
        const cells = footprint && hasFullRealtimeFootprint
          ? Array.from(footprint.cells.entries()).map(([bucketPrice, cell]) => ({
            bucketPrice,
            bidVol: cell.bidVol,
            askVol: cell.askVol,
          }))
          : [];
        let buyVol = 0;
        let sellVol = 0;

        if (footprint && hasFullRealtimeFootprint) {
          footprint.cells.forEach((cell) => {
            buyVol += cell.askVol;
            sellVol += cell.bidVol;
          });
        } else if (!footprint) {
          console.warn(`[Storage] Missing footprint for ${pair} ${timeframe} candle ${candle.time}`);
        } else {
          console.warn(`[Storage] Skipping partial realtime footprint for ${pair} ${timeframe} candle ${candle.time}`);
        }

        if (claimClosedCandleStorage(pair, timeframe, candle.time, bucketSize)) {
          storeClosedCandleAction(
            pair,
            timeframe,
            candle,
            cells,
            hasFullRealtimeFootprint ? footprint?.delta ?? 0 : 0,
            buyVol,
            sellVol,
            bucketSize,
          ).catch((err) => {
            console.error('[Storage] Candle snapshot save request failed:', err);
          });
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

    const handleTrade = (trade: Trade) => {
      if (!markProcessedTrade(trade)) return;

      const candleTime = getCandleTimeForTrade(trade.time, timeframeSeconds);
      if (firstFullyCoveredCandleTimeRef.current === null) {
        firstFullyCoveredCandleTimeRef.current = candleTime + timeframeSeconds;
      }

      engineRef.current.ingestTrade(trade, candleTime);
      volumeProfileEngineRef.current.ingestTrade(trade);

      if (claimRawTradeStorage(pair, trade)) {
        rawTradeQueueRef.current.push(trade);
      }

      pendingProfileRedrawRef.current = true;
      pendingFootprintRedrawRef.current = true;

      if (rawTradeQueueRef.current.length >= RAW_TRADE_FLUSH_SIZE) {
        flushRawTrades();
      }
    };

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

      return await response.json() as Candle[];
    };

    const hydrateStoredRawTrades = async (candles: Candle[]) => {
      if (candles.length === 0) return;

      const start = candles[0].time * 1000;
      const inferredSeconds = candles.length >= 2
        ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
        : 60;
      const end = (candles[candles.length - 1].time + inferredSeconds) * 1000;
      const params = new URLSearchParams({
        symbol: pair,
        start: String(start),
        end: String(end),
        limit: '50000',
      });

      const response = await fetch(`/api/history/trades?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) return;

      const trades = await response.json() as Trade[];
      if (trades.length === 0) return;

      let hydratedCount = 0;
      for (let i = 0; i < trades.length; i += 1) {
        if (!active) return;
        if (i > 0 && i % HYDRATION_CHUNK_SIZE === 0) {
          await yieldToBrowser();
        }

        const trade = trades[i];
        if (!markProcessedTrade(trade)) continue;

        engineRef.current.ingestTrade(trade, getCandleTimeForTrade(trade.time, timeframeSeconds));
        volumeProfileEngineRef.current.ingestTrade(trade);
        hydratedCount += 1;
      }

      if (hydratedCount > 0) {
        pendingFootprintRedrawRef.current = true;
        pendingProfileRedrawRef.current = true;
      }
    };

    const init = async () => {
      try {
        console.log(`[PanelFeed:${panelId}] Connecting live streams for ${pair} ${timeframe}...`);
        adapter.subscribeCandles(pair, timeframe, handleCandle);
        adapter.subscribeTrades(pair, handleTrade);

        setLoadingHistory(panelId, true);
        console.log(`[PanelFeed:${panelId}] Fetching Binance history for ${pair} ${timeframe} in background...`);
        let history: Candle[] = [];
        let historySource: 'Binance' | 'stored' = 'Binance';

        try {
          history = await adapter.fetchHistory(pair, timeframe);
        } catch (err) {
          console.warn('[History] Could not load Binance candles:', err);
        }

        if (history.length === 0) {
          console.log(`[PanelFeed:${panelId}] Binance history unavailable. Falling back to stored history for ${pair} ${timeframe}...`);
          try {
            history = await fetchStoredHistory();
            historySource = 'stored';
          } catch (err) {
            console.warn('[History] Could not load stored candles:', err);
          }
        }

        if (!active) return;

        if (history.length > 0) {
          pushAllCandles(panelId, history);

          // Auto Bucket Size Calculation
          if (autoBucketSize) {
            const recentCandles = history.slice(-100); // use last 100 candles for avg
            const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
            const targetTicks = avgRange / tickSize;
            // Aim for ~25 rows per footprint
            const computedSize = Math.max(1, Math.round(targetTicks / 25));
            setComputedBucketSize(panelId, computedSize);
            engineRef.current.reset(computedSize);
          }

          history.forEach(c => engineRef.current.ingestCandle(c));
          await hydrateStoredRawTrades(history);
          if (!active) return;

          recomputeSignalState();
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
    const rawTradeFlushInterval = setInterval(flushRawTrades, RAW_TRADE_FLUSH_MS);
    const obManager = orderbookRef.current;

    const initOrderbook = async () => {
      if (!adapter.fetchOrderbookSnapshot || !adapter.subscribeOrderbook) return;

      try {
        console.log(`[PanelFeed:${panelId}] Fetching orderbook snapshot for ${pair}...`);
        const snapshot = await adapter.fetchOrderbookSnapshot(pair, 500);
        if (!active) return;

        obManager.initFromSnapshot(snapshot);
        console.log(`[PanelFeed:${panelId}] Orderbook snapshot loaded (${snapshot.bids.length} bids, ${snapshot.asks.length} asks)`);

        // Subscribe to incremental updates
        adapter.subscribeOrderbook(pair, (update: DepthUpdate) => {
          obManager.applyUpdate(update);
          pendingAggregationRef.current = true;
        });

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
      adapter.disconnect();
      flushRawTrades();
      clearInterval(rawTradeFlushInterval);
      if (adapter.disconnectOrderbook) adapter.disconnectOrderbook();
      if (aggregationInterval) clearInterval(aggregationInterval);
      obManager.reset();
      setLiquidityZones(panelId, []);
      setConnected(panelId, false);
      connectedRef.current = false;
    };
  }, [pair, timeframe, panelId, bucketSize, exhaustionLookback, icebergEnabled, icebergMinScore, pushCandle, setConnected, pushAllCandles, setLoadingHistory, setAbsorptionMap, setExhaustionMap, setIcebergLevels, setLiquidityVacuumZones, autoBucketSize, setComputedBucketSize, tickSize, setLiquidityZones, liquidityEnabled, liquidityBucketSize, minimumLiquidityThreshold, liquidityRange, rebuildLiquidityVacuumZones]);

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

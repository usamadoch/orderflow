import { useCallback, useRef } from 'react';
import type { PanelId } from '../../../lib/store/chart';
import { useChartStore } from '../../../lib/store/chart';
import type { AggregationEngine } from '../../../lib/aggregation/engine';
import { BASE_FOOTPRINT_BUCKET_SIZE } from '../../../lib/aggregation/engine';
import type { AbsorptionResult } from '../../../types/absorption';
import type { ExhaustionResult } from '../../../types/exhaustion';
import type { IcebergLevel } from '../../../types/iceberg';
import type { LiquidityVacuumZone } from '../../../types/liquidityVacuum';
import { IcebergEngine } from '../../../lib/iceberg/engine';
import { useChartRuntimeStore } from '../../../lib/store/chartRuntime';
import { signalWorkerClient } from '../../../lib/worker/signalWorkerClient';
import {
  getFootprintWorkNeed,
  getTradeDedupeKey,
} from '../../../lib/utils/feedUtils';
import { MAX_DEDUPE_KEYS } from '../../../lib/config/constants';
import { recordRestoreDiagnostic } from '../../../lib/debug/marketMetrics';
import type { Trade } from '../../../types/trade';
import type { TradeSource } from '../../../types/feed';


/**
 * Extracts component-level signal refs (absorption, exhaustion, iceberg,
 * liquidity vacuum) plus the corresponding useCallbacks from FeedProvider
 * lines 178-183, 210-299.
 *
 * Also includes markProcessedTrade and getCurrentFootprintWorkNeed which
 * are component-level useCallbacks used by both the main useEffect and
 * other component-level effects.
 */
export function useSignalEngine(
  panelId: PanelId,
  bucketSize: number,
  engineRef: React.MutableRefObject<AggregationEngine>,
  bucketSizeRef: React.MutableRefObject<number>,
  exhaustionLookback: number,
  icebergLookback: number,
  icebergEnabled: boolean,
  icebergMinScore: number,
  liquidityVacuumEnabled: boolean,
  liquidityVacuumMinScore: number,
  liquidityVacuumMaxZones: number,
  absorptionEnabled: boolean,
  exhaustionEnabled: boolean,
  processedTradeIdsRef: React.MutableRefObject<Set<string>>,
  icebergDisabledNoopSkippedRef: React.MutableRefObject<number>,
) {
  // --- Signal refs ---
  const absorptionMapRef = useRef<Map<number, AbsorptionResult>>(new Map());
  const exhaustionMapRef = useRef<Map<number, ExhaustionResult>>(new Map());
  const icebergEngineRef = useRef<IcebergEngine>(new IcebergEngine(bucketSize, icebergLookback));
  const icebergLevelsRef = useRef<IcebergLevel[]>([]);
  const liquidityVacuumZonesRef = useRef<LiquidityVacuumZone[]>([]);
  const lastScoredCandleTimeRef = useRef<number | null>(null);

  // --- Store setters ---
  const setAbsorptionMap = useChartRuntimeStore(s => s.setAbsorptionMap);
  const setExhaustionMap = useChartRuntimeStore(s => s.setExhaustionMap);
  const setIcebergLevels = useChartRuntimeStore(s => s.setIcebergLevels);
  const setLiquidityVacuumZones = useChartRuntimeStore(s => s.setLiquidityVacuumZones);

  // --- useCallbacks (from FeedProvider lines 210-299) ---

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
  }, [processedTradeIdsRef]);

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
  }, [panelId, setIcebergLevels, icebergDisabledNoopSkippedRef]);

  const triggerWorkerComputeSignals = useCallback(async (candles = useChartRuntimeStore.getState().panels[panelId].candles || []) => {
    if (candles.length === 0) return;

    // We only need the footprint candles for the visible/analyzed range.
    // To be safe and keep it simple for now, we'll map all candles to footprints.
    // (This map operation is fast, the actual computation in the worker is what takes time)
    const footprints = candles.map(c => engineRef.current.getFootprintCandle(c.time)).filter(Boolean) as import('../../../types/footprint').FootprintCandle[];

    const result = await signalWorkerClient.computeSignals({
      panelId,
      candles,
      footprints,
      bucketSize: Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSizeRef.current),
      
      absorptionEnabled,
      
      exhaustionEnabled,
      exhaustionLookback,
      
      icebergEnabled,
      icebergMinScore,
      icebergLookback,
      
      liquidityVacuumEnabled,
      liquidityVacuumMinScore,
      liquidityVacuumMaxZones,
    });

    if (absorptionEnabled) {
      absorptionMapRef.current = result.absorptionMap;
      setAbsorptionMap(panelId, result.absorptionMap);
    }
    
    if (exhaustionEnabled) {
      exhaustionMapRef.current = result.exhaustionMap;
      setExhaustionMap(panelId, result.exhaustionMap);
    }
    
    if (icebergEnabled) {
      icebergLevelsRef.current = result.icebergLevels;
      setIcebergLevels(panelId, result.icebergLevels);
    } else {
      clearIcebergLevelsIfNeeded('worker-recompute-disabled');
    }
    
    if (liquidityVacuumEnabled) {
      liquidityVacuumZonesRef.current = result.liquidityVacuumZones;
      setLiquidityVacuumZones(panelId, result.liquidityVacuumZones);
    } else if (liquidityVacuumZonesRef.current.length > 0) {
      liquidityVacuumZonesRef.current = [];
      setLiquidityVacuumZones(panelId, []);
    }
  }, [
    panelId, engineRef, bucketSizeRef, absorptionEnabled, setAbsorptionMap, 
    exhaustionEnabled, exhaustionLookback, setExhaustionMap, 
    icebergEnabled, icebergMinScore, icebergLookback, setIcebergLevels, clearIcebergLevelsIfNeeded,
    liquidityVacuumEnabled, liquidityVacuumMinScore, liquidityVacuumMaxZones, setLiquidityVacuumZones
  ]);

  const triggerWorkerScoreLive = useCallback(async (candles = useChartRuntimeStore.getState().panels[panelId].candles || []) => {
    if (candles.length === 0) return;
    
    const lastCandle = candles[candles.length - 1];
    if (lastCandle.isClosed) return;

    // Only need footprints for the lookback window of the live candle
    const maxLookback = Math.max(20, exhaustionLookback);
    const windowStart = Math.max(0, candles.length - 1 - maxLookback);
    const windowCandles = candles.slice(windowStart);
    const footprints = windowCandles.map(c => engineRef.current.getFootprintCandle(c.time)).filter(Boolean) as import('../../../types/footprint').FootprintCandle[];

    const result = await signalWorkerClient.scoreLive({
      panelId,
      candles,
      footprints,
      bucketSize: Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSizeRef.current),
      
      absorptionEnabled,
      absorptionMap: absorptionMapRef.current,
      
      exhaustionEnabled,
      exhaustionLookback,
      exhaustionMap: exhaustionMapRef.current,
      
      liquidityVacuumEnabled,
      liquidityVacuumMinScore,
      liquidityVacuumMaxZones,
    });

    if (absorptionEnabled) {
      absorptionMapRef.current = result.absorptionMap;
      setAbsorptionMap(panelId, result.absorptionMap);
    } else if (absorptionMapRef.current.size > 0) {
      const emptyMap = new Map();
      absorptionMapRef.current = emptyMap;
      setAbsorptionMap(panelId, emptyMap);
    }
    
    if (exhaustionEnabled) {
      exhaustionMapRef.current = result.exhaustionMap;
      setExhaustionMap(panelId, result.exhaustionMap);
    } else if (exhaustionMapRef.current.size > 0) {
      const emptyMap = new Map();
      exhaustionMapRef.current = emptyMap;
      setExhaustionMap(panelId, emptyMap);
    }
    
    if (liquidityVacuumEnabled) {
      liquidityVacuumZonesRef.current = result.liquidityVacuumZones;
      setLiquidityVacuumZones(panelId, result.liquidityVacuumZones);
    } else if (liquidityVacuumZonesRef.current.length > 0) {
      liquidityVacuumZonesRef.current = [];
      setLiquidityVacuumZones(panelId, []);
    }
  }, [
    panelId, engineRef, bucketSizeRef, absorptionEnabled, setAbsorptionMap, 
    exhaustionEnabled, exhaustionLookback, setExhaustionMap, 
    liquidityVacuumEnabled, liquidityVacuumMinScore, liquidityVacuumMaxZones, setLiquidityVacuumZones
  ]);

  // Keep rebuildLiquidityVacuumZones as a pass-through to triggerWorkerComputeSignals to prevent breaking FeedProvider's current API before we refactor it
  const rebuildLiquidityVacuumZones = useCallback((candles = useChartRuntimeStore.getState().panels[panelId].candles || []) => {
    triggerWorkerComputeSignals(candles);
    return [];
  }, [triggerWorkerComputeSignals, panelId]);

  return {
    absorptionMapRef,
    exhaustionMapRef,
    icebergEngineRef,
    icebergLevelsRef,
    liquidityVacuumZonesRef,
    lastScoredCandleTimeRef,
    setAbsorptionMap,
    setExhaustionMap,
    setIcebergLevels,
    setLiquidityVacuumZones,
    markProcessedTrade,
    getCurrentFootprintWorkNeed,
    clearIcebergLevelsIfNeeded,
    rebuildLiquidityVacuumZones,
    triggerWorkerComputeSignals,
    triggerWorkerScoreLive,
  };
}

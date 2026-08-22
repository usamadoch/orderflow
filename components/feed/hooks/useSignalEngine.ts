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
import { buildLiquidityVacuumZones } from '../../../lib/liquidityVacuum/engine';
import { useChartRuntimeStore } from '../../../lib/store/chartRuntime';
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
  }, [liquidityVacuumEnabled, liquidityVacuumMaxZones, liquidityVacuumMinScore, panelId, setLiquidityVacuumZones, bucketSizeRef, engineRef]);

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
  };
}

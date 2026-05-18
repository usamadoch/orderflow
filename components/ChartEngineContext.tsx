'use client';

import { createContext, useContext } from 'react';
import { AggregationEngine } from '../lib/aggregation/engine';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { IcebergEngine } from '../lib/iceberg/engine';
import type { VolumeProfileSource } from '../lib/volumeProfile/profileEngine';

export interface ChartEngineContextValue {
  engine: AggregationEngine | null;
  liquidityHistory: LiquidityHistoryManager | null;
  icebergEngine: IcebergEngine | null;
  volumeProfileEngine: VolumeProfileSource | null;
  volumeProfileRevision: number;
}

export const ChartEngineContext = createContext<ChartEngineContextValue>({
  engine: null,
  liquidityHistory: null,
  icebergEngine: null,
  volumeProfileEngine: null,
  volumeProfileRevision: 0,
});

export function useChartEngine() {
  const context = useContext(ChartEngineContext);
  if (!context || !context.engine) {
    throw new Error("useChartEngine must be used within a ChartEngineContext.Provider");
  }
  return context.engine;
}

export function useLiquidityHistory() {
  const context = useContext(ChartEngineContext);
  if (!context || !context.liquidityHistory) {
    throw new Error("useLiquidityHistory must be used within a ChartEngineContext.Provider");
  }
  return context.liquidityHistory;
}

export function useIcebergEngine() {
  const context = useContext(ChartEngineContext);
  if (!context || !context.icebergEngine) {
    throw new Error("useIcebergEngine must be used within a ChartEngineContext.Provider");
  }
  return context.icebergEngine;
}

export function useVolumeProfileEngine() {
  const context = useContext(ChartEngineContext);
  if (!context || !context.volumeProfileEngine) {
    throw new Error("useVolumeProfileEngine must be used within a ChartEngineContext.Provider");
  }
  return {
    volumeProfileEngine: context.volumeProfileEngine,
    volumeProfileRevision: context.volumeProfileRevision,
  };
}

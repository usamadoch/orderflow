'use client';

import { createContext, useContext } from 'react';
import { AggregationEngine } from '../lib/aggregation/engine';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { IcebergEngine } from '../lib/iceberg/engine';

export interface ChartEngineContextValue {
  engine: AggregationEngine | null;
  liquidityHistory: LiquidityHistoryManager | null;
  icebergEngine: IcebergEngine | null;
}

export const ChartEngineContext = createContext<ChartEngineContextValue>({ engine: null, liquidityHistory: null, icebergEngine: null });

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

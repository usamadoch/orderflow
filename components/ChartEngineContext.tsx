'use client';

import { createContext, useContext } from 'react';
import { AggregationEngine } from '../lib/aggregation/engine';

export const ChartEngineContext = createContext<AggregationEngine | null>(null);

export function useChartEngine() {
  const engine = useContext(ChartEngineContext);
  if (!engine) {
    throw new Error("useChartEngine must be used within a ChartEngineContext.Provider");
  }
  return engine;
}

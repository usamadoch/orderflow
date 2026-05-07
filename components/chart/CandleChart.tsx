"use client";

import { useEffect, useRef } from 'react';
import { useChartInit } from './useChartInit';
import { useChartStore } from '../../lib/store/chart';

export function CandleChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { seriesRef } = useChartInit(containerRef);
  const candles = useChartStore((state) => state.candles);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!seriesRef.current) return;

    if (candles.length === 0) {
      seriesRef.current.setData([]);
      dataLoadedRef.current = false;
      return;
    }

    if (!dataLoadedRef.current) {
      seriesRef.current.setData(candles as any);
      dataLoadedRef.current = true;
    } else {
      seriesRef.current.update(candles[candles.length - 1] as any);
    }
  }, [candles, seriesRef]);

  return <div ref={containerRef} className="w-full h-full" />;
}

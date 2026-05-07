'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useChartStore } from '@/lib/store/chart';
import { useChartEngine } from '../ChartEngineContext';
import { usePanZoom } from './usePanZoom';
import { getVisibleRange, getVisiblePriceRange, priceToY as calcPriceToY, indexToX as calcIndexToX } from './useCoordinates';
import { drawCandles } from './drawCandles';
import { drawFootprint } from './drawFootprint';
import { drawGrid, drawPriceAxis, drawTimeAxis } from './drawAxes';
import { drawPriceLine } from './drawPriceLine';
import { initCanvas } from '@/lib/utils/canvas';

export function ChartCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isRedrawScheduled = useRef(false);
  
  const candles = useChartStore(state => state.candles);
  const chartMode = useChartStore(state => state.chartMode);
  const bucketSize = useChartStore(state => state.bucketSize);
  const footprintTrigger = useChartStore(state => state.footprintTrigger);
  const engine = useChartEngine();

  const getCandlesLength = useCallback(() => candles.length, [candles]);

  const priceAxisWidth = 60;
  const timeAxisHeight = 24;

  const redraw = useCallback(() => {
    if (isRedrawScheduled.current) return;
    
    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;
      
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const container = containerRef.current;
      if (!canvas || !ctx || !container) return;

      const logicalWidth = container.offsetWidth;
      const logicalHeight = container.offsetHeight;

      const chartWidth = logicalWidth - priceAxisWidth;
      const chartHeight = logicalHeight - timeAxisHeight;

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      if (candles.length === 0) return;

      const currentScrollOffset = scrollOffset.current;
      const currentBarWidth = barWidth.current;

      const { firstIndex, lastIndex, rawFirstIndex, rawLastIndex } = getVisibleRange(candles, currentScrollOffset, currentBarWidth, chartWidth);
      
      // Initialize price scaling if not set
      if (priceCenter.current === null || priceRange.current === null) {
        const { priceMin: autoMin, priceMax: autoMax } = getVisiblePriceRange(candles, firstIndex, lastIndex);
        priceCenter.current = (autoMin + autoMax) / 2;
        priceRange.current = (autoMax - autoMin) || 100;
      }

      const pCenter = priceCenter.current;
      const pRange = priceRange.current;
      const priceMin = pCenter - pRange / 2;
      const priceMax = pCenter + pRange / 2;

      const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
      const indexToX = (index: number) => calcIndexToX(index, candles.length, currentScrollOffset, currentBarWidth, chartWidth);

      drawGrid(ctx, priceMin, priceMax, priceToY, indexToX, rawFirstIndex, rawLastIndex, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);

      if (chartMode === 'candle') {
        drawCandles(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth);
      } else {
        drawFootprint(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, engine, bucketSize, logicalHeight);
      }

      drawPriceAxis(ctx, priceMin, priceMax, priceToY, logicalWidth, logicalHeight, priceAxisWidth);
      drawTimeAxis(ctx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);

      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        drawPriceLine(ctx, lastCandle, priceToY, chartWidth, priceAxisWidth, logicalWidth);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartMode, bucketSize, footprintTrigger, engine]);

  const { scrollOffset, barWidth, priceCenter, priceRange } = usePanZoom(canvasRef, redraw, getCandlesLength, priceAxisWidth, timeAxisHeight);

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  // Initial setup and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const setupCanvas = () => {
      ctxRef.current = initCanvas(canvas, container);
      redrawRef.current();
    };

    setupCanvas();

    const observer = new ResizeObserver(() => {
      setupCanvas();
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Redraw when data changes
  useEffect(() => {
    redraw();
  }, [candles, chartMode, bucketSize, footprintTrigger, redraw]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0D0D0D] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 outline-none"
        tabIndex={0}
      />
    </div>
  );
}

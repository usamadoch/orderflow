'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { PanelId, useChartStore } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { HeatmapWorkerClient } from '@/lib/worker/heatmapWorkerClient';
import { drawOrderbookHeatmap } from '@/lib/draw/drawOrderbookHeatmap';
import { initCanvas } from '@/lib/utils/canvas';
import {
  priceToY as calcPriceToY,
  indexToX as calcIndexToX,
  getVisibleRange,
  getVisiblePriceRange,
} from './useCoordinates';
import { drawPriceAxis, drawTimeAxis } from './drawAxes';
import { AlertTriangle, RotateCcw } from 'lucide-react';

const PRICE_LINE_ACCENT_COLOR = '#F0B90B';
const PRICE_AXIS_WIDTH = 65;
const TIME_AXIS_HEIGHT = 24;

interface HeatmapPanelProps {
  panelId: PanelId;
  workerClient: HeatmapWorkerClient | null;
  tickSize: number;
}

export function HeatmapPanel({ panelId, workerClient, tickSize }: HeatmapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isRedrawScheduled = useRef(false);
  const isResizingDivider = useRef(false);

  // Independent Chart Navigation Refs (mutated during gestures without React re-render churn)
  const scrollOffsetRef = useRef(0);
  const barWidthRef = useRef(12);
  const priceCenterRef = useRef<number | null>(null);
  const priceRangeRef = useRef<number | null>(null);
  const isAutoScaledRef = useRef(true);

  // Mouse drag & interaction tracking
  const isDragging = useRef(false);
  const dragMode = useRef<'chart' | 'price' | 'time'>('chart');
  const lastX = useRef(0);
  const lastY = useRef(0);
  const mouseX = useRef<number | null>(null);
  const mouseY = useRef<number | null>(null);

  // Auto-scale UI indicator state (only updated on state transition, zero churn while dragging)
  const [isAutoScaledState, setIsAutoScaledState] = useState(true);

  // Store settings
  const heatmapPanelWidth = useChartStore((s) => s.panels[panelId]?.heatmapPanelWidth ?? 360);
  const heatmapPriceBucketSize = useChartStore((s) => s.panels[panelId]?.heatmapPriceBucketSize ?? 50);
  const heatmapSampleIntervalMs = useChartStore((s) => s.panels[panelId]?.heatmapSampleIntervalMs ?? 200);
  const heatmapRetentionMinutes = useChartStore((s) => s.panels[panelId]?.heatmapRetentionMinutes ?? 120);
  const heatmapClampPercentile = useChartStore((s) => s.panels[panelId]?.heatmapClampPercentile ?? 95);
  const heatmapShowTrades = useChartStore((s) => s.panels[panelId]?.heatmapShowTrades ?? true);
  const setHeatmapPanelWidth = useChartStore((s) => s.setHeatmapPanelWidth);

  // Runtime resync count badge (rarely changes, 0 under normal operation)
  const [resyncCount, setResyncCount] = useState(
    () => useChartRuntimeStore.getState().panels[panelId]?.orderbookResyncCount ?? 0
  );
  useEffect(() => {
    return useChartRuntimeStore.subscribe(
      (s) => s.panels[panelId]?.orderbookResyncCount ?? 0,
      (val) => setResyncCount(val)
    );
  }, [panelId]);

  const effectiveBucketSize = useMemo(() => {
    return heatmapPriceBucketSize > 0 ? heatmapPriceBucketSize : Math.max(0.1, tickSize || 1);
  }, [heatmapPriceBucketSize, tickSize]);

  // Sync config changes to workerClient
  useEffect(() => {
    if (!workerClient) return;
    workerClient.setConfig({
      priceBucketSize: effectiveBucketSize,
      sampleIntervalMs: heatmapSampleIntervalMs,
      retentionWindowMs: heatmapRetentionMinutes * 60 * 1000,
    });
  }, [workerClient, effectiveBucketSize, heatmapSampleIntervalMs, heatmapRetentionMinutes]);

  // Pure canvas render pass reading directly from stores and local navigation refs
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !workerClient) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let ctx = ctxRef.current;
    if (!ctx || canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      ctx = initCanvas(canvas, width, height);
      ctxRef.current = ctx;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    if (!ctx) return;

    // 1. Reserved Axis Geometry
    const chartWidth = Math.max(1, width - PRICE_AXIS_WIDTH);
    const chartHeight = Math.max(1, height - TIME_AXIS_HEIGHT);

    // 2. Read latest runtime candle and orderbook state imperatively
    const runtimeState = useChartRuntimeStore.getState().panels[panelId];
    const candles = runtimeState?.candles ?? [];
    const trades = runtimeState?.trades ?? [];
    const viewportPrice = runtimeState?.viewportPrice;

    // 3. Time Navigation & Visible Range
    const currentScrollOffset = scrollOffsetRef.current;
    const currentBarWidth = barWidthRef.current;

    const { rawFirstIndex, rawLastIndex } = getVisibleRange(
      candles,
      currentScrollOffset,
      currentBarWidth,
      chartWidth,
      0
    );

    const indexToX = (index: number) =>
      calcIndexToX(index, candles.length, currentScrollOffset, currentBarWidth, chartWidth, 0);

    const lastCandle = candles[candles.length - 1];
    const nowMs = lastCandle ? (lastCandle.time > 1e11 ? lastCandle.time : lastCandle.time * 1000) : Date.now();
    const firstCandleMs = candles[0]
      ? (candles[0].time > 1e11 ? candles[0].time : candles[0].time * 1000)
      : nowMs - 60000;
    const candleIntervalMs = candles.length > 1
      ? Math.max(1000, (nowMs - firstCandleMs) / (candles.length - 1))
      : 60000;

    const timeToX = (tMs: number) => {
      if (candles.length > 0) {
        const deltaMs = tMs - nowMs;
        const deltaBars = deltaMs / candleIntervalMs;
        const fractionalIndex = candles.length - 1 + deltaBars;
        return indexToX(fractionalIndex);
      }
      return chartWidth - currentBarWidth / 2 + ((tMs - nowMs) / 60000) * currentBarWidth + currentScrollOffset;
    };

    // 4. Vertical Price Scale & Auto-Scale
    if (isAutoScaledRef.current || priceCenterRef.current === null || priceRangeRef.current === null) {
      let autoMin: number;
      let autoMax: number;
      if (
        viewportPrice &&
        Number.isFinite(viewportPrice.priceMin) &&
        Number.isFinite(viewportPrice.priceMax) &&
        viewportPrice.priceMax > viewportPrice.priceMin
      ) {
        autoMin = viewportPrice.priceMin;
        autoMax = viewportPrice.priceMax;
      } else if (candles.length > 0) {
        const range = getVisiblePriceRange(candles, rawFirstIndex, rawLastIndex);
        autoMin = range.priceMin;
        autoMax = range.priceMax;
      } else {
        autoMin = 0;
        autoMax = 100;
      }

      priceCenterRef.current = (autoMin + autoMax) / 2;
      priceRangeRef.current = Math.max(0.0001, autoMax - autoMin);
    }

    const pCenter = priceCenterRef.current;
    const pRange = Math.max(0.0001, priceRangeRef.current);
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;
    const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);

    // 5. Query visible grid from local worker engine
    const minVisibleTimeMs = nowMs - ((chartWidth - currentScrollOffset) / currentBarWidth) * candleIntervalMs;
    const maxVisibleTimeMs = nowMs + ((currentScrollOffset + chartWidth) / currentBarWidth) * candleIntervalMs;

    const localEngine = workerClient.getLocalEngine();
    const { slots, p95Clamp } = localEngine.getVisibleGrid(
      minVisibleTimeMs - 5000,
      maxVisibleTimeMs + 5000,
      priceMin,
      priceMax,
      heatmapClampPercentile
    );

    // 6. Base Canvas Fill
    ctx.fillStyle = '#0E1015';
    ctx.fillRect(0, 0, width, height);

    // 7. Heatmap & Trades Layer (Clipped strictly to chart area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    drawOrderbookHeatmap({
      ctx,
      slots,
      priceToY,
      timeToX,
      priceBucketSize: effectiveBucketSize,
      sampleIntervalMs: heatmapSampleIntervalMs,
      p95Clamp,
      chartWidth,
      chartHeight,
      trades,
      showTrades: heatmapShowTrades,
      priceLineAccentColor: PRICE_LINE_ACCENT_COLOR,
      isLatestLive: true,
    });

    // Current Price Dashed Reference Line
    if (candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const currentY = priceToY(lastPrice);
      if (currentY >= 0 && currentY <= chartHeight) {
        ctx.strokeStyle = PRICE_LINE_ACCENT_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(currentY) + 0.5);
        ctx.lineTo(chartWidth, Math.round(currentY) + 0.5);
        ctx.stroke();
      }
    }

    ctx.restore();

    // 8. Price Axis (Right vertical bar)
    drawPriceAxis(
      ctx,
      priceMin,
      priceMax,
      priceToY,
      width,
      height,
      PRICE_AXIS_WIDTH,
      TIME_AXIS_HEIGHT
    );

    // Current Market Price Badge on Price Axis
    if (candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const currentY = priceToY(lastPrice);
      if (currentY >= 0 && currentY <= chartHeight) {
        ctx.save();
        ctx.fillStyle = PRICE_LINE_ACCENT_COLOR;
        ctx.fillRect(chartWidth, Math.round(currentY) - 9, PRICE_AXIS_WIDTH, 18);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(lastPrice.toFixed(2), chartWidth + 6, Math.round(currentY));
        ctx.restore();
      }
    }

    // 9. Time Axis (Bottom horizontal bar)
    if (candles.length > 0) {
      drawTimeAxis(
        ctx,
        candles,
        rawFirstIndex,
        rawLastIndex,
        indexToX,
        width,
        height,
        PRICE_AXIS_WIDTH,
        TIME_AXIS_HEIGHT,
        currentBarWidth
      );
    } else {
      ctx.save();
      ctx.fillStyle = '#0E1015';
      ctx.fillRect(0, chartHeight, chartWidth, TIME_AXIS_HEIGHT);
      ctx.fillStyle = '#1F1F1F';
      ctx.fillRect(0, chartHeight, chartWidth, 1);
      ctx.restore();
    }
  }, [
    panelId,
    workerClient,
    effectiveBucketSize,
    heatmapSampleIntervalMs,
    heatmapClampPercentile,
    heatmapShowTrades,
  ]);

  // Throttled redraw scheduler using requestAnimationFrame
  const scheduleRedraw = useCallback(() => {
    if (isRedrawScheduled.current) return;
    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;
      render();
    });
  }, [render]);

  // Interactive Pan & Zoom Canvas Event Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const chartWidth = rect.width - PRICE_AXIS_WIDTH;
      const chartHeight = rect.height - TIME_AXIS_HEIGHT;

      if (x > chartWidth) {
        dragMode.current = 'price';
        canvas.style.cursor = 'ns-resize';
      } else if (y > chartHeight) {
        dragMode.current = 'time';
        canvas.style.cursor = 'ew-resize';
      } else {
        dragMode.current = 'chart';
        canvas.style.cursor = 'grabbing';
      }

      isDragging.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const rect = canvas.getBoundingClientRect();
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      const chartWidth = Math.max(1, rect.width - PRICE_AXIS_WIDTH);
      const chartHeight = Math.max(1, rect.height - TIME_AXIS_HEIGHT);

      if (dragMode.current === 'chart') {
        // Free panning in time
        scrollOffsetRef.current += deltaX;

        // Free panning in price
        if (Math.abs(deltaY) > 0) {
          if (isAutoScaledRef.current) {
            isAutoScaledRef.current = false;
            setIsAutoScaledState(false);
          }
          if (priceCenterRef.current !== null && priceRangeRef.current !== null) {
            const pricePerPixel = priceRangeRef.current / chartHeight;
            // Dragging down (deltaY > 0) shifts higher prices down into view
            priceCenterRef.current += deltaY * pricePerPixel;
          }
        }
        scheduleRedraw();
      } else if (dragMode.current === 'price') {
        // Vertical price zoom
        if (isAutoScaledRef.current) {
          isAutoScaledRef.current = false;
          setIsAutoScaledState(false);
        }
        if (priceRangeRef.current !== null) {
          const sensitivity = 0.005;
          priceRangeRef.current = Math.max(0.0001, priceRangeRef.current * (1 + deltaY * sensitivity));
          scheduleRedraw();
        }
      } else if (dragMode.current === 'time') {
        // Horizontal time zoom anchored to cursor
        const sensitivity = 0.01;
        const oldBarWidth = barWidthRef.current;
        const newBarWidth = Math.max(1, Math.min(100, oldBarWidth * (1 + deltaX * sensitivity)));
        if (oldBarWidth !== newBarWidth) {
          const mouseCanvasX = Math.max(0, Math.min(chartWidth, e.clientX - rect.left));
          scrollOffsetRef.current +=
            (scrollOffsetRef.current + chartWidth - mouseCanvasX) * (newBarWidth / oldBarWidth - 1);
          barWidthRef.current = newBarWidth;
          scheduleRedraw();
        }
      }
    };

    const onWindowMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (mouseX.current !== null && mouseY.current !== null) {
        const rect = canvas.getBoundingClientRect();
        const chartWidth = rect.width - PRICE_AXIS_WIDTH;
        const chartHeight = rect.height - TIME_AXIS_HEIGHT;
        if (mouseX.current > chartWidth) {
          canvas.style.cursor = 'ns-resize';
        } else if (mouseY.current > chartHeight) {
          canvas.style.cursor = 'ew-resize';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      } else {
        canvas.style.cursor = 'default';
      }
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX.current = x;
      mouseY.current = y;

      if (isDragging.current) return;

      const chartWidth = rect.width - PRICE_AXIS_WIDTH;
      const chartHeight = rect.height - TIME_AXIS_HEIGHT;

      if (x > chartWidth) {
        canvas.style.cursor = 'ns-resize';
      } else if (y > chartHeight) {
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    };

    const onCanvasMouseLeave = () => {
      mouseX.current = null;
      mouseY.current = null;
      if (!isDragging.current) {
        canvas.style.cursor = 'default';
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const chartWidth = Math.max(1, rect.width - PRICE_AXIS_WIDTH);
      const chartHeight = Math.max(1, rect.height - TIME_AXIS_HEIGHT);

      // 1. Wheel over vertical price bar -> Vertical Price Zoom
      if (x > chartWidth) {
        if (priceRangeRef.current !== null) {
          if (isAutoScaledRef.current) {
            isAutoScaledRef.current = false;
            setIsAutoScaledState(false);
          }
          const zoomSensitivity = 0.002;
          const zoomFactor = 1 + e.deltaY * zoomSensitivity;
          priceRangeRef.current = Math.max(0.0001, priceRangeRef.current * zoomFactor);
          scheduleRedraw();
        }
        return;
      }

      // 2. Wheel over horizontal time bar -> Horizontal Time Zoom
      if (y > chartHeight) {
        const zoomSensitivity = 0.002;
        const zoomFactor = 1 + e.deltaY * zoomSensitivity;
        const oldBarWidth = barWidthRef.current;
        const newBarWidth = Math.max(1, Math.min(100, oldBarWidth / zoomFactor));
        if (oldBarWidth !== newBarWidth) {
          scrollOffsetRef.current += (scrollOffsetRef.current + chartWidth - x) * (newBarWidth / oldBarWidth - 1);
          barWidthRef.current = newBarWidth;
          scheduleRedraw();
        }
        return;
      }

      // 3. Wheel in chart area: Ctrl/Shift for vertical price zoom, standard for horizontal time zoom
      if (e.ctrlKey || e.shiftKey) {
        if (priceRangeRef.current !== null) {
          if (isAutoScaledRef.current) {
            isAutoScaledRef.current = false;
            setIsAutoScaledState(false);
          }
          const zoomSensitivity = 0.002;
          const zoomFactor = 1 + e.deltaY * zoomSensitivity;
          priceRangeRef.current = Math.max(0.0001, priceRangeRef.current * zoomFactor);
          scheduleRedraw();
        }
      } else {
        const zoomSensitivity = 0.002;
        const zoomFactor = 1 + e.deltaY * zoomSensitivity;
        const oldBarWidth = barWidthRef.current;
        const newBarWidth = Math.max(1, Math.min(100, oldBarWidth / zoomFactor));
        if (oldBarWidth !== newBarWidth) {
          scrollOffsetRef.current += (scrollOffsetRef.current + chartWidth - x) * (newBarWidth / oldBarWidth - 1);
          barWidthRef.current = newBarWidth;
          scheduleRedraw();
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const chartWidth = rect.width - PRICE_AXIS_WIDTH;
      const chartHeight = rect.height - TIME_AXIS_HEIGHT;

      // Double-click on price axis -> auto-fit price to active depth
      if (x > chartWidth) {
        isAutoScaledRef.current = true;
        priceCenterRef.current = null;
        priceRangeRef.current = null;
        setIsAutoScaledState(true);
        scheduleRedraw();
        return;
      }

      // Double-click on time axis -> reset time zoom & scroll
      if (y > chartHeight) {
        barWidthRef.current = 12;
        scrollOffsetRef.current = 0;
        scheduleRedraw();
        return;
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('blur', onWindowMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onCanvasMouseMove);
      canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('blur', onWindowMouseUp);
    };
  }, [scheduleRedraw]);

  // 1. Redraw when new slice arrives from Web Worker
  useEffect(() => {
    if (!workerClient) return;

    const prevHandler = workerClient.onHeatmapSlice;
    workerClient.onHeatmapSlice = (slice) => {
      prevHandler?.(slice);
      scheduleRedraw();
    };

    return () => {
      workerClient.onHeatmapSlice = prevHandler;
    };
  }, [workerClient, scheduleRedraw]);

  // 2. Follow main chart viewportPrice ONLY while in auto-scale mode
  useEffect(() => {
    const unsub = useChartRuntimeStore.subscribe(
      (s) => s.panels[panelId]?.viewportPrice,
      (curr, prev) => {
        if (!curr) return;
        if (isAutoScaledRef.current) {
          if (!prev || curr.priceMin !== prev.priceMin || curr.priceMax !== prev.priceMax) {
            scheduleRedraw();
          }
        }
      }
    );
    return () => unsub();
  }, [panelId, scheduleRedraw]);

  // 3. Redraw on candle dataVersion updates
  useEffect(() => {
    const unsub = useChartRuntimeStore.subscribe(
      (s) => s.panels[panelId]?.dataVersion,
      (curr, prev) => {
        if (curr !== prev) scheduleRedraw();
      }
    );
    return () => unsub();
  }, [panelId, scheduleRedraw]);

  // 4. Continuous 1-second timer to recompute 95th-percentile clamp and refresh paint
  useEffect(() => {
    const timer = setInterval(() => {
      scheduleRedraw();
    }, 1000);
    return () => clearInterval(timer);
  }, [scheduleRedraw]);

  // 5. Redraw on configuration or container width changes
  useEffect(() => {
    scheduleRedraw();
  }, [heatmapPanelWidth, effectiveBucketSize, heatmapClampPercentile, heatmapShowTrades, scheduleRedraw]);

  // Draggable width divider handling
  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingDivider.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const startWidth = heatmapPanelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizingDivider.current) return;
        const delta = startX - ev.clientX; // Moving divider to left increases width
        const newWidth = Math.max(180, Math.min(1200, startWidth + delta));
        setHeatmapPanelWidth(panelId, newWidth);
      };

      const onMouseUp = () => {
        isResizingDivider.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [panelId, heatmapPanelWidth, setHeatmapPanelWidth]
  );

  // Manual reset actions
  const resetAutoScale = useCallback(() => {
    isAutoScaledRef.current = true;
    priceCenterRef.current = null;
    priceRangeRef.current = null;
    setIsAutoScaledState(true);
    scheduleRedraw();
  }, [scheduleRedraw]);

  const resetAllNavigation = useCallback(() => {
    isAutoScaledRef.current = true;
    priceCenterRef.current = null;
    priceRangeRef.current = null;
    barWidthRef.current = 12;
    scrollOffsetRef.current = 0;
    setIsAutoScaledState(true);
    scheduleRedraw();
  }, [scheduleRedraw]);

  return (
    <div
      style={{ width: `${heatmapPanelWidth}px` }}
      className="relative shrink-0 h-full flex flex-row bg-[#0E1015] border-l border-[#1F1F1F] select-none"
    >
      {/* Draggable Divider Handle */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-[5px] -ml-[2.5px] h-full cursor-col-resize z-20 group relative shrink-0"
        title="Drag to resize Heatmap Chart Panel"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-transparent group-hover:bg-accent/60 transition-colors" />
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="relative flex-1 h-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

        {/* Top Header Controls / Indicators Overlay */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-[#14171F]/85 backdrop-blur px-2 py-1 rounded border border-[#222735] text-[10px] font-mono text-text-dim shadow-sm">
          <span className="font-bold text-accent">HEATMAP</span>
          <span className="text-[#444]">|</span>

          {/* Auto-Scale Toggle Button */}
          <button
            onClick={resetAutoScale}
            title={
              isAutoScaledState
                ? 'Auto-scale active (Click to re-center)'
                : 'Manual price scale active (Click to auto-fit to market)'
            }
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              isAutoScaledState
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'bg-[#1F2430] text-text-dim hover:text-white hover:bg-[#2A3142] border border-transparent'
            }`}
          >
            AUTO
          </button>

          {/* Reset Both Price & Time Zoom */}
          <button
            onClick={resetAllNavigation}
            title="Reset price auto-scale and time zoom to default"
            className="p-0.5 hover:text-white transition-colors text-text-dim/70"
          >
            <RotateCcw size={10} />
          </button>

          <span className="text-[#444]">|</span>
          <span title="Orderbook Resync Events">
            Resyncs:{' '}
            <span className={resyncCount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {resyncCount}
            </span>
          </span>

          {/* Dev Simulate Gap Test Trigger */}
          {process.env.NODE_ENV !== 'production' && workerClient && (
            <button
              onClick={() => workerClient.simulateGap()}
              title="Dev: Simulate out-of-order sequence gap to verify clean resync"
              className="ml-0.5 p-0.5 hover:text-amber-300 transition-colors text-text-dim/60"
            >
              <AlertTriangle size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


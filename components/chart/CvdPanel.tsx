'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { buildCvdSeries } from '@/lib/utils/delta';
import { initCanvas } from '@/lib/utils/canvas';
import { useChartStore, PanelId, PanelState } from '@/lib/store/chart';
import { Candle } from '@/types/candle';
import { getVisibleRange, indexToX as calcIndexToX, xToIndex, timeToIndex } from './useCoordinates';
import { drawTimeAxis } from './drawAxes';
import { drawCrosshair, drawCrosshairTimeLabel } from './drawCrosshair';
import { CvdScale, drawCvd, drawCvdCrosshairValueLabel, getCvdScale } from './drawCvd';

interface CvdPanelProps {
  panelId: PanelId;
  candles: Candle[];
  engine: AggregationEngine;
  barWidth: number;
  scrollOffset: number;
  footprintTrigger: number;
  volumeProfileRevision: number;
  profileWidth: number;
  sessions: PanelState['sessions'];
  cvdMode: PanelState['cvdMode'];
  cvdSmoothing: number;
  cvdResetMode: PanelState['cvdResetMode'];
  cvdPositiveColor: string;
  cvdNegativeColor: string;
  cvdScaleMode: PanelState['cvdScaleMode'];
  cvdFixedRange: number;
  cvdShowDivergence: boolean;
}

type CvdDragMode = 'pan' | 'scale';

export function CvdPanel({
  panelId,
  candles,
  engine,
  barWidth: barWidthProp,
  scrollOffset: scrollOffsetProp,
  footprintTrigger,
  volumeProfileRevision,
  profileWidth,
  sessions,
  cvdMode,
  cvdSmoothing,
  cvdResetMode,
  cvdPositiveColor,
  cvdNegativeColor,
  cvdScaleMode,
  cvdFixedRange,
  cvdShowDivergence,
}: CvdPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const isRedrawScheduled = useRef(false);
  const isDragging = useRef(false);
  const dragMode = useRef<CvdDragMode | null>(null);
  const lastY = useRef(0);
  const mouseX = useRef<number | null>(null);
  const mouseY = useRef<number | null>(null);
  const isMouseOver = useRef(false);
  const scaleCenter = useRef<number | null>(null);
  const scaleRange = useRef<number | null>(null);

  const priceAxisWidth = 85;
  const timeAxisHeight = 24;

  const getAutoScale = useCallback((chartHeight: number) => {
    const chartWidth = Math.max(1, widthRef.current - priceAxisWidth);
    const { firstIndex, lastIndex } = getVisibleRange(
      candles,
      scrollOffsetProp,
      barWidthProp,
      chartWidth,
      profileWidth
    );
    const points = buildCvdSeries(candles, engine, {
      resetMode: cvdResetMode,
      smoothing: cvdSmoothing,
      sessions,
    });

    return getCvdScale(points, firstIndex, lastIndex, cvdMode, cvdScaleMode, cvdFixedRange, chartHeight);
  }, [
    candles,
    engine,
    scrollOffsetProp,
    barWidthProp,
    profileWidth,
    cvdResetMode,
    cvdSmoothing,
    sessions,
    cvdMode,
    cvdScaleMode,
    cvdFixedRange,
  ]);

  const getViewportScale = useCallback((chartHeight: number, autoScale?: CvdScale): CvdScale => {
    const base = autoScale ?? getAutoScale(chartHeight);

    if (scaleCenter.current === null || scaleRange.current === null) {
      return base;
    }

    return createManualScale(scaleCenter.current, scaleRange.current, chartHeight);
  }, [getAutoScale]);

  const ensureManualScale = useCallback((chartHeight: number) => {
    const currentScale = getViewportScale(chartHeight);

    if (scaleCenter.current === null || scaleRange.current === null) {
      scaleCenter.current = (currentScale.min + currentScale.max) / 2;
      scaleRange.current = Math.max(1, currentScale.max - currentScale.min);
    }

    return currentScale;
  }, [getViewportScale]);

  const redraw = useCallback(() => {
    if (isRedrawScheduled.current) return;

    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;

      const ctx = ctxRef.current;
      const logicalWidth = widthRef.current;
      const logicalHeight = heightRef.current;
      if (!ctx || logicalWidth <= 0 || logicalHeight <= 0) return;

      const chartWidth = logicalWidth - priceAxisWidth;
      const chartHeight = logicalHeight - timeAxisHeight;
      const { firstIndex, lastIndex, rawFirstIndex, rawLastIndex } = getVisibleRange(
        candles,
        scrollOffsetProp,
        barWidthProp,
        chartWidth,
        profileWidth
      );
      const indexToX = (index: number) => calcIndexToX(index, candles.length, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
      const points = buildCvdSeries(candles, engine, {
        resetMode: cvdResetMode,
        smoothing: cvdSmoothing,
        sessions,
      });
      const autoScale = getCvdScale(points, firstIndex, lastIndex, cvdMode, cvdScaleMode, cvdFixedRange, chartHeight);
      const scale = getViewportScale(chartHeight, autoScale);

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      drawCvd(ctx, points, firstIndex, lastIndex, indexToX, scale, {
        mode: cvdMode,
        scaleMode: cvdScaleMode,
        fixedRange: cvdFixedRange,
        positiveColor: cvdPositiveColor,
        negativeColor: cvdNegativeColor,
        showDivergenceMarkers: cvdShowDivergence,
        chartWidth,
        chartHeight,
        canvasWidth: logicalWidth,
        canvasHeight: logicalHeight,
        priceAxisWidth,
        timeAxisHeight,
        barWidth: barWidthProp,
      });

      drawTimeAxis(ctx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, barWidthProp);

      const crosshair = useChartStore.getState().crosshair;
      const crosshairSyncEnabled = useChartStore.getState().crosshairSyncEnabled;
      let mx: number | null = null;
      let my: number | null = null;

      if (
        isMouseOver.current &&
        mouseX.current !== null &&
        mouseY.current !== null &&
        mouseX.current >= 0 &&
        mouseX.current <= chartWidth &&
        mouseY.current >= 0 &&
        mouseY.current <= chartHeight
      ) {
        mx = mouseX.current;
        my = mouseY.current;
      } else if (crosshairSyncEnabled && crosshair.activePanel && crosshair.time !== null && candles.length > 0) {
        mx = indexToX(timeToIndex(crosshair.time, candles));
      }

      if (mx !== null || my !== null) {
        drawCrosshair(ctx, mx, my, chartWidth, chartHeight);

        if (my !== null) {
          drawCvdCrosshairValueLabel(ctx, my, scale.yToValue(my), chartWidth, priceAxisWidth, chartHeight);
        }

        if (mx !== null && mx >= 0 && mx <= chartWidth) {
          const index = xToIndex(mx, candles, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
          const time = candles[index]?.time ?? crosshair.time ?? 0;
          if (time > 0) {
            drawCrosshairTimeLabel(ctx, mx, time, chartHeight, timeAxisHeight, chartWidth);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    candles,
    engine,
    scrollOffsetProp,
    barWidthProp,
    profileWidth,
    sessions,
    cvdMode,
    cvdSmoothing,
    cvdResetMode,
    cvdPositiveColor,
    cvdNegativeColor,
    cvdScaleMode,
    cvdFixedRange,
    cvdShowDivergence,
    getViewportScale,
  ]);

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  const updateCrosshair = useCallback((x: number | null, y: number | null) => {
    if (x === null || y === null) {
      useChartStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const chartWidth = canvas.clientWidth - priceAxisWidth;
    const chartHeight = canvas.clientHeight - timeAxisHeight;
    if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) return;

    const index = xToIndex(x, candles, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
    const time = candles[index]?.time ?? null;

    if (useChartStore.getState().crosshairSyncEnabled) {
      useChartStore.getState().setCrosshair({ activePanel: panelId, time, price: null });
    }
  }, [panelId, candles, scrollOffsetProp, barWidthProp, profileWidth]);

  useEffect(() => {
    scaleCenter.current = null;
    scaleRange.current = null;
    redrawRef.current();
  }, [cvdMode, cvdScaleMode, cvdFixedRange, cvdResetMode, cvdSmoothing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const setupCanvas = (w: number, h: number) => {
      ctxRef.current = initCanvas(canvas, w, h);
      widthRef.current = w;
      heightRef.current = h;
      redrawRef.current();
    };

    const rect = container.getBoundingClientRect();
    setupCanvas(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setupCanvas(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(container);

    let dprMedia: MediaQueryList | null = null;
    const onDprChange = () => {
      const nextRect = container.getBoundingClientRect();
      setupCanvas(nextRect.width, nextRect.height);
      listenToDpr();
    };
    const listenToDpr = () => {
      if (dprMedia) dprMedia.removeEventListener('change', onDprChange);
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener('change', onDprChange, { once: true });
    };

    listenToDpr();

    return () => {
      observer.disconnect();
      if (dprMedia) dprMedia.removeEventListener('change', onDprChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getLocalPoint = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const setCursor = (x: number, y: number, width: number, height: number) => {
      const chartWidth = width - priceAxisWidth;
      const chartHeight = height - timeAxisHeight;

      if (isDragging.current) {
        canvas.style.cursor = dragMode.current === 'scale' ? 'ns-resize' : 'grabbing';
      } else if (y <= chartHeight && x > chartWidth) {
        canvas.style.cursor = 'ns-resize';
      } else if (y <= chartHeight && x >= 0 && x <= chartWidth) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const { x, y, width, height } = getLocalPoint(event);
      const chartWidth = width - priceAxisWidth;
      const chartHeight = height - timeAxisHeight;

      if (y < 0 || y > chartHeight || x < 0 || x > width) return;

      event.preventDefault();
      isDragging.current = true;
      dragMode.current = x > chartWidth ? 'scale' : 'pan';
      lastY.current = event.clientY;
      ensureManualScale(chartHeight);
      setCursor(x, y, width, height);
    };

    const onMouseMove = (event: MouseEvent) => {
      const { x, y, width, height } = getLocalPoint(event);
      const isOver = x >= 0 && x <= width && y >= 0 && y <= height;

      if (isOver || isDragging.current) {
        mouseX.current = x;
        mouseY.current = y;
      }

      setCursor(x, y, width, height);

      const chartHeight = height - timeAxisHeight;

      if (isDragging.current) {
        const deltaY = event.clientY - lastY.current;
        lastY.current = event.clientY;

        if (scaleCenter.current !== null && scaleRange.current !== null) {
          if (dragMode.current === 'scale') {
            const nextRange = scaleRange.current * (1 + deltaY * 0.006);
            scaleRange.current = Math.max(1, Math.min(1_000_000_000, nextRange));
          } else {
            const valuePerPixel = scaleRange.current / Math.max(1, chartHeight);
            scaleCenter.current += deltaY * valuePerPixel;
          }
        }

        redrawRef.current();
        return;
      }

      if (isOver) {
        updateCrosshair(x, y);
        redrawRef.current();
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      dragMode.current = null;
      canvas.style.cursor = isMouseOver.current ? 'crosshair' : '';
    };

    const onMouseEnter = () => {
      isMouseOver.current = true;
    };

    const onMouseLeave = () => {
      isMouseOver.current = false;

      if (!isDragging.current) {
        updateCrosshair(null, null);
        canvas.style.cursor = '';
        redrawRef.current();
      }
    };

    const onWheel = (event: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const chartHeight = rect.height - timeAxisHeight;

      if (x < 0 || x > rect.width || y < 0 || y > chartHeight) return;

      event.preventDefault();
      const currentScale = ensureManualScale(chartHeight);
      const oldRange = Math.max(1, currentScale.max - currentScale.min);
      const zoomFactor = Math.max(0.2, Math.min(5, 1 + event.deltaY * 0.002));
      const newRange = Math.max(1, Math.min(1_000_000_000, oldRange * zoomFactor));
      const anchorValue = currentScale.yToValue(y);
      const ratio = (currentScale.max - anchorValue) / oldRange;
      const newMax = anchorValue + newRange * ratio;
      const newMin = newMax - newRange;

      scaleCenter.current = (newMin + newMax) / 2;
      scaleRange.current = newRange;
      redrawRef.current();
    };

    const onDoubleClick = () => {
      scaleCenter.current = null;
      scaleRange.current = null;
      redrawRef.current();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [ensureManualScale, updateCrosshair]);

  useEffect(() => {
    redraw();
  }, [
    candles,
    footprintTrigger,
    volumeProfileRevision,
    barWidthProp,
    scrollOffsetProp,
    cvdMode,
    cvdSmoothing,
    cvdResetMode,
    cvdPositiveColor,
    cvdNegativeColor,
    cvdScaleMode,
    cvdFixedRange,
    cvdShowDivergence,
    redraw,
  ]);

  useEffect(() => {
    const unsubscribe = useChartStore.subscribe((state, prevState) => {
      if (
        state.crosshair.time !== prevState.crosshair.time ||
        state.crosshair.activePanel !== prevState.crosshair.activePanel ||
        state.crosshairSyncEnabled !== prevState.crosshairSyncEnabled
      ) {
        redrawRef.current();
      }
    });

    return unsubscribe;
  }, []);

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

function createManualScale(center: number, range: number, chartHeight: number): CvdScale {
  const safeRange = Math.max(1, range);
  const min = center - safeRange / 2;
  const max = center + safeRange / 2;

  const valueToY = (value: number) => ((max - value) / safeRange) * chartHeight;
  const yToValue = (y: number) => max - (y / Math.max(1, chartHeight)) * safeRange;

  return { min, max, valueToY, yToValue };
}

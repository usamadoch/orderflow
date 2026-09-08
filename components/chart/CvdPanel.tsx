'use client';

// 1. External packages
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

// 2. Internal packages & stores
import { useChartStore, PanelId, PanelState } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { initCanvas } from '@/lib/utils/canvas';
import { buildCvdSeries, detectLocalCvdDivergences } from '@/lib/utils/delta';
import type { Candle } from '@/types/candle';
import type { CvdScale, CvdDragMode } from '@/types/cvd';
import { DEFAULT_CANVAS_BG } from '@/lib/config/chartColors';

// 3. Relative component & utility imports
import { createManualScale } from './cvdPanelUtils';
import { drawTimeAxis } from './drawAxes';
import { drawCrosshair, drawCrosshairTimeLabel } from './drawCrosshair';
import { drawCvd, drawCvdCrosshairValueLabel, getCvdScale } from './drawCvd';
import { drawDrawingPriceLabels, drawLines } from './drawLines';
import { resolveLineForRender } from './chartCanvasUtils';
import type { DrawnLine } from '@/types/chart';
import { getVisibleRange, indexToX as calcIndexToX, xToIndex, timeToIndex } from './useCoordinates';

interface CvdPanelProps {
  panelId: PanelId;
  engine: AggregationEngine;
  barWidth: number;
  scrollOffset: number;
  volumeProfileRevision: number;
  profileWidth: number;
  sessions: PanelState['sessions'];
  globalTimezone?: string;
  globalTimeFormat?: '12h' | '24h';
  cvdMode: PanelState['cvdMode'];
  cvdSmoothing: number;
  cvdResetMode: PanelState['cvdResetMode'];
  cvdPositiveColor: string;
  cvdNegativeColor: string;
  cvdScaleMode: PanelState['cvdScaleMode'];
  cvdFixedRange: number;
  cvdShowDivergence: boolean;
  cvdDivergenceLookback: number;
  drawnLines?: PanelState['drawnLines'];
}


export function CvdPanel({
  panelId,
  engine,
  barWidth: barWidthProp,
  scrollOffset: scrollOffsetProp,
  volumeProfileRevision,
  profileWidth,
  sessions,
  globalTimezone = 'local',
  globalTimeFormat = '24h',
  cvdMode,
  cvdSmoothing,
  cvdResetMode,
  cvdPositiveColor,
  cvdNegativeColor,
  cvdScaleMode,
  cvdFixedRange,
  cvdShowDivergence,
  cvdDivergenceLookback,
  drawnLines: drawnLinesProp,
}: CvdPanelProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const scheduledLayers = useRef<Set<'background' | 'live' | 'overlay' | 'live-dirty'>>(new Set(['background', 'live', 'overlay']));
  const isRedrawScheduled = useRef(false);
  const horizontalGridLineColor = useChartStore(s => s.horizontalGridLineColor);
  const horizontalGridLineOpacity = useChartStore(s => s.horizontalGridLineOpacity);
  const horizontalGridLineStyle = useChartStore(s => s.horizontalGridLineStyle);
  const crosshairColor = useChartStore(s => s.crosshairColor);
  const crosshairOpacity = useChartStore(s => s.crosshairOpacity);
  const crosshairThickness = useChartStore(s => s.crosshairThickness);
  const crosshairStyle = useChartStore(s => s.crosshairStyle);
  const storeDrawnLines = useChartStore(s => s.panels[panelId]?.drawnLines);
  const drawnLines = useMemo(() => storeDrawnLines ?? drawnLinesProp ?? [], [storeDrawnLines, drawnLinesProp]);
  const prevCandlesRef = useRef<Candle[]>([]);
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
    const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
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
    engine,
    scrollOffsetProp,
    barWidthProp,
    profileWidth,
    cvdResetMode,
    panelId,
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

  const redraw = useCallback((layers: 'all' | Set<'background' | 'live' | 'overlay' | 'live-dirty'> | 'overlay' | 'live' | 'background' | 'live-dirty' = 'all') => {
    if (layers === 'all') {
      scheduledLayers.current.add('background');
      scheduledLayers.current.add('live');
      scheduledLayers.current.add('overlay');
    } else if (typeof layers === 'string') {
      scheduledLayers.current.add(layers);
    } else {
      layers.forEach((l) => scheduledLayers.current.add(l));
    }

    if (isRedrawScheduled.current) return;

    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;
      const layersToDraw = new Set(scheduledLayers.current);
      scheduledLayers.current.clear();
      const drawAll = layersToDraw.size === 3;

      const bgCtx = bgCtxRef.current;
      const liveCtx = liveCtxRef.current;
      const ctx = ctxRef.current;
      const logicalWidth = widthRef.current;
      const logicalHeight = heightRef.current;

      if (!bgCtx || !liveCtx || !ctx || logicalWidth <= 0 || logicalHeight <= 0) return;

      const chartWidth = logicalWidth - priceAxisWidth;
      const chartHeight = logicalHeight - timeAxisHeight;
      const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
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
        timezone: globalTimezone,
      });
      const autoScale = getCvdScale(points, firstIndex, lastIndex, cvdMode, cvdScaleMode, cvdFixedRange, chartHeight);
      const scale = getViewportScale(chartHeight, autoScale);

      if (drawAll || layersToDraw.has('background')) {
        bgCtx.clearRect(0, 0, logicalWidth, logicalHeight);
        bgCtx.fillStyle = DEFAULT_CANVAS_BG;
        bgCtx.fillRect(0, 0, logicalWidth, logicalHeight);
        drawTimeAxis(bgCtx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, barWidthProp);
      }

      const isDirty = !drawAll && !layersToDraw.has('live') && layersToDraw.has('live-dirty');
      if (drawAll || layersToDraw.has('live') || layersToDraw.has('live-dirty')) {
        if (isDirty && candles.length > 0) {
          const x = indexToX(candles.length - 1);
          const colStartX = x - barWidthProp / 2 - 2;
          const colWidth = barWidthProp + 4;
          liveCtx.save();
          liveCtx.beginPath();
          liveCtx.rect(colStartX, 0, colWidth, logicalHeight);
          liveCtx.clip();
          liveCtx.clearRect(colStartX, 0, colWidth, logicalHeight);
        } else {
          liveCtx.clearRect(0, 0, logicalWidth, logicalHeight);
        }
        const divergenceMarkers = cvdShowDivergence
          ? detectLocalCvdDivergences(candles, points, cvdDivergenceLookback)
          : [];

        drawCvd(liveCtx, points, firstIndex, lastIndex, indexToX, scale, {
          mode: cvdMode,
          scaleMode: cvdScaleMode,
          fixedRange: cvdFixedRange,
          positiveColor: cvdPositiveColor,
          negativeColor: cvdNegativeColor,
          showDivergenceMarkers: cvdShowDivergence,
          divergenceMarkers,
          chartWidth,
          chartHeight,
          canvasWidth: logicalWidth,
          canvasHeight: logicalHeight,
          priceAxisWidth,
          timeAxisHeight,
          barWidth: barWidthProp,
          gridColor: horizontalGridLineColor,
          gridOpacity: horizontalGridLineOpacity,
          gridStyle: horizontalGridLineStyle,
        });
        
        if (isDirty && candles.length > 0) {
          liveCtx.restore();
        }
      }

      if (drawAll || layersToDraw.has('overlay')) {
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Draw vertical lines on top of CVD
        const runtimeDrawingDrag = useChartRuntimeStore.getState().drawingDrag;
        const drawingsSyncEnabled = useChartStore.getState().drawingsSyncEnabled;
        let liveDrawnLines = useChartStore.getState().panels[panelId]?.drawnLines ?? drawnLines ?? [];
        if (runtimeDrawingDrag) {
          const isSelf = runtimeDrawingDrag.panelId === panelId;
          if (isSelf || drawingsSyncEnabled) {
            liveDrawnLines = liveDrawnLines.map((line) =>
              line.id === runtimeDrawingDrag.id
                ? ({ ...line, ...runtimeDrawingDrag.updates } as DrawnLine)
                : line
            );
          }
        }
        const verticalLines = liveDrawnLines
          .filter((line) => line.type === 'vertical')
          .map((line) => resolveLineForRender(line, candles))
          .filter((line): line is DrawnLine => line !== null);

        if (verticalLines.length > 0) {
          drawLines(
            ctx,
            verticalLines,
            indexToX,
            () => 0,
            logicalWidth,
            logicalHeight,
            timeAxisHeight,
            priceAxisWidth,
            barWidthProp,
            null,
            null,
            false,
            candles
          );

          drawDrawingPriceLabels(
            ctx,
            verticalLines,
            indexToX,
            () => 0,
            logicalWidth,
            logicalHeight,
            timeAxisHeight,
            priceAxisWidth,
            barWidthProp,
            candles,
            globalTimezone,
            globalTimeFormat
          );
        }

        const crosshair = useChartRuntimeStore.getState().crosshair;
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
          const snappedIndex = xToIndex(mouseX.current, candles, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
          mx = indexToX(snappedIndex);
          my = mouseY.current;
        } else if (crosshair.activePanel && (!isMouseOver.current && (crosshair.activePanel === panelId || crosshairSyncEnabled))) {
          if (crosshair.time !== null && candles.length > 0) {
            const syncedIndex = timeToIndex(crosshair.time, candles);
            mx = indexToX(syncedIndex);
          }
        }

        if (mx !== null || my !== null) {
          drawCrosshair(ctx, mx, my, chartWidth, chartHeight, {
            color: crosshairColor,
            opacity: crosshairOpacity,
            thickness: crosshairThickness,
            style: crosshairStyle,
            verticalLineHeight: chartHeight,
          });

          if (my !== null) {
            drawCvdCrosshairValueLabel(ctx, my, scale.yToValue(my), chartWidth, priceAxisWidth, chartHeight);
          }

          if (mx !== null && mx >= 0 && mx <= chartWidth) {
            const index = xToIndex(mx, candles, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
            let time = 0;
            if (candles[index]) {
              time = candles[index].time;
            } else if (candles.length > 0) {
              const lastCandle = candles[candles.length - 1];
              const firstCandle = candles[0];
              const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
              time = lastCandle.time + (index - (candles.length - 1)) * avgInterval;
            } else if (crosshair.time) {
              time = crosshair.time;
            }
            if (time > 0) {
              drawCrosshairTimeLabel(ctx, mx, time, chartHeight, timeAxisHeight, chartWidth);
            }
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    cvdDivergenceLookback,
    getViewportScale,
    globalTimezone,
    globalTimeFormat,
    horizontalGridLineColor,
    horizontalGridLineOpacity,
    horizontalGridLineStyle,
    drawnLines,
    crosshairColor,
    crosshairOpacity,
    crosshairThickness,
    crosshairStyle,
  ]);

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  useEffect(() => {
    redrawRef.current();
  }, [globalTimezone, globalTimeFormat]);

  const updateCrosshair = useCallback((x: number | null, y: number | null) => {
    if (x === null || y === null) {
      useChartRuntimeStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const chartWidth = canvas.clientWidth - priceAxisWidth;
    const chartHeight = canvas.clientHeight - timeAxisHeight;
    if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) return;

    const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
    const index = xToIndex(x, candles, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
    let time = candles[index]?.time ?? null;
    if (time === null && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const firstCandle = candles[0];
      const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
      time = lastCandle.time + (index - (candles.length - 1)) * avgInterval;
    }

    useChartRuntimeStore.getState().setCrosshair({ activePanel: panelId, time, price: null });
  }, [panelId, scrollOffsetProp, barWidthProp, profileWidth]);

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
      const roundedW = Math.max(1, Math.round(w));
      const roundedH = Math.max(1, Math.round(h));
      if (bgCanvasRef.current) bgCtxRef.current = initCanvas(bgCanvasRef.current, roundedW, roundedH);
      if (liveCanvasRef.current) liveCtxRef.current = initCanvas(liveCanvasRef.current, roundedW, roundedH);
      if (canvasRef.current) ctxRef.current = initCanvas(canvasRef.current, roundedW, roundedH);
      widthRef.current = roundedW;
      heightRef.current = roundedH;
      redrawRef.current('all');
    };

    const rect = container.getBoundingClientRect();
    setupCanvas(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setupCanvas(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height));
    });

    observer.observe(container);

    let lastDpr = window.devicePixelRatio || 1;
    let dprMedia: MediaQueryList | null = null;
    const checkDprAndRescale = () => {
      const currentDpr = window.devicePixelRatio || 1;
      if (Math.abs(currentDpr - lastDpr) > 0.01) {
        lastDpr = currentDpr;
        const nextRect = container.getBoundingClientRect();
        setupCanvas(nextRect.width, nextRect.height);
        listenToDpr();
      }
    };
    const onDprChange = () => {
      lastDpr = window.devicePixelRatio || 1;
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
    window.addEventListener('resize', checkDprAndRescale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkDprAndRescale);
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

    const onWindowDragMove = (event: MouseEvent) => {
      if (!isDragging.current) return;
      const { x, y, width, height } = getLocalPoint(event);
      mouseX.current = x;
      mouseY.current = y;
      setCursor(x, y, width, height);

      const chartHeight = height - timeAxisHeight;
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
    };

    const onWindowDragUp = (event: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      dragMode.current = null;

      const { x, y, width, height } = getLocalPoint(event);
      const isOver = x >= 0 && x <= width && y >= 0 && y <= height;
      isMouseOver.current = isOver;
      if (!isOver) {
        mouseX.current = null;
        mouseY.current = null;
        updateCrosshair(null, null);
        canvas.style.cursor = '';
        redrawRef.current('overlay');
      } else {
        setCursor(x, y, width, height);
      }
    };

    const onCanvasMouseMove = (event: MouseEvent) => {
      if (isDragging.current) return;
      const { x, y, width, height } = getLocalPoint(event);
      isMouseOver.current = true;
      mouseX.current = x;
      mouseY.current = y;

      setCursor(x, y, width, height);
      updateCrosshair(x, y);
      redrawRef.current('overlay');
    };

    const onWindowMouseMove = (event: MouseEvent) => {
      if (isDragging.current) {
        onWindowDragMove(event);
      }
    };

    const onWindowMouseUp = (event: MouseEvent) => {
      if (isDragging.current) {
        onWindowDragUp(event);
      }
    };

    const onMouseEnter = () => {
      isMouseOver.current = true;
    };

    const onMouseLeave = () => {
      isMouseOver.current = false;

      if (!isDragging.current) {
        mouseX.current = null;
        mouseY.current = null;
        updateCrosshair(null, null);
        canvas.style.cursor = '';
        redrawRef.current('overlay');
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
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onCanvasMouseMove);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [ensureManualScale, updateCrosshair]);

  // Redraw when candles change (optimized for live ticks)
  useEffect(() => {
    const unsubscribe = useChartRuntimeStore.subscribe(
      (state) => state.panels[panelId]?.dataVersion,
      (version, prevVersion) => {
        if (version === prevVersion) return;
        
        const prev = prevCandlesRef.current;
        const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
        prevCandlesRef.current = candles;

        if (prev.length > 0 && candles.length > 0) {
          // If we just appended one candle or updated the last candle
          if ((candles.length === prev.length || candles.length === prev.length + 1) && candles[0] === prev[0]) {
            redraw('live-dirty');
            return;
          }
        }
        redraw('all');
      }
    );
    return () => unsubscribe();
  }, [panelId, redraw]);

  useEffect(() => {
    redraw('all');
  }, [
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
    cvdDivergenceLookback,
    redraw,
  ]);

  useEffect(() => {
    redraw('overlay');
  }, [drawnLines, crosshairColor, crosshairOpacity, crosshairThickness, crosshairStyle, redraw]);

  useEffect(() => {
    const unsubscribeDrawingDrag = useChartRuntimeStore.subscribe(
      (state) => state.drawingDrag,
      (drag, prevDrag) => {
        if (drag || prevDrag) {
          redrawRef.current('overlay');
        }
      }
    );
    return () => unsubscribeDrawingDrag();
  }, []);

  useEffect(() => {
    const unsubscribeCrosshair = useChartRuntimeStore.subscribe((state) => state.crosshair, (crosshair, previousCrosshair) => {
      const isCrosshairSyncEnabled = useChartStore.getState().crosshairSyncEnabled;
      if (!isCrosshairSyncEnabled && crosshair.activePanel !== panelId) return;
      if (crosshair.activePanel === panelId && isMouseOver.current) return;
      if (
        crosshair.time !== previousCrosshair.time ||
        crosshair.activePanel !== previousCrosshair.activePanel
      ) {
        redrawRef.current('overlay');
      }
    });

    const unsubscribeSync = useChartStore.subscribe((state, prevState) => {
      if (state.crosshairSyncEnabled === prevState.crosshairSyncEnabled) return;
      if (!state.crosshairSyncEnabled) {
        useChartRuntimeStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
      }
      redrawRef.current('overlay');
    });

    return () => {
      unsubscribeCrosshair();
      unsubscribeSync();
    };
  }, [panelId]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-background overflow-hidden">
      <canvas
        ref={bgCanvasRef}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={liveCanvasRef}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 outline-none"
        tabIndex={0}
      />
    </div>
  );
}
  
'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Lock, Unlock, X } from 'lucide-react';
import { PanelId, ChartMode, AbsorptionSide, BubbleSide, useChartStore, PanelState, ExhaustionSide, Measurement } from '@/lib/store/chart';
import { FootprintMode } from '@/types/footprint';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { usePanZoom } from './usePanZoom';
import { getVisibleRange, getVisiblePriceRange, priceToY as calcPriceToY, indexToX as calcIndexToX, yToPrice, xToIndex, timeToIndex } from './useCoordinates';
import { drawCandles } from './drawCandles';
import { drawFootprint } from './drawFootprint';
import { drawGrid, drawPriceAxis, drawTimeAxis, calculatePriceStep } from './drawAxes';
import { drawPriceLine } from './drawPriceLine';
import { drawCrosshair, drawCrosshairPriceLabel, drawCrosshairTimeLabel } from './drawCrosshair';
import { buildProfile } from '@/lib/utils/volumeProfile';
import { drawVolumeProfile } from './drawVolumeProfile';
import { drawAbsorption } from './drawAbsorption';
import { drawBubbles } from './drawBubbles';
import { drawSelectionRect, drawCustomProfile } from './drawSelectionRect';
import { drawLines } from './drawLines';
import { initCanvas } from '@/lib/utils/canvas';
import { Candle } from '@/types/candle';
import { AbsorptionResult } from '@/types/absorption';
import { ExhaustionResult } from '@/types/exhaustion';
import { IcebergLevel } from '@/types/iceberg';
import { AbsorptionTooltip } from './AbsorptionTooltip';
import { drawExhaustion } from './drawExhaustion';
import { ExhaustionTooltip } from './ExhaustionTooltip';
import { drawDeltaProfile } from '@/lib/draw/drawDeltaProfile';
import { drawMeasurementRect } from '@/lib/draw/drawMeasurement';
import { drawSessions } from '@/lib/draw/drawSessions';
import { drawLiquidity } from '@/lib/draw/drawLiquidity';
import { drawLiquidityHeatmap } from '@/lib/draw/drawLiquidityHeatmap';
import { drawIceberg } from '@/lib/draw/drawIceberg';
import { buildHeatmapRows } from '@/lib/liquidity/heatmap';
import { LiquidityHistoryManager } from '@/lib/liquidity/history';
import { computeMeasurementMetrics, computeFootprintMetrics, CoordinateSystem } from '@/lib/utils/measurement';
import { MeasurementPanel } from './MeasurementPanel';
import { HeatmapRow } from '@/types/liquidity';
import { IcebergTooltip } from './IcebergTooltip';

interface ChartCanvasProps {
  panelId: PanelId;
  candles: Candle[];
  chartMode: ChartMode;
  footprintMode: FootprintMode;
  bucketSize: number;
  barWidth: number;
  scrollOffset: number;
  timeframe: string;
  footprintTrigger: number;
  isLoadingHistory: boolean;
  engine: AggregationEngine;
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  absorptionMap: Map<number, AbsorptionResult>;
  bubblesEnabled: boolean;
  bubbleThreshold: number;
  bubbleThresholdMode: 'absolute' | 'relative';
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
  isDrawMode: boolean;
  customProfileRange: {
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null;
  customProfileLocked: boolean;
  isProfileSelected: boolean;
  drawnLines: PanelState['drawnLines'];
  lineDrawMode: PanelState['lineDrawMode'];
  exhaustionEnabled: boolean;
  exhaustionMinScore: number;
  exhaustionSide: ExhaustionSide;
  exhaustionShowProvisional: boolean;
  exhaustionMap: Map<number, ExhaustionResult>;
  icebergEnabled: boolean;
  icebergMinScore: number;
  icebergLookback: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  icebergLevels: IcebergLevel[];
  profileWidthPct: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileShowDelta: boolean;
  deltaProfileWidth: number;
  measureToolActive: boolean;
  activeMeasurement: Measurement | null;
  sessionsEnabled: boolean;
  sessions: PanelState['sessions'];
  liquidityZones: PanelState['liquidityZones'];
  liquidityEnabled: boolean;
  liquidityOpacity: number;
  liquidityBucketSize: number;
  liquidityHistory: LiquidityHistoryManager | null;
  liquidityHeatmapEnabled: boolean;
  liquidityHeatmapOpacity: number;
  liquidityHeatmapAgeFade: number;
  liquidityHeatmapWidth: number;
  liquidityHeatmapShowPulled: boolean;
  liquidityHeatmapShowConsumed: boolean;
  liquidityHeatmapShowPersistence: boolean;
  liquidityHeatmapShowCurrentLabel: boolean;
  liquidityHeatmapProfileSync: boolean;
  onBarWidthChange: (v: number) => void;
  onScrollOffsetChange: (v: number) => void;
}

export function ChartCanvas({
  panelId,
  candles,
  chartMode,
  footprintMode,
  bucketSize,
  barWidth: barWidthProp,
  scrollOffset: scrollOffsetProp,
  timeframe,
  footprintTrigger,
  isLoadingHistory,
  engine,
  absorptionEnabled,
  absorptionMinScore,
  absorptionSide,
  absorptionShowLabels,
  absorptionMap,
  bubblesEnabled,
  bubbleThreshold,
  bubbleThresholdMode,
  bubbleMinRadius,
  bubbleMaxRadius,
  bubbleSide,
  isDrawMode,
  customProfileRange,
  customProfileLocked,
  isProfileSelected,
  drawnLines,
  lineDrawMode,
  exhaustionEnabled,
  exhaustionMinScore,
  exhaustionSide,
  exhaustionShowProvisional,
  exhaustionMap,
  icebergEnabled,
  icebergMinScore,
  icebergLookback,
  icebergShowSuspected,
  icebergShowLabels,
  icebergShowTint,
  icebergLevels,
  profileWidthPct,
  profileOpacity,
  profileMinRowWidth,
  profileScaleMode,
  profileShowPocHighlight,
  profileShowVaFill,
  profileShowPocLine,
  profileShowVaLines,
  profileShowDelta,
  deltaProfileWidth,
  measureToolActive,
  activeMeasurement,
  sessionsEnabled,
  sessions,
  liquidityZones,
  liquidityEnabled,
  liquidityOpacity,
  liquidityBucketSize,
  liquidityHistory,
  liquidityHeatmapEnabled,
  liquidityHeatmapOpacity,
  liquidityHeatmapAgeFade,
  liquidityHeatmapWidth,
  liquidityHeatmapShowPulled,
  liquidityHeatmapShowConsumed,
  liquidityHeatmapShowPersistence,
  liquidityHeatmapShowCurrentLabel,
  liquidityHeatmapProfileSync,
  onBarWidthChange,
  onScrollOffsetChange,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isRedrawScheduled = useRef(false);

  // Drawing refs
  const dragStart = useRef<{ x: number, y: number } | null>(null);
  const dragEnd = useRef<{ x: number, y: number } | null>(null);
  const isDragging = useRef(false);
  const isHoveringClear = useRef(false);
  const isHoveringLock = useRef(false);
  const hoverZone = useRef<'move' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom' | null>(null);
  const dragAnchor = useRef<{ x: number, y: number } | null>(null);
  const profileSnapshot = useRef<PanelState['customProfileRange']>(null);
  const isDraggingProfile = useRef(false);
  const isDraggingResize = useRef(false);
  const resizeEdge = useRef<'left' | 'right' | 'top' | 'bottom' | null>(null);

  const hoveredLineId = useRef<string | null>(null);
  const isHoveringDeleteDot = useRef(false);
  
  const coordsRef = useRef<CoordinateSystem | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  const [hoveredAbs, setHoveredAbs] = React.useState<{ result: AbsorptionResult, x: number, y: number } | null>(null);
  const [hoveredExhaustion, setHoveredExhaustion] = React.useState<{ result: ExhaustionResult, x: number, y: number } | null>(null);
  const [hoveredIceberg, setHoveredIceberg] = React.useState<{ level: IcebergLevel, x: number, y: number } | null>(null);

  const getCandlesLength = useCallback(() => candles.length, [candles]);

  const priceAxisWidth = 85;
  const timeAxisHeight = 24;
  const baseProfileWidth = 120;
  
  let profileWidth = baseProfileWidth;
  if (liquidityHeatmapEnabled) {
    profileWidth += liquidityHeatmapWidth;
  }

  const redraw = useCallback(() => {
    if (isRedrawScheduled.current) return;

    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const container = containerRef.current;
      if (!canvas || !ctx || !container) return;

      const logicalWidth = widthRef.current;
      const logicalHeight = heightRef.current;

      const chartWidth = logicalWidth - priceAxisWidth;
      const chartHeight = logicalHeight - timeAxisHeight;

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      if (isLoadingHistory) {
        ctx.font = '500 14px "JetBrains Mono"';
        ctx.fillStyle = '#4A4A4A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Loading history...', chartWidth / 2, chartHeight / 2);
        return;
      }

      if (candles.length === 0) return;

      const currentScrollOffset = scrollOffset.current;
      const currentBarWidth = barWidth.current;

      const { firstIndex, lastIndex, rawFirstIndex, rawLastIndex } = getVisibleRange(candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);

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

      // Track coordinates for metric calculation
      coordsRef.current = {
        visiblePriceMin: priceMin,
        visiblePriceMax: priceMax,
      };

      const profileBucketSize = Math.max(5, Math.floor(bucketSize / 4));

      const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
      const indexToX = (index: number) => calcIndexToX(index, candles.length, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);

      drawLines(ctx, drawnLines, indexToX, priceToY, logicalWidth, logicalHeight, timeAxisHeight, priceAxisWidth, hoveredLineId.current, isHoveringDeleteDot.current);

      drawGrid(ctx, priceMin, priceMax, priceToY, indexToX, rawFirstIndex, rawLastIndex, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);

      // Session boxes - drawn behind everything
      drawSessions(
        ctx,
        candles,
        { firstIndex, lastIndex },
        indexToX,
        currentBarWidth,
        logicalHeight,
        timeAxisHeight,
        sessions,
        sessionsEnabled
      );

      // Liquidity zones - drawn between grid and sessions/candles
      if (liquidityEnabled && liquidityZones.length > 0) {
        const lastCandlePrice = candles.length > 0 ? candles[candles.length - 1].close : null;
        drawLiquidity(
          ctx,
          liquidityZones,
          priceToY,
          logicalWidth,
          logicalHeight,
          priceAxisWidth,
          profileWidth,
          liquidityOpacity,
          liquidityBucketSize,
          timeAxisHeight,
          priceMin,
          priceMax,
          lastCandlePrice
        );
      }

      // Selection Rectangle (drawn below candles)
      drawSelectionRect(
        ctx,
        dragStart.current,
        dragEnd.current,
        customProfileRange,
        (idx) => indexToX(idx),
        (p) => priceToY(p),
        currentBarWidth
      );

      if (chartMode === 'candle') {
        drawCandles(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth);
      } else {
        drawFootprint(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, engine, bucketSize, logicalHeight, footprintMode);
      }

      // Volume bubbles — drawn above candles/footprint, below volume profile
      if (bubblesEnabled) {
        drawBubbles(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, bucketSize, engine, currentBarWidth, {
          bubbleThreshold,
          bubbleThresholdMode,
          bubbleMinRadius,
          bubbleMaxRadius,
          bubbleSide,
        });
      }

      // 5. Absorption markers
      if (absorptionEnabled && absorptionMap.size > 0) {
        drawAbsorption(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, absorptionMap, absorptionShowLabels, absorptionMinScore, absorptionSide, timeframe);
      }

      // 5b. Exhaustion markers
      if (exhaustionEnabled && exhaustionMap.size > 0) {
        drawExhaustion(ctx, candles, { firstIndex, lastIndex }, indexToX, priceToY, currentBarWidth, exhaustionMap, { exhaustionMinScore, exhaustionSide, exhaustionShowProvisional, timeframe });
      }

      // 5c. Iceberg level markers
      if (icebergEnabled && icebergLevels.length > 0) {
        drawIceberg(ctx, icebergLevels, candles, indexToX, priceToY, currentBarWidth, bucketSize, {
          icebergMinScore,
          icebergShowSuspected,
          icebergShowLabels,
          icebergShowTint,
          icebergLookback,
          absorptionMap,
        });
      }

      // 6. Custom Profile (on top of candles and other overlays)
      if (customProfileRange) {
        const customCandles = candles.slice(customProfileRange.firstIndex, customProfileRange.lastIndex + 1);
        const customProfile = buildProfile(
          customCandles, 
          engine, 
          bucketSize, 
          profileBucketSize, 
          customProfileRange.priceHigh, 
          customProfileRange.priceLow
        );
        drawCustomProfile(
          ctx,
          customProfileRange,
          customProfile,
          indexToX,
          priceToY,
          currentBarWidth,
          bucketSize,
          hoverZone.current !== null,
          customProfileLocked,
          isProfileSelected,
          profileScaleMode,
          profileBucketSize,
          profileWidthPct,
          profileOpacity,
          profileMinRowWidth,
          profileShowPocHighlight,
          profileShowVaFill,
          profileShowPocLine,
          profileShowVaLines
        );

        if (profileShowDelta && customProfile) {
          const customX1 = indexToX(customProfileRange.firstIndex) - currentBarWidth / 2;
          const customX2 = indexToX(customProfileRange.lastIndex) + currentBarWidth / 2;
          const customRectX = Math.min(customX1, customX2);

          drawDeltaProfile(
            ctx,
            customProfile,
            priceToY,
            customRectX,
            deltaProfileWidth,
            profileBucketSize,
            profileOpacity,
            profileMinRowWidth,
            profileScaleMode
          );
        }
      }

      const lastCandle = candles[candles.length - 1];
      const isScrolled = candles.length > 0 && (candles.length - lastIndex) > 50;

      let heatmapRows: HeatmapRow[] | undefined = undefined;
      if (liquidityHeatmapEnabled && liquidityHistory) {
        heatmapRows = buildHeatmapRows(liquidityHistory, priceMin, priceMax, liquidityBucketSize, lastCandle?.close || 0);
      }

      // Volume Profile
      const visibleCandles = candles.slice(firstIndex, lastIndex + 1);
      const profile = buildProfile(visibleCandles, engine, bucketSize, profileBucketSize);
      if (profile) {
        drawVolumeProfile(
          ctx, 
          profile, 
          priceToY, 
          logicalWidth, 
          baseProfileWidth, 
          priceAxisWidth, 
          bucketSize, 
          !!customProfileRange,
          profileWidthPct,
          profileOpacity,
          profileMinRowWidth,
          profileBucketSize,
          profileScaleMode,
          profileShowPocHighlight,
          profileShowVaFill,
          profileShowPocLine,
          profileShowVaLines,
          liquidityHeatmapProfileSync ? heatmapRows : undefined
        );
      }
      
      // Measurement Rect (on top of profiles, below axes)
      if (activeMeasurement) {
        drawMeasurementRect(ctx, activeMeasurement, currentBarWidth);
      } else if (measureToolActive && isDragging.current && dragStart.current && dragEnd.current) {
        // Live measurement rendering during drag
        drawMeasurementRect(ctx, {
          startX: dragStart.current.x,
          startY: dragStart.current.y,
          endX: dragEnd.current.x,
          endY: dragEnd.current.y,
          live: true,
          metrics: null,
          footprintMetrics: null
        }, currentBarWidth);
      }

      drawPriceAxis(ctx, priceMin, priceMax, priceToY, logicalWidth, logicalHeight, priceAxisWidth);
      drawTimeAxis(ctx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);

      if (heatmapRows && liquidityHistory) {
        // The heatmap strip is drawn right before the volume profile
        const stripX = chartWidth - profileWidth; // start of reserved space (heatmap comes first from the left)
        drawLiquidityHeatmap(ctx, heatmapRows, priceToY, stripX, liquidityHeatmapWidth, liquidityBucketSize, {
          heatmapOpacity: liquidityHeatmapOpacity,
          ageFadeFactor: liquidityHeatmapAgeFade,
          showPulled: liquidityHeatmapShowPulled,
          showConsumed: liquidityHeatmapShowConsumed,
          showPersistence: liquidityHeatmapShowPersistence,
          totalSnapshots: liquidityHistory.getHistory().length,
          currentPrice: lastCandle?.close || 0,
          isScrolled,
          showCurrentLabel: liquidityHeatmapShowCurrentLabel,
          canvasHeight: chartHeight
        });
      }

      if (lastCandle) {
        drawPriceLine(ctx, lastCandle, priceToY, chartWidth, priceAxisWidth, logicalWidth, timeframe);
      }

      // Draw Crosshair
      const crosshair = useChartStore.getState().crosshair;
      const crosshairSyncEnabled = useChartStore.getState().crosshairSyncEnabled;
      let mx: number | null = null;
      let my: number | null = null;

      if (isMouseOver.current && mouseX.current !== null && mouseY.current !== null) {
        mx = mouseX.current;
        my = mouseY.current;
      } else if (crosshairSyncEnabled && crosshair.activePanel && crosshair.activePanel !== panelId) {
        if (crosshair.time !== null) {
          const syncedIndex = timeToIndex(crosshair.time, candles);
          mx = indexToX(syncedIndex);
        }
        if (crosshair.price !== null) {
          my = priceToY(crosshair.price);
        }
      }

      if (mx !== null || my !== null) {
        drawCrosshair(ctx, mx, my, chartWidth, chartHeight);

        // Price Label
        if (my !== null && my >= 0 && my <= chartHeight) {
          const price = yToPrice(my, priceMin, priceMax, chartHeight);
          const step = calculatePriceStep(priceMax - priceMin, chartHeight);
          const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
          drawCrosshairPriceLabel(ctx, my, price, chartWidth, priceAxisWidth, chartHeight, precision);
        }

        // Time Label
        if (mx !== null && mx >= 0 && mx <= chartWidth) {
          const index = xToIndex(mx, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
          let time = 0;
          if (candles[index]) {
            time = candles[index].time;
          } else if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            const firstCandle = candles[0];
            const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
            time = lastCandle.time + (index - (candles.length - 1)) * avgInterval;
          }
          drawCrosshairTimeLabel(ctx, mx, time, chartHeight, timeAxisHeight, chartWidth);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartMode, footprintMode, bucketSize, footprintTrigger, engine, isLoadingHistory, timeframe, absorptionEnabled, absorptionMinScore, absorptionSide, absorptionShowLabels, absorptionMap, exhaustionEnabled, exhaustionMinScore, exhaustionSide, exhaustionShowProvisional, exhaustionMap, icebergEnabled, icebergMinScore, icebergLookback, icebergShowSuspected, icebergShowLabels, icebergShowTint, icebergLevels, bubblesEnabled, bubbleThreshold, bubbleMinRadius, bubbleMaxRadius, bubbleSide, isDrawMode, customProfileRange, customProfileLocked, isProfileSelected, drawnLines, lineDrawMode, profileWidthPct, profileOpacity, profileMinRowWidth, profileScaleMode, profileShowPocHighlight, profileShowVaFill, profileShowPocLine, profileShowVaLines, profileShowDelta, deltaProfileWidth, measureToolActive, activeMeasurement, sessionsEnabled, sessions, liquidityZones, liquidityEnabled, liquidityOpacity, liquidityBucketSize, liquidityHistory, liquidityHeatmapEnabled, liquidityHeatmapOpacity, liquidityHeatmapAgeFade, liquidityHeatmapWidth, liquidityHeatmapShowPulled, liquidityHeatmapShowConsumed, liquidityHeatmapShowPersistence, liquidityHeatmapShowCurrentLabel, liquidityHeatmapProfileSync]);

  const scrollOffset = useRef(scrollOffsetProp);
  const barWidth = useRef(barWidthProp);
  const priceCenter = useRef<number | null>(null);
  const priceRange = useRef<number | null>(null);

  const { 
    mouseX, 
    mouseY, 
    isMouseOver,
    isDragging: isPanZoomDragging,
    dragMode: panZoomDragMode
  } = usePanZoom(
    canvasRef,
    redraw,
    getCandlesLength,
    priceAxisWidth,
    timeAxisHeight,
    profileWidth,
    barWidthProp,
    scrollOffsetProp,
    onBarWidthChange,
    onScrollOffsetChange,
    isDrawMode,
    measureToolActive,
    () => {
      // Prevent chart panning if we are over a custom profile or its buttons, or a line
      if (isHoveringClear.current || isHoveringLock.current || hoverZone.current || hoveredLineId.current) {
        return false;
      }
      return true;
    },
    // Crosshair Sync Handler
    useCallback((x: number | null, y: number | null) => {
      if (x === null || y === null) {
        useChartStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const chartWidth = canvas.clientWidth - priceAxisWidth;
      const chartHeight = canvas.clientHeight - timeAxisHeight;

      // Only update store if within chart area
      if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) {
        return;
      }

      const pCenter = priceCenter.current ?? 0;
      const pRange = priceRange.current ?? 100;
      const priceMin = pCenter - pRange / 2;
      const priceMax = pCenter + pRange / 2;

      const price = yToPrice(y, priceMin, priceMax, chartHeight);
      const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
      
      let time = null;
      if (candles[index]) {
        time = candles[index].time;
      } else if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const firstCandle = candles[0];
        const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
        time = lastCandle.time + (index - (candles.length - 1)) * avgInterval;
      }

      const syncEnabled = useChartStore.getState().crosshairSyncEnabled;
      if (syncEnabled) {
        useChartStore.getState().setCrosshair({ activePanel: panelId, time, price });
      }
    }, [panelId, candles, priceAxisWidth, timeAxisHeight, profileWidth]),
    { scrollOffset, barWidth, priceCenter, priceRange }
  );

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  // Subscribe to crosshair changes for sync rendering
  useEffect(() => {
    // Only subscribe if we are not the active panel (active panel redraws via mousemove)
    return useChartStore.subscribe((state, prevState) => {
      if (!state.crosshairSyncEnabled) {
        // If sync was just disabled, trigger a final redraw to clear synced lines
        if (prevState.crosshairSyncEnabled) {
          redrawRef.current();
        }
        return;
      }

      if (state.crosshair.activePanel === panelId) return;

      if (
        state.crosshair.time !== prevState.crosshair.time ||
        state.crosshair.price !== prevState.crosshair.price ||
        state.crosshair.activePanel !== prevState.crosshair.activePanel ||
        state.crosshairSyncEnabled !== prevState.crosshairSyncEnabled
      ) {
        redrawRef.current();
      }
    });
  }, [panelId]);

  // Initial setup and resize handler
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

    // Initial setup with current bounds
    const rect = container.getBoundingClientRect();
    setupCanvas(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        setContainerSize({ width: w, height: h });
        setupCanvas(w, h);
      }
    });

    observer.observe(container);

    // Listen for devicePixelRatio changes (zoom or monitor change)
    let dprMedia: MediaQueryList | null = null;
    const onDprChange = () => {
      const r = container.getBoundingClientRect();
      setupCanvas(r.width, r.height);
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

  // Redraw when data changes
  useEffect(() => {
    redraw();
  }, [candles, chartMode, footprintMode, bucketSize, footprintTrigger, redraw, isLoadingHistory, drawnLines, lineDrawMode]);

  // Real-time countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      redraw();
    }, 1000);
    return () => clearInterval(timer);
  }, [redraw]);

  // Controls overlay positioning
  const customProfileControls = useMemo(() => {
    if (!customProfileRange || containerSize.width === 0) return null;

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = containerSize.height - timeAxisHeight;

    const pCenter = priceCenter.current ?? 0;
    const pRange = priceRange.current ?? 100;
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;

    const { lastIndex, priceHigh } = customProfileRange;
    const x2 = calcIndexToX(lastIndex, candles.length, scrollOffsetProp, barWidthProp, chartWidth, profileWidth);
    const y1 = calcPriceToY(priceHigh, priceMin, priceMax, chartHeight);

    return {
      top: y1 - 32, // Move outside/above the profile box
      left: x2 + barWidthProp / 2 - 40,
    };
  }, [customProfileRange, containerSize, candles.length, priceAxisWidth, timeAxisHeight, profileWidth, scrollOffsetProp, barWidthProp, priceCenter, priceRange]);

  // Drawing Interaction Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 0. Line Drawing and Deletion
      if (hoveredLineId.current && isHoveringDeleteDot.current) {
        useChartStore.getState().removeLine(panelId, hoveredLineId.current);
        hoveredLineId.current = null;
        isHoveringDeleteDot.current = false;
        redraw();
        return;
      }

      if (lineDrawMode !== 'none') {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = rect.height - timeAxisHeight;
        if (x > chartWidth || y > chartHeight) return;

        if (lineDrawMode === 'horizontal') {
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'horizontal', value: price });
        } else if (lineDrawMode === 'vertical') {
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'vertical', value: index });
        }
        useChartStore.getState().setLineDrawMode(panelId, 'none');
        redraw();
        return;
      }

      // Interaction Priority:
      // 1. Draw mode / Measurement tool
      if (isDrawMode || measureToolActive) {
        // Only start if within chart area
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = rect.height - timeAxisHeight;
        if (x > chartWidth || y > chartHeight) {
          return;
        }
        dragStart.current = { x, y };
        dragEnd.current = { x, y }; // Initialize end at start
        isDragging.current = true;
        
        if (isDrawMode) {
          useChartStore.getState().setCustomProfileRange(panelId, null);
        } else {
          useChartStore.getState().setActiveMeasurement(panelId, null);
        }
        return;
      }

      // Interaction with React overlay buttons is handled by React DOM events
      // No manual hit detection needed for Clear/Lock here anymore.

      // 4. Move/Resize Profile
      if (hoverZone.current && !useChartStore.getState().panels[panelId].customProfileLocked) {
        dragAnchor.current = { x, y };
        profileSnapshot.current = useChartStore.getState().panels[panelId].customProfileRange;

        if (hoverZone.current === 'move') {
          isDraggingProfile.current = true;
        } else {
          isDraggingResize.current = true;
          resizeEdge.current = hoverZone.current.replace('resize-', '') as 'left' | 'right' | 'top' | 'bottom';
        }
        useChartStore.getState().setProfileSelected(panelId, true);
        return;
      }

      // 5. Select Profile (if clicked inside while locked)
      if (hoverZone.current) {
        useChartStore.getState().setProfileSelected(panelId, true);
        redraw();
        return;
      }

      // 6. Click outside -> deselect profile
      useChartStore.getState().setProfileSelected(panelId, false);
      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Centralized Cursor Logic
      let cursor = 'crosshair';

      if (lineDrawMode !== 'none') {
        cursor = 'crosshair';
      } else if (measureToolActive) {
        cursor = 'crosshair';
      } else if (isDragging.current || isDrawMode) {
        cursor = 'crosshair';
      } else if (isDraggingProfile.current) {
        cursor = 'grabbing';
      } else if (isDraggingResize.current) {
        cursor = (resizeEdge.current === 'left' || resizeEdge.current === 'right') ? 'ew-resize' : 'ns-resize';
      } else if (isPanZoomDragging.current) {
        if (panZoomDragMode.current === 'price') cursor = 'ns-resize';
        else if (panZoomDragMode.current === 'time') cursor = 'ew-resize';
        else cursor = 'grabbing';
      } else if (lineDrawMode === 'none') {
        // Hover Detection
        hoverZone.current = null;
        const hoveringAction = false; 

        if (!hoveringAction) {
          if (customProfileRange) {
            const chartWidth = rect.width - priceAxisWidth;
            const chartHeight = rect.height - timeAxisHeight;
            const pCenter = priceCenter.current ?? 0;
            const pRange = priceRange.current ?? 100;
            const priceMin = pCenter - pRange / 2;
            const priceMax = pCenter + pRange / 2;

            const rx1 = calcIndexToX(customProfileRange.firstIndex, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth) - barWidth.current / 2;
            const rx2 = calcIndexToX(customProfileRange.lastIndex, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth) + barWidth.current / 2;
            const ry1 = calcPriceToY(customProfileRange.priceHigh, priceMin, priceMax, chartHeight);
            const ry2 = calcPriceToY(customProfileRange.priceLow, priceMin, priceMax, chartHeight);

            const minX = Math.min(rx1, rx2);
            const maxX = Math.max(rx1, rx2);
            const minY = Math.min(ry1, ry2);
            const maxY = Math.max(ry1, ry2);

            if (x >= minX - 6 && x <= maxX + 6 && y >= minY - 6 && y <= maxY + 6) {
              const isLocked = useChartStore.getState().panels[panelId].customProfileLocked;
              if (isLocked) {
                hoverZone.current = 'move';
                cursor = 'crosshair';
              } else {
                if (Math.abs(x - minX) < 6) hoverZone.current = 'resize-left';
                else if (Math.abs(x - maxX) < 6) hoverZone.current = 'resize-right';
                else if (Math.abs(y - minY) < 6) hoverZone.current = 'resize-top';
                else if (Math.abs(y - maxY) < 6) hoverZone.current = 'resize-bottom';
                else hoverZone.current = 'move';

                if (hoverZone.current === 'move') cursor = 'grab';
                else if (hoverZone.current.includes('left') || hoverZone.current.includes('right')) cursor = 'ew-resize';
                else cursor = 'ns-resize';
              }
            } else {
              // Check Axes
              if (x > rect.width - priceAxisWidth) cursor = 'ns-resize';
              else if (y > rect.height - timeAxisHeight) cursor = 'ew-resize';
              else cursor = 'crosshair';
            }
          }

          // Line Hover Detection
          hoveredLineId.current = null;
          isHoveringDeleteDot.current = false;

          if (!hoveringAction) {
            const chartWidth = rect.width - priceAxisWidth;
            const chartHeight = rect.height - timeAxisHeight;
            const pCenter = priceCenter.current ?? 0;
            const pRange = priceRange.current ?? 100;
            const priceMin = pCenter - pRange / 2;
            const priceMax = pCenter + pRange / 2;

            const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);
            const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

            for (const line of drawnLines) {
              if (line.type === 'horizontal') {
                const ly = priceToY(line.value);
                if (Math.abs(y - ly) < 6 && x <= chartWidth) {
                  hoveredLineId.current = line.id;
                  cursor = 'pointer';
                  // Check delete dot
                  const dotX = chartWidth - 6;
                  if (Math.abs(x - dotX) < 8 && Math.abs(y - ly) < 8) {
                    isHoveringDeleteDot.current = true;
                  }
                  break;
                }
              } else {
                const lx = indexToX(line.value);
                if (lx !== null && Math.abs(x - lx) < 6 && y <= chartHeight) {
                  hoveredLineId.current = line.id;
                  cursor = 'pointer';
                  // Check delete dot
                  const dotY = 10;
                  if (Math.abs(x - lx) < 8 && Math.abs(y - dotY) < 8) {
                    isHoveringDeleteDot.current = true;
                  }
                  break;
                }
              }
            }
          }

          if (!hoveredLineId.current && !hoveringAction) {
            // Check Axes
            if (x > rect.width - priceAxisWidth) cursor = 'ns-resize';
            else if (y > rect.height - timeAxisHeight) cursor = 'ew-resize';
            else cursor = 'crosshair';
          }
        }

        // Absorption Hover Detection
        let foundAbs = false;
        if (absorptionEnabled && absorptionMap.size > 0) {
          const chartWidth = rect.width - priceAxisWidth;
          const chartHeight = rect.height - timeAxisHeight;
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;

          const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);
          const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

          const { firstIndex, lastIndex } = getVisibleRange(candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

          for (let i = firstIndex; i <= lastIndex && i < candles.length; i++) {
            const candle = candles[i];
            const result = absorptionMap.get(candle.time);
            if (!result || result.score < absorptionMinScore) continue;
            if (absorptionSide !== 'both' && result.direction !== absorptionSide) continue;

            const ax = indexToX(i);
            const radius = result.rank === 'extreme' ? 11 : result.rank === 'strong' ? 8 : 5;
            let ay: number;
            if (result.direction === 'seller') {
              ay = priceToY(candle.low) + 8 + radius;
            } else {
              ay = priceToY(candle.high) - 8 - radius;
            }

            const dist = Math.sqrt((x - ax) ** 2 + (y - ay) ** 2);
            if (dist < radius + 5) {
              setHoveredAbs({ result, x: ax, y: ay });
              cursor = 'help';
              foundAbs = true;
              break;
            }
          }
        }
        if (!foundAbs) {
          setHoveredAbs(null);

          // Exhaustion Hover Detection
          let foundEx = false;
          if (exhaustionEnabled && exhaustionMap.size > 0) {
            const chartWidth = rect.width - priceAxisWidth;
            const chartHeight = rect.height - timeAxisHeight;
            const pCenter = priceCenter.current ?? 0;
            const pRange = priceRange.current ?? 100;
            const priceMin = pCenter - pRange / 2;
            const priceMax = pCenter + pRange / 2;

            const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);
            const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

            const { firstIndex, lastIndex } = getVisibleRange(candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

            for (let i = firstIndex; i <= lastIndex && i < candles.length; i++) {
              const candle = candles[i];
              const result = exhaustionMap.get(candle.time);
              if (!result || result.score < exhaustionMinScore) continue;
              if (exhaustionSide !== 'both' && result.direction !== exhaustionSide) continue;
              if (result.provisional && !exhaustionShowProvisional) continue;

              const ex = indexToX(i);
              if (ex === null) continue;

              const isBuyer = result.direction === 'buyer';
              const rankOffset = result.rank === 'extreme' ? 5 : result.rank === 'strong' ? 4 : result.rank === 'moderate' ? 3 : 2;
              const ey = isBuyer 
                ? priceToY(candle.high) - 6 - rankOffset
                : priceToY(candle.low) + 6 + rankOffset;

              const dist = Math.sqrt((x - ex) ** 2 + (y - ey) ** 2);
              if (dist < 14) {
                setHoveredExhaustion({ result, x: ex, y: ey });
                cursor = 'help';
                foundEx = true;
                break;
              }
            }
          }
          if (!foundEx) {
            setHoveredExhaustion(null);

            // Iceberg Hover Detection
            let foundIceberg = false;
            if (icebergEnabled && icebergLevels.length > 0) {
              const chartWidth = rect.width - priceAxisWidth;
              const chartHeight = rect.height - timeAxisHeight;
              const pCenter = priceCenter.current ?? 0;
              const pRange = priceRange.current ?? 100;
              const priceMin = pCenter - pRange / 2;
              const priceMax = pCenter + pRange / 2;

              const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);
              const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

              for (const level of icebergLevels) {
                if (level.score < icebergMinScore) continue;
                if (!icebergShowSuspected && level.rank === 'suspected') continue;

                const end = Number.isFinite(level.windowEndIndex) ? level.windowEndIndex : candles.length - 1;
                const start = Number.isFinite(level.windowStartIndex)
                  ? level.windowStartIndex
                  : Math.max(0, end - icebergLookback + 1);
                const x1 = indexToX(Math.max(0, Math.min(candles.length - 1, start)));
                const x2 = indexToX(Math.max(0, Math.min(candles.length - 1, end)));
                if (x1 === null || x2 === null) continue;

                const minX = Math.min(x1, x2) - barWidth.current / 2;
                const maxX = Math.max(x1, x2) + barWidth.current / 2;
                const iy = priceToY(level.price + bucketSize / 2);

                if (x >= minX && x <= maxX && Math.abs(y - iy) <= 8) {
                  setHoveredIceberg({ level, x: Math.min(maxX, x + 8), y: iy });
                  cursor = 'help';
                  foundIceberg = true;
                  break;
                }
              }
            }
            if (!foundIceberg) setHoveredIceberg(null);
          } else {
            setHoveredIceberg(null);
          }
        } else {
          setHoveredExhaustion(null);
          setHoveredIceberg(null);
        }
      }

      canvas.style.cursor = cursor;
      redraw();

      // Drag Logic
      if (isDragging.current && (isDrawMode || measureToolActive)) {
        dragEnd.current = { x, y };
        redraw();
      } else if (isDraggingProfile.current && dragAnchor.current && profileSnapshot.current) {
        const deltaX = x - dragAnchor.current.x;

        const currentBarWidth = barWidth.current;
        const indexDelta = Math.round(deltaX / currentBarWidth);

        const chartHeight = rect.height - timeAxisHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;

        const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
        const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
        const priceDelta = priceAtCurrent - priceAtAnchor;

        const newRange = {
          firstIndex: Math.max(0, Math.min(candles.length - 1, profileSnapshot.current.firstIndex + indexDelta)),
          lastIndex: Math.max(0, Math.min(candles.length - 1, profileSnapshot.current.lastIndex + indexDelta)),
          priceHigh: profileSnapshot.current.priceHigh + priceDelta,
          priceLow: profileSnapshot.current.priceLow + priceDelta,
        };

        useChartStore.getState().setCustomProfileRange(panelId, newRange);
        redraw();
      } else if (isDraggingResize.current && dragAnchor.current && profileSnapshot.current) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = rect.height - timeAxisHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;

        const updatedRange = { ...profileSnapshot.current };

        if (resizeEdge.current === 'left' || resizeEdge.current === 'right') {
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          if (resizeEdge.current === 'left') updatedRange.firstIndex = index;
          else updatedRange.lastIndex = index;
        } else {
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          if (resizeEdge.current === 'top') updatedRange.priceHigh = price;
          else updatedRange.priceLow = price;
        }

        const bucketSizeVal = useChartStore.getState().panels[panelId].bucketSize;
        // Enforce min size
        if (Math.abs(updatedRange.lastIndex - updatedRange.firstIndex) >= 2 &&
          Math.abs(updatedRange.priceHigh - updatedRange.priceLow) >= bucketSizeVal) {
          useChartStore.getState().setCustomProfileRange(panelId, updatedRange);
          redraw();
        }
      }
    };

    const onMouseUp = () => {
      if (!isDragging.current && !isDraggingProfile.current && !isDraggingResize.current) return;

      if (isDragging.current && measureToolActive && dragStart.current && dragEnd.current) {
        isDragging.current = false;
        const dist = Math.sqrt((dragEnd.current.x - dragStart.current.x)**2 + (dragEnd.current.y - dragStart.current.y)**2);
        if (dist < 4) {
          useChartStore.getState().setActiveMeasurement(panelId, null);
        } else {
          let metrics = null;
          if (coordsRef.current && candles.length > 0) {
            metrics = computeMeasurementMetrics(
              dragStart.current.x, dragStart.current.y,
              dragEnd.current.x, dragEnd.current.y,
              candles,
              coordsRef.current,
              timeframe,
              widthRef.current,
              heightRef.current,
              scrollOffset.current,
              barWidth.current,
              profileWidth,
              timeAxisHeight
            );
          }

          let footprintMetrics = null;
          if (metrics && chartMode === 'footprint' && engine) {
            footprintMetrics = computeFootprintMetrics(metrics, candles, engine);
          }

          useChartStore.getState().setActiveMeasurement(panelId, {
            startX: dragStart.current.x,
            startY: dragStart.current.y,
            endX: dragEnd.current.x,
            endY: dragEnd.current.y,
            live: false,
            metrics,
            footprintMetrics
          });
        }
        dragStart.current = null;
        dragEnd.current = null;
        redraw();
        return;
      }

      if (isDraggingProfile.current || isDraggingResize.current) {
        isDraggingProfile.current = false;
        isDraggingResize.current = false;
        dragAnchor.current = null;
        profileSnapshot.current = null;
        resizeEdge.current = null;
        redraw();
        return;
      }

      if (isDragging.current && isDrawMode && dragStart.current && dragEnd.current) {
        isDragging.current = false;

        const rect = canvas.getBoundingClientRect();
        const chartWidth = rect.width - priceAxisWidth;
        const currentBarWidth = barWidth.current;
        const currentScrollOffset = scrollOffset.current;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const chartHeight = rect.height - timeAxisHeight;

        const idx1 = xToIndex(dragStart.current.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
        const idx2 = xToIndex(dragEnd.current.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
        const p1 = yToPrice(dragStart.current.y, priceMin, priceMax, chartHeight);
        const p2 = yToPrice(dragEnd.current.y, priceMin, priceMax, chartHeight);

        const firstIndex = Math.min(idx1, idx2);
        const lastIndex = Math.max(idx1, idx2);
        const priceHigh = Math.max(p1, p2);
        const priceLow = Math.min(p1, p2);

        const widthPx = Math.abs(dragEnd.current.x - dragStart.current.x);
        const heightPx = Math.abs(dragEnd.current.y - dragStart.current.y);

        if (widthPx >= 5 || heightPx >= 5) {
          useChartStore.getState().setCustomProfileRange(panelId, {
            firstIndex,
            lastIndex,
            priceHigh,
            priceLow
          });
          // Auto-exit draw mode after first draw
          useChartStore.getState().setDrawMode(panelId, false);
        } else {
          // If user clicks without dragging while in draw mode
          useChartStore.getState().setCustomProfileRange(panelId, null);
          useChartStore.getState().setDrawMode(panelId, false);
        }
      }

      isDragging.current = false;
      dragStart.current = null;
      dragEnd.current = null;
      redraw();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragStart.current = null;
        dragEnd.current = null;
        isDragging.current = false;
        useChartStore.getState().setCustomProfileRange(panelId, null);
        redraw();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawMode, measureToolActive, activeMeasurement, redraw, priceAxisWidth, timeAxisHeight, panelId, lineDrawMode, drawnLines, candles, absorptionEnabled, absorptionMap, absorptionMinScore, absorptionSide, barWidth, customProfileRange, exhaustionEnabled, exhaustionMap, exhaustionMinScore, exhaustionShowProvisional, exhaustionSide, icebergEnabled, icebergLevels, icebergMinScore, icebergShowSuspected, icebergLookback, bucketSize, isPanZoomDragging, panZoomDragMode, priceCenter, priceRange, profileWidth, scrollOffset, chartMode, engine, timeframe]);


  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0D0D0D] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 outline-none"
        tabIndex={0}
      />
      {hoveredAbs && (
        <AbsorptionTooltip 
          result={hoveredAbs.result} 
          x={hoveredAbs.x} 
          y={hoveredAbs.y} 
        />
      )}
      {hoveredExhaustion && (
        <ExhaustionTooltip 
          result={hoveredExhaustion.result} 
          x={hoveredExhaustion.x} 
          y={hoveredExhaustion.y} 
        />
      )}
      {hoveredIceberg && (
        <IcebergTooltip
          level={hoveredIceberg.level}
          x={hoveredIceberg.x}
          y={hoveredIceberg.y}
        />
      )}

      <MeasurementPanel 
        measurement={activeMeasurement}
        canvasRect={canvasRef.current?.getBoundingClientRect() || null}
      />

      {/* Custom Profile Controls Overlay */}
      {customProfileRange && customProfileControls && (
        <div 
          className="absolute flex items-center gap-1 p-1 bg-[#1A1A1A]/90 backdrop-blur-sm border border-[#333] rounded shadow-xl z-20"
          style={{
            top: `${customProfileControls.top}px`,
            left: `${customProfileControls.left}px`,
            transform: 'translateY(-4px)',
          }}
        >
          <button
            onClick={() => {
              useChartStore.getState().setCustomProfileLocked(panelId, !customProfileLocked);
              redraw();
            }}
            className={`p-1.5 hover:bg-[#2A2A2A] rounded-md transition-all ${customProfileLocked ? 'text-[#3D7EFF]' : 'text-gray-400'}`}
            title={customProfileLocked ? "Unlock Profile" : "Lock Profile"}
          >
            {customProfileLocked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
          </button>
          <div className="w-[1px] h-4 bg-[#333] mx-0.5" />
          <button
            onClick={() => {
              useChartStore.getState().setCustomProfileRange(panelId, null);
              redraw();
            }}
            className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-md transition-all"
            title="Remove Profile"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

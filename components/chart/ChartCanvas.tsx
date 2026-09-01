'use client';

// 1. External packages
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';

// 2. Internal packages & stores
import {
  PanelId,
  ChartMode,
  AbsorptionSide,
  BubbleSide,
  useChartStore,
  PanelState,
  ExhaustionSide,
  DrawnLine,
  ContractType,
  DataSourceMode,
  MAX_AGGREGATE_BUBBLE_EVENTS,
} from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';
import { recordVolumeBarsDebug } from '@/lib/debug/marketMetrics';
import { drawDeltaProfile } from '@/lib/draw/drawDeltaProfile';
import { drawIceberg } from '@/lib/draw/drawIceberg';
import { drawLiquidity } from '@/lib/draw/drawLiquidity';
import { drawLiquidityHeatmap } from '@/lib/draw/drawLiquidityHeatmap';
import { drawLiquidityVacuum } from '@/lib/draw/drawLiquidityVacuum';
import { drawMeasurementRect } from '@/lib/draw/drawMeasurement';
import { drawSessions } from '@/lib/draw/drawSessions';
import { buildHeatmapRows } from '@/lib/liquidity/heatmap';
import { LiquidityHistoryManager } from '@/lib/liquidity/history';
import { initCanvas } from '@/lib/utils/canvas';
import { formatPrice, formatVol } from '@/lib/utils/format';
import { computeMeasurementMetrics, computeFootprintMetrics, CoordinateSystem } from '@/lib/utils/measurement';
import type { AggregateBubbleMarketSource, BubbleSizeBy, BubbleScaleMode, BubbleColorMode, BubbleVolumeColorMode, BubbleDisplayMode } from '@/types/bubble';
import type { DrawingHitZone, IndicatorId, VolumeBarsInputData, VolumeProfileType } from '@/types/chart';
import type { ExhaustionResult } from '@/types/exhaustion';
import type { FootprintMode } from '@/types/footprint';
import type { IcebergLevel } from '@/types/iceberg';
import type { HeatmapRow } from '@/types/liquidity';
import type { Order, BracketDragState, PendingModifyOrder, Position, BracketOrder, VirtualPosition } from '@/types/trading';
import type { VolumeProfileSource } from '@/types/volumeProfile';

// 3. Relative component & canvas imports
import { computeBottomPanelsLayout } from './chartBottomPanels';
import { CustomProfileToolbar, DrawingToolbar, ModifyConfirmRow } from './CanvasDrawingToolbar';
import {
  resolveProfileBucketSize,
  resolveIndexFromTimeOrFallback,
  candleTimeAt,
  isPositionDrawing,
  hasPositionGeometry,
  resolveLineForRender,
  resolveCustomProfileRange,
  getCustomProfileTimeBounds,
  isActiveLimitOrder,
  getRemainingOrderQuantity,
  getModifyBlockReason,
} from './chartCanvasUtils';
import {
  getOrderHitZone,
  buildPositionFromRiskDrag,
  getDrawingHitZone,
  getDrawingToolbarAnchor,
  getCustomProfileHitZone,
  getPriceLineHitZone,
} from './chartCanvasHitTest';
import { drawAbsorption } from './drawAbsorption';
import { drawGrid, drawPriceAxis, drawTimeAxis, calculatePriceStep } from './drawAxes';
import { drawAggregateTradeBubbles } from './drawBubbles';
import { drawCandles } from './drawCandles';
import { drawCrosshair, drawCrosshairPriceLabel, drawCrosshairTimeLabel } from './drawCrosshair';
import { drawExhaustion } from './drawExhaustion';
import { drawFootprint } from './drawFootprint';
import { drawDrawingPriceLabels, drawLines } from './drawLines';
import { drawPriceLine } from './drawPriceLine';
import { drawSelectionRect, drawCustomProfile } from './drawSelectionRect';
import { drawStatsGrid } from './drawStatsGrid';
import { drawTradingOverlays, TradingOverlayHitZones } from './drawTradingOverlays';
import { drawVolumeBars } from './drawVolumeBars';
import { drawVolumeProfile } from './drawVolumeProfile';
import { ExhaustionTooltip } from './ExhaustionTooltip';
import { computeHistoricalSessionRanges } from './chartPanelUtils';
import { IcebergTooltip } from './IcebergTooltip';
import { MeasurementPanel } from './MeasurementPanel';
import { usePanZoom } from './usePanZoom';
import { getVisibleRange, getVisiblePriceRange, priceToY as calcPriceToY, indexToX as calcIndexToX, yToPrice, xToIndex, timeToIndex } from './useCoordinates';


interface ChartCanvasProps {
  panelId: PanelId;
  chartMode: ChartMode;
  footprintMode: FootprintMode;
  bucketSize: number;
  barWidth: number;
  scrollOffset: number;
  timeframe: string;
  isLoadingHistory: boolean;
  engine: AggregationEngine;
  volumeProfileEngine: VolumeProfileSource;
  volumeProfileRevision: number;
  tickSize: number;
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  bubblesEnabled: boolean;
  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: 'absolute' | 'relative';
  bubbleMinOrders: number;
  bubbleFilterRender: number;
  bubbleStdDevVal: number;
  bubbleOutStdDevPerc: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode: BubbleScaleMode;
  bubbleColorMode: BubbleColorMode;
  bubbleVolumeColorMode: BubbleVolumeColorMode;
  bubbleDisplayMode: BubbleDisplayMode;
  bubbleBidColor: string;
  bubbleAskColor: string;
  bubbleLineWidth: number;
  bubbleOpacity: number;
  activeChartContractType: ContractType;
  activeDataSourceMode: DataSourceMode;
  tradingSymbol: string;
  tradingContractType: ContractType;
  volumeBarsEnabled: boolean;
  volumeBarsInputData: PanelState['volumeBarsInputData'];
  volumeBarsMarketSource: PanelState['volumeBarsMarketSource'];
  volumeBarsFilterMode: PanelState['volumeBarsFilterMode'];
  volumeBarsMovingAverageLength: number;
  volumeBarsFilterMin: number;
  volumeBarsFilterMax: number;
  volumeBarsColorMode: PanelState['volumeBarsColorMode'];
  volumeBarsOpacity: number;
  volumeBarsHeightPct: number;
  volumeBarsShowValueText: boolean;
  volumeBarsTextSize: number;
  volumeBarsAverageLineEnabled: boolean;
  volumeBarsAverageLength: number;
  isDrawMode: boolean;
  customProfileRange: {
    firstTime?: number;
    lastTime?: number;
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null;
  customProfileLocked: boolean;
  drawnLines: PanelState['drawnLines'];
  lineDrawMode: PanelState['lineDrawMode'];
  exhaustionEnabled: boolean;
  exhaustionMinScore: number;
  exhaustionSide: ExhaustionSide;
  exhaustionShowProvisional: boolean;
  icebergEnabled: boolean;
  icebergMinScore: number;
  icebergLookback: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  liquidityVacuumEnabled: boolean;
  liquidityVacuumMinScore: number;
  liquidityVacuumShowLabels: boolean;
  liquidityVacuumOpacity: number;
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  defaultProfilePeriod: 'visible' | 'latest' | 'composite' | 'periodic';
  profilePeriodValue?: number;
  profilePeriodUnit?: 'minutes' | 'hours' | 'days';
  profileResolutionTicks: number;
  profileMinRowHeight: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileType: VolumeProfileType;
  profileInputData: VolumeBarsInputData;
  profilePocColor?: string;
  profileHvnColor?: string;
  profileLvnColor?: string;
  profilePocWidth?: number;
  profileFilterMin?: number;
  profileFilterMax?: number;
  historicalSessionProfileEnabled: boolean;
  profileNodeSensitivity: number;
  deltaProfileWidth: number;
  sessionsEnabled: boolean;
  sessions: PanelState['sessions'];
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
  activeIndicators?: IndicatorId[];
  statsIndicatorEnabled: boolean;
  statsIndicatorItems: string[];
  globalTimezone?: string;
  globalTimeFormat?: '12h' | '24h';
  showTimeAxis?: boolean;
  onBarWidthChange: (v: number) => void;
  onScrollOffsetChange: (v: number) => void;
}

export function ChartCanvas({
  panelId,
  activeIndicators,
  chartMode,
  footprintMode,
  bucketSize,
  barWidth: barWidthProp,
  scrollOffset: scrollOffsetProp,
  timeframe,
  isLoadingHistory,
  engine,
  volumeProfileEngine,
  volumeProfileRevision,
  tickSize,
  absorptionEnabled,
  absorptionMinScore,
  absorptionSide,
  absorptionShowLabels,
  bubblesEnabled,
  bubbleSizeBy,
  aggregateBubbleMarketSource,
  bubbleThreshold,
  bubbleThresholdMode,
  bubbleMinOrders,
  bubbleFilterRender,
  bubbleStdDevVal,
  bubbleOutStdDevPerc,
  bubbleSide,
  bubbleScaleMode,
  bubbleColorMode,
  bubbleVolumeColorMode,
  bubbleDisplayMode,
  bubbleBidColor,
  bubbleAskColor,
  bubbleLineWidth,
  bubbleOpacity,
  activeChartContractType,
  activeDataSourceMode,
  tradingSymbol,
  tradingContractType,
  volumeBarsEnabled,
  volumeBarsInputData,
  volumeBarsMarketSource,
  volumeBarsFilterMode,
  volumeBarsMovingAverageLength,
  volumeBarsFilterMin,
  volumeBarsFilterMax,
  volumeBarsColorMode,
  volumeBarsOpacity,
  volumeBarsHeightPct,
  volumeBarsShowValueText,
  volumeBarsTextSize,
  volumeBarsAverageLineEnabled,
  volumeBarsAverageLength,
  isDrawMode,
  customProfileRange,
  customProfileLocked,
  drawnLines,
  lineDrawMode,
  exhaustionEnabled,
  exhaustionMinScore,
  exhaustionSide,
  exhaustionShowProvisional,
  icebergEnabled,
  icebergMinScore,
  icebergLookback,
  icebergShowSuspected,
  icebergShowLabels,
  icebergShowTint,
  liquidityVacuumEnabled,
  liquidityVacuumMinScore,
  liquidityVacuumShowLabels,
  liquidityVacuumOpacity,
  profileWidthPct,
  defaultProfileEnabled,
  defaultProfilePeriod,
  profilePeriodValue,
  profilePeriodUnit,
  profileResolutionTicks,
  profileMinRowHeight,
  profileOpacity,
  profileMinRowWidth,
  profileScaleMode,
  profileShowPocHighlight,
  profileShowVaFill,
  profileShowPocLine,
  profileShowVaLines,
  profileType,
  profileInputData,
  profilePocColor,
  profileHvnColor,
  profileLvnColor,
  profilePocWidth,
  profileFilterMin,
  profileFilterMax,
  historicalSessionProfileEnabled,
  profileNodeSensitivity,
  deltaProfileWidth,
  sessionsEnabled,
  sessions,
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
  statsIndicatorEnabled,
  statsIndicatorItems,
  globalTimezone = 'local',
  globalTimeFormat = '24h',
  showTimeAxis = true,
  onBarWidthChange,
  onScrollOffsetChange,
}: ChartCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const scheduledLayers = useRef(new Set<string>());
  const isRedrawScheduled = useRef(false);
  
  const lastCandlesLengthRef = useRef(0);
  const firstCandleTimeRef = useRef<number | null>(null);

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
  const hoveredDrawingZone = useRef<DrawingHitZone | null>(null);
  const isDraggingDrawing = useRef(false);
  const drawingDragZone = useRef<DrawingHitZone | null>(null);
  const drawingSnapshot = useRef<DrawnLine | null>(null);
  const hoveredOrderLineId = useRef<string | null>(null);
  const isDraggingOrderLine = useRef(false);
  const orderDragSnapshot = useRef<Order | null>(null);
  const orderDragOriginalPrice = useRef<number | null>(null);

  // Bracket SL/TP drag refs
  const isDraggingBracket = useRef(false);
  const bracketDragRef = useRef<BracketDragState | null>(null);
  const bracketDragEntryPrice = useRef<number | null>(null);
  const bracketDragSide = useRef<'long' | 'short' | null>(null);
  const bracketHitZones = useRef<TradingOverlayHitZones>({
    slHandles: new Map(),
    tpHandles: new Map(),
  });
  
  const coordsRef = useRef<CoordinateSystem | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const drawnSessionRangesRef = useRef<{ id: string; startX: number | null; endX: number | null; range: { start: number; end: number } }[]>([]);

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [sessionContextMenu, setSessionContextMenu] = React.useState<{ x: number, y: number, sessionId: string, start: number, end: number } | null>(null);


  const [hoveredExhaustion, setHoveredExhaustion] = React.useState<{ result: ExhaustionResult, x: number, y: number } | null>(null);
  const [hoveredIceberg, setHoveredIceberg] = React.useState<{ level: IcebergLevel, x: number, y: number } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = React.useState<string | null>(null);
  const [confirmingCancelOrderId, setConfirmingCancelOrderId] = React.useState<string | null>(null);
  const [pendingModifyBracket, setPendingModifyBracket] = React.useState<{
    positionId: string;
    sl: number;
    tp: number;
  } | null>(null);
  const [showModifyBracketConfirm, setShowModifyBracketConfirm] = React.useState(false);
  const [pendingModifyOrder, setPendingModifyOrder] = React.useState<PendingModifyOrder | null>(null);
  const [showModifyConfirm, setShowModifyConfirm] = React.useState(false);
  const [confirmClosePosition, setConfirmClosePosition] = React.useState<VirtualPosition | null>(null);
  const [isClosingPosition, setIsClosingPosition] = React.useState(false);
  const [chartOrderMessage, setChartOrderMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const bracketDragConfirmEnabled = useChartStore(s => s.bracketDragConfirmEnabled);
  const virtualPositions = useChartRuntimeStore(s => s.tradingStatus.virtualPositions);
  const bracketOrders = useChartRuntimeStore(s => s.tradingStatus.bracketOrders);
  const bracketDrag = useChartRuntimeStore(s => s.tradingStatus.bracketDrag);
  const currentTradingMode = useChartRuntimeStore(s => s.tradingStatus.currentMode);
  const modeBadge = useChartRuntimeStore(s => s.tradingStatus.modeBadge);
  const orderActionLoading = useChartRuntimeStore(s => s.tradingStatus.orderActionLoading);
  const orderActionError = useChartRuntimeStore(s => s.tradingStatus.orderActionError);
  const orderActionSuccess = useChartRuntimeStore(s => s.tradingStatus.orderActionSuccess);
  const modifyingOrderId = useChartRuntimeStore(s => s.tradingStatus.modifyingOrderId);
  const dragPreviewPrice = useChartRuntimeStore(s => s.tradingStatus.dragPreviewPrice);
  const modifyLoading = useChartRuntimeStore(s => s.tradingStatus.modifyLoading);
  const modifyError = useChartRuntimeStore(s => s.tradingStatus.modifyError);
  const modifySuccess = useChartRuntimeStore(s => s.tradingStatus.modifySuccess);
  const riskStatus = useChartRuntimeStore(s => s.tradingStatus.riskStatus);
  const setTradingStatus = useChartRuntimeStore(s => s.setTradingStatus);
  const refreshRiskStatus = useChartRuntimeStore(s => s.refreshRiskStatus);
  const cancelOrder = useChartRuntimeStore(s => s.cancelOrder);
  const modifyOrder = useChartRuntimeStore(s => s.modifyOrder);
  const measureToolActive = useChartRuntimeStore(s => s.panels[panelId]?.measureToolActive ?? false);
  const activeMeasurement = useChartRuntimeStore(s => s.panels[panelId]?.activeMeasurement ?? null);

  const getCandlesLength = useCallback(() => useChartRuntimeStore.getState().panels[panelId]?.candles?.length ?? 0, [panelId]);

  const priceAxisWidth = 85;
  const timeAxisHeight = showTimeAxis ? 24 : 0;
  const baseProfileWidth = 120;

  useEffect(() => {
    void refreshRiskStatus();
  }, [refreshRiskStatus]);
  
  let profileWidth = defaultProfileEnabled ? baseProfileWidth : 0;
  if (liquidityHeatmapEnabled) {
    profileWidth += liquidityHeatmapWidth;
  }

  const getBottomLayout = useCallback((canvasHeight: number) => {
    return computeBottomPanelsLayout({
      activeIndicators,
      statsIndicatorEnabled,
      statsIndicatorItems,
      volumeBarsEnabled,
      volumeBarsHeightPct,
      canvasHeight,
      timeAxisHeight,
    });
  }, [
    activeIndicators,
    statsIndicatorEnabled,
    statsIndicatorItems,
    volumeBarsEnabled,
    volumeBarsHeightPct,
    timeAxisHeight,
  ]);

  const bottomPanelsLayout = getBottomLayout(heightRef.current);
  const bottomPanelsHeight = bottomPanelsLayout.totalHeight;

  const redraw = useCallback((layer: 'all' | 'overlay' | 'background' | 'live' | 'live-dirty' = 'all') => {
    scheduledLayers.current.add(layer);
    if (isRedrawScheduled.current) return;

    isRedrawScheduled.current = true;
    requestAnimationFrame(() => {
      isRedrawScheduled.current = false;
      const layersToDraw = new Set(scheduledLayers.current);
      scheduledLayers.current.clear();
      const drawAll = layersToDraw.has('all');

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const bgCtx = bgCtxRef.current;
      const liveCtx = liveCtxRef.current;
      const container = containerRef.current;
      if (!canvas || !ctx || !bgCtx || !liveCtx || !container) return;

      const logicalWidth = widthRef.current;
      const logicalHeight = heightRef.current;

      const liveBottomLayout = getBottomLayout(logicalHeight);
      const chartWidth = logicalWidth - priceAxisWidth;
      const chartHeight = liveBottomLayout.mainChartHeight;

      if (drawAll || layersToDraw.has('background')) {
        bgCtx.clearRect(0, 0, logicalWidth, logicalHeight);
        bgCtx.fillStyle = '#0F0F0F';
        bgCtx.fillRect(0, 0, logicalWidth, logicalHeight);
      }
      if (drawAll || layersToDraw.has('overlay')) {
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      }

      const runtimeState = useChartRuntimeStore.getState();
      const currentPanelRuntime = runtimeState.panels[panelId] || {};
      const storeState = useChartStore.getState();
      const panelState = storeState.panels[panelId];

      const candles = currentPanelRuntime.candles ?? [];
      const openOrders = runtimeState.tradingStatus.openOrders ?? [];
      const bracketOrders = runtimeState.tradingStatus.bracketOrders ?? [];
      const positions = runtimeState.tradingStatus.positions ?? [];
      const virtualPositions = runtimeState.tradingStatus.virtualPositions ?? [];
      const recentFills = runtimeState.tradingStatus.recentTrades ?? [];
      const bracketDrag = runtimeState.tradingStatus.bracketDrag ?? null;
      const marketOrderDrag = runtimeState.tradingStatus.marketOrderDrag ?? null;
      
      const activeMeasurement = currentPanelRuntime.activeMeasurement ?? null;
      const measureToolActive = currentPanelRuntime.measureToolActive ?? false;
      const isProfileSelected = currentPanelRuntime.isProfileSelected ?? false;
      const liquidityZones = currentPanelRuntime.liquidityZones ?? [];
      const liquidityVacuumZones = currentPanelRuntime.liquidityVacuumZones ?? [];
      const icebergLevels = currentPanelRuntime.icebergLevels ?? [];
      const aggregateBubbleEvents = currentPanelRuntime.aggregateBubbleEvents ?? [];
      const historicalSessionRanges = panelState ? computeHistoricalSessionRanges(panelState, candles, globalTimezone) : [];

      const absorptionMap = currentPanelRuntime.absorptionMap ?? new Map();
      const exhaustionMap = currentPanelRuntime.exhaustionMap ?? new Map();

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
      const resolvedCustomProfileRange = resolveCustomProfileRange(customProfileRange, candles);
      const resolvedDrawnLines = drawnLines
        .map((line) => resolveLineForRender(line, candles))
        .filter((line): line is DrawnLine => line !== null);
      const resolvedPositionLines = resolvedDrawnLines.filter(isPositionDrawing);
      const resolvedNonPositionLines = resolvedDrawnLines.filter((line) => !isPositionDrawing(line));
      const localProfileHitZone =
        isMouseOver.current && mouseX.current !== null && mouseY.current !== null
          ? getCustomProfileHitZone(
              resolvedCustomProfileRange,
              mouseX.current,
              mouseY.current,
              candles.length,
              currentScrollOffset,
              currentBarWidth,
              chartWidth,
              chartHeight,
              profileWidth,
              priceMin,
              priceMax,
              customProfileLocked,
              useChartRuntimeStore.getState().panels[panelId]?.isProfileSelected ?? false
            )
          : null;

      // Track coordinates for metric calculation
      coordsRef.current = {
        visiblePriceMin: priceMin,
        visiblePriceMax: priceMax,
      };

      const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
      const indexToX = (index: number) => calcIndexToX(index, candles.length, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
      const defaultProfileBucketSize = resolveProfileBucketSize(
        priceMax,
        priceMin,
        chartHeight,
        profileResolutionTicks,
        tickSize,
        bucketSize
      );

      if (drawAll || layersToDraw.has('overlay')) {
        drawLines(ctx, resolvedNonPositionLines, indexToX, priceToY, logicalWidth, logicalHeight, timeAxisHeight, priceAxisWidth, currentBarWidth, hoveredLineId.current, selectedDrawingId, isHoveringDeleteDot.current);
      }

      if (drawAll || layersToDraw.has('background')) {
        drawGrid(bgCtx, priceMin, priceMax, priceToY, indexToX, rawFirstIndex, rawLastIndex, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);

        // Session boxes - drawn behind everything
        drawSessions(
          bgCtx,
          candles,
          { firstIndex, lastIndex },
          indexToX,
          currentBarWidth,
          logicalHeight,
          timeAxisHeight,
          sessions,
          sessionsEnabled,
          globalTimezone
        );
      }

      // Liquidity zones - drawn between grid and sessions/candles
      const isDirty = !drawAll && !layersToDraw.has('live') && layersToDraw.has('live-dirty');
      let liveCtxClipped = false;
      if (drawAll || layersToDraw.has('live') || layersToDraw.has('live-dirty')) {
        if (isDirty && candles.length > 0) {
          const x = indexToX(candles.length - 1);
          if (x !== null) {
            const colStartX = x - currentBarWidth / 2 - 2;
            const colWidth = currentBarWidth + 4;
            liveCtx.save();
            liveCtx.beginPath();
            liveCtx.rect(colStartX, 0, colWidth, logicalHeight);
            liveCtx.clip();
            liveCtx.clearRect(colStartX, 0, colWidth, logicalHeight);
            liveCtxClipped = true;
          } else {
            liveCtx.clearRect(0, 0, logicalWidth, logicalHeight);
          }
        } else {
          liveCtx.clearRect(0, 0, logicalWidth, logicalHeight);
        }

        if (liquidityEnabled && liquidityZones.length > 0) {
          const lastCandlePrice = candles.length > 0 ? candles[candles.length - 1].close : null;
          drawLiquidity(
            liveCtx,
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

        if (liquidityVacuumEnabled && liquidityVacuumZones.length > 0) {
          drawLiquidityVacuum(
            liveCtx,
            liquidityVacuumZones,
            candles,
            indexToX,
            priceToY,
            currentBarWidth,
            logicalWidth,
            logicalHeight,
            {
              minScore: liquidityVacuumMinScore,
              opacity: liquidityVacuumOpacity,
              showLabels: liquidityVacuumShowLabels,
              profileWidth,
              priceAxisWidth,
              timeAxisHeight,
            }
          );
        }
      }

      if (drawAll || layersToDraw.has('overlay')) {
        // Selection Rectangle (drawn below candles)
        drawSelectionRect(
          ctx,
          isDrawMode ? dragStart.current : null,
          isDrawMode ? dragEnd.current : null,
          resolvedCustomProfileRange,
          (idx) => indexToX(idx),
          (p) => priceToY(p),
          currentBarWidth
        );
      }

      if (drawAll || layersToDraw.has('live') || layersToDraw.has('live-dirty')) {
        if (chartMode === 'candle' || chartMode === 'hollow') {
          drawCandles(liveCtx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, chartMode === 'hollow');
        } else {
          drawFootprint(liveCtx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, engine, bucketSize, chartHeight, footprintMode);
        }
      }

      if (drawAll || layersToDraw.has('live') || layersToDraw.has('live-dirty')) {


        // Volume bubbles — drawn above candles/footprint, below volume profile
        if (bubblesEnabled) {
          drawAggregateTradeBubbles(liveCtx, aggregateBubbleEvents, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, {
            bubbleSizeBy,
            aggregateBubbleMarketSource,
            activeChartContractType,
            activeDataSourceMode,
            bubbleThreshold,
            bubbleThresholdMode,
            bubbleMinOrders,
            bubbleFilterRender,
            bubbleStdDevVal,
            bubbleOutStdDevPerc,
            bubbleSide,
            bubbleScaleMode,
            bubbleColorMode,
            bubbleVolumeColorMode,
            bubbleDisplayMode,
            bubbleBidColor,
            bubbleAskColor,
            bubbleLineWidth,
            bubbleOpacity,
          }, {
            panelId,
            bufferSize: aggregateBubbleEvents.length,
            maxBufferSize: MAX_AGGREGATE_BUBBLE_EVENTS,
            activeChartContractType,
            activeDataSourceMode,
            engine,
            bucketSize,
          });
        }

        // 5. Absorption markers
        if (absorptionEnabled && absorptionMap.size > 0) {
          drawAbsorption(liveCtx, candles, firstIndex, lastIndex, indexToX, priceToY, absorptionMap, absorptionShowLabels, absorptionMinScore, absorptionSide, timeframe);
        }

        // 5b. Exhaustion markers
        if (exhaustionEnabled && exhaustionMap.size > 0) {
          drawExhaustion(liveCtx, candles, { firstIndex, lastIndex }, indexToX, priceToY, currentBarWidth, exhaustionMap, { exhaustionMinScore, exhaustionSide, exhaustionShowProvisional, timeframe });
        }

        // 5c. Iceberg level markers
        if (icebergEnabled && icebergLevels.length > 0) {
          drawIceberg(liveCtx, icebergLevels, candles, indexToX, priceToY, currentBarWidth, bucketSize, {
            icebergMinScore,
            icebergShowSuspected,
            icebergShowLabels,
            icebergShowTint,
            icebergLookback,
            absorptionMap,
          });
        }

        // 5d. Bottom indicator panels (Stats grid, Volume bars, etc. stacked in layout order)
        if (liveBottomLayout.statsPanel) {
          drawStatsGrid(
            liveCtx,
            candles,
            firstIndex,
            lastIndex,
            indexToX,
            liveBottomLayout.statsPanel.top,
            statsIndicatorItems,
            engine,
            liquidityHistory,
            logicalWidth,
            priceAxisWidth,
            currentBarWidth
          );
        }

        if (liveBottomLayout.volumePanel) {
          drawVolumeBars(
            liveCtx,
            candles,
            firstIndex,
            lastIndex,
            indexToX,
            currentBarWidth,
            chartWidth,
            chartHeight,
            timeAxisHeight,
            profileWidth,
            engine,
            aggregateBubbleEvents,
            {
              panelId,
              enabled: volumeBarsEnabled,
              inputData: volumeBarsInputData,
              marketSource: volumeBarsMarketSource,
              filterMode: volumeBarsFilterMode,
              movingAverageLength: volumeBarsMovingAverageLength,
              filterMin: volumeBarsFilterMin,
              filterMax: volumeBarsFilterMax,
              colorMode: volumeBarsColorMode,
              opacity: volumeBarsOpacity,
              heightPct: volumeBarsHeightPct,
              showValueText: volumeBarsShowValueText,
              textSize: volumeBarsTextSize,
              averageLineEnabled: volumeBarsAverageLineEnabled,
              averageLength: volumeBarsAverageLength,
              activeChartContractType,
              activeDataSourceMode,
              panelTop: liveBottomLayout.volumePanel.top,
              panelHeight: liveBottomLayout.volumePanel.height,
              onDebug: recordVolumeBarsDebug,
            },
          );
        }

        if (liveCtxClipped) {
          liveCtx.restore();
        }
      }

      const lastCandle = candles[candles.length - 1];
      const isScrolled = candles.length > 0 && (candles.length - lastIndex) > 50;

      let heatmapRows: HeatmapRow[] | undefined = undefined;
      if (liquidityHeatmapEnabled && liquidityHistory) {
        heatmapRows = buildHeatmapRows(liquidityHistory, priceMin, priceMax, liquidityBucketSize, lastCandle?.close || 0);
      }

      if (drawAll || layersToDraw.has('overlay')) {
        // 6. Custom Profile (on top of candles and other overlays)
        if (resolvedCustomProfileRange) {
          const customTimeBounds = getCustomProfileTimeBounds(resolvedCustomProfileRange, candles);
          const customCandles = customTimeBounds
            ? candles.filter((candle) => candle.time >= customTimeBounds.startTime && candle.time <= customTimeBounds.endTime)
            : [];
          const customStartTime = customTimeBounds?.startTime ?? null;
          const customEndTime = customTimeBounds?.endTime ?? null;
          const customProfileHeightPx = Math.abs(
            priceToY(resolvedCustomProfileRange.priceLow) - priceToY(resolvedCustomProfileRange.priceHigh)
          );
          const customProfileBucketSize = resolveProfileBucketSize(
            resolvedCustomProfileRange.priceHigh,
            resolvedCustomProfileRange.priceLow,
            customProfileHeightPx,
            profileResolutionTicks,
            tickSize,
            bucketSize
          );
          const customProfile = volumeProfileEngine.buildProfile({
            candles: customCandles,
            profileBucketSize: customProfileBucketSize,
            priceHigh: resolvedCustomProfileRange.priceHigh,
            priceLow: resolvedCustomProfileRange.priceLow,
            nodeSensitivity: profileNodeSensitivity,
            inputData: profileInputData,
            filterMin: profileFilterMin,
            filterMax: profileFilterMax,
            debugContext: {
              label: 'selected-custom-profile-render',
              panelId,
              selectedStartTime: customStartTime ?? undefined,
              selectedEndTime: customEndTime ?? undefined,
            },
          });
          drawCustomProfile(
            ctx,
            resolvedCustomProfileRange,
            customProfile,
            indexToX,
            priceToY,
            currentBarWidth,
            bucketSize,
            hoverZone.current !== null,
            customProfileLocked,
            isProfileSelected,
            profileScaleMode,
            customProfileBucketSize,
            profileWidthPct,
            profileOpacity,
            profileMinRowWidth,
            profileMinRowHeight,
            profileShowPocHighlight,
            profileShowVaFill,
            profileShowPocLine,
            profileShowVaLines,
            profileType,
            liquidityHeatmapProfileSync ? heatmapRows : undefined,
            customCandles,
            indexToX,
            profilePocColor,
            profileHvnColor,
            profileLvnColor,
            profilePocWidth
          );

          if ((profileType === 'delta' || profileType === 'deltaVolume') && customProfile) {
            const customX1 = indexToX(resolvedCustomProfileRange.firstIndex) - currentBarWidth / 2;
            const customX2 = indexToX(resolvedCustomProfileRange.lastIndex) + currentBarWidth / 2;
            const customRectX = Math.min(customX1, customX2);

            drawDeltaProfile(
              ctx,
              customProfile,
              priceToY,
              customRectX,
              deltaProfileWidth,
              customProfileBucketSize,
              profileOpacity,
              profileMinRowWidth,
              profileMinRowHeight,
              profileScaleMode
            );
          }
        }
      }

      // Volume Profile & Historical Session Volume Profiles (Full live canvas only, not live-dirty)
      if (drawAll || layersToDraw.has('live')) {
        if (defaultProfileEnabled) {
          let profileCandles: typeof candles = [];

          if (defaultProfilePeriod === 'latest' && candles.length > 0) {
            const targetTz = globalTimezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : globalTimezone;
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: targetTz, year: 'numeric', month: 'numeric', day: 'numeric' });
            
            // Find the calendar day of the most recent candle
            const lastCandleTime = candles[candles.length - 1].time;
            const lastCandleDateStr = formatter.format(new Date(lastCandleTime * 1000));
            
            // Walk backwards to find the first candle of this same calendar day
            let firstIdxOfLatestDay = candles.length - 1;
            while (firstIdxOfLatestDay > 0) {
              const prevCandleTime = candles[firstIdxOfLatestDay - 1].time;
              if (formatter.format(new Date(prevCandleTime * 1000)) !== lastCandleDateStr) {
                break;
              }
              firstIdxOfLatestDay--;
            }
            
            profileCandles = candles.slice(firstIdxOfLatestDay);
          } else if (defaultProfilePeriod === 'periodic' && candles.length > 0) {
            const val = profilePeriodValue || 4;
            const unit = profilePeriodUnit || 'hours';
            let secondsStr = 3600;
            if (unit === 'minutes') secondsStr = 60;
            if (unit === 'days') secondsStr = 86400;
            const periodSeconds = val * secondsStr;

            const lastCandleTime = candles[candles.length - 1].time;
            const boundaryTime = Math.floor(lastCandleTime / periodSeconds) * periodSeconds;
            
            let lo = 0, hi = candles.length;
            while (lo < hi) {
              const mid = (lo + hi) >>> 1;
              if (candles[mid].time < boundaryTime) lo = mid + 1;
              else hi = mid;
            }
            profileCandles = candles.slice(lo);
          } else if (defaultProfilePeriod === 'composite') {
            profileCandles = candles;
          } else {
            // 'visible' (default)
            profileCandles = candles.slice(Math.max(0, firstIndex), Math.min(candles.length, lastIndex + 1));
          }
          
          const profile = volumeProfileEngine.buildProfile({
            candles: profileCandles,
            profileBucketSize: defaultProfileBucketSize,
            nodeSensitivity: profileNodeSensitivity,
            inputData: profileInputData,
            filterMin: profileFilterMin,
            filterMax: profileFilterMax,
          });

          if (profile) {
            drawVolumeProfile(
              liveCtx,
              profile,
              priceToY,
              logicalWidth,
              baseProfileWidth,
              priceAxisWidth,
              bucketSize,
              !!resolvedCustomProfileRange,
              profileWidthPct,
              profileOpacity,
              profileMinRowWidth,
              profileMinRowHeight,
              defaultProfileBucketSize,
              profileScaleMode,
              profileShowPocHighlight,
              profileShowVaFill,
              profileShowPocLine,
              profileShowVaLines,
              profileType,
              liquidityHeatmapProfileSync ? heatmapRows : undefined,
              profileCandles,
              indexToX,
              profilePocColor,
              profileHvnColor,
              profileLvnColor,
              profilePocWidth
            );
          }
        }

        // Historical Session Volume Profiles
        if (historicalSessionProfileEnabled && historicalSessionRanges.length > 0) {
          drawnSessionRangesRef.current = [];
          for (const sessionRange of historicalSessionRanges) {
            const sessionCandles: typeof candles = [];
            let sHigh = -Infinity;
            let sLow = Infinity;
            let minFirstIndex = Infinity;
            let maxLastIndex = -Infinity;

            for (const segment of sessionRange.segments) {
              const startTime = segment.startTimeMs / 1000;
              const endTime = segment.endTimeMs / 1000;
              
              let lo = 0, hi = candles.length;
              while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (candles[mid].time < startTime) lo = mid + 1; else hi = mid;
              }
              const firstIndex = lo;

              lo = firstIndex; hi = candles.length;
              while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (candles[mid].time < endTime) lo = mid + 1; else hi = mid;
              }
              const lastIndex = lo - 1;

              if (firstIndex > lastIndex || firstIndex >= candles.length) continue;

              for (let ci = firstIndex; ci <= lastIndex; ci++) {
                if (candles[ci].high > sHigh) sHigh = candles[ci].high;
                if (candles[ci].low < sLow) sLow = candles[ci].low;
              }

              sessionCandles.push(...candles.slice(firstIndex, lastIndex + 1));
              if (firstIndex < minFirstIndex) minFirstIndex = firstIndex;
              if (lastIndex > maxLastIndex) maxLastIndex = lastIndex;
            }

            if (sessionCandles.length === 0 || sHigh === -Infinity || sLow === Infinity) continue;

            const sessionProfileRange = {
              firstIndex: minFirstIndex,
              lastIndex: maxLastIndex,
              priceHigh: sHigh,
              priceLow: sLow,
            };
            
            drawnSessionRangesRef.current.push({
              id: sessionRange.id,
              startX: indexToX(minFirstIndex),
              endX: indexToX(maxLastIndex),
              range: { start: sessionCandles[0].time, end: sessionCandles[sessionCandles.length - 1].time }
            });

            const sessionProfileHeightPx = Math.abs(priceToY(sLow) - priceToY(sHigh));
            const sessionProfileBucketSize = resolveProfileBucketSize(
              sHigh,
              sLow,
              sessionProfileHeightPx,
              profileResolutionTicks,
              tickSize,
              bucketSize
            );
            
            const sessionProfile = volumeProfileEngine.buildProfile({
              candles: sessionCandles,
              profileBucketSize: sessionProfileBucketSize,
              priceHigh: sHigh,
              priceLow: sLow,
              nodeSensitivity: profileNodeSensitivity,
              inputData: profileInputData,
              filterMin: profileFilterMin,
              filterMax: profileFilterMax,
              debugContext: {
                label: 'historical-session-profile-render',
                panelId,
                selectedStartTime: sessionRange.segments[0].startTimeMs / 1000,
                selectedEndTime: sessionRange.segments[sessionRange.segments.length - 1].endTimeMs / 1000,
              },
            });
            
            drawCustomProfile(
              liveCtx,
              sessionProfileRange,
              sessionProfile,
              indexToX,
              priceToY,
              currentBarWidth,
              bucketSize,
              false, // isHovered
              true, // isLocked
              false, // isSelected
              profileScaleMode,
              sessionProfileBucketSize,
              profileWidthPct,
              profileOpacity,
              profileMinRowWidth,
              profileMinRowHeight,
              profileShowPocHighlight,
              profileShowVaFill,
              profileShowPocLine,
              profileShowVaLines,
              profileType
            );

            if ((profileType === 'delta' || profileType === 'deltaVolume') && sessionProfile) {
              const sessionX1 = indexToX(sessionProfileRange.firstIndex) - currentBarWidth / 2;
              const sessionX2 = indexToX(sessionProfileRange.lastIndex) + currentBarWidth / 2;
              const sessionRectX = Math.min(sessionX1, sessionX2);

              drawDeltaProfile(
                liveCtx,
                sessionProfile,
                priceToY,
                sessionRectX,
                deltaProfileWidth,
                sessionProfileBucketSize,
                profileOpacity,
                profileMinRowWidth,
                profileMinRowHeight,
                profileScaleMode
              );
            }
          }
        }
      }
      
      if (drawAll || layersToDraw.has('overlay')) {
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
        } else if (lineDrawMode === 'box' && isDragging.current && dragStart.current && dragEnd.current) {
        const firstIndex = xToIndex(dragStart.current.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
        const lastIndex = xToIndex(dragEnd.current.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
        const priceHigh = Math.max(
          yToPrice(dragStart.current.y, priceMin, priceMax, chartHeight),
          yToPrice(dragEnd.current.y, priceMin, priceMax, chartHeight)
        );
        const priceLow = Math.min(
          yToPrice(dragStart.current.y, priceMin, priceMax, chartHeight),
          yToPrice(dragEnd.current.y, priceMin, priceMax, chartHeight)
        );

        drawLines(
          ctx,
          [{
            id: 'active-box',
            type: 'box',
            value: priceHigh,
            firstIndex,
            lastIndex,
            priceHigh,
            priceLow,
          }],
          indexToX,
          priceToY,
          logicalWidth,
          logicalHeight,
          timeAxisHeight,
          priceAxisWidth,
          currentBarWidth,
          'active-box',
          null,
          false
        );
      }
      }

      if (drawAll || layersToDraw.has('background')) {
        drawPriceAxis(bgCtx, priceMin, priceMax, priceToY, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight);
        if (showTimeAxis) {
          drawTimeAxis(bgCtx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);
        }
      }

      if (drawAll || layersToDraw.has('overlay')) {
        drawDrawingPriceLabels(ctx, resolvedDrawnLines, indexToX, priceToY, logicalWidth, logicalHeight, timeAxisHeight, priceAxisWidth, currentBarWidth);
      }

      if (drawAll || layersToDraw.has('live')) {
        if (heatmapRows && liquidityHistory) {
          // The heatmap strip is drawn right before the volume profile
          const stripX = chartWidth - profileWidth; // start of reserved space (heatmap comes first from the left)
          drawLiquidityHeatmap(liveCtx, heatmapRows, priceToY, stripX, liquidityHeatmapWidth, liquidityBucketSize, {
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
      }

      if (drawAll || layersToDraw.has('overlay')) {
        let activePosition: DrawnLine | null = null;
        if (
          (lineDrawMode === 'long-position' || lineDrawMode === 'short-position' || lineDrawMode === 'position') &&
          isDragging.current &&
          dragStart.current &&
          dragEnd.current
        ) {
          const dy = dragEnd.current.y - dragStart.current.y;
          const resolvedMode = lineDrawMode === 'position' ? (dy > 0 ? 'long-position' : 'short-position') : lineDrawMode;
          activePosition = buildPositionFromRiskDrag(
            resolvedMode,
            dragStart.current,
            dragEnd.current,
            candles,
            currentScrollOffset,
            currentBarWidth,
            chartWidth,
            profileWidth,
            priceMin,
            priceMax,
            chartHeight,
            Math.max(tickSize, bucketSize * 0.01),
            null
          );

          if (activePosition) {
            activePosition.id = 'active-position';
          }
        }

        const positionLines = activePosition ? [...resolvedPositionLines, activePosition] : resolvedPositionLines;
        if (positionLines.length > 0) {
          drawLines(
            ctx,
            positionLines,
            indexToX,
            priceToY,
            logicalWidth,
            logicalHeight,
            timeAxisHeight,
            priceAxisWidth,
            currentBarWidth,
            activePosition ? 'active-position' : hoveredLineId.current,
            selectedDrawingId,
            isHoveringDeleteDot.current,
            candles
          );
        }

        const binancePositions = tradingContractType === 'futures'
          ? positions.filter((p: Position) => p.side !== 'flat').map((p: Position) => ({
              id: p.symbol,
              status: 'open' as const,
              symbol: p.symbol,
              side: p.side as 'long' | 'short',
              quantity: p.quantity,
              entryPrice: p.entryPrice ?? 0,
              unrealizedPnl: p.unrealizedPnl,
              liquidationPrice: p.liquidationPrice,
              openedAt: p.updatedAt ?? Date.now(),
              fillIds: [],
            }))
          : [];
          
        const activePositions = [...binancePositions, ...virtualPositions];

        if (openOrders.length > 0 || activePositions.length > 0 || recentFills.length > 0 || marketOrderDrag) {
          bracketHitZones.current = drawTradingOverlays(
            ctx,
            candles,
            { firstIndex, lastIndex },
            indexToX,
            priceToY,
            chartWidth,
            chartHeight,
            priceAxisWidth,
            openOrders,
            activePositions,
            bracketOrders,
            recentFills,
            modifyingOrderId && dragPreviewPrice !== null
              ? { orderId: modifyingOrderId, price: dragPreviewPrice }
              : null,
            bracketDrag,
            marketOrderDrag
          );
        }

        if (lastCandle) {
          useChartRuntimeStore.getState().updateVirtualPnl(tradingSymbol, lastCandle.close);
          drawPriceLine(ctx, lastCandle, priceToY, chartWidth, priceAxisWidth, logicalWidth, timeframe);
        }

        // Draw Crosshair
        const crosshair = useChartRuntimeStore.getState().crosshair;
        const crosshairSyncEnabled = useChartStore.getState().crosshairSyncEnabled;
        let mx: number | null = null;
        let my: number | null = null;

        if (isMouseOver.current && mouseX.current !== null && mouseY.current !== null && !localProfileHitZone) {
          mx = mouseX.current;
          my = mouseY.current;
        } else if (crosshairSyncEnabled && crosshair.activePanel && (crosshair.activePanel !== panelId || !isMouseOver.current)) {
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
            if (showTimeAxis) {
              drawCrosshairTimeLabel(ctx, mx, time, chartHeight, timeAxisHeight, chartWidth);
            }
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartMode, footprintMode, bucketSize, engine, volumeProfileEngine, volumeProfileRevision, tickSize, isLoadingHistory, timeframe, absorptionEnabled, absorptionMinScore, absorptionSide, absorptionShowLabels, exhaustionEnabled, exhaustionMinScore, exhaustionSide, exhaustionShowProvisional, icebergEnabled, icebergMinScore, icebergLookback, icebergShowSuspected, icebergShowLabels, icebergShowTint, liquidityVacuumEnabled, liquidityVacuumMinScore, liquidityVacuumShowLabels, liquidityVacuumOpacity, bubblesEnabled, bubbleSizeBy, aggregateBubbleMarketSource, activeChartContractType, activeDataSourceMode, bubbleThreshold, bubbleThresholdMode, bubbleMinOrders, bubbleFilterRender, bubbleStdDevVal, bubbleOutStdDevPerc, bubbleSide, bubbleScaleMode, isDrawMode, customProfileRange, customProfileLocked, drawnLines, lineDrawMode, selectedDrawingId, profileWidthPct, defaultProfileEnabled, profileResolutionTicks, profileMinRowHeight, profileOpacity, profileMinRowWidth, profileScaleMode, profileShowPocHighlight, profileShowVaFill, profileShowPocLine, profileShowVaLines, profileType, deltaProfileWidth, sessionsEnabled, sessions, liquidityEnabled, liquidityOpacity, liquidityBucketSize, liquidityHistory, liquidityHeatmapEnabled, liquidityHeatmapOpacity, liquidityHeatmapAgeFade, liquidityHeatmapWidth, liquidityHeatmapShowPulled, liquidityHeatmapShowConsumed, liquidityHeatmapShowPersistence, liquidityHeatmapShowCurrentLabel, liquidityHeatmapProfileSync, activeIndicators, statsIndicatorEnabled, statsIndicatorItems, volumeBarsEnabled, volumeBarsInputData, volumeBarsMarketSource, volumeBarsFilterMode, volumeBarsMovingAverageLength, volumeBarsFilterMin, volumeBarsFilterMax, volumeBarsColorMode, volumeBarsOpacity, volumeBarsHeightPct, volumeBarsShowValueText, volumeBarsTextSize, volumeBarsAverageLineEnabled, volumeBarsAverageLength, showTimeAxis, modifyingOrderId, dragPreviewPrice, globalTimezone, globalTimeFormat]);

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
    bottomPanelsHeight,
    barWidthProp,
    scrollOffsetProp,
    onBarWidthChange,
    onScrollOffsetChange,
    isDrawMode || lineDrawMode !== 'none',
    measureToolActive,
    (x: number, y: number) => {
      // Prevent chart panning if we are over a custom profile or its buttons, or a line
      if (isHoveringClear.current || isHoveringLock.current || hoverZone.current || hoveredLineId.current || hoveredOrderLineId.current) {
        return false;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const chartWidth = canvas.clientWidth - priceAxisWidth;
        const chartHeight = canvas.clientHeight - timeAxisHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
        const resolvedCustomProfileRange = resolveCustomProfileRange(customProfileRange, candles);
        const profileHitZone = getCustomProfileHitZone(
          resolvedCustomProfileRange,
          x,
          y,
          candles.length,
          scrollOffset.current,
          barWidth.current,
          chartWidth,
          chartHeight,
          profileWidth,
          priceMin,
          priceMax,
          customProfileLocked,
          useChartRuntimeStore.getState().panels[panelId]?.isProfileSelected ?? false
        );
        if (profileHitZone) return false;

        const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);

        if (!useChartRuntimeStore.getState().tradingStatus.pendingMarketOrderId && candles.length > 0) {
          const lastCandle = candles[candles.length - 1];
          if (getPriceLineHitZone(priceToY(lastCandle.close), x, y, chartWidth)) {
            return false;
          }
        }

        const openOrders = useChartRuntimeStore.getState().tradingStatus.openOrders ?? [];
        for (const order of openOrders) {
          if (getOrderHitZone(order, x, y, chartWidth, chartHeight, priceToY)) {
            return false;
          }
        }
        
        const virtualPositions = useChartRuntimeStore.getState().tradingStatus.virtualPositions ?? [];
        for (const vp of virtualPositions) {
          if (vp.status !== 'open') continue;
          const slBox = bracketHitZones.current.slHandles.get(vp.id);
          const tpBox = bracketHitZones.current.tpHandles.get(vp.id);
          const hitSL = slBox && x >= slBox.x && x <= slBox.x + slBox.w && y >= slBox.y && y <= slBox.y + slBox.h;
          const hitTP = !hitSL && tpBox && x >= tpBox.x && x <= tpBox.x + tpBox.w && y >= tpBox.y && y <= tpBox.y + tpBox.h;
          if (hitSL || hitTP) return false;
        }
      }
      return true;
    },
    useCallback((x: number | null, y: number | null) => {
      if (x === null || y === null) {
        useChartRuntimeStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
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
      const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
      const resolvedCustomProfileRange = resolveCustomProfileRange(customProfileRange, candles);
      const profileHitZone = getCustomProfileHitZone(
        resolvedCustomProfileRange,
        x,
        y,
        candles.length,
        scrollOffset.current,
        barWidth.current,
        chartWidth,
        chartHeight,
        profileWidth,
        priceMin,
        priceMax,
        customProfileLocked,
        useChartRuntimeStore.getState().panels[panelId]?.isProfileSelected ?? false
      );

      if (profileHitZone) {
        useChartRuntimeStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
        return;
      }

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
        useChartRuntimeStore.getState().setCrosshair({ activePanel: panelId, time, price });
      }
    }, [panelId, priceAxisWidth, timeAxisHeight, profileWidth, customProfileRange, customProfileLocked]),
    { scrollOffset, barWidth, priceCenter, priceRange }
  );

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  useEffect(() => {
    redrawRef.current('all');
  }, [globalTimezone, globalTimeFormat]);

  // Subscribe to crosshair changes for sync rendering
  useEffect(() => {
    const unsubscribeCrosshair = useChartRuntimeStore.subscribe((state) => state.crosshair, (crosshair, previousCrosshair) => {
      if (!useChartStore.getState().crosshairSyncEnabled) {
        return;
      }

      if (crosshair.activePanel === panelId && isMouseOver.current) return;

      if (
        crosshair.time !== previousCrosshair.time ||
        crosshair.price !== previousCrosshair.price ||
        crosshair.activePanel !== previousCrosshair.activePanel
      ) {
        redrawRef.current();
      }
    });

    const unsubscribeSync = useChartStore.subscribe((state, prevState) => {
      if (state.crosshairSyncEnabled === prevState.crosshairSyncEnabled) return;
      if (!state.crosshairSyncEnabled) {
        useChartRuntimeStore.getState().setCrosshair({ activePanel: null, time: null, price: null });
      }
      redrawRef.current();
    });

    return () => {
      unsubscribeCrosshair();
      unsubscribeSync();
    };
  }, [panelId, isMouseOver]);

  // Initial setup and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const setupCanvas = (w: number, h: number) => {
      if (bgCanvasRef.current) bgCtxRef.current = initCanvas(bgCanvasRef.current, w, h);
      if (liveCanvasRef.current) liveCtxRef.current = initCanvas(liveCanvasRef.current, w, h);
      ctxRef.current = initCanvas(canvas, w, h);
      widthRef.current = w;
      heightRef.current = h;
      redrawRef.current('all');
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
  // Redraw when candles change (optimized for live ticks)
  useEffect(() => {
    const unsubscribe = useChartRuntimeStore.subscribe(
      (state) => state.panels[panelId]?.dataVersion,
      (version, prevVersion) => {
        if (version === prevVersion) return;
        
        const prevLength = lastCandlesLengthRef.current;
        const prevFirstTime = firstCandleTimeRef.current;
        const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
        
        lastCandlesLengthRef.current = candles.length;
        firstCandleTimeRef.current = candles.length > 0 ? candles[0].time : null;

        if (prevLength > 0 && candles.length > 0) {
          // If we just appended one candle or updated the last candle
          if ((candles.length === prevLength || candles.length === prevLength + 1) && candles[0].time === prevFirstTime) {
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
    chartMode,
    footprintMode,
    bucketSize,
    volumeProfileRevision,
    redraw,
    isLoadingHistory,
    drawnLines,
    lineDrawMode,
    showTimeAxis,
    volumeBarsEnabled,
    volumeBarsMovingAverageLength,
    volumeBarsFilterMin,
    volumeBarsFilterMax,
    volumeBarsOpacity,
    volumeBarsHeightPct,
    volumeBarsShowValueText,
    volumeBarsTextSize,
    volumeBarsAverageLineEnabled,
    volumeBarsAverageLength,
  ]);

  useEffect(() => {
    if (selectedDrawingId && !drawnLines.some((line) => line.id === selectedDrawingId)) {
      setSelectedDrawingId(null);
    }
  }, [drawnLines, selectedDrawingId]);

  useEffect(() => {
    redraw();
  }, [selectedDrawingId, redraw]);

  // Real-time countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      redraw('background');
    }, 1000);
    return () => clearInterval(timer);
  }, [redraw]);

  const customProfileControls = useMemo(() => {
    const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
    if (!customProfileRange || containerSize.width === 0) return null;
    const resolvedCustomProfileRange = resolveCustomProfileRange(customProfileRange, candles);
    if (!resolvedCustomProfileRange) return null;

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = containerSize.height - timeAxisHeight;

    const pCenter = priceCenter.current ?? 0;
    const pRange = priceRange.current ?? 100;
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;

    const { lastIndex, priceHigh } = resolvedCustomProfileRange;
    const x2 = calcIndexToX(lastIndex, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
    const y1 = calcPriceToY(priceHigh, priceMin, priceMax, chartHeight);
    const overlayWidth = 76;

    return {
      top: Math.max(4, Math.min(chartHeight - 34, y1 - 32)),
      left: Math.max(4, Math.min(chartWidth - overlayWidth - 4, x2 + barWidth.current / 2 - overlayWidth / 2)),
    };
  }, [customProfileRange, containerSize, priceAxisWidth, timeAxisHeight, profileWidth, scrollOffset, barWidth, priceCenter, priceRange, panelId]);

  const selectedDrawing = useMemo(() => {
    if (!selectedDrawingId) return null;
    return drawnLines.find((line) => line.id === selectedDrawingId) ?? null;
  }, [drawnLines, selectedDrawingId]);

  const selectedDrawingControls = (() => {
    const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
    if (!selectedDrawing || containerSize.width === 0) return null;
    const resolvedDrawing = resolveLineForRender(selectedDrawing, candles);
    if (!resolvedDrawing) return null;

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = containerSize.height - timeAxisHeight;
    if (chartWidth <= 0 || chartHeight <= 0) return null;

    const pCenter = priceCenter.current ?? 0;
    const pRange = priceRange.current ?? 100;
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;
    const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
    const indexToX = (index: number) => calcIndexToX(index, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
    const anchor = getDrawingToolbarAnchor(resolvedDrawing, indexToX, priceToY, chartWidth, chartHeight, barWidth.current);
    if (!anchor) return null;

    const overlayWidth = 232;
    const overlayOffset = isPositionDrawing(resolvedDrawing) ? 78 : 44;
    return {
      top: Math.max(4, Math.min(chartHeight - 44, anchor.y - overlayOffset)),
      left: Math.max(4, Math.min(chartWidth - overlayWidth - 4, anchor.x - overlayWidth / 2)),
    };
  })();

  const chartOrderControls = useMemo(() => {
    const openOrders = useChartRuntimeStore.getState().tradingStatus.openOrders;
    if (containerSize.width === 0 || containerSize.height === 0) return [];

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = getBottomLayout(containerSize.height).mainChartHeight;
    if (chartWidth <= 0 || chartHeight <= 0) return [];

    const pCenter = priceCenter.current ?? 0;
    const pRange = priceRange.current ?? 100;
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;

    return openOrders
      .filter(isActiveLimitOrder)
      .map((order) => {
        const y = calcPriceToY(order.price!, priceMin, priceMax, chartHeight);
        if (y < -12 || y > chartHeight + 12) return null;
        return {
          order,
          top: Math.max(4, Math.min(chartHeight - 24, y - 11)),
          left: Math.max(8, chartWidth - 70),
        };
      })
      .filter((item): item is { order: Order; top: number; left: number } => item !== null);
  }, [containerSize, priceAxisWidth, getBottomLayout, priceCenter, priceRange]);

  const tradingOverlayControls = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { positions: [], sls: [], tps: [] };
    }

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = getBottomLayout(containerSize.height).mainChartHeight;
    if (chartWidth <= 0 || chartHeight <= 0) {
      return { positions: [], sls: [], tps: [] };
    }

    const pCenter = priceCenter.current ?? 0;
    const pRange = priceRange.current ?? 100;
    const priceMin = pCenter - pRange / 2;
    const priceMax = pCenter + pRange / 2;

    const positions: { vp: VirtualPosition; top: number; left: number }[] = [];
    const sls: { positionId: string; slPrice: number; top: number; left: number }[] = [];
    const tps: { positionId: string; tpPrice: number; top: number; left: number }[] = [];

    for (const vp of virtualPositions) {
      if (vp.status !== 'open' || !Number.isFinite(vp.entryPrice)) continue;

      // Position Entry Close Button
      const entryY = calcPriceToY(vp.entryPrice, priceMin, priceMax, chartHeight);
      if (entryY >= -12 && entryY <= chartHeight + 12) {
        positions.push({
          vp,
          top: Math.max(4, Math.min(chartHeight - 22, entryY - 9)),
          left: Math.max(8, chartWidth - 24),
        });
      }

      // Check Bracket
      const bracket = bracketOrders.find((b) => b.positionId === vp.id);
      const isDraggingSL = bracketDrag?.positionId === vp.id && bracketDrag.handle === 'sl';
      const slPrice = isDraggingSL ? bracketDrag.previewPrice : bracket?.stopLossPrice;
      const isSlActive = (bracket?.stopLossPrice != null && bracket.stopLossStatus === 'active') || isDraggingSL;

      if (isSlActive && slPrice != null) {
        const slY = calcPriceToY(slPrice, priceMin, priceMax, chartHeight);
        if (slY >= -12 && slY <= chartHeight + 12) {
          sls.push({
            positionId: vp.id,
            slPrice,
            top: Math.max(4, Math.min(chartHeight - 22, slY - 9)),
            left: Math.max(8, chartWidth - 24),
          });
        }
      }

      const isDraggingTP = bracketDrag?.positionId === vp.id && bracketDrag.handle === 'tp';
      const tpPrice = isDraggingTP ? bracketDrag.previewPrice : bracket?.takeProfitPrice;
      const isTpActive = (bracket?.takeProfitPrice != null && bracket.takeProfitStatus === 'active') || isDraggingTP;

      if (isTpActive && tpPrice != null) {
        const tpY = calcPriceToY(tpPrice, priceMin, priceMax, chartHeight);
        if (tpY >= -12 && tpY <= chartHeight + 12) {
          tps.push({
            positionId: vp.id,
            tpPrice,
            top: Math.max(4, Math.min(chartHeight - 22, tpY - 9)),
            left: Math.max(8, chartWidth - 24),
          });
        }
      }
    }

    return { positions, sls, tps };
  }, [containerSize, priceAxisWidth, getBottomLayout, priceCenter, priceRange, virtualPositions, bracketOrders, bracketDrag]);

  const handleCancelOrder = useCallback(async (order: Order) => {
    if (confirmingCancelOrderId !== order.id) {
      setConfirmingCancelOrderId(order.id);
      setChartOrderMessage(null);
      return;
    }

    const result = await cancelOrder({
      symbol: tradingSymbol,
      contractType: tradingContractType === 'spot' ? 'spot' : 'futures',
      orderId: order.id,
      clientOrderId: order.clientOrderId,
    });

    setConfirmingCancelOrderId(null);
    setChartOrderMessage({
      type: result.success ? 'success' : 'error',
      text: result.success ? `Cancelled order ${order.id}.` : result.errorMessage ?? 'Order cancellation failed.',
    });
  }, [cancelOrder, confirmingCancelOrderId, tradingContractType, tradingSymbol]);

  useEffect(() => {
    if (!confirmingCancelOrderId) return;
    const openOrders = useChartRuntimeStore.getState().tradingStatus.openOrders ?? [];
    if (openOrders.some((order: Order) => order.id === confirmingCancelOrderId)) return;
    setConfirmingCancelOrderId(null);
  }, [confirmingCancelOrderId]);

  const closeModifyConfirm = useCallback(() => {
    if (modifyLoading) return;
    setShowModifyConfirm(false);
    setPendingModifyOrder(null);
    setTradingStatus({
      modifyingOrderId: null,
      dragPreviewPrice: null,
      modifyError: null,
    });
  }, [modifyLoading, setTradingStatus]);

  const confirmModifyOrder = useCallback(async () => {
    if (!pendingModifyOrder || modifyLoading) return;

    const blockReason = getModifyBlockReason({
      order: pendingModifyOrder.order,
      symbol: tradingSymbol,
      contractType: tradingContractType,
      mode: currentTradingMode,
      modeBadge,
      price: pendingModifyOrder.newPrice,
      quantity: pendingModifyOrder.quantity,
      riskStatus,
    });

    if (blockReason) {
      setTradingStatus({ modifyError: blockReason, modifySuccess: null });
      return;
    }

    const result = await modifyOrder({
      symbol: tradingSymbol,
      contractType: 'spot',
      orderId: pendingModifyOrder.order.id,
      clientOrderId: pendingModifyOrder.order.clientOrderId,
      side: pendingModifyOrder.order.side,
      quantity: pendingModifyOrder.quantity,
      price: pendingModifyOrder.newPrice,
      timeInForce: pendingModifyOrder.order.timeInForce ?? 'GTC',
    });

    setChartOrderMessage({
      type: result.success ? 'success' : 'error',
      text: result.success
        ? `Modified order ${pendingModifyOrder.order.id}.`
        : result.errorMessage ?? 'Order modification failed.',
    });

    if (result.success) {
      setShowModifyConfirm(false);
      setPendingModifyOrder(null);
    }
  }, [
    currentTradingMode,
    modeBadge,
    modifyLoading,
    modifyOrder,
    pendingModifyOrder,
    riskStatus,
    setTradingStatus,
    tradingContractType,
    tradingSymbol,
  ]);

  const executeMarketOrder = useCallback(async (direction: 'buy' | 'sell', slPrice: number) => {
    const mt5Connected = useChartRuntimeStore.getState().tradingStatus.mt5Connected;
    if (!mt5Connected) {
      setChartOrderMessage({ type: 'error', text: 'Cannot place order: MT5 is disconnected' });
      return;
    }

    if (!Number.isFinite(slPrice) || slPrice <= 0) {
      setChartOrderMessage({ type: 'error', text: 'Invalid Stop Loss price' });
      return;
    }

    const requestId = crypto.randomUUID();
    setTradingStatus({ pendingMarketOrderId: requestId });

    try {
      const res = await fetch('http://localhost:3001/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          symbol: tradingSymbol,
          direction,
          slPrice,
        }),
      });

      if (!res.ok) throw new Error('Failed to send order to bridge');

      const maxRetries = 50; // 10 seconds total (50 * 200ms)
      for (let i = 0; i < maxRetries; i++) {
        const pollRes = await fetch(`http://localhost:3001/result/${requestId}`);
        if (pollRes.ok) {
          const data = await pollRes.json();
          if (data.status) {
            if (data.status.toLowerCase() === 'filled') {
              const lastCandles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
              const lastClose = lastCandles.length > 0 ? lastCandles[lastCandles.length - 1].close : null;
              const resolvedFillPrice = Number(data.fillPrice) > 0 ? Number(data.fillPrice) : (Number(data.openPrice) > 0 ? Number(data.openPrice) : lastClose);

              setChartOrderMessage({
                type: 'success',
                text: resolvedFillPrice ? `Market Order filled at ${formatPrice(resolvedFillPrice)}` : 'Market Order filled',
              });
              const vpId = data.ticket.toString();
              const side = direction === 'buy' ? 'long' : 'short';
              const slVal = data.sl || slPrice;
              const tpVal = data.tp || null;

              useChartRuntimeStore.getState().upsertVirtualPosition({
                id: vpId,
                symbol: tradingSymbol,
                side,
                quantity: data.volume || 1,
                entryPrice: resolvedFillPrice ?? 0,
                status: 'open',
                unrealizedPnl: 0,
                openedAt: Date.now(),
                fillIds: [],
              });
              useChartRuntimeStore.getState().upsertBracketOrder({
                id: `bracket-${vpId}`,
                positionId: vpId,
                symbol: tradingSymbol,
                stopLossPrice: slVal,
                takeProfitPrice: tpVal,
                stopLossStatus: slVal ? 'active' : 'none',
                takeProfitStatus: tpVal ? 'active' : 'none',
                updatedAt: Date.now(),
              });
            } else {
              setChartOrderMessage({ type: 'error', text: data.error || 'Market Order rejected by EA' });
            }
            setTradingStatus({ pendingMarketOrderId: null, marketOrderDrag: null });
            return;
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
      
      setChartOrderMessage({ type: 'error', text: 'No response from EA' });
      setTradingStatus({ pendingMarketOrderId: null, marketOrderDrag: null });
    } catch (err: unknown) {
      setChartOrderMessage({ type: 'error', text: (err as Error).message || 'Bridge connection error' });
      setTradingStatus({ pendingMarketOrderId: null });
    }
  }, [tradingSymbol, setTradingStatus, panelId]);

  const handleConfirmBracketModify = useCallback(async () => {
    if (!pendingModifyBracket) return;
    
    const requestId = crypto.randomUUID();
    const { positionId, sl, tp } = pendingModifyBracket;
    
    // Set some loading state if needed, here we can use the same pattern
    // but there's no global modify loading for brackets yet, so we just await inline
    // In a full implementation we'd set a flag.
    
    try {
      const res = await fetch('http://localhost:3001/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          ticket: parseInt(positionId, 10),
          sl: sl,
          tp: tp,
        }),
      });

      if (!res.ok) throw new Error('Failed to send modify to bridge');

      const maxRetries = 50; // 10 seconds
      for (let i = 0; i < maxRetries; i++) {
        const pollRes = await fetch(`http://localhost:3001/modify-result/${requestId}`);
        if (pollRes.ok) {
          const data = await pollRes.json();
          if (data.success !== undefined) {
            if (data.success) {
              setChartOrderMessage({ type: 'success', text: `Bracket for #${positionId} modified successfully` });
              // Update local state
              const store = useChartRuntimeStore.getState();
              const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
              if (existing) {
                store.upsertBracketOrder({
                  ...existing,
                  stopLossPrice: sl,
                  takeProfitPrice: tp,
                  updatedAt: Date.now(),
                });
              }
              setShowModifyBracketConfirm(false);
              setPendingModifyBracket(null);
            } else {
              setChartOrderMessage({ type: 'error', text: data.error || 'Modification rejected by EA' });
              // Close modal on error, line snaps back automatically
              setShowModifyBracketConfirm(false);
              setPendingModifyBracket(null);
            }
            return;
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
      
      setChartOrderMessage({ type: 'error', text: 'No response from EA' });
      setShowModifyBracketConfirm(false);
      setPendingModifyBracket(null);
    } catch (err: unknown) {
      setChartOrderMessage({ type: 'error', text: (err as Error).message || 'Bridge connection error' });
      setShowModifyBracketConfirm(false);
      setPendingModifyBracket(null);
    }
  }, [pendingModifyBracket]);

  const executeBracketModifyDirect = useCallback(async ({
    positionId,
    sl,
    tp,
    originalSl,
    originalTp,
  }: {
    positionId: string;
    sl: number;
    tp: number;
    originalSl?: number;
    originalTp?: number;
  }) => {
    const requestId = crypto.randomUUID();
    try {
      const res = await fetch('http://localhost:3001/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          ticket: parseInt(positionId, 10),
          sl,
          tp,
        }),
      });

      if (!res.ok) throw new Error('Failed to send modify to bridge');

      const maxRetries = 50; // 10 seconds
      for (let i = 0; i < maxRetries; i++) {
        const pollRes = await fetch(`http://localhost:3001/modify-result/${requestId}`);
        if (pollRes.ok) {
          const data = await pollRes.json();
          if (data.success !== undefined) {
            if (data.success) {
              setChartOrderMessage({ type: 'success', text: `Bracket for #${positionId} modified successfully` });
              const store = useChartRuntimeStore.getState();
              const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
              if (existing) {
                store.upsertBracketOrder({
                  ...existing,
                  stopLossPrice: sl > 0 ? sl : undefined,
                  takeProfitPrice: tp > 0 ? tp : undefined,
                  stopLossStatus: sl > 0 ? 'active' : 'none',
                  takeProfitStatus: tp > 0 ? 'active' : 'none',
                  updatedAt: Date.now(),
                });
              }
            } else {
              setChartOrderMessage({ type: 'error', text: data.error || 'Modification rejected by EA' });
              // Revert to original prices on rejection
              const store = useChartRuntimeStore.getState();
              const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
              if (existing) {
                store.upsertBracketOrder({
                  ...existing,
                  stopLossPrice: originalSl,
                  takeProfitPrice: originalTp,
                  stopLossStatus: originalSl && originalSl > 0 ? 'active' : 'none',
                  takeProfitStatus: originalTp && originalTp > 0 ? 'active' : 'none',
                  updatedAt: Date.now(),
                });
                redraw();
              }
            }
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      setChartOrderMessage({ type: 'error', text: 'No response from EA' });
      // Revert on timeout
      const store = useChartRuntimeStore.getState();
      const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
      if (existing) {
        store.upsertBracketOrder({
          ...existing,
          stopLossPrice: originalSl,
          takeProfitPrice: originalTp,
          stopLossStatus: originalSl && originalSl > 0 ? 'active' : 'none',
          takeProfitStatus: originalTp && originalTp > 0 ? 'active' : 'none',
          updatedAt: Date.now(),
        });
        redraw();
      }
    } catch (err: unknown) {
      setChartOrderMessage({ type: 'error', text: (err as Error).message || 'Bridge connection error' });
      // Revert on error
      const store = useChartRuntimeStore.getState();
      const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
      if (existing) {
        store.upsertBracketOrder({
          ...existing,
          stopLossPrice: originalSl,
          takeProfitPrice: originalTp,
          stopLossStatus: originalSl && originalSl > 0 ? 'active' : 'none',
          takeProfitStatus: originalTp && originalTp > 0 ? 'active' : 'none',
          updatedAt: Date.now(),
        });
        redraw();
      }
    }
  }, [redraw]);

  const handleRemoveStopLoss = useCallback(async (positionId: string) => {
    const store = useChartRuntimeStore.getState();
    const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
    if (!existing) return;

    const originalSl = existing.stopLossPrice;
    const currentTp = existing.takeProfitPrice || 0;

    // Optimistically remove SL in local store
    store.upsertBracketOrder({
      ...existing,
      stopLossPrice: undefined,
      stopLossStatus: 'none',
      updatedAt: Date.now(),
    });
    redraw();

    void executeBracketModifyDirect({
      positionId,
      sl: 0,
      tp: currentTp,
      originalSl,
      originalTp: currentTp,
    });
  }, [executeBracketModifyDirect, redraw]);

  const handleRemoveTakeProfit = useCallback(async (positionId: string) => {
    const store = useChartRuntimeStore.getState();
    const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);
    if (!existing) return;

    const currentSl = existing.stopLossPrice || 0;
    const originalTp = existing.takeProfitPrice;

    // Optimistically remove TP in local store
    store.upsertBracketOrder({
      ...existing,
      takeProfitPrice: undefined,
      takeProfitStatus: 'none',
      updatedAt: Date.now(),
    });
    redraw();

    void executeBracketModifyDirect({
      positionId,
      sl: currentSl,
      tp: 0,
      originalSl: currentSl,
      originalTp,
    });
  }, [executeBracketModifyDirect, redraw]);

  const handleExecuteClosePosition = useCallback(async () => {
    if (!confirmClosePosition) return;
    setIsClosingPosition(true);
    const positionId = confirmClosePosition.id;
    const requestId = crypto.randomUUID();

    try {
      const res = await fetch('http://localhost:3001/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          ticket: parseInt(positionId, 10),
        }),
      });

      if (!res.ok) throw new Error('Failed to send close request to bridge');

      const maxRetries = 50; // 10 seconds
      for (let i = 0; i < maxRetries; i++) {
        const pollRes = await fetch(`http://localhost:3001/close-result/${requestId}`);
        if (pollRes.ok) {
          const data = await pollRes.json();
          if (data.success !== undefined) {
            if (data.success) {
              setChartOrderMessage({ type: 'success', text: `Position #${positionId} closed` });
              // Optimistically remove position and bracket from store
              const store = useChartRuntimeStore.getState();
              const nextVps = store.tradingStatus.virtualPositions.filter((p) => p.id !== positionId);
              const nextBrackets = store.tradingStatus.bracketOrders.filter((b) => b.positionId !== positionId);
              store.setTradingStatus({
                virtualPositions: nextVps,
                bracketOrders: nextBrackets,
              });
              setConfirmClosePosition(null);
              redraw();
            } else {
              setChartOrderMessage({ type: 'error', text: data.error || 'Close position rejected by EA' });
              setConfirmClosePosition(null);
            }
            setIsClosingPosition(false);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      setChartOrderMessage({ type: 'error', text: 'No response from EA' });
      setConfirmClosePosition(null);
    } catch (err: unknown) {
      setChartOrderMessage({ type: 'error', text: (err as Error).message || 'Bridge connection error' });
      setConfirmClosePosition(null);
    } finally {
      setIsClosingPosition(false);
    }
  }, [confirmClosePosition, redraw]);

  // Auto-dismiss chart notifications after 3.5s
  useEffect(() => {
    if (!chartOrderMessage && !orderActionSuccess && !orderActionError && !modifySuccess && !modifyError) return;
    const timer = setTimeout(() => {
      setChartOrderMessage(null);
      useChartRuntimeStore.getState().setTradingStatus({
        orderActionSuccess: null,
        orderActionError: null,
        modifySuccess: null,
        modifyError: null,
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [chartOrderMessage, orderActionSuccess, orderActionError, modifySuccess, modifyError]);

  // Drawing Interaction Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (lineDrawMode !== 'none') {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        if (x > chartWidth || y > chartHeight) return;

        if (lineDrawMode === 'horizontal') {
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'horizontal', value: price });
        } else if (lineDrawMode === 'horizontal-ray') {
          const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'horizontal-ray', value: price, startIndex: index, startTime: candleTimeAt(index, candles) });
        } else if (lineDrawMode === 'vertical') {
          const candles = useChartRuntimeStore.getState().panels[panelId]?.candles ?? [];
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'vertical', value: index, time: candleTimeAt(index, candles) });
        } else if (lineDrawMode === 'box') {
          dragStart.current = { x, y };
          dragEnd.current = { x, y };
          isDragging.current = true;
          return;
        } else if (lineDrawMode === 'long-position' || lineDrawMode === 'short-position' || lineDrawMode === 'position') {
          dragStart.current = { x, y };
          dragEnd.current = { x, y };
          isDragging.current = true;
          return;
        } else if (lineDrawMode === 'buy' || lineDrawMode === 'sell') {
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;
          const slPrice = yToPrice(y, priceMin, priceMax, chartHeight);
          const direction = lineDrawMode;
          useChartStore.getState().setLineDrawMode(panelId, 'none');
          executeMarketOrder(direction, slPrice);
          redraw();
          return;
        }
        useChartStore.getState().setLineDrawMode(panelId, 'none');
        redraw();
        return;
      }

      const measureToolActive = useChartRuntimeStore.getState().panels[panelId]?.measureToolActive ?? false;
      if (isDrawMode || measureToolActive) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        if (x > chartWidth || y > chartHeight) return;
        dragStart.current = { x, y };
        dragEnd.current = { x, y };
        isDragging.current = true;
        
        if (isDrawMode) {
          useChartStore.getState().setCustomProfileRange(panelId, null);
        } else {
          useChartRuntimeStore.getState().setActiveMeasurement(panelId, null);
        }
        return;
      }


    const getUnifiedHitTarget = (x: number, y: number) => {
      const runtimeState = useChartRuntimeStore.getState();
      const candles = runtimeState.panels[panelId]?.candles ?? [];
      const virtualPositions = runtimeState.tradingStatus.virtualPositions;
      const bracketOrders = runtimeState.tradingStatus.bracketOrders;
      const openOrders = runtimeState.tradingStatus.openOrders;

      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = getBottomLayout(rect.height).mainChartHeight;
      const pCenter = priceCenter.current ?? 0;
      const pRange = priceRange.current ?? 100;
      const priceMin = pCenter - pRange / 2;
      const priceMax = pCenter + pRange / 2;
      const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
      const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

      // 1. Bracket Handles
      for (const vp of virtualPositions) {
        if (vp.status !== 'open') continue;
        const slBox = bracketHitZones.current.slHandles.get(vp.id);
        const tpBox = bracketHitZones.current.tpHandles.get(vp.id);
        const hitSL = slBox && x >= slBox.x && x <= slBox.x + slBox.w && y >= slBox.y && y <= slBox.y + slBox.h;
        const hitTP = !hitSL && tpBox && x >= tpBox.x && x <= tpBox.x + tpBox.w && y >= tpBox.y && y <= tpBox.y + tpBox.h;
        if (hitSL || hitTP) {
          const bracket = bracketOrders.find((b) => b.positionId === vp.id);
          const handle = hitSL ? 'sl' : 'tp';
          const startPrice = hitSL ? (bracket?.stopLossPrice ?? vp.entryPrice) : (bracket?.takeProfitPrice ?? vp.entryPrice);
          return { type: 'bracket' as const, positionId: vp.id, handle, startPrice, side: vp.side, entryPrice: vp.entryPrice };
        }
      }

      // 2. Open Orders
      for (const order of openOrders) {
        if (getOrderHitZone(order, x, y, chartWidth, chartHeight, priceToY)) {
          return { type: 'order' as const, order };
        }
      }

      const storeState = useChartStore.getState();
      const currentPanel = storeState.panels[panelId];

      // 3. Custom Profile
      if (currentPanel.customProfileRange) {
        const resolvedRange = resolveCustomProfileRange(currentPanel.customProfileRange, candles);
        const isSelected = runtimeState.panels[panelId]?.isProfileSelected ?? false;
        const hitZone = getCustomProfileHitZone(
          resolvedRange, x, y, candles.length, scrollOffset.current, barWidth.current,
          chartWidth, chartHeight, profileWidth, priceMin, priceMax, currentPanel.customProfileLocked, isSelected
        );
        if (hitZone) return { type: 'custom-profile' as const, hitZone, resolvedRange };
      }

      // 4. Drawing Tools (reverse creation order)
      const currentSelectedId = selectedDrawingId;
      const drawnLines = currentPanel.drawnLines;
      const resolvedDrawnLines = drawnLines.map(l => resolveLineForRender(l, candles)).filter(Boolean) as DrawnLine[];
      for (let i = resolvedDrawnLines.length - 1; i >= 0; i--) {
        const line = resolvedDrawnLines[i];
        const isSelected = line.id === currentSelectedId;
        const hitZone = getDrawingHitZone(line, x, y, indexToX, priceToY, chartWidth, chartHeight, barWidth.current, isSelected);
        if (hitZone) return { type: 'drawing' as const, id: line.id, hitZone, line };
      }

      return null;
    };

      const hitTarget = getUnifiedHitTarget(x, y);

      if (hitTarget) {
        if (hitTarget.type === 'bracket') {
          isDraggingBracket.current = true;
          bracketDragEntryPrice.current = hitTarget.entryPrice;
          bracketDragSide.current = hitTarget.side;
          bracketDragRef.current = { positionId: hitTarget.positionId, handle: hitTarget.handle as 'sl' | 'tp', previewPrice: hitTarget.startPrice };
          useChartRuntimeStore.getState().setBracketDrag({ positionId: hitTarget.positionId, handle: hitTarget.handle as 'sl' | 'tp', previewPrice: hitTarget.startPrice });
          setSelectedDrawingId(null);
          useChartRuntimeStore.getState().setProfileSelected(panelId, false);
          redraw();
          return;
        }

        if (hitTarget.type === 'order') {
          const blockReason = getModifyBlockReason({
            order: hitTarget.order,
            symbol: tradingSymbol,
            contractType: tradingContractType,
            mode: currentTradingMode,
            modeBadge,
            riskStatus,
          });
          if (blockReason) {
            setChartOrderMessage({ type: 'error', text: blockReason });
            redraw();
            return;
          }
          setSelectedDrawingId(null);
          useChartRuntimeStore.getState().setProfileSelected(panelId, false);
          orderDragSnapshot.current = hitTarget.order;
          orderDragOriginalPrice.current = hitTarget.order.price!;
          isDraggingOrderLine.current = true;
          setPendingModifyOrder(null);
          setShowModifyConfirm(false);
          setChartOrderMessage(null);
          setTradingStatus({
            modifyingOrderId: hitTarget.order.id,
            dragPreviewPrice: hitTarget.order.price!,
            modifyError: null,
            modifySuccess: null,
          });
          redraw();
          return;
        }

        if (hitTarget.type === 'custom-profile') {
          const currentPanel = useChartStore.getState().panels[panelId];
          setSelectedDrawingId(null);
          useChartRuntimeStore.getState().setProfileSelected(panelId, true);
          
          if (!currentPanel.customProfileLocked && hitTarget.resolvedRange) {
            dragAnchor.current = { x, y };
            profileSnapshot.current = hitTarget.resolvedRange;
            if (hitTarget.hitZone === 'move') {
              isDraggingProfile.current = true;
            } else {
              isDraggingResize.current = true;
              resizeEdge.current = hitTarget.hitZone.replace('resize-', '') as 'left' | 'right' | 'top' | 'bottom';
            }
          }
          redraw();
          return;
        }

        if (hitTarget.type === 'drawing') {
          if (hitTarget.hitZone === 'delete') {
            useChartStore.getState().removeLine(panelId, hitTarget.id);
            if (selectedDrawingId === hitTarget.id) setSelectedDrawingId(null);
            hoveredLineId.current = null;
            isHoveringDeleteDot.current = false;
            hoveredDrawingZone.current = null;
            redraw();
            return;
          }

          setSelectedDrawingId(hitTarget.id);
          useChartRuntimeStore.getState().setProfileSelected(panelId, false);
          if (!hitTarget.line.locked) {
            dragAnchor.current = { x, y };
            drawingSnapshot.current = hitTarget.line;
            drawingDragZone.current = hitTarget.hitZone;
            isDraggingDrawing.current = true;
          }
          redraw();
          return;
        }
      }

      setSelectedDrawingId(null);
      useChartRuntimeStore.getState().setProfileSelected(panelId, false);
      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      const runtimeState = useChartRuntimeStore.getState();
      const candles = runtimeState.panels[panelId]?.candles ?? [];
      const exhaustionMap = runtimeState.panels[panelId]?.exhaustionMap ?? new Map();
      const icebergLevels = runtimeState.panels[panelId]?.icebergLevels ?? [];
      const virtualPositions = runtimeState.tradingStatus.virtualPositions ?? [];
      const bracketOrders = runtimeState.tradingStatus.bracketOrders ?? [];
      const openOrders = runtimeState.tradingStatus.openOrders ?? [];
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let cursor = 'crosshair';

      const measureToolActive = useChartRuntimeStore.getState().panels[panelId]?.measureToolActive ?? false;

      if (lineDrawMode !== 'none') {
        cursor = 'crosshair';
        hoveredLineId.current = null;
        hoveredDrawingZone.current = null;
        isHoveringDeleteDot.current = false;
      } else if (measureToolActive || isDragging.current || isDrawMode) {
        cursor = 'crosshair';
      } else if (isDraggingDrawing.current) {
        cursor = drawingDragZone.current === 'move' ? 'grabbing' : 'crosshair';
      } else if (isDraggingProfile.current) {
        cursor = 'grabbing';
      } else if (isDraggingResize.current) {
        cursor = (resizeEdge.current === 'left' || resizeEdge.current === 'right') ? 'ew-resize' : 'ns-resize';
      } else if (isDraggingOrderLine.current || isDraggingBracket.current) {
        cursor = 'ns-resize';
      } else if (isPanZoomDragging.current) {
        if (panZoomDragMode.current === 'price') cursor = 'ns-resize';
        else if (panZoomDragMode.current === 'time') cursor = 'ew-resize';
        else cursor = 'grabbing';
      } else {
        hoverZone.current = null;
        hoveredLineId.current = null;
        hoveredDrawingZone.current = null;
        isHoveringDeleteDot.current = false;


    const getUnifiedHitTarget = (x: number, y: number) => {
      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = getBottomLayout(rect.height).mainChartHeight;
      const pCenter = priceCenter.current ?? 0;
      const pRange = priceRange.current ?? 100;
      const priceMin = pCenter - pRange / 2;
      const priceMax = pCenter + pRange / 2;
      const priceToY = (price: number) => calcPriceToY(price, priceMin, priceMax, chartHeight);
      const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

      // 1. Bracket Handles
      for (const vp of virtualPositions) {
        if (vp.status !== 'open') continue;
        const slBox = bracketHitZones.current.slHandles.get(vp.id);
        const tpBox = bracketHitZones.current.tpHandles.get(vp.id);
        const hitSL = slBox && x >= slBox.x && x <= slBox.x + slBox.w && y >= slBox.y && y <= slBox.y + slBox.h;
        const hitTP = !hitSL && tpBox && x >= tpBox.x && x <= tpBox.x + tpBox.w && y >= tpBox.y && y <= tpBox.y + tpBox.h;
        if (hitSL || hitTP) {
          const bracket = bracketOrders.find((b) => b.positionId === vp.id);
          const handle = hitSL ? 'sl' : 'tp';
          const startPrice = hitSL ? (bracket?.stopLossPrice ?? vp.entryPrice) : (bracket?.takeProfitPrice ?? vp.entryPrice);
          return { type: 'bracket' as const, positionId: vp.id, handle, startPrice, side: vp.side, entryPrice: vp.entryPrice };
        }
      }

      // 2. Open Orders
      for (const order of openOrders) {
        if (getOrderHitZone(order, x, y, chartWidth, chartHeight, priceToY)) {
          return { type: 'order' as const, order };
        }
      }

      const storeState = useChartStore.getState();
      const currentPanel = storeState.panels[panelId];

      // 3. Custom Profile
      if (currentPanel.customProfileRange) {
        const resolvedRange = resolveCustomProfileRange(currentPanel.customProfileRange, candles);
        const isSelected = runtimeState.panels[panelId]?.isProfileSelected ?? false;
        const hitZone = getCustomProfileHitZone(
          resolvedRange, x, y, candles.length, scrollOffset.current, barWidth.current,
          chartWidth, chartHeight, profileWidth, priceMin, priceMax, currentPanel.customProfileLocked, isSelected
        );
        if (hitZone) return { type: 'custom-profile' as const, hitZone, resolvedRange };
      }

      // 4. Drawing Tools (reverse creation order)
      const currentSelectedId = selectedDrawingId;
      const drawnLines = currentPanel.drawnLines;
      const resolvedDrawnLines = drawnLines.map(l => resolveLineForRender(l, candles)).filter(Boolean) as DrawnLine[];
      for (let i = resolvedDrawnLines.length - 1; i >= 0; i--) {
        const line = resolvedDrawnLines[i];
        const isSelected = line.id === currentSelectedId;
        const hitZone = getDrawingHitZone(line, x, y, indexToX, priceToY, chartWidth, chartHeight, barWidth.current, isSelected);
        if (hitZone) return { type: 'drawing' as const, id: line.id, hitZone, line };
      }

      return null;
    };

        const hitTarget = getUnifiedHitTarget(x, y);

        if (hitTarget) {
          if (hitTarget.type === 'bracket' || hitTarget.type === 'order') {
            cursor = 'ns-resize';
          } else if (hitTarget.type === 'custom-profile') {
            hoverZone.current = hitTarget.hitZone;
            if (hitTarget.hitZone.startsWith('resize-')) {
              cursor = (hitTarget.hitZone === 'resize-left' || hitTarget.hitZone === 'resize-right') ? 'ew-resize' : 'ns-resize';
            } else if (hitTarget.hitZone === 'move') {
              cursor = 'grab';
            }
          } else if (hitTarget.type === 'drawing') {
            hoveredLineId.current = hitTarget.id;
            hoveredDrawingZone.current = hitTarget.hitZone;
            if (hitTarget.hitZone === 'delete') {
              isHoveringDeleteDot.current = true;
              cursor = 'pointer';
            } else if (hitTarget.hitZone.startsWith('resize-')) {
              cursor = (hitTarget.hitZone === 'resize-left' || hitTarget.hitZone === 'resize-right') ? 'ew-resize' : 'ns-resize';
            } else if (hitTarget.hitZone === 'move') {
              cursor = 'grab';
            }
          }
        }

        // Exhaustion Hover Detection
        let foundEx = false;
        if (!hitTarget && exhaustionEnabled && exhaustionMap.size > 0) {
          const chartWidth = rect.width - priceAxisWidth;
          const chartHeight = getBottomLayout(rect.height).mainChartHeight;
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

          let foundIceberg = false;
          if (!hitTarget && icebergEnabled && icebergLevels.length > 0) {
            const chartWidth = rect.width - priceAxisWidth;
            const chartHeight = getBottomLayout(rect.height).mainChartHeight;
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
      }

      canvas.style.cursor = cursor;
      redraw();

      // Drag Logic
      if (isDraggingBracket.current && bracketDragRef.current) {
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange  = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const rawPrice   = yToPrice(Math.max(0, Math.min(chartHeight, y)), priceMin, priceMax, chartHeight);
        const entryPrice = bracketDragEntryPrice.current ?? rawPrice;
        const side       = bracketDragSide.current ?? 'long';
        const { handle, positionId } = bracketDragRef.current;

        let clampedPrice = rawPrice;
        if (handle === 'sl') {
          clampedPrice = side === 'long'
            ? Math.min(rawPrice, entryPrice - 1)
            : Math.max(rawPrice, entryPrice + 1);
        } else {
          clampedPrice = side === 'long'
            ? Math.max(rawPrice, entryPrice + 1)
            : Math.min(rawPrice, entryPrice - 1);
        }

        if (Number.isFinite(clampedPrice)) {
          const next: BracketDragState = { positionId, handle, previewPrice: clampedPrice };
          bracketDragRef.current = next;
          useChartRuntimeStore.getState().setBracketDrag(next);
          redraw();
        }
      } else if (isDraggingOrderLine.current) {
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const nextPrice = yToPrice(Math.max(0, Math.min(chartHeight, y)), priceMin, priceMax, chartHeight);
        setTradingStatus({
          modifyingOrderId: orderDragSnapshot.current?.id ?? null,
          dragPreviewPrice: Number.isFinite(nextPrice) ? nextPrice : null,
          modifyError: null,
        });
        redraw();
      } else if (
        isDragging.current &&
        (isDrawMode || measureToolActive || lineDrawMode === 'box' || lineDrawMode === 'long-position' || lineDrawMode === 'short-position' || lineDrawMode === 'position')
      ) {
        dragEnd.current = { x, y };
        redraw();
      } else if (isDraggingDrawing.current && dragAnchor.current && drawingSnapshot.current && drawingDragZone.current) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const snapshot = drawingSnapshot.current;
        const zone = drawingDragZone.current;

        if (snapshot.type === 'horizontal') {
          if (zone === 'move') {
            const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
            const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
            useChartStore.getState().updateLine(panelId, snapshot.id, {
              value: snapshot.value + (priceAtCurrent - priceAtAnchor),
            });
          }
          redraw();
        } else if (snapshot.type === 'vertical') {
          if (zone === 'move') {
            const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
            useChartStore.getState().updateLine(panelId, snapshot.id, {
              value: index,
              time: candleTimeAt(index, candles),
            });
          }
          redraw();
        } else if (snapshot.type === 'horizontal-ray') {
          const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
          const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
          const priceDelta = priceAtCurrent - priceAtAnchor;
          const baseStartIndex = resolveIndexFromTimeOrFallback(snapshot.startTime, snapshot.startIndex, candles);

          if (zone === 'resize-left') {
            const startIndex = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
            useChartStore.getState().updateLine(panelId, snapshot.id, {
              startIndex,
              startTime: candleTimeAt(startIndex, candles),
              value: priceAtCurrent,
            });
          } else if (zone === 'move' && baseStartIndex !== null) {
            const indexDelta = Math.round((x - dragAnchor.current.x) / barWidth.current);
            const startIndex = Math.max(0, baseStartIndex + indexDelta);
            useChartStore.getState().updateLine(panelId, snapshot.id, {
              startIndex,
              startTime: candleTimeAt(startIndex, candles),
              value: snapshot.value + priceDelta,
            });
          }
          redraw();
        } else if (
          snapshot.type === 'box' &&
          snapshot.firstIndex !== undefined &&
          snapshot.lastIndex !== undefined &&
          snapshot.priceHigh !== undefined &&
          snapshot.priceLow !== undefined
        ) {
          const updates: Partial<DrawnLine> = {};
          const baseFirstIndex = resolveIndexFromTimeOrFallback(snapshot.firstTime, snapshot.firstIndex, candles);
          const baseLastIndex = resolveIndexFromTimeOrFallback(snapshot.lastTime, snapshot.lastIndex, candles);
          if (baseFirstIndex === null || baseLastIndex === null) {
            redraw();
            return;
          }

          if (zone === 'move') {
            const indexDelta = Math.round((x - dragAnchor.current.x) / barWidth.current);
            const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
            const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
            const priceDelta = priceAtCurrent - priceAtAnchor;
            updates.firstIndex = Math.max(0, baseFirstIndex + indexDelta);
            updates.lastIndex = Math.max(0, baseLastIndex + indexDelta);
            updates.firstTime = candleTimeAt(updates.firstIndex, candles);
            updates.lastTime = candleTimeAt(updates.lastIndex, candles);
            updates.priceHigh = snapshot.priceHigh + priceDelta;
            updates.priceLow = snapshot.priceLow + priceDelta;
          } else if (zone === 'resize-left' || zone === 'resize-right') {
            const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
            if (zone === 'resize-left') {
              updates.firstIndex = Math.min(index, baseLastIndex - 1);
              updates.firstTime = candleTimeAt(updates.firstIndex, candles);
            } else {
              updates.lastIndex = Math.max(index, baseFirstIndex + 1);
              updates.lastTime = candleTimeAt(updates.lastIndex, candles);
            }
          } else if (zone === 'resize-top' || zone === 'resize-bottom') {
            const price = yToPrice(y, priceMin, priceMax, chartHeight);
            if (zone === 'resize-top') {
              updates.priceHigh = Math.max(price, snapshot.priceLow + bucketSize);
            } else {
              updates.priceLow = Math.min(price, snapshot.priceHigh - bucketSize);
            }
          }

          useChartStore.getState().updateLine(panelId, snapshot.id, updates);
          redraw();
        } else if (hasPositionGeometry(snapshot)) {
          const updates: Partial<DrawnLine> = {};
          const baseFirstIndex = resolveIndexFromTimeOrFallback(snapshot.firstTime, snapshot.firstIndex, candles);
          const baseLastIndex = resolveIndexFromTimeOrFallback(snapshot.lastTime, snapshot.lastIndex, candles);
          if (baseFirstIndex === null || baseLastIndex === null) {
            redraw();
            return;
          }

          const minGap = Math.max(tickSize, bucketSize * 0.01);
          const isLong = snapshot.type === 'long-position';
          const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);

          if (zone === 'move') {
            const indexDelta = Math.round((x - dragAnchor.current.x) / barWidth.current);
            const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
            const priceDelta = priceAtCurrent - priceAtAnchor;
            updates.firstIndex = Math.max(0, baseFirstIndex + indexDelta);
            updates.lastIndex = Math.max(0, baseLastIndex + indexDelta);
            updates.firstTime = candleTimeAt(updates.firstIndex, candles);
            updates.lastTime = candleTimeAt(updates.lastIndex, candles);
            updates.value = snapshot.value + priceDelta;
            updates.stopPrice = snapshot.stopPrice! + priceDelta;
            if (snapshot.targetPrice !== undefined) updates.targetPrice = snapshot.targetPrice! + priceDelta;
          } else if (zone === 'resize-left' || zone === 'resize-right') {
            const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
            if (zone === 'resize-left') {
              updates.firstIndex = Math.min(index, baseLastIndex - 1);
              updates.firstTime = candleTimeAt(updates.firstIndex, candles);
            } else {
              updates.lastIndex = Math.max(index, baseFirstIndex + 1);
              updates.lastTime = candleTimeAt(updates.lastIndex, candles);
            }
          } else if (zone === 'resize-entry') {
            if (isLong) {
              updates.value = Math.max(snapshot.stopPrice! + minGap, snapshot.targetPrice !== undefined ? Math.min(snapshot.targetPrice! - minGap, priceAtCurrent) : priceAtCurrent);
            } else {
              updates.value = Math.min(snapshot.stopPrice! - minGap, snapshot.targetPrice !== undefined ? Math.max(snapshot.targetPrice! + minGap, priceAtCurrent) : priceAtCurrent);
            }
          } else if (zone === 'resize-stop') {
            updates.stopPrice = isLong
              ? Math.min(priceAtCurrent, snapshot.value - minGap)
              : Math.max(priceAtCurrent, snapshot.value + minGap);
          } else if (zone === 'resize-target') {
            updates.targetPrice = isLong
              ? Math.max(priceAtCurrent, snapshot.value + minGap)
              : Math.min(priceAtCurrent, snapshot.value - minGap);
          }

          useChartStore.getState().updateLine(panelId, snapshot.id, updates);
          redraw();
        }
      } else if (isDraggingProfile.current && dragAnchor.current && profileSnapshot.current) {
        const deltaX = x - dragAnchor.current.x;
        const currentBarWidth = barWidth.current;
        const indexDelta = Math.round(deltaX / currentBarWidth);
        const baseFirstIndex = resolveIndexFromTimeOrFallback(profileSnapshot.current.firstTime, profileSnapshot.current.firstIndex, candles);
        const baseLastIndex = resolveIndexFromTimeOrFallback(profileSnapshot.current.lastTime, profileSnapshot.current.lastIndex, candles);
        if (baseFirstIndex === null || baseLastIndex === null) {
          redraw();
          return;
        }

        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;

        const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
        const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
        const priceDelta = priceAtCurrent - priceAtAnchor;

        const newRange = {
          firstIndex: Math.max(0, baseFirstIndex + indexDelta),
          lastIndex: Math.max(0, baseLastIndex + indexDelta),
          priceHigh: profileSnapshot.current.priceHigh + priceDelta,
          priceLow: profileSnapshot.current.priceLow + priceDelta,
        };
        const nextRange = {
          ...newRange,
          firstTime: candleTimeAt(newRange.firstIndex, candles),
          lastTime: candleTimeAt(newRange.lastIndex, candles),
        };

        useChartStore.getState().setCustomProfileRange(panelId, nextRange);
        redraw();
      } else if (isDraggingResize.current && dragAnchor.current && profileSnapshot.current) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;

        const updatedRange = { ...profileSnapshot.current };
        const baseFirstIndex = resolveIndexFromTimeOrFallback(profileSnapshot.current.firstTime, profileSnapshot.current.firstIndex, candles);
        const baseLastIndex = resolveIndexFromTimeOrFallback(profileSnapshot.current.lastTime, profileSnapshot.current.lastIndex, candles);
        if (baseFirstIndex === null || baseLastIndex === null) {
          redraw();
          return;
        }

        if (resizeEdge.current === 'left' || resizeEdge.current === 'right') {
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          if (resizeEdge.current === 'left') {
            updatedRange.firstIndex = Math.min(index, baseLastIndex - 2);
            updatedRange.firstTime = candleTimeAt(updatedRange.firstIndex, candles);
          } else {
            updatedRange.lastIndex = Math.max(index, baseFirstIndex + 2);
            updatedRange.lastTime = candleTimeAt(updatedRange.lastIndex, candles);
          }
        } else {
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          if (resizeEdge.current === 'top') {
            updatedRange.priceHigh = Math.max(price, profileSnapshot.current.priceLow + bucketSize);
          } else {
            updatedRange.priceLow = Math.min(price, profileSnapshot.current.priceHigh - bucketSize);
          }
        }

        const bucketSizeVal = useChartStore.getState().panels[panelId].bucketSize;
        if (Math.abs(updatedRange.lastIndex - updatedRange.firstIndex) >= 2 &&
          Math.abs(updatedRange.priceHigh - updatedRange.priceLow) >= bucketSizeVal) {
          useChartStore.getState().setCustomProfileRange(panelId, updatedRange);
          redraw();
        }
      }
    };

    const onMouseUp = () => {
      const runtimeState = useChartRuntimeStore.getState();
      const candles = runtimeState.panels[panelId]?.candles ?? [];
      const measureToolActive = runtimeState.panels[panelId]?.measureToolActive ?? false;

      if (
        !isDragging.current &&
        !isDraggingProfile.current &&
        !isDraggingResize.current &&
        !isDraggingDrawing.current &&
        !isDraggingOrderLine.current &&
        !isDraggingBracket.current
      ) return;

      // ── Commit bracket SL/TP drag ──────────────────────────────────────────
      if (isDraggingBracket.current && bracketDragRef.current) {
        const { positionId, handle, previewPrice } = bracketDragRef.current;
        const store = useChartRuntimeStore.getState();
        const existing = store.tradingStatus.bracketOrders.find((b) => b.positionId === positionId);

        if (Number.isFinite(previewPrice) && previewPrice > 0) {
          const originalSl = existing?.stopLossPrice;
          const originalTp = existing?.takeProfitPrice;
          const nextSl = handle === 'sl' ? previewPrice : (existing?.stopLossPrice || 0);
          const nextTp = handle === 'tp' ? previewPrice : (existing?.takeProfitPrice || 0);

          if (!bracketDragConfirmEnabled) {
            // OPTIMISTIC LOCAL UPDATE: Update bracket order in runtime store immediately
            const bracketToUpsert: BracketOrder = {
              id: existing?.id ?? `bracket-${positionId}`,
              positionId,
              symbol: existing?.symbol ?? tradingSymbol,
              stopLossPrice: nextSl > 0 ? nextSl : undefined,
              takeProfitPrice: nextTp > 0 ? nextTp : undefined,
              stopLossStatus: nextSl > 0 ? 'active' : 'none',
              takeProfitStatus: nextTp > 0 ? 'active' : 'none',
              updatedAt: Date.now(),
            };
            store.upsertBracketOrder(bracketToUpsert);

            // Revert the temporary drag visualization without any snap-back
            store.setBracketDrag(null);

            // Fire modification to bridge asynchronously in the background
            void executeBracketModifyDirect({
              positionId,
              sl: nextSl,
              tp: nextTp,
              originalSl,
              originalTp,
            });
          } else {
            // Revert the temporary drag visualization for confirmation flow
            store.setBracketDrag(null);
            
            setPendingModifyBracket({
              positionId,
              sl: nextSl,
              tp: nextTp,
            });
            setShowModifyBracketConfirm(true);
          }
        } else {
          store.setBracketDrag(null);
        }

        // Reset bracket drag state
        isDraggingBracket.current    = false;
        bracketDragRef.current        = null;
        bracketDragEntryPrice.current = null;
        bracketDragSide.current       = null;
        redraw();
        return;
      }

      if (isDraggingOrderLine.current) {
        const order = orderDragSnapshot.current;
        const originalPrice = orderDragOriginalPrice.current;
        const newPrice = useChartRuntimeStore.getState().tradingStatus.dragPreviewPrice;
        isDraggingOrderLine.current = false;
        orderDragSnapshot.current = null;
        orderDragOriginalPrice.current = null;

        if (!order || originalPrice === null || newPrice === null || !Number.isFinite(newPrice) || newPrice <= 0) {
          setTradingStatus({
            modifyingOrderId: null,
            dragPreviewPrice: null,
            modifyError: 'Replacement limit price must be greater than 0.',
            modifySuccess: null,
          });
          redraw();
          return;
        }

        const quantity = getRemainingOrderQuantity(order);
        const blockReason = getModifyBlockReason({
          order,
          symbol: tradingSymbol,
          contractType: tradingContractType,
          mode: currentTradingMode,
          modeBadge,
          price: newPrice,
          quantity: quantity ?? undefined,
          riskStatus,
        });

        if (blockReason || quantity === null) {
          const message = blockReason ?? 'Remaining quantity is required to modify an order.';
          setTradingStatus({
            modifyingOrderId: null,
            dragPreviewPrice: null,
            modifyError: message,
            modifySuccess: null,
          });
          setChartOrderMessage({ type: 'error', text: message });
          redraw();
          return;
        }

        const minDelta = Math.max(Number.EPSILON, tickSize > 0 ? tickSize * 0.1 : 0);
        if (Math.abs(newPrice - originalPrice) <= minDelta) {
          setTradingStatus({
            modifyingOrderId: null,
            dragPreviewPrice: null,
            modifyError: null,
          });
          redraw();
          return;
        }

        setPendingModifyOrder({ order, originalPrice, newPrice, quantity });
        setShowModifyConfirm(true);
        setTradingStatus({
          modifyingOrderId: order.id,
          dragPreviewPrice: newPrice,
          modifyError: null,
          modifySuccess: null,
        });
        redraw();
        return;
      }

      if (isDraggingDrawing.current) {
        isDraggingDrawing.current = false;
        dragAnchor.current = null;
        drawingSnapshot.current = null;
        drawingDragZone.current = null;
        redraw();
        return;
      }

      if (isDragging.current && measureToolActive && dragStart.current && dragEnd.current) {
        isDragging.current = false;
        const dist = Math.sqrt((dragEnd.current.x - dragStart.current.x)**2 + (dragEnd.current.y - dragStart.current.y)**2);
        if (dist < 4) {
          useChartRuntimeStore.getState().setActiveMeasurement(panelId, null);
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

          useChartRuntimeStore.getState().setActiveMeasurement(panelId, {
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

      if (
        isDragging.current &&
        (lineDrawMode === 'long-position' || lineDrawMode === 'short-position' || lineDrawMode === 'position') &&
        dragStart.current &&
        dragEnd.current
      ) {
        isDragging.current = false;

        const rect = canvas.getBoundingClientRect();
        const chartWidth = rect.width - priceAxisWidth;
        const currentBarWidth = barWidth.current;
        const currentScrollOffset = scrollOffset.current;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;

        const widthPx = Math.abs(dragEnd.current.x - dragStart.current.x);
        const heightPx = Math.abs(dragEnd.current.y - dragStart.current.y);

        if (widthPx >= 5 && heightPx >= 5) {
          const dy = dragEnd.current.y - dragStart.current.y;
          const resolvedMode = lineDrawMode === 'position' ? (dy > 0 ? 'long-position' : 'short-position') : lineDrawMode;
          const position = buildPositionFromRiskDrag(
            resolvedMode,
            dragStart.current,
            dragEnd.current,
            candles,
            currentScrollOffset,
            currentBarWidth,
            chartWidth,
            profileWidth,
            priceMin,
            priceMax,
            chartHeight,
            Math.max(tickSize, bucketSize * 0.01),
            0.5
          );
          if (position) {
            useChartStore.getState().addLine(panelId, position);
          }
        }

        useChartStore.getState().setLineDrawMode(panelId, 'none');
        dragStart.current = null;
        dragEnd.current = null;
        redraw();
        return;
      }

      if (isDragging.current && lineDrawMode === 'box' && dragStart.current && dragEnd.current) {
        isDragging.current = false;

        const rect = canvas.getBoundingClientRect();
        const chartWidth = rect.width - priceAxisWidth;
        const currentBarWidth = barWidth.current;
        const currentScrollOffset = scrollOffset.current;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;

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

        if (widthPx >= 5 && heightPx >= 5) {
          useChartStore.getState().addLine(panelId, {
            id: crypto.randomUUID(),
            type: 'box',
            value: priceHigh,
            firstIndex,
            lastIndex,
            firstTime: candleTimeAt(firstIndex, candles),
            lastTime: candleTimeAt(lastIndex, candles),
            priceHigh,
            priceLow,
          });
        }

        useChartStore.getState().setLineDrawMode(panelId, 'none');
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
        const chartHeight = getBottomLayout(rect.height).mainChartHeight;

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
            firstTime: candleTimeAt(firstIndex, candles),
            lastTime: candleTimeAt(lastIndex, candles),
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
        isDraggingDrawing.current = false;
        isDraggingOrderLine.current = false;
        orderDragSnapshot.current = null;
        orderDragOriginalPrice.current = null;
        useChartRuntimeStore.getState().setMarketOrderDrag(null);
        setShowModifyConfirm(false);
        setPendingModifyOrder(null);
        setTradingStatus({ modifyingOrderId: null, dragPreviewPrice: null, modifyError: null });
        drawingSnapshot.current = null;
        drawingDragZone.current = null;
        setSelectedDrawingId(null);
        useChartStore.getState().setCustomProfileRange(panelId, null);
        redraw();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      import('./chartCanvasHitTest').then(({ getHistoricalSessionProfileHitZone }) => {
        const sessionId = getHistoricalSessionProfileHitZone(
          x, y,
          getCandlesLength(),
          scrollOffset.current,
          barWidth.current,
          rect.width,
          profileWidth,
          drawnSessionRangesRef.current
        );

        if (sessionId) {
          const session = drawnSessionRangesRef.current.find(s => s.id === sessionId);
          if (session) {
            setSessionContextMenu({ x: e.clientX, y: e.clientY, sessionId, start: session.range.start, end: session.range.end });
          }
        } else {
          setSessionContextMenu(null);
        }
      });
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawMode, redraw, priceAxisWidth, timeAxisHeight, getBottomLayout, panelId, lineDrawMode, drawnLines, absorptionEnabled, absorptionMinScore, absorptionSide, barWidth, customProfileRange, exhaustionEnabled, exhaustionMinScore, exhaustionShowProvisional, exhaustionSide, icebergEnabled, icebergMinScore, icebergShowSuspected, icebergLookback, bucketSize, tickSize, isPanZoomDragging, panZoomDragMode, priceCenter, priceRange, profileWidth, scrollOffset, chartMode, engine, timeframe, selectedDrawingId, tradingSymbol, tradingContractType, currentTradingMode, modeBadge, riskStatus, setTradingStatus, executeMarketOrder, bracketDragConfirmEnabled, executeBracketModifyDirect, getCandlesLength]);

  const pendingModifyBlockReason = pendingModifyOrder
    ? getModifyBlockReason({
      order: pendingModifyOrder.order,
      symbol: tradingSymbol,
      contractType: tradingContractType,
      mode: currentTradingMode,
      modeBadge,
      price: pendingModifyOrder.newPrice,
      quantity: pendingModifyOrder.quantity,
      riskStatus,
    })
    : null;

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0F0F0F] overflow-hidden">
      <canvas
        ref={bgCanvasRef}
        className="absolute top-0 left-0 outline-none pointer-events-none z-0"
      />
      <canvas
        ref={liveCanvasRef}
        className="absolute top-0 left-0 outline-none pointer-events-none z-10"
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 outline-none z-20"
        tabIndex={0}
      />
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

      {sessionContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSessionContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setSessionContextMenu(null); }} />
          <div 
            className="fixed z-50 bg-[#1F1F1F] border border-[#333] shadow-lg rounded py-1 w-48 text-[11px] font-bold text-main"
            style={{ left: sessionContextMenu.x, top: sessionContextMenu.y }}
          >
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-accent/10 hover:text-accent transition-colors"
              onClick={() => {
                const state = useChartStore.getState();
                const panel = state.panels[panelId];
                if (panel) {
                  // Merge with next session - requires expanding the end boundary
                  const ranges = [...(panel.mergedProfileRanges || [])];
                  // If there is an existing merge range starting here, extend it, else add new
                  // We'll just push a new range that starts at this session's start
                  ranges.push({ start: sessionContextMenu.start, end: sessionContextMenu.end + 86400 * 3 }); // Arbitrary large end to merge next
                  state.setMergedProfileRanges(panelId, ranges);
                }
                setSessionContextMenu(null);
              }}
            >
              Merge With Next Session
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 hover:bg-accent/10 hover:text-accent transition-colors"
              onClick={() => {
                const state = useChartStore.getState();
                const panel = state.panels[panelId];
                if (panel) {
                  // Clear merges involving this session
                  const ranges = (panel.mergedProfileRanges || []).filter(r => !(r.start <= sessionContextMenu.start && r.end >= sessionContextMenu.end));
                  state.setMergedProfileRanges(panelId, ranges);
                }
                setSessionContextMenu(null);
              }}
            >
              Split Session
            </button>
          </div>
        </>
      )}

      <MeasurementPanel 
        measurement={activeMeasurement}
        canvasRect={canvasRef.current?.getBoundingClientRect() || null}
      />

      {chartOrderControls.map(({ order, top, left }) => {
        const isConfirming = confirmingCancelOrderId === order.id;
        const disabled = orderActionLoading || modifyLoading;
        return (
          <button
            key={order.id}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              void handleCancelOrder(order);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className={`absolute z-20 h-[22px] rounded border px-2 text-[10px] font-bold leading-none shadow-sm transition-colors disabled:cursor-wait disabled:opacity-70 ${
              isConfirming
                ? 'border-[#f23645]/70 bg-[#f23645]/18 text-[#ffd7db] hover:bg-[#f23645]/26'
                : 'border-[#333] bg-[#1F1F1F]/92 text-[#E8E8E8] hover:border-[#f23645]/60 hover:text-[#ffd7db]'
            }`}
            style={{ top: `${top}px`, left: `${left}px` }}
            title={isConfirming ? 'Confirm cancel order' : 'Cancel order'}
            aria-label={isConfirming ? 'Confirm cancel order' : 'Cancel order'}
          >
            {disabled && isConfirming ? '...' : isConfirming ? 'Confirm' : 'Cancel'}
          </button>
        );
      })}

      {tradingOverlayControls.positions.map(({ vp, top, left }) => (
        <button
          key={`pos-close-${vp.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmClosePosition(vp);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#444] bg-[#1F1F1F] text-[#999] shadow-md transition-colors hover:border-[#f23645]/80 hover:bg-[#f23645]/25 hover:text-white"
          style={{ top: `${top}px`, left: `${left}px` }}
          title={`Close Position #${vp.id}`}
          aria-label={`Close Position #${vp.id}`}
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      ))}

      {tradingOverlayControls.sls.map(({ positionId, top, left }) => (
        <button
          key={`sl-remove-${positionId}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleRemoveStopLoss(positionId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#f23645]/60 bg-[#1F1F1F] text-[#f23645] shadow-md transition-colors hover:border-[#f23645] hover:bg-[#f23645]/30 hover:text-white"
          style={{ top: `${top}px`, left: `${left}px` }}
          title={`Remove Stop Loss for #${positionId}`}
          aria-label={`Remove Stop Loss for #${positionId}`}
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      ))}

      {tradingOverlayControls.tps.map(({ positionId, top, left }) => (
        <button
          key={`tp-remove-${positionId}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleRemoveTakeProfit(positionId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#089981]/60 bg-[#1F1F1F] text-[#089981] shadow-md transition-colors hover:border-[#089981] hover:bg-[#089981]/30 hover:text-white"
          style={{ top: `${top}px`, left: `${left}px` }}
          title={`Remove Take Profit for #${positionId}`}
          aria-label={`Remove Take Profit for #${positionId}`}
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      ))}

      {(chartOrderMessage || orderActionError || orderActionSuccess || modifyError || modifySuccess) && (
        <div
          onClick={() => {
            setChartOrderMessage(null);
            useChartRuntimeStore.getState().setTradingStatus({
              orderActionSuccess: null,
              orderActionError: null,
              modifySuccess: null,
              modifyError: null,
            });
          }}
          className={`cursor-pointer absolute right-[92px] top-2 z-30 flex items-center gap-2 max-w-[320px] rounded border bg-[#1F1F1F]/95 px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-sm transition-all hover:opacity-80 ${
            (chartOrderMessage?.type === 'error' || orderActionError || modifyError)
              ? 'border-[#f23645]/60 text-[#ffd7db]'
              : 'border-[#089981]/60 text-[#c8fff2]'
          }`}
          title="Click to dismiss"
        >
          <span className="flex-1">{chartOrderMessage?.text ?? modifyError ?? orderActionError ?? modifySuccess ?? orderActionSuccess}</span>
          <X size={12} className="opacity-60 hover:opacity-100 flex-shrink-0" />
        </div>
      )}

      {showModifyConfirm && pendingModifyOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[380px] rounded-md border border-[#303030] bg-[#1F1F1F] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#303030] px-4 py-3">
              <div>
                <div className="text-[12px] font-black uppercase tracking-wider text-[#E8E8E8]">Confirm modify</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase text-[#787B86]">
                  {pendingModifyOrder.order.symbol} / {pendingModifyBlockReason ? 'BLOCKED' : modeBadge.toUpperCase()}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModifyConfirm}
                disabled={modifyLoading}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#303030] text-[#787B86] hover:border-accent/60 hover:text-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close modify confirmation"
                title="Close"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>

            <div className="space-y-2 px-4 py-4">
              <ModifyConfirmRow label="Side" value={pendingModifyOrder.order.side.toUpperCase()} valueColor={pendingModifyOrder.order.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR} />
              <ModifyConfirmRow label="Symbol" value={pendingModifyOrder.order.symbol} />
              <ModifyConfirmRow label="Order id" value={pendingModifyOrder.order.id} />
              <ModifyConfirmRow label="Quantity" value={formatVol(pendingModifyOrder.quantity)} />
              <ModifyConfirmRow label="Original price" value={formatPrice(pendingModifyOrder.originalPrice)} />
              <ModifyConfirmRow label="New price" value={formatPrice(pendingModifyOrder.newPrice)} />
              <ModifyConfirmRow label="Badge" value={pendingModifyBlockReason ? 'BLOCKED' : modeBadge.toUpperCase()} />
              {pendingModifyBlockReason && <ModifyConfirmRow label="Risk" value={pendingModifyBlockReason} />}

              {(modifyError || pendingModifyBlockReason) && (
                <div className="rounded border border-[#F23645]/30 bg-[#F23645]/10 px-3 py-2 text-[11px] font-semibold text-[#FF9BA4]">
                  {modifyError ?? pendingModifyBlockReason}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#303030] px-4 py-3">
              <button
                type="button"
                onClick={closeModifyConfirm}
                disabled={modifyLoading}
                className="h-8 flex-1 rounded border border-[#333333] bg-[#262626] text-[11px] font-bold uppercase text-[#B8B8B8] hover:text-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModifyOrder}
                disabled={modifyLoading || !!pendingModifyBlockReason}
                className="h-8 flex-1 rounded bg-accent text-[11px] font-black uppercase tracking-wider text-white hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-55"
              >
                {modifyLoading ? 'Modifying' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}



      {showModifyBracketConfirm && pendingModifyBracket && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex w-[320px] flex-col overflow-hidden rounded-md border border-[#3A3A3A] bg-[#1E1E1E] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#303030] bg-[#242424] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D1D4DC]">Modify Bracket</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModifyBracketConfirm(false);
                  setPendingModifyBracket(null);
                }}
                disabled={modifyLoading}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#303030] text-[#787B86] hover:border-accent/60 hover:text-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>

            <div className="space-y-2 px-4 py-4">
              <ModifyConfirmRow label="Ticket" value={pendingModifyBracket.positionId} />
              <ModifyConfirmRow label="New SL" value={pendingModifyBracket.sl > 0 ? formatPrice(pendingModifyBracket.sl) : 'None'} />
              <ModifyConfirmRow label="New TP" value={pendingModifyBracket.tp > 0 ? formatPrice(pendingModifyBracket.tp) : 'None'} />

              {modifyError && (
                <div className="rounded border border-[#F23645]/30 bg-[#F23645]/10 px-3 py-2 text-[11px] font-semibold text-[#FF9BA4]">
                  {modifyError}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#303030] px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowModifyBracketConfirm(false);
                  setPendingModifyBracket(null);
                }}
                disabled={modifyLoading}
                className="h-8 flex-1 rounded border border-[#333333] bg-[#262626] text-[11px] font-bold uppercase text-[#B8B8B8] hover:text-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBracketModify}
                disabled={modifyLoading}
                className="h-8 flex-1 rounded bg-accent text-[11px] font-black uppercase tracking-wider text-white hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-55"
              >
                {modifyLoading ? 'Modifying' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClosePosition && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex w-[310px] flex-col overflow-hidden rounded-md border border-[#3A3A3A] bg-[#1E1E1E] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#303030] bg-[#242424] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D1D4DC]">Close Position</span>
              <button
                type="button"
                onClick={() => setConfirmClosePosition(null)}
                disabled={isClosingPosition}
                className="flex h-6 w-6 items-center justify-center rounded text-[#787B86] hover:text-[#E8E8E8] disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2.5 px-4 py-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#787B86]">Ticket</span>
                <span className="font-mono font-bold text-[#E8E8E8]">#{confirmClosePosition.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787B86]">Side / Size</span>
                <span className={`font-bold ${confirmClosePosition.side === 'long' ? 'text-chart-bullish' : 'text-chart-bearish'}`}>
                  {confirmClosePosition.side.toUpperCase()} {confirmClosePosition.quantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787B86]">Entry Price</span>
                <span className="font-mono text-[#E8E8E8]">{formatPrice(confirmClosePosition.entryPrice)}</span>
              </div>
              {Number.isFinite(confirmClosePosition.unrealizedPnl) && (
                <div className="flex justify-between">
                  <span className="text-[#787B86]">Floating P&L</span>
                  <span className={`font-mono font-bold ${confirmClosePosition.unrealizedPnl! >= 0 ? 'text-chart-bullish' : 'text-chart-bearish'}`}>
                    {confirmClosePosition.unrealizedPnl! >= 0 ? '+' : ''}{confirmClosePosition.unrealizedPnl!.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#303030] bg-[#191919] px-4 py-3">
              <button
                type="button"
                onClick={() => setConfirmClosePosition(null)}
                disabled={isClosingPosition}
                className="h-8 flex-1 rounded border border-[#333] bg-[#262626] text-[11px] font-bold uppercase text-[#B8B8B8] hover:text-[#E8E8E8] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClosePosition}
                disabled={isClosingPosition}
                className="h-8 flex-1 rounded bg-[#F23645] text-[11px] font-black uppercase tracking-wider text-white hover:bg-[#F23645]/85 disabled:opacity-50"
              >
                {isClosingPosition ? 'Closing...' : 'Close Position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDrawing && selectedDrawingControls && (
        <DrawingToolbar
          panelId={panelId}
          selectedDrawing={selectedDrawing}
          selectedDrawingControls={selectedDrawingControls}
          onDelete={() => setSelectedDrawingId(null)}
          onRedraw={redraw}
        />
      )}

      {customProfileRange && customProfileControls && (
        <CustomProfileToolbar
          panelId={panelId}
          customProfileLocked={customProfileLocked}
          customProfileControls={customProfileControls}
          onRedraw={redraw}
        />
      )}

    </div>
  );
}


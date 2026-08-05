'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Lock, Settings, Unlock, X } from 'lucide-react';
import { PanelId, ChartMode, AbsorptionSide, BubbleSide, useChartStore, PanelState, ExhaustionSide, Measurement, DrawnLine, DrawingStrokeWidth, ContractType, DataSourceMode, MAX_AGGREGATE_BUBBLE_EVENTS } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { FootprintMode } from '@/types/footprint';
import { AggregationEngine } from '@/lib/aggregation/engine';
import type { VolumeProfileSource } from '@/lib/volumeProfile/profileEngine';
import { usePanZoom } from './usePanZoom';
import { getVisibleRange, getVisiblePriceRange, priceToY as calcPriceToY, indexToX as calcIndexToX, yToPrice, xToIndex, timeToIndex } from './useCoordinates';
import { drawCandles } from './drawCandles';
import { drawFootprint } from './drawFootprint';
import { drawVolumeBars } from './drawVolumeBars';
import { drawTradingOverlays, TradingOverlayHitZones } from './drawTradingOverlays';
import { drawGrid, drawPriceAxis, drawTimeAxis, calculatePriceStep } from './drawAxes';
import { drawPriceLine } from './drawPriceLine';
import { drawCrosshair, drawCrosshairPriceLabel, drawCrosshairTimeLabel } from './drawCrosshair';
import { drawVolumeProfile } from './drawVolumeProfile';
import { drawAbsorption } from './drawAbsorption';
import { BubbleScaleMode, drawAggregateTradeBubbles, drawBubbles } from './drawBubbles';
import { drawSelectionRect, drawCustomProfile } from './drawSelectionRect';
import { drawDrawingPriceLabels, drawLines } from './drawLines';
import { initCanvas } from '@/lib/utils/canvas';
import { Candle } from '@/types/candle';
import type { BracketDragState, BracketOrder, Order, Position, TradeFill, TradingRiskStatusPayload, VirtualPosition } from '@/types/trading';
import type { AggregateBubbleMarketSource, BubbleEvent, BubbleSizeBy, BubbleSource } from '@/types/bubble';
import { AbsorptionResult } from '@/types/absorption';
import { ExhaustionResult } from '@/types/exhaustion';
import { IcebergLevel } from '@/types/iceberg';
import { LiquidityVacuumZone } from '@/types/liquidityVacuum';
import { AbsorptionTooltip } from './AbsorptionTooltip';
import { drawExhaustion } from './drawExhaustion';
import { ExhaustionTooltip } from './ExhaustionTooltip';
import { drawDeltaProfile } from '@/lib/draw/drawDeltaProfile';
import { drawMeasurementRect } from '@/lib/draw/drawMeasurement';
import { drawSessions } from '@/lib/draw/drawSessions';
import { drawLiquidity } from '@/lib/draw/drawLiquidity';
import { drawLiquidityHeatmap } from '@/lib/draw/drawLiquidityHeatmap';
import { drawIceberg } from '@/lib/draw/drawIceberg';
import { drawLiquidityVacuum } from '@/lib/draw/drawLiquidityVacuum';
import { buildHeatmapRows } from '@/lib/liquidity/heatmap';
import { LiquidityHistoryManager } from '@/lib/liquidity/history';
import { computeMeasurementMetrics, computeFootprintMetrics, CoordinateSystem } from '@/lib/utils/measurement';
import { recordAggregateBubbleDebug, recordVolumeBarsDebug } from '@/lib/debug/marketMetrics';
import { MeasurementPanel } from './MeasurementPanel';
import { HeatmapRow, LiquidityZone } from '@/types/liquidity';
import { IcebergTooltip } from './IcebergTooltip';
import { MIN_FINE_PROFILE_BASE_BUCKET_SIZE } from '@/lib/config/markets';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';
import { formatPrice, formatVol } from '@/lib/utils/format';

type CustomProfileHitZone = 'move' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom';
type DrawingHitZone = 'hover' | 'move' | 'delete' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom' | 'resize-entry' | 'resize-stop' | 'resize-target';
type CustomProfileRange = NonNullable<PanelState['customProfileRange']>;
type PendingModifyOrder = {
  order: Order;
  originalPrice: number;
  newPrice: number;
  quantity: number;
};

const DRAWING_COLORS = [
  CHART_BEARISH_COLOR,
  '#FF9801',
  '#FFEB3B',
  '#4CAF50',
  CHART_BULLISH_COLOR,
  '#00BCD4',
  '#2962FF',
  '#673AB7',
  '#E91E63',
] as const;
const DEFAULT_DRAWING_STROKE_WIDTH: DrawingStrokeWidth = 2;
const TARGET_PROFILE_ROW_PX = 3;

function calcAutoBucketSize(
  priceHigh: number,
  priceLow: number,
  canvasHeightPx: number,
  tickSize: number
): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return 1;

  const normalizedHigh = Math.max(priceHigh, priceLow);
  const normalizedLow = Math.min(priceHigh, priceLow);
  const priceRangeTicks = Math.max(1, (normalizedHigh - normalizedLow) / tickSize);
  const ticksPerPx = priceRangeTicks / Math.max(1, canvasHeightPx);
  const rawBucket = ticksPerPx * TARGET_PROFILE_ROW_PX * tickSize;

  return Math.max(tickSize, Math.ceil(rawBucket / tickSize) * tickSize);
}

function resolveProfileBucketSize(
  priceHigh: number,
  priceLow: number,
  canvasHeightPx: number,
  profileResolutionTicks: number,
  tickSize: number,
  fallbackBucketSize: number
): number {
  const requestedProfileBucketSize = tickSize > 0
    ? profileResolutionTicks > 0
      ? tickSize * profileResolutionTicks
      : calcAutoBucketSize(priceHigh, priceLow, canvasHeightPx, tickSize)
    : Math.max(1, fallbackBucketSize / 4);

  return Math.max(MIN_FINE_PROFILE_BASE_BUCKET_SIZE, requestedProfileBucketSize);
}

function findExactTimeIndex(time: number, candles: Candle[]) {
  let left = 0;
  let right = candles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = candles[mid].time;
    if (midTime === time) return mid;
    if (midTime < time) left = mid + 1;
    else right = mid - 1;
  }

  return null;
}

function resolveIndexFromTimeOrFallback(time: number | undefined, fallbackIndex: number | undefined, candles: Candle[]) {
  if (time !== undefined) {
    return findExactTimeIndex(time, candles);
  }
  if (fallbackIndex === undefined || candles.length === 0) return null;
  if (fallbackIndex < 0 || fallbackIndex > candles.length - 1) return null;
  return fallbackIndex;
}

function candleTimeAt(index: number | null, candles: Candle[]) {
  return index !== null ? candles[index]?.time : undefined;
}

function resolveLineForRender(line: DrawnLine, candles: Candle[]): DrawnLine | null {
  if (line.type === 'horizontal') return line;

  if (line.type === 'vertical') {
    const index = resolveIndexFromTimeOrFallback(line.time, line.value, candles);
    return index === null ? null : { ...line, value: index };
  }

  if (line.type === 'horizontal-ray') {
    const startIndex = resolveIndexFromTimeOrFallback(line.startTime, line.startIndex, candles);
    return startIndex === null ? null : { ...line, startIndex };
  }

  if (line.type === 'box') {
    const firstIndex = resolveIndexFromTimeOrFallback(line.firstTime, line.firstIndex, candles);
    const lastIndex = resolveIndexFromTimeOrFallback(line.lastTime, line.lastIndex, candles);
    if (firstIndex === null || lastIndex === null) return null;
    return { ...line, firstIndex, lastIndex };
  }

  if (isPositionDrawing(line)) {
    const firstIndex = resolveIndexFromTimeOrFallback(line.firstTime, line.firstIndex, candles);
    const lastIndex = resolveIndexFromTimeOrFallback(line.lastTime, line.lastIndex, candles);
    if (firstIndex === null || lastIndex === null) return null;
    return { ...line, firstIndex, lastIndex };
  }

  return line;
}

function resolveCustomProfileRange(range: PanelState['customProfileRange'], candles: Candle[]): CustomProfileRange | null {
  if (!range) return null;
  const firstIndex = resolveIndexFromTimeOrFallback(range.firstTime, range.firstIndex, candles);
  const lastIndex = resolveIndexFromTimeOrFallback(range.lastTime, range.lastIndex, candles);
  if (firstIndex === null || lastIndex === null) return null;
  return { ...range, firstIndex, lastIndex };
}

function getCustomProfileTimeBounds(range: CustomProfileRange, candles: Candle[]) {
  const firstTime = range.firstTime ?? candles[range.firstIndex]?.time;
  const lastTime = range.lastTime ?? candles[range.lastIndex]?.time;
  if (firstTime === undefined || lastTime === undefined) return null;
  return {
    startTime: Math.min(firstTime, lastTime),
    endTime: Math.max(firstTime, lastTime),
  };
}

function isPositionDrawing(line: DrawnLine) {
  return line.type === 'long-position' || line.type === 'short-position';
}

function hasPositionGeometry(line: DrawnLine) {
  return (
    isPositionDrawing(line) &&
    line.firstIndex !== undefined &&
    line.lastIndex !== undefined &&
    line.stopPrice !== undefined &&
    line.targetPrice !== undefined
  );
}

function ModifyConfirmRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">{label}</span>
      <span className="text-right text-[11px] font-black uppercase text-[#E8E8E8]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function isActiveLimitOrder(order: Order) {
  return (
    order.type === 'limit' &&
    (order.status === 'open' || order.status === 'partially_filled') &&
    Number.isFinite(order.price) &&
    !!order.price
  );
}

function getRemainingOrderQuantity(order: Order) {
  if (Number.isFinite(order.quantity) && Number.isFinite(order.filledQuantity)) {
    const remaining = order.quantity - order.filledQuantity;
    if (remaining > 0) return remaining;
  }

  return Number.isFinite(order.quantity) && order.quantity > 0 ? order.quantity : null;
}

function getModifyBlockReason(input: {
  order: Order;
  symbol: string;
  contractType: ContractType;
  mode: string;
  modeBadge: string;
  price?: number;
  quantity?: number;
  riskStatus?: TradingRiskStatusPayload | null;
}) {
  const { order, symbol, contractType, mode, modeBadge, price, quantity, riskStatus } = input;

  if (mode === 'binance_live' || modeBadge === 'live') return 'Live trading is blocked for drag modify.';
  if (mode !== 'binance_testnet' || modeBadge !== 'testnet') return 'Only Binance testnet spot order modification is supported.';
  if (riskStatus?.killSwitchActive) return riskStatus.blockReasons[0] ?? 'Trading kill switch is active.';
  if (riskStatus?.liveBlocked) return riskStatus.blockReasons[0] ?? 'Live trading is blocked.';
  if (riskStatus && riskStatus.blockReasons.length > 0) return riskStatus.blockReasons[0];
  if (contractType !== 'spot') return 'Only spot limit orders can be modified.';
  if (order.symbol.toUpperCase() !== symbol.toUpperCase()) return 'Order symbol does not match this chart panel.';
  if (!order.id || order.id.trim().length === 0) return 'Order id is required to modify an order.';
  if (order.type !== 'limit') return 'Only open Limit orders can be modified.';
  if (order.status !== 'open' && order.status !== 'partially_filled') return 'Only open orders can be modified.';
  if (getRemainingOrderQuantity(order) === null) return 'Remaining quantity is required to modify an order.';
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) return 'Replacement limit price must be greater than 0.';
  if (riskStatus && quantity !== undefined && quantity > riskStatus.maxOrderQty) return `Order quantity exceeds max quantity ${riskStatus.maxOrderQty}.`;
  if (riskStatus && price !== undefined && quantity !== undefined) {
    const notional = quantity * price;
    if (Number.isFinite(notional) && notional > riskStatus.maxOrderNotional) return `Order notional exceeds max notional ${riskStatus.maxOrderNotional}.`;
  }
  if (riskStatus && riskStatus.dailyOrderCountUsed >= riskStatus.dailyOrderCountLimit) {
    return `Daily order count limit ${riskStatus.dailyOrderCountLimit} has been reached.`;
  }
  return null;
}

function findNearestOrderLine(
  orders: Order[],
  x: number,
  y: number,
  chartWidth: number,
  chartHeight: number,
  priceToY: (price: number) => number,
) {
  if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) return null;

  let nearest: { order: Order; distance: number } | null = null;
  for (const order of orders) {
    if (order.type !== 'limit' || !Number.isFinite(order.price) || !order.price) continue;
    const distance = Math.abs(y - priceToY(order.price));
    if (distance > 7) continue;
    if (!nearest || distance < nearest.distance) nearest = { order, distance };
  }

  return nearest?.order ?? null;
}

function buildPositionFromRiskDrag(
  mode: 'long-position' | 'short-position',
  dragStart: { x: number; y: number },
  dragEnd: { x: number; y: number },
  candles: Candle[],
  currentScrollOffset: number,
  currentBarWidth: number,
  chartWidth: number,
  profileWidth: number,
  priceMin: number,
  priceMax: number,
  chartHeight: number,
  minRisk: number,
  rewardRatio: number | null
): DrawnLine | null {
  if (candles.length === 0) return null;

  const idx1 = xToIndex(dragStart.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
  const idx2 = xToIndex(dragEnd.x, candles, currentScrollOffset, currentBarWidth, chartWidth, profileWidth);
  const firstIndex = Math.min(idx1, idx2);
  const lastIndex = Math.max(idx1, idx2);
  const startPrice = yToPrice(dragStart.y, priceMin, priceMax, chartHeight);
  const endPrice = yToPrice(dragEnd.y, priceMin, priceMax, chartHeight);
  const isLong = mode === 'long-position';
  const entryPrice = isLong ? Math.max(startPrice, endPrice) : Math.min(startPrice, endPrice);
  const rawStopPrice = isLong ? Math.min(startPrice, endPrice) : Math.max(startPrice, endPrice);
  const riskDistance = Math.max(minRisk, Math.abs(rawStopPrice - entryPrice));
  const stopPrice = isLong ? entryPrice - riskDistance : entryPrice + riskDistance;
  const rewardDistance = riskDistance * Math.max(0, rewardRatio ?? 0);
  const targetPrice = rewardRatio === null
    ? undefined
    : isLong
      ? entryPrice + rewardDistance
      : entryPrice - rewardDistance;

  return {
    id: crypto.randomUUID(),
    type: mode,
    value: entryPrice,
    firstIndex,
    lastIndex,
    firstTime: candles[firstIndex]?.time,
    lastTime: candles[lastIndex]?.time,
    stopPrice,
    ...(targetPrice === undefined ? {} : { targetPrice }),
  };
}

function getDrawingHitZone(
  line: DrawnLine,
  x: number,
  y: number,
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  barWidth: number
): DrawingHitZone | null {
  if (line.type === 'horizontal') {
    const ly = priceToY(line.value);
    if (Math.abs(y - ly) < 6 && x <= chartWidth) {
      return Math.abs(x - (chartWidth - 6)) < 8 && Math.abs(y - ly) < 8 ? 'delete' : 'move';
    }
    return null;
  }

  if (line.type === 'vertical') {
    const lx = indexToX(line.value);
    if (lx !== null && Math.abs(x - lx) < 6 && y <= chartHeight) {
      return Math.abs(x - lx) < 8 && Math.abs(y - 10) < 8 ? 'delete' : 'move';
    }
    return null;
  }

  if (line.type === 'horizontal-ray') {
    const startIndex = line.startIndex ?? 0;
    const lx = indexToX(startIndex);
    const ly = priceToY(line.value);
    if (lx === null || ly < 0 || ly > chartHeight) return null;

    if (Math.abs(x - (chartWidth - 6)) < 8 && Math.abs(y - ly) < 8) return 'delete';
    if (Math.abs(x - lx) < 8 && Math.abs(y - ly) < 8) return 'resize-left';
    if (x >= Math.max(0, lx) && x <= chartWidth && Math.abs(y - ly) < 6) return 'move';
    return null;
  }

  if (
    line.type === 'box' &&
    line.firstIndex !== undefined &&
    line.lastIndex !== undefined &&
    line.priceHigh !== undefined &&
    line.priceLow !== undefined
  ) {
    const x1 = indexToX(line.firstIndex);
    const x2 = indexToX(line.lastIndex);
    if (x1 === null || x2 === null) return null;

    const left = Math.min(x1, x2) - barWidth / 2;
    const right = Math.max(x1, x2) + barWidth / 2;
    const top = priceToY(line.priceHigh);
    const bottom = priceToY(line.priceLow);
    const minY = Math.min(top, bottom);
    const maxY = Math.max(top, bottom);
    const pad = 7;

    if (Math.abs(x - right) < 8 && Math.abs(y - minY) < 8) return 'delete';
    if (x < left - pad || x > right + pad || y < minY - pad || y > maxY + pad) return null;
    if (Math.abs(x - left) <= pad) return 'resize-left';
    if (Math.abs(x - right) <= pad) return 'resize-right';
    if (Math.abs(y - minY) <= pad) return 'resize-top';
    if (Math.abs(y - maxY) <= pad) return 'resize-bottom';
    return 'move';
  }

  if (hasPositionGeometry(line)) {
    const x1 = indexToX(line.firstIndex!);
    const x2 = indexToX(line.lastIndex!);
    if (x1 === null || x2 === null) return null;

    const left = Math.min(x1, x2) - barWidth / 2;
    const right = Math.max(x1, x2) + barWidth / 2;
    const entryY = priceToY(line.value);
    const stopY = priceToY(line.stopPrice!);
    const targetY = priceToY(line.targetPrice!);
    const minY = Math.min(entryY, stopY, targetY);
    const maxY = Math.max(entryY, stopY, targetY);
    const pad = 7;

    if (Math.abs(x - right) < 8 && Math.abs(y - minY) < 8) return 'delete';
    if (x < left - pad || x > right + pad || y < minY - pad || y > maxY + pad) return null;
    if (Math.abs(y - entryY) <= pad) return 'resize-entry';
    if (Math.abs(y - stopY) <= pad) return 'resize-stop';
    if (Math.abs(y - targetY) <= pad) return 'resize-target';
    if (Math.abs(x - left) <= pad) return 'resize-left';
    if (Math.abs(x - right) <= pad) return 'resize-right';
    return 'move';
  }

  return null;
}

function getDrawingToolbarAnchor(
  line: DrawnLine,
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  barWidth: number
) {
  if (line.type === 'horizontal') {
    const y = priceToY(line.value);
    if (y < 0 || y > chartHeight) return null;
    return { x: chartWidth - 120, y };
  }

  if (line.type === 'vertical') {
    const x = indexToX(line.value);
    if (x === null || x < 0 || x > chartWidth) return null;
    return { x, y: 28 };
  }

  if (line.type === 'horizontal-ray') {
    const x = indexToX(line.startIndex ?? 0);
    const y = priceToY(line.value);
    if (x === null || x > chartWidth || y < 0 || y > chartHeight) return null;
    return { x: Math.max(0, x), y };
  }

  if (
    line.type === 'box' &&
    line.firstIndex !== undefined &&
    line.lastIndex !== undefined &&
    line.priceHigh !== undefined &&
    line.priceLow !== undefined
  ) {
    const x1 = indexToX(line.firstIndex);
    const x2 = indexToX(line.lastIndex);
    if (x1 === null || x2 === null) return null;
    const right = Math.max(x1, x2) + barWidth / 2;
    const top = priceToY(line.priceHigh);
    const bottom = priceToY(line.priceLow);
    const y = Math.min(top, bottom);
    if (right < 0 || y > chartHeight || Math.max(top, bottom) < 0) return null;
    return { x: right, y };
  }

  if (hasPositionGeometry(line)) {
    const x1 = indexToX(line.firstIndex!);
    const x2 = indexToX(line.lastIndex!);
    if (x1 === null || x2 === null) return null;
    const right = Math.max(x1, x2) + barWidth / 2;
    const entryY = priceToY(line.value);
    const stopY = priceToY(line.stopPrice!);
    const targetY = priceToY(line.targetPrice!);
    const y = Math.min(entryY, stopY, targetY);
    if (right < 0 || y > chartHeight || Math.max(entryY, stopY, targetY) < 0) return null;
    return { x: right, y };
  }

  return null;
}

function getCustomProfileHitZone(
  customProfileRange: PanelState['customProfileRange'],
  x: number,
  y: number,
  candlesLength: number,
  scrollOffset: number,
  barWidth: number,
  chartWidth: number,
  chartHeight: number,
  profileWidth: number,
  priceMin: number,
  priceMax: number,
  isLocked: boolean
): CustomProfileHitZone | null {
  if (!customProfileRange || candlesLength === 0 || x > chartWidth || y > chartHeight) return null;

  const rx1 = calcIndexToX(customProfileRange.firstIndex, candlesLength, scrollOffset, barWidth, chartWidth, profileWidth) - barWidth / 2;
  const rx2 = calcIndexToX(customProfileRange.lastIndex, candlesLength, scrollOffset, barWidth, chartWidth, profileWidth) + barWidth / 2;
  const ry1 = calcPriceToY(customProfileRange.priceHigh, priceMin, priceMax, chartHeight);
  const ry2 = calcPriceToY(customProfileRange.priceLow, priceMin, priceMax, chartHeight);

  const minX = Math.min(rx1, rx2);
  const maxX = Math.max(rx1, rx2);
  const minY = Math.min(ry1, ry2);
  const maxY = Math.max(ry1, ry2);
  const handlePad = 6;

  if (x < minX - handlePad || x > maxX + handlePad || y < minY - handlePad || y > maxY + handlePad) {
    return null;
  }

  if (isLocked) return 'move';
  if (Math.abs(x - minX) <= handlePad) return 'resize-left';
  if (Math.abs(x - maxX) <= handlePad) return 'resize-right';
  if (Math.abs(y - minY) <= handlePad) return 'resize-top';
  if (Math.abs(y - maxY) <= handlePad) return 'resize-bottom';
  return 'move';
}

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
  volumeProfileEngine: VolumeProfileSource;
  volumeProfileRevision: number;
  tickSize: number;
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  absorptionMap: Map<number, AbsorptionResult>;
  bubblesEnabled: boolean;
  bubbleSource: BubbleSource;
  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: 'absolute' | 'relative';
  bubbleMinOrders: number;
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode: BubbleScaleMode;
  aggregateBubbleEvents: BubbleEvent[];
  activeChartContractType: ContractType;
  activeDataSourceMode: DataSourceMode;
  tradingSymbol: string;
  tradingContractType: ContractType;
  openOrders: Order[];
  positions: Position[];
  virtualPositions: VirtualPosition[];
  bracketOrders: BracketOrder[];
  bracketDrag: BracketDragState | null;
  recentFills: TradeFill[];
  volumeBarsEnabled: boolean;
  volumeBarsInputData: PanelState['volumeBarsInputData'];
  volumeBarsMarketSource: PanelState['volumeBarsMarketSource'];
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
  liquidityVacuumEnabled: boolean;
  liquidityVacuumMinScore: number;
  liquidityVacuumShowLabels: boolean;
  liquidityVacuumOpacity: number;
  liquidityVacuumZones: LiquidityVacuumZone[];
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  profileResolutionTicks: number;
  profileMinRowHeight: number;
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
  liquidityZones: LiquidityZone[];
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
  showTimeAxis?: boolean;
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
  volumeProfileEngine,
  volumeProfileRevision,
  tickSize,
  absorptionEnabled,
  absorptionMinScore,
  absorptionSide,
  absorptionShowLabels,
  absorptionMap,
  bubblesEnabled,
  bubbleSource,
  bubbleSizeBy,
  aggregateBubbleMarketSource,
  bubbleThreshold,
  bubbleThresholdMode,
  bubbleMinOrders,
  bubbleMinRadius,
  bubbleMaxRadius,
  bubbleSide,
  bubbleScaleMode,
  aggregateBubbleEvents,
  activeChartContractType,
  activeDataSourceMode,
  tradingSymbol,
  tradingContractType,
  openOrders,
  positions,
  virtualPositions,
  bracketOrders,
  bracketDrag,
  recentFills,
  volumeBarsEnabled,
  volumeBarsInputData,
  volumeBarsMarketSource,
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
  liquidityVacuumEnabled,
  liquidityVacuumMinScore,
  liquidityVacuumShowLabels,
  liquidityVacuumOpacity,
  liquidityVacuumZones,
  profileWidthPct,
  defaultProfileEnabled,
  profileResolutionTicks,
  profileMinRowHeight,
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
  showTimeAxis = true,
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

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  const [hoveredAbs, setHoveredAbs] = React.useState<{ result: AbsorptionResult, x: number, y: number } | null>(null);
  const [hoveredExhaustion, setHoveredExhaustion] = React.useState<{ result: ExhaustionResult, x: number, y: number } | null>(null);
  const [hoveredIceberg, setHoveredIceberg] = React.useState<{ level: IcebergLevel, x: number, y: number } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = React.useState<string | null>(null);
  const [confirmingCancelOrderId, setConfirmingCancelOrderId] = React.useState<string | null>(null);
  const [showModifyConfirm, setShowModifyConfirm] = React.useState(false);
  const [pendingModifyOrder, setPendingModifyOrder] = React.useState<PendingModifyOrder | null>(null);
  const [chartOrderMessage, setChartOrderMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  const getCandlesLength = useCallback(() => candles.length, [candles]);

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
      ctx.fillStyle = '#0F0F0F';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

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
              customProfileLocked
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

      drawLines(ctx, resolvedNonPositionLines, indexToX, priceToY, logicalWidth, logicalHeight, timeAxisHeight, priceAxisWidth, currentBarWidth, hoveredLineId.current, selectedDrawingId, isHoveringDeleteDot.current);

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

      if (liquidityVacuumEnabled && liquidityVacuumZones.length > 0) {
        drawLiquidityVacuum(
          ctx,
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

      if (chartMode === 'candle') {
        drawCandles(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth);
      } else {
        drawFootprint(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, engine, bucketSize, chartHeight, footprintMode);
      }

      if (volumeBarsEnabled) {
        drawVolumeBars(
          ctx,
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
            onDebug: recordVolumeBarsDebug,
          },
        );
      }

      // Volume bubbles — drawn above candles/footprint, below volume profile
      if (bubblesEnabled) {
        if (bubbleSource === 'aggregateTrades') {
          drawAggregateTradeBubbles(ctx, aggregateBubbleEvents, candles, firstIndex, lastIndex, indexToX, priceToY, currentBarWidth, {
            bubbleSizeBy,
            aggregateBubbleMarketSource,
            activeChartContractType,
            activeDataSourceMode,
            bubbleThreshold,
            bubbleThresholdMode,
            bubbleMinOrders,
            bubbleMinRadius,
            bubbleMaxRadius,
            bubbleSide,
            bubbleScaleMode,
          }, {
            panelId,
            bubbleSource,
            bufferSize: aggregateBubbleEvents.length,
            maxBufferSize: MAX_AGGREGATE_BUBBLE_EVENTS,
            activeChartContractType,
            activeDataSourceMode,
            engine,
            bucketSize,
          });
        } else {
          const latestAggregateEvent = aggregateBubbleEvents[aggregateBubbleEvents.length - 1] ?? null;
          const restoredAggregateEvents = aggregateBubbleEvents.filter((event) => event.origin === 'restored');
          const restoredAggregateTimes = restoredAggregateEvents
            .map((event) => event.time)
            .filter((time) => Number.isFinite(time));
          const restoredEventCountBySource = restoredAggregateEvents.reduce((counts, event) => {
            if (event.contractType === 'spot' || event.contractType === 'futures') {
              counts[event.contractType] += 1;
            }
            return counts;
          }, { spot: 0, futures: 0 });
          const totalEventCountBySource = aggregateBubbleEvents.reduce((counts, event) => {
            if (event.contractType === 'spot' || event.contractType === 'futures') {
              counts[event.contractType] += 1;
            }
            return counts;
          }, { spot: 0, futures: 0 });
          recordAggregateBubbleDebug({
            panelId,
            bubbleSource,
            bubbleSizeBy,
            aggregateBubbleMarketSource,
            activeChartMarketSource: {
              contractType: activeChartContractType,
              dataSourceMode: activeDataSourceMode,
            },
            bufferSize: aggregateBubbleEvents.length,
            maxBufferSize: MAX_AGGREGATE_BUBBLE_EVENTS,
            restoredEventCount: restoredAggregateEvents.length,
            liveEventCount: Math.max(0, aggregateBubbleEvents.length - restoredAggregateEvents.length),
            totalHydratedCount: aggregateBubbleEvents.length,
            duplicateSkippedCount: 0,
            restoreQueryRange: null,
            restoredSpotCount: restoredEventCountBySource.spot,
            restoredFuturesCount: restoredEventCountBySource.futures,
            minRestoredEventTime: restoredAggregateTimes.length > 0 ? Math.min(...restoredAggregateTimes) : null,
            maxRestoredEventTime: restoredAggregateTimes.length > 0 ? Math.max(...restoredAggregateTimes) : null,
            storageThresholds: null,
            currentRenderedCountAfterRestore: null,
            visibleEventCount: 0,
            renderedCount: 0,
            totalEventCountBySource,
            visibleEventCountBySource: {
              spot: 0,
              futures: 0,
            },
            renderedCountBySource: {
              spot: 0,
              futures: 0,
            },
            visibleEventCountBySizeMode: {
              volume: 0,
              orders: 0,
            },
            renderedCountBySizeMode: {
              volume: 0,
              orders: 0,
            },
            filteredCount: aggregateBubbleEvents.length,
            filterReasons: aggregateBubbleEvents.length > 0 ? { sourceNotSelected: aggregateBubbleEvents.length } : {},
            tradeCountFallbackCount: 0,
            tradeCountFallbackPolicy: bubbleSizeBy === 'orders' ? 'missing-or-invalid-trade-count-treated-as-1' : null,
            latestEvent: latestAggregateEvent
              ? {
                time: latestAggregateEvent.time,
                price: latestAggregateEvent.price,
                volume: latestAggregateEvent.volume,
                side: latestAggregateEvent.side,
                source: latestAggregateEvent.source,
                symbol: latestAggregateEvent.symbol,
                contractType: latestAggregateEvent.contractType,
                tradeCount: typeof latestAggregateEvent.tradeCount === 'number' && Number.isFinite(latestAggregateEvent.tradeCount)
                  ? latestAggregateEvent.tradeCount
                  : null,
              }
              : null,
            latestRendered: null,
            latestFiltered: null,
            visibleWindow: candles[firstIndex] && candles[lastIndex]
              ? {
                startTime: candles[firstIndex].time,
                endTime: candles[lastIndex].time,
              }
              : null,
            settings: {
              sizeBy: bubbleSizeBy,
              marketSource: aggregateBubbleMarketSource,
              resolvedMarketSource: activeDataSourceMode === 'both' ? 'both' : activeDataSourceMode || activeChartContractType,
              minVolume: bubbleThreshold,
              minOrders: bubbleMinOrders,
              thresholdMode: bubbleThresholdMode,
              side: bubbleSide,
              scaleMode: bubbleScaleMode,
              minRadius: bubbleMinRadius,
              maxRadius: bubbleMaxRadius,
              actualThreshold: null,
              actualThresholdMode: null,
            },
          });
          drawBubbles(ctx, candles, firstIndex, lastIndex, indexToX, priceToY, bucketSize, engine, currentBarWidth, {
            bubbleThreshold,
            bubbleThresholdMode,
            bubbleMinRadius,
            bubbleMaxRadius,
            bubbleSide,
            bubbleScaleMode,
          });
        }
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
          profileShowVaLines
        );

        if (profileShowDelta && customProfile) {
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

      const lastCandle = candles[candles.length - 1];
      const isScrolled = candles.length > 0 && (candles.length - lastIndex) > 50;

      let heatmapRows: HeatmapRow[] | undefined = undefined;
      if (liquidityHeatmapEnabled && liquidityHistory) {
        heatmapRows = buildHeatmapRows(liquidityHistory, priceMin, priceMax, liquidityBucketSize, lastCandle?.close || 0);
      }

      // Volume Profile
      if (defaultProfileEnabled) {
        const visibleCandles = candles.slice(firstIndex, lastIndex + 1);
        const profile = volumeProfileEngine.buildProfile({
          candles: visibleCandles,
          profileBucketSize: defaultProfileBucketSize,
        });

        if (profile) {
          drawVolumeProfile(
            ctx,
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
            liquidityHeatmapProfileSync ? heatmapRows : undefined
          );
        }
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

      drawPriceAxis(ctx, priceMin, priceMax, priceToY, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight);
      drawDrawingPriceLabels(ctx, resolvedDrawnLines, indexToX, priceToY, logicalWidth, logicalHeight, timeAxisHeight, priceAxisWidth, currentBarWidth);
      if (showTimeAxis) {
        drawTimeAxis(ctx, candles, rawFirstIndex, rawLastIndex, indexToX, logicalWidth, logicalHeight, priceAxisWidth, timeAxisHeight, currentBarWidth);
      }

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

      let activePosition: DrawnLine | null = null;
      if (
        (lineDrawMode === 'long-position' || lineDrawMode === 'short-position') &&
        isDragging.current &&
        dragStart.current &&
        dragEnd.current
      ) {
        activePosition = buildPositionFromRiskDrag(
          lineDrawMode,
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

      const activePositions = tradingContractType === 'futures'
        ? positions.filter(p => p.side !== 'flat').map(p => ({
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
        : virtualPositions;

      if (openOrders.length > 0 || activePositions.length > 0 || recentFills.length > 0) {
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
        );
      }

      if (lastCandle) {
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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartMode, footprintMode, bucketSize, footprintTrigger, engine, volumeProfileEngine, volumeProfileRevision, tickSize, isLoadingHistory, timeframe, absorptionEnabled, absorptionMinScore, absorptionSide, absorptionShowLabels, absorptionMap, exhaustionEnabled, exhaustionMinScore, exhaustionSide, exhaustionShowProvisional, exhaustionMap, icebergEnabled, icebergMinScore, icebergLookback, icebergShowSuspected, icebergShowLabels, icebergShowTint, icebergLevels, liquidityVacuumEnabled, liquidityVacuumMinScore, liquidityVacuumShowLabels, liquidityVacuumOpacity, liquidityVacuumZones, bubblesEnabled, bubbleSource, bubbleSizeBy, aggregateBubbleMarketSource, aggregateBubbleEvents, activeChartContractType, activeDataSourceMode, bubbleThreshold, bubbleThresholdMode, bubbleMinOrders, bubbleMinRadius, bubbleMaxRadius, bubbleSide, bubbleScaleMode, isDrawMode, customProfileRange, customProfileLocked, isProfileSelected, drawnLines, lineDrawMode, selectedDrawingId, profileWidthPct, defaultProfileEnabled, profileResolutionTicks, profileMinRowHeight, profileOpacity, profileMinRowWidth, profileScaleMode, profileShowPocHighlight, profileShowVaFill, profileShowPocLine, profileShowVaLines, profileShowDelta, deltaProfileWidth, measureToolActive, activeMeasurement, sessionsEnabled, sessions, liquidityZones, liquidityEnabled, liquidityOpacity, liquidityBucketSize, liquidityHistory, liquidityHeatmapEnabled, liquidityHeatmapOpacity, liquidityHeatmapAgeFade, liquidityHeatmapWidth, liquidityHeatmapShowPulled, liquidityHeatmapShowConsumed, liquidityHeatmapShowPersistence, liquidityHeatmapShowCurrentLabel, liquidityHeatmapProfileSync, showTimeAxis, openOrders, positions, recentFills, modifyingOrderId, dragPreviewPrice]);

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
          customProfileLocked
        );
        if (profileHitZone) return false;
      }
      return true;
    },
    // Crosshair Sync Handler
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
        customProfileLocked
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
    }, [panelId, candles, priceAxisWidth, timeAxisHeight, profileWidth, customProfileRange, customProfileLocked]),
    { scrollOffset, barWidth, priceCenter, priceRange }
  );

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

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
  }, [
    candles,
    chartMode,
    footprintMode,
    bucketSize,
    footprintTrigger,
    volumeProfileRevision,
    redraw,
    isLoadingHistory,
    drawnLines,
    lineDrawMode,
    showTimeAxis,
    aggregateBubbleEvents,
    volumeBarsEnabled,
    volumeBarsInputData,
    volumeBarsMarketSource,
    volumeBarsFilterMin,
    volumeBarsFilterMax,
    volumeBarsColorMode,
    volumeBarsOpacity,
    volumeBarsHeightPct,
    volumeBarsShowValueText,
    volumeBarsTextSize,
    volumeBarsAverageLineEnabled,
    volumeBarsAverageLength,
    openOrders,
    positions,
    virtualPositions,
    bracketOrders,
    bracketDrag,
    recentFills,
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
      redraw();
    }, 1000);
    return () => clearInterval(timer);
  }, [redraw]);

  // Controls overlay positioning
  const customProfileControls = useMemo(() => {
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
  }, [customProfileRange, containerSize, candles, priceAxisWidth, timeAxisHeight, profileWidth, scrollOffset, barWidth, priceCenter, priceRange]);

  const selectedDrawing = useMemo(() => {
    if (!selectedDrawingId) return null;
    return drawnLines.find((line) => line.id === selectedDrawingId) ?? null;
  }, [drawnLines, selectedDrawingId]);

  const selectedDrawingControls = (() => {
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
    if (containerSize.width === 0 || containerSize.height === 0 || candles.length === 0) return [];

    const chartWidth = containerSize.width - priceAxisWidth;
    const chartHeight = containerSize.height - timeAxisHeight;
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
  }, [openOrders, containerSize, candles.length, priceAxisWidth, timeAxisHeight, priceCenter, priceRange]);

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
    if (openOrders.some((order) => order.id === confirmingCancelOrderId)) return;
    setConfirmingCancelOrderId(null);
  }, [confirmingCancelOrderId, openOrders]);

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

  // Drawing Interaction Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 0. Line Drawing, Deletion, Selection, and Drawing Movement
      if (hoveredLineId.current && isHoveringDeleteDot.current) {
        useChartStore.getState().removeLine(panelId, hoveredLineId.current);
        if (selectedDrawingId === hoveredLineId.current) {
          setSelectedDrawingId(null);
        }
        hoveredLineId.current = null;
        isHoveringDeleteDot.current = false;
        hoveredDrawingZone.current = null;
        redraw();
        return;
      }

      if (hoveredLineId.current && hoveredDrawingZone.current) {
        const targetLine = useChartStore.getState().panels[panelId].drawnLines.find((line) => line.id === hoveredLineId.current);
        if (targetLine) {
          setSelectedDrawingId(targetLine.id);
          useChartRuntimeStore.getState().setProfileSelected(panelId, false);
          if (!targetLine.locked && hoveredDrawingZone.current !== 'hover') {
            dragAnchor.current = { x, y };
            drawingSnapshot.current = targetLine;
            drawingDragZone.current = hoveredDrawingZone.current;
            isDraggingDrawing.current = true;
          }
          redraw();
          return;
        }
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
        } else if (lineDrawMode === 'horizontal-ray') {
          const pCenter = priceCenter.current ?? 0;
          const pRange = priceRange.current ?? 100;
          const priceMin = pCenter - pRange / 2;
          const priceMax = pCenter + pRange / 2;
          const price = yToPrice(y, priceMin, priceMax, chartHeight);
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'horizontal-ray', value: price, startIndex: index, startTime: candles[index]?.time });
        } else if (lineDrawMode === 'vertical') {
          const index = xToIndex(x, candles, scrollOffset.current, barWidth.current, chartWidth, profileWidth);
          useChartStore.getState().addLine(panelId, { id: crypto.randomUUID(), type: 'vertical', value: index, time: candles[index]?.time });
        } else if (lineDrawMode === 'box') {
          dragStart.current = { x, y };
          dragEnd.current = { x, y };
          isDragging.current = true;
          return;
        } else if (lineDrawMode === 'long-position' || lineDrawMode === 'short-position') {
          dragStart.current = { x, y };
          dragEnd.current = { x, y };
          isDragging.current = true;
          return;
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
          useChartRuntimeStore.getState().setActiveMeasurement(panelId, null);
        }
        return;
      }

      // Interaction with React overlay buttons is handled by React DOM events
      // No manual hit detection needed for Clear/Lock here anymore.

      // 4. Move/Resize Profile
      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = rect.height - timeAxisHeight;
      const pCenter = priceCenter.current ?? 0;
      const pRange = priceRange.current ?? 100;
      const priceMin = pCenter - pRange / 2;
      const priceMax = pCenter + pRange / 2;
      const orderLine = findNearestOrderLine(
        openOrders,
        x,
        y,
        chartWidth,
        chartHeight,
        (price) => calcPriceToY(price, priceMin, priceMax, chartHeight)
      );

      if (orderLine) {
        const blockReason = getModifyBlockReason({
          order: orderLine,
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
        orderDragSnapshot.current = orderLine;
        orderDragOriginalPrice.current = orderLine.price!;
        isDraggingOrderLine.current = true;
        setPendingModifyOrder(null);
        setShowModifyConfirm(false);
        setChartOrderMessage(null);
        setTradingStatus({
          modifyingOrderId: orderLine.id,
          dragPreviewPrice: orderLine.price!,
          modifyError: null,
          modifySuccess: null,
        });
        redraw();
        return;
      }

      // ── Bracket SL/TP handle hit (onMouseDown) ─────────────────────────────
      {
        const chartWidth2 = rect.width - priceAxisWidth;
        const chartHeight2 = rect.height - timeAxisHeight;
        if (x <= chartWidth2 && y <= chartHeight2) {
          for (const vp of virtualPositions) {
            if (vp.status !== 'open') continue;

            const slBox = bracketHitZones.current.slHandles.get(vp.id);
            const tpBox = bracketHitZones.current.tpHandles.get(vp.id);

            const hitSL = slBox && x >= slBox.x && x <= slBox.x + slBox.w && y >= slBox.y && y <= slBox.y + slBox.h;
            const hitTP = !hitSL && tpBox && x >= tpBox.x && x <= tpBox.x + tpBox.w && y >= tpBox.y && y <= tpBox.y + tpBox.h;

            if (hitSL || hitTP) {
              const bracket = bracketOrders.find((b) => b.positionId === vp.id);
              const handle: 'sl' | 'tp' = hitSL ? 'sl' : 'tp';
              const startPrice = hitSL
                ? (bracket?.stopLossPrice ?? vp.entryPrice)
                : (bracket?.takeProfitPrice ?? vp.entryPrice);

              isDraggingBracket.current    = true;
              bracketDragEntryPrice.current = vp.entryPrice;
              bracketDragSide.current       = vp.side;
              bracketDragRef.current        = { positionId: vp.id, handle, previewPrice: startPrice };
              useChartRuntimeStore.getState().setBracketDrag({ positionId: vp.id, handle, previewPrice: startPrice });
              setSelectedDrawingId(null);
              useChartRuntimeStore.getState().setProfileSelected(panelId, false);
              redraw();
              return;
            }
          }
        }
      }

      const currentPanel = useChartStore.getState().panels[panelId];
      const resolvedCurrentProfileRange = resolveCustomProfileRange(currentPanel.customProfileRange, candles);
      const profileHitZone = getCustomProfileHitZone(
        resolvedCurrentProfileRange,
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
        currentPanel.customProfileLocked
      );

      hoverZone.current = profileHitZone;

      if (profileHitZone && !currentPanel.customProfileLocked) {
        setSelectedDrawingId(null);
        dragAnchor.current = { x, y };
        profileSnapshot.current = resolvedCurrentProfileRange;

        if (profileHitZone === 'move') {
          isDraggingProfile.current = true;
        } else {
          isDraggingResize.current = true;
          resizeEdge.current = profileHitZone.replace('resize-', '') as 'left' | 'right' | 'top' | 'bottom';
        }
        useChartRuntimeStore.getState().setProfileSelected(panelId, true);
        return;
      }

      // 5. Select Profile (if clicked inside while locked)
      if (profileHitZone) {
        setSelectedDrawingId(null);
        useChartRuntimeStore.getState().setProfileSelected(panelId, true);
        redraw();
        return;
      }

      // 6. Click outside -> deselect profile and drawing
      setSelectedDrawingId(null);
      useChartRuntimeStore.getState().setProfileSelected(panelId, false);
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
        hoveredLineId.current = null;
        hoveredDrawingZone.current = null;
        isHoveringDeleteDot.current = false;
      } else if (measureToolActive) {
        cursor = 'crosshair';
      } else if (isDragging.current || isDrawMode) {
        cursor = 'crosshair';
      } else if (isDraggingDrawing.current) {
        cursor = drawingDragZone.current === 'move' ? 'grabbing' : 'crosshair';
      } else if (isDraggingProfile.current) {
        cursor = 'grabbing';
      } else if (isDraggingResize.current) {
        cursor = (resizeEdge.current === 'left' || resizeEdge.current === 'right') ? 'ew-resize' : 'ns-resize';
      } else if (isDraggingOrderLine.current) {
        cursor = 'ns-resize';
      } else if (isDraggingBracket.current) {
        cursor = 'ns-resize';
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
            const resolvedCustomProfileRange = resolveCustomProfileRange(customProfileRange, candles);

            hoverZone.current = getCustomProfileHitZone(
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
              useChartStore.getState().panels[panelId].customProfileLocked
            );

            if (hoverZone.current) {
              if (useChartStore.getState().panels[panelId].customProfileLocked) cursor = 'pointer';
              else if (hoverZone.current === 'move') cursor = 'grab';
              else if (hoverZone.current.includes('left') || hoverZone.current.includes('right')) cursor = 'ew-resize';
              else cursor = 'ns-resize';
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
          hoveredDrawingZone.current = null;
          hoveredOrderLineId.current = null;

          if (!hoveringAction && !hoverZone.current) {
            const chartWidth = rect.width - priceAxisWidth;
            const chartHeight = rect.height - timeAxisHeight;
            const pCenter = priceCenter.current ?? 0;
            const pRange = priceRange.current ?? 100;
            const priceMin = pCenter - pRange / 2;
            const priceMax = pCenter + pRange / 2;

            const priceToY = (p: number) => calcPriceToY(p, priceMin, priceMax, chartHeight);
            const indexToX = (idx: number) => calcIndexToX(idx, candles.length, scrollOffset.current, barWidth.current, chartWidth, profileWidth);

            const resolvedDrawnLines = drawnLines
              .map((line) => resolveLineForRender(line, candles))
              .filter((line): line is DrawnLine => line !== null);

            for (const line of resolvedDrawnLines) {
              const hitZone = getDrawingHitZone(line, x, y, indexToX, priceToY, chartWidth, chartHeight, barWidth.current);
              if (hitZone) {
                hoveredLineId.current = line.id;
                hoveredDrawingZone.current = hitZone;
                isHoveringDeleteDot.current = hitZone === 'delete';
                if (line.locked && hitZone !== 'delete') cursor = 'pointer';
                else if (hitZone === 'move') cursor = 'grab';
                else if (hitZone === 'resize-left' || hitZone === 'resize-right') cursor = 'ew-resize';
                else if (
                  hitZone === 'resize-top' ||
                  hitZone === 'resize-bottom' ||
                  hitZone === 'resize-entry' ||
                  hitZone === 'resize-stop' ||
                  hitZone === 'resize-target'
                ) cursor = 'ns-resize';
                else cursor = 'pointer';
                break;
              }
            }

            if (!hoveredLineId.current) {
              const orderLine = findNearestOrderLine(openOrders, x, y, chartWidth, chartHeight, priceToY);
              if (orderLine) {
                hoveredOrderLineId.current = orderLine.id;
                cursor = getModifyBlockReason({
                  order: orderLine,
                  symbol: tradingSymbol,
                  contractType: tradingContractType,
                  mode: currentTradingMode,
                  modeBadge,
                  riskStatus,
                })
                  ? 'not-allowed'
                  : 'ns-resize';
              }
            }
          }

          if (!hoveredLineId.current && !hoveredOrderLineId.current && !hoveringAction && !hoverZone.current) {
            // Check Axes
            if (x > rect.width - priceAxisWidth) cursor = 'ns-resize';
            else if (y > rect.height - timeAxisHeight) cursor = 'ew-resize';
            else cursor = 'crosshair';
          }
        }

        // Absorption Hover Detection
        let foundAbs = false;
        if (!hoverZone.current && absorptionEnabled && absorptionMap.size > 0) {
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
          if (!hoverZone.current && exhaustionEnabled && exhaustionMap.size > 0) {
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
            if (!hoverZone.current && icebergEnabled && icebergLevels.length > 0) {
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
      if (isDraggingBracket.current && bracketDragRef.current) {
        const chartHeight = rect.height - timeAxisHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange  = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;
        const rawPrice   = yToPrice(Math.max(0, Math.min(chartHeight, y)), priceMin, priceMax, chartHeight);
        const entryPrice = bracketDragEntryPrice.current ?? rawPrice;
        const side       = bracketDragSide.current ?? 'long';
        const { handle, positionId } = bracketDragRef.current;

        // Clamping: Long → TP above entry, SL below. Short → SL above entry, TP below.
        let clampedPrice = rawPrice;
        if (handle === 'sl') {
          clampedPrice = side === 'long'
            ? Math.min(rawPrice, entryPrice - 1)   // SL must be strictly below long entry
            : Math.max(rawPrice, entryPrice + 1);   // SL must be strictly above short entry
        } else {
          clampedPrice = side === 'long'
            ? Math.max(rawPrice, entryPrice + 1)   // TP must be strictly above long entry
            : Math.min(rawPrice, entryPrice - 1);   // TP must be strictly below short entry
        }

        if (Number.isFinite(clampedPrice)) {
          const next: BracketDragState = { positionId, handle, previewPrice: clampedPrice };
          bracketDragRef.current = next;
          useChartRuntimeStore.getState().setBracketDrag(next);
          redraw();
        }
      } else if (isDraggingOrderLine.current) {
        const chartHeight = rect.height - timeAxisHeight;
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
        (isDrawMode || measureToolActive || lineDrawMode === 'box' || lineDrawMode === 'long-position' || lineDrawMode === 'short-position')
      ) {
        dragEnd.current = { x, y };
        redraw();
      } else if (isDraggingDrawing.current && dragAnchor.current && drawingSnapshot.current && drawingDragZone.current) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = rect.height - timeAxisHeight;
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
              time: candles[index]?.time,
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
              startTime: candles[startIndex]?.time,
              value: priceAtCurrent,
            });
          } else if (zone === 'move' && baseStartIndex !== null) {
            const indexDelta = Math.round((x - dragAnchor.current.x) / barWidth.current);
            const startIndex = Math.max(0, Math.min(candles.length - 1, baseStartIndex + indexDelta));
            useChartStore.getState().updateLine(panelId, snapshot.id, {
              startIndex,
              startTime: candles[startIndex]?.time,
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
            updates.firstIndex = Math.max(0, Math.min(candles.length - 1, baseFirstIndex + indexDelta));
            updates.lastIndex = Math.max(0, Math.min(candles.length - 1, baseLastIndex + indexDelta));
            updates.firstTime = candles[updates.firstIndex]?.time;
            updates.lastTime = candles[updates.lastIndex]?.time;
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
            updates.firstIndex = Math.max(0, Math.min(candles.length - 1, baseFirstIndex + indexDelta));
            updates.lastIndex = Math.max(0, Math.min(candles.length - 1, baseLastIndex + indexDelta));
            updates.firstTime = candles[updates.firstIndex]?.time;
            updates.lastTime = candles[updates.lastIndex]?.time;
            updates.value = snapshot.value + priceDelta;
            updates.stopPrice = snapshot.stopPrice! + priceDelta;
            updates.targetPrice = snapshot.targetPrice! + priceDelta;
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
              updates.value = Math.max(snapshot.stopPrice! + minGap, Math.min(snapshot.targetPrice! - minGap, priceAtCurrent));
            } else {
              updates.value = Math.min(snapshot.stopPrice! - minGap, Math.max(snapshot.targetPrice! + minGap, priceAtCurrent));
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

        const chartHeight = rect.height - timeAxisHeight;
        const pCenter = priceCenter.current ?? 0;
        const pRange = priceRange.current ?? 100;
        const priceMin = pCenter - pRange / 2;
        const priceMax = pCenter + pRange / 2;

        const priceAtAnchor = yToPrice(dragAnchor.current.y, priceMin, priceMax, chartHeight);
        const priceAtCurrent = yToPrice(y, priceMin, priceMax, chartHeight);
        const priceDelta = priceAtCurrent - priceAtAnchor;

        const newRange = {
          firstIndex: Math.max(0, Math.min(candles.length - 1, baseFirstIndex + indexDelta)),
          lastIndex: Math.max(0, Math.min(candles.length - 1, baseLastIndex + indexDelta)),
          priceHigh: profileSnapshot.current.priceHigh + priceDelta,
          priceLow: profileSnapshot.current.priceLow + priceDelta,
        };
        const nextRange = {
          ...newRange,
          firstTime: candles[newRange.firstIndex]?.time,
          lastTime: candles[newRange.lastIndex]?.time,
        };

        useChartStore.getState().setCustomProfileRange(panelId, nextRange);
        redraw();
      } else if (isDraggingResize.current && dragAnchor.current && profileSnapshot.current) {
        const chartWidth = rect.width - priceAxisWidth;
        const chartHeight = rect.height - timeAxisHeight;
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
        // Enforce min size
        if (Math.abs(updatedRange.lastIndex - updatedRange.firstIndex) >= 2 &&
          Math.abs(updatedRange.priceHigh - updatedRange.priceLow) >= bucketSizeVal) {
          useChartStore.getState().setCustomProfileRange(panelId, updatedRange);
          redraw();
        }
      }
    };

    const onMouseUp = () => {
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

        if (existing && Number.isFinite(previewPrice) && previewPrice > 0) {
          const updated: BracketOrder = {
            ...existing,
            ...(handle === 'sl'
              ? { stopLossPrice: previewPrice }
              : { takeProfitPrice: previewPrice }),
            updatedAt: Date.now(),
          };
          store.upsertBracketOrder(updated);
        }

        // Reset bracket drag state
        isDraggingBracket.current    = false;
        bracketDragRef.current        = null;
        bracketDragEntryPrice.current = null;
        bracketDragSide.current       = null;
        store.setBracketDrag(null);
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
        (lineDrawMode === 'long-position' || lineDrawMode === 'short-position') &&
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
        const chartHeight = rect.height - timeAxisHeight;

        const widthPx = Math.abs(dragEnd.current.x - dragStart.current.x);
        const heightPx = Math.abs(dragEnd.current.y - dragStart.current.y);

        if (widthPx >= 5 && heightPx >= 5) {
          const position = buildPositionFromRiskDrag(
            lineDrawMode,
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

        if (widthPx >= 5 && heightPx >= 5) {
          useChartStore.getState().addLine(panelId, {
            id: crypto.randomUUID(),
            type: 'box',
            value: priceHigh,
            firstIndex,
            lastIndex,
            firstTime: candles[firstIndex]?.time,
            lastTime: candles[lastIndex]?.time,
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
            firstTime: candles[firstIndex]?.time,
            lastTime: candles[lastIndex]?.time,
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
  }, [isDrawMode, measureToolActive, activeMeasurement, redraw, priceAxisWidth, timeAxisHeight, panelId, lineDrawMode, drawnLines, candles, absorptionEnabled, absorptionMap, absorptionMinScore, absorptionSide, barWidth, customProfileRange, exhaustionEnabled, exhaustionMap, exhaustionMinScore, exhaustionShowProvisional, exhaustionSide, icebergEnabled, icebergLevels, icebergMinScore, icebergShowSuspected, icebergLookback, bucketSize, tickSize, isPanZoomDragging, panZoomDragMode, priceCenter, priceRange, profileWidth, scrollOffset, chartMode, engine, timeframe, selectedDrawingId, openOrders, tradingSymbol, tradingContractType, currentTradingMode, modeBadge, riskStatus, setTradingStatus]);

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

      {(chartOrderMessage || orderActionError || orderActionSuccess || modifyError || modifySuccess) && (
        <div
          className={`pointer-events-none absolute right-[92px] top-2 z-20 max-w-[260px] rounded border bg-[#1F1F1F]/94 px-2 py-1 text-[11px] font-semibold shadow-sm ${
            (chartOrderMessage?.type === 'error' || orderActionError || modifyError)
              ? 'border-[#f23645]/55 text-[#ffd7db]'
              : 'border-[#089981]/55 text-[#c8fff2]'
          }`}
        >
          {chartOrderMessage?.text ?? modifyError ?? orderActionError ?? modifySuccess ?? orderActionSuccess}
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

      {selectedDrawing && selectedDrawingControls && (
        <div
          className="popup-contrast absolute flex items-center gap-1 rounded border border-[#333] bg-[#1F1F1F]/95 p-1 shadow-xl backdrop-blur-sm z-30"
          style={{
            top: `${selectedDrawingControls.top}px`,
            left: `${selectedDrawingControls.left}px`,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              useChartStore.getState().updateLine(panelId, selectedDrawing.id, { locked: !selectedDrawing.locked });
              redraw();
            }}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${selectedDrawing.locked ? 'text-[#3D7EFF] hover:bg-[#1F1F1F]' : 'text-gray-400 hover:bg-[#1F1F1F] hover:text-[#E8E8E8]'}`}
            title={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
            aria-label={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
          >
            {selectedDrawing.locked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
          </button>
          <select
            value={selectedDrawing.strokeWidth ?? DEFAULT_DRAWING_STROKE_WIDTH}
            onChange={(event) => {
              useChartStore.getState().updateLine(panelId, selectedDrawing.id, {
                strokeWidth: Number(event.target.value) as DrawingStrokeWidth,
              });
              redraw();
            }}
            disabled={selectedDrawing.locked}
            className="h-7 rounded border border-[#333] bg-[#1F1F1F] px-1 text-[11px] font-bold text-[#E8E8E8] outline-none transition-colors hover:border-[#555] disabled:cursor-not-allowed disabled:opacity-45"
            title="Stroke width"
            aria-label="Stroke width"
          >
            {[1, 2, 3, 4].map((width) => (
              <option key={width} value={width}>{width}px</option>
            ))}
          </select>
          <div className="mx-0.5 h-5 w-px bg-[#333]" />
          <div className="flex items-center gap-0.5" title="Drawing color">
            {DRAWING_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { color });
                  redraw();
                }}
                disabled={selectedDrawing.locked}
                className="flex h-7 w-5 items-center justify-center rounded hover:bg-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                title={color}
                aria-label={`Set drawing color ${color}`}
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full border ${selectedDrawing.color === color ? 'border-white' : 'border-black/40'}`}
                  style={{ backgroundColor: color }}
                />
              </button>
            ))}
          </div>
          <div className="mx-0.5 h-5 w-px bg-[#333]" />
          <button
            type="button"
            onClick={() => {
              useChartStore.getState().removeLine(panelId, selectedDrawing.id);
              setSelectedDrawingId(null);
              redraw();
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
            title="Delete drawing"
            aria-label="Delete drawing"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Custom Profile Controls Overlay */}
      {customProfileRange && customProfileControls && (
        <div 
          className="popup-contrast absolute flex items-center gap-1 p-1 bg-[#1F1F1F]/90 backdrop-blur-sm border border-[#333] rounded shadow-xl z-20"
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
            className={`p-1.5 hover:bg-[#1F1F1F] rounded-md transition-all ${customProfileLocked ? 'text-[#3D7EFF]' : 'text-gray-400'}`}
            title={customProfileLocked ? "Unlock Profile" : "Lock Profile"}
          >
            {customProfileLocked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
          </button>
          <button
            onClick={() => {
              useChartStore.getState().openIndicatorSettings(panelId, 'profiles');
            }}
            className="p-1.5 text-gray-400 hover:bg-[#1F1F1F] hover:text-accent rounded-md transition-all"
            title="Profile Settings"
            aria-label="Profile Settings"
          >
            <Settings size={15} strokeWidth={2.5} />
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

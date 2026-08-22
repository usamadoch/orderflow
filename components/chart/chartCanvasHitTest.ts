import type { Candle } from '@/types/candle';
import type { DrawnLine, PanelState } from '@/lib/store/chart';
import type { CustomProfileHitZone, DrawingHitZone } from '@/types/chart';
import type { Order } from '@/types/trading';
import { priceToY as calcPriceToY, indexToX as calcIndexToX, xToIndex, yToPrice } from './useCoordinates';
import { distanceToSegment, hasPositionGeometry, candleTimeAt } from './chartCanvasUtils';

export function getOrderHitZone(
  order: Order,
  x: number,
  y: number,
  chartWidth: number,
  chartHeight: number,
  priceToY: (price: number) => number
): boolean {
  if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) return false;
  if (order.type !== 'limit' || !Number.isFinite(order.price) || !order.price) return false;

  const oy = priceToY(order.price);
  if (Math.abs(y - oy) > 7) return false;

  return true;
}

export function buildPositionFromRiskDrag(
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
    firstTime: candleTimeAt(firstIndex, candles),
    lastTime: candleTimeAt(lastIndex, candles),
    stopPrice,
    ...(targetPrice === undefined ? {} : { targetPrice }),
  };
}

export function getDrawingHitZone(
  line: DrawnLine,
  x: number,
  y: number,
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  barWidth: number,
  isSelected: boolean
): DrawingHitZone | null {
  const pad = 7;

  if (line.type === 'horizontal') {
    const ly = priceToY(line.value);
    if (Math.abs(y - ly) <= pad && x <= chartWidth) {
      return Math.abs(x - (chartWidth - 6)) <= pad ? 'delete' : 'move';
    }
    return null;
  }

  if (line.type === 'vertical') {
    const lx = indexToX(line.value);
    if (lx !== null && Math.abs(x - lx) <= pad && y <= chartHeight) {
      return Math.abs(y - 10) <= pad ? 'delete' : 'move';
    }
    return null;
  }

  if (line.type === 'horizontal-ray') {
    const startIndex = line.startIndex ?? 0;
    const lx = indexToX(startIndex);
    const ly = priceToY(line.value);
    if (lx === null || ly < 0 || ly > chartHeight) return null;

    if (Math.abs(x - (chartWidth - 6)) <= pad && Math.abs(y - ly) <= pad) return 'delete';

    const startX = Math.max(0, lx);
    const dist = distanceToSegment(x, y, startX, ly, chartWidth, ly);
    if (dist <= pad) {
      if (Math.abs(x - lx) <= pad) return 'resize-left';
      return 'move';
    }
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

    if (isSelected && Math.abs(x - right) <= pad && Math.abs(y - minY) <= pad) return 'delete';

    const onLeftEdge = Math.abs(x - left) <= pad && y >= minY - pad && y <= maxY + pad;
    const onRightEdge = Math.abs(x - right) <= pad && y >= minY - pad && y <= maxY + pad;
    const onTopEdge = Math.abs(y - minY) <= pad && x >= left - pad && x <= right + pad;
    const onBottomEdge = Math.abs(y - maxY) <= pad && x >= left - pad && x <= right + pad;

    if (!onLeftEdge && !onRightEdge && !onTopEdge && !onBottomEdge) {
      return null;
    }

    if (isSelected) {
      const cornerPad = 12;
      const nearLeft = Math.abs(x - left) <= cornerPad;
      const nearRight = Math.abs(x - right) <= cornerPad;
      const nearTop = Math.abs(y - minY) <= cornerPad;
      const nearBottom = Math.abs(y - maxY) <= cornerPad;

      if (nearLeft || nearRight || nearTop || nearBottom) {
        if (onLeftEdge && nearLeft) return 'resize-left';
        if (onRightEdge && nearRight) return 'resize-right';
        if (onTopEdge && nearTop) return 'resize-top';
        if (onBottomEdge && nearBottom) return 'resize-bottom';
      }
    }

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
    const targetY = line.targetPrice !== undefined ? priceToY(line.targetPrice) : undefined;
    const minY = targetY !== undefined ? Math.min(entryY, stopY, targetY) : Math.min(entryY, stopY);
    const maxY = targetY !== undefined ? Math.max(entryY, stopY, targetY) : Math.max(entryY, stopY);

    if (isSelected && Math.abs(x - right) <= pad && Math.abs(y - minY) <= pad) return 'delete';

    const onEntry = Math.abs(y - entryY) <= pad && x >= left - pad && x <= right + pad;
    const onStop = Math.abs(y - stopY) <= pad && x >= left - pad && x <= right + pad;
    const onTarget = targetY !== undefined && Math.abs(y - targetY) <= pad && x >= left - pad && x <= right + pad;
    const onLeft = Math.abs(x - left) <= pad && y >= minY - pad && y <= maxY + pad;
    const onRight = Math.abs(x - right) <= pad && y >= minY - pad && y <= maxY + pad;

    if (!onEntry && !onStop && !onTarget && !onLeft && !onRight) {
      return null;
    }

    if (onStop) return 'resize-stop';
    if (onTarget) return 'resize-target';
    if (onLeft) return 'resize-left';
    if (onRight) return 'resize-right';
    if (onEntry) return 'move';

    return 'move';
  }

  return null;
}

export function getDrawingToolbarAnchor(
  line: DrawnLine,
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  barWidth: number
): { x: number; y: number } | null {
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

export function getCustomProfileHitZone(
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
  isLocked: boolean,
  isSelected: boolean
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

  const onLeft = Math.abs(x - minX) <= handlePad && y >= minY - handlePad && y <= maxY + handlePad;
  const onRight = Math.abs(x - maxX) <= handlePad && y >= minY - handlePad && y <= maxY + handlePad;
  const onTop = Math.abs(y - minY) <= handlePad && x >= minX - handlePad && x <= maxX + handlePad;
  const onBottom = Math.abs(y - maxY) <= handlePad && x >= minX - handlePad && x <= maxX + handlePad;

  if (!onLeft && !onRight && !onTop && !onBottom) {
    return null;
  }

  if (isLocked) return 'move';

  if (isSelected) {
    const cornerPad = 12;
    const nearLeft = Math.abs(x - minX) <= cornerPad;
    const nearRight = Math.abs(x - maxX) <= cornerPad;
    const nearTop = Math.abs(y - minY) <= cornerPad;
    const nearBottom = Math.abs(y - maxY) <= cornerPad;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      if (onLeft && nearLeft) return 'resize-left';
      if (onRight && nearRight) return 'resize-right';
      if (onTop && nearTop) return 'resize-top';
      if (onBottom && nearBottom) return 'resize-bottom';
    }
  }

  return 'move';
}

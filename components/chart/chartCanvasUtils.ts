import type { Candle } from '@/types/candle';
import type { DrawnLine, PanelState, ContractType } from '@/lib/store/chart';
import type { CustomProfileRange } from '@/types/chart';
import type { Order, TradingRiskStatusPayload } from '@/types/trading';
import { MIN_FINE_PROFILE_BASE_BUCKET_SIZE } from '@/lib/config/markets';

const TARGET_PROFILE_ROW_PX = 3;

export function calcAutoBucketSize(
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

export function resolveProfileBucketSize(
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

  const baseBucketSize = Math.max(MIN_FINE_PROFILE_BASE_BUCKET_SIZE, tickSize);
  const multiple = Math.max(1, Math.round(requestedProfileBucketSize / baseBucketSize));
  return multiple * baseBucketSize;
}

export function findExactTimeIndex(time: number, candles: Candle[]): number | null {
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

export function resolveIndexFromTimeOrFallback(
  time: number | undefined,
  fallbackIndex: number | undefined,
  candles: Candle[]
): number | null {
  if (candles.length === 0) return null;

  if (time !== undefined) {
    const lastCandle = candles[candles.length - 1];
    if (time > lastCandle.time) {
      if (fallbackIndex !== undefined) return fallbackIndex;
      const firstCandle = candles[0];
      const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
      const indexDiff = (time - lastCandle.time) / avgInterval;
      return (candles.length - 1) + Math.round(indexDiff);
    }

    const exactIndex = findExactTimeIndex(time, candles);
    if (exactIndex !== null) return exactIndex;
  }

  if (fallbackIndex === undefined || fallbackIndex < 0) return null;
  return fallbackIndex;
}

export function candleTimeAt(index: number | null, candles: Candle[]): number | undefined {
  if (index === null || candles.length === 0) return undefined;
  if (index >= 0 && index < candles.length) return candles[index].time;

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
  return lastCandle.time + (index - (candles.length - 1)) * avgInterval;
}

export function isPositionDrawing(line: DrawnLine): boolean {
  return line.type === 'long-position' || line.type === 'short-position';
}

export function hasPositionGeometry(line: DrawnLine): boolean {
  return (
    isPositionDrawing(line) &&
    line.firstIndex !== undefined &&
    line.lastIndex !== undefined &&
    line.stopPrice !== undefined &&
    line.targetPrice !== undefined
  );
}

export function resolveLineForRender(line: DrawnLine, candles: Candle[]): DrawnLine | null {
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

export function resolveCustomProfileRange(
  range: PanelState['customProfileRange'],
  candles: Candle[]
): CustomProfileRange | null {
  if (!range) return null;
  const firstIndex = resolveIndexFromTimeOrFallback(range.firstTime, range.firstIndex, candles);
  const lastIndex = resolveIndexFromTimeOrFallback(range.lastTime, range.lastIndex, candles);
  if (firstIndex === null || lastIndex === null) return null;
  return { ...range, firstIndex, lastIndex };
}

export function getCustomProfileTimeBounds(range: CustomProfileRange, candles: Candle[]) {
  const firstTime = range.firstTime ?? candleTimeAt(range.firstIndex, candles);
  const lastTime = range.lastTime ?? candleTimeAt(range.lastIndex, candles);
  if (firstTime === undefined || lastTime === undefined) return null;
  return {
    startTime: Math.min(firstTime, lastTime),
    endTime: Math.max(firstTime, lastTime),
  };
}

export function isActiveLimitOrder(order: Order): boolean {
  return (
    order.type === 'limit' &&
    (order.status === 'open' || order.status === 'partially_filled') &&
    Number.isFinite(order.price) &&
    !!order.price
  );
}

export function getRemainingOrderQuantity(order: Order): number | null {
  if (Number.isFinite(order.quantity) && Number.isFinite(order.filledQuantity)) {
    const remaining = order.quantity - order.filledQuantity;
    if (remaining > 0) return remaining;
  }

  return Number.isFinite(order.quantity) && order.quantity > 0 ? order.quantity : null;
}

export function getModifyBlockReason(input: {
  order: Order;
  symbol: string;
  contractType: ContractType;
  mode: string;
  modeBadge: string;
  price?: number;
  quantity?: number;
  riskStatus?: TradingRiskStatusPayload | null;
}): string | null {
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

export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

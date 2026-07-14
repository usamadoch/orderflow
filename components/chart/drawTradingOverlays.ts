import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from '@/lib/config/chartColors';
import { formatPrice, formatVol } from '@/lib/utils/format';
import type { Candle } from '@/types/candle';
import type { Order, Position, TradeFill } from '@/types/trading';

const LABEL_FONT = '600 11px "Inter", -apple-system, system-ui, sans-serif';
const SMALL_FONT = '500 10px "Inter", -apple-system, system-ui, sans-serif';

function toTitleCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function toSeconds(timestamp: number) {
  return timestamp > 100000000000 ? timestamp / 1000 : timestamp;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();
  ctx.stroke();
}

function drawLineLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  maxRight: number,
) {
  ctx.font = LABEL_FONT;
  const width = Math.min(maxRight - x, Math.ceil(ctx.measureText(text).width) + 16);
  if (width <= 24) return;

  const height = 22;
  const labelY = Math.max(2, y - height - 4);
  ctx.fillStyle = 'rgba(15, 15, 15, 0.88)';
  ctx.strokeStyle = chartColorToRgba(color, 0.7);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, labelY, width, height, 4);

  ctx.fillStyle = '#E8E8E8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 8, labelY + height / 2, width - 14);
}

function findNearestCandleIndex(candles: Candle[], fillTime: number) {
  if (candles.length === 0) return null;

  const seconds = toSeconds(fillTime);
  let left = 0;
  let right = candles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const time = candles[mid].time;
    if (time === seconds) return mid;
    if (time < seconds) left = mid + 1;
    else right = mid - 1;
  }

  const candidates = [Math.max(0, right), Math.min(candles.length - 1, left)];
  let bestIndex = candidates[0];
  let bestDelta = Math.abs(candles[bestIndex].time - seconds);
  for (const index of candidates) {
    const delta = Math.abs(candles[index].time - seconds);
    if (delta < bestDelta) {
      bestIndex = index;
      bestDelta = delta;
    }
  }

  const visibleInterval = candles.length > 1
    ? Math.max(60, Math.abs(candles[Math.min(candles.length - 1, bestIndex + 1)]?.time - candles[bestIndex].time) || 60)
    : 60;

  return bestDelta <= visibleInterval ? bestIndex : null;
}

export function drawTradingOverlays(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (index: number) => number,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  orders: Order[],
  positions: Position[],
  recentFills: TradeFill[],
  dragPreview?: { orderId: string; price: number } | null,
) {
  ctx.save();

  for (const order of orders) {
    if (order.type !== 'limit' || !Number.isFinite(order.price) || !order.price) continue;

    const y = Math.round(priceToY(order.price));
    if (y < -8 || y > chartHeight + 8) continue;

    const color = order.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
    ctx.strokeStyle = color;
    ctx.globalAlpha = dragPreview?.orderId === order.id ? 0.42 : 0.84;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const remainingQuantity = Math.max(0, order.quantity - order.filledQuantity);
    const label = `${toTitleCase(order.side)} ${formatVol(remainingQuantity || order.quantity)} ${toTitleCase(order.type)} ${toTitleCase(order.status)}`;
    drawLineLabel(ctx, label, 8, y, color, Math.max(120, chartWidth - 78));
  }

  if (dragPreview && Number.isFinite(dragPreview.price) && dragPreview.price > 0) {
    const order = orders.find((item) => item.id === dragPreview.orderId);
    if (order) {
      const y = Math.round(priceToY(dragPreview.price));
      if (y >= -8 && y <= chartHeight + 8) {
        const color = order.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.96;
        ctx.lineWidth = 1.75;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        const label = `New ${formatPrice(dragPreview.price)}`;
        drawLineLabel(ctx, label, 8, y, color, Math.max(120, chartWidth - 78));
      }
    }
  }

  for (const position of positions) {
    if (
      position.side === 'flat' ||
      !Number.isFinite(position.quantity) ||
      position.quantity <= 0 ||
      !Number.isFinite(position.entryPrice) ||
      !position.entryPrice
    ) {
      continue;
    }

    const y = Math.round(priceToY(position.entryPrice));
    if (y < -8 || y > chartHeight + 8) continue;

    const color = position.side === 'long' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const pnlText = Number.isFinite(position.unrealizedPnl)
      ? ` PnL ${position.unrealizedPnl! >= 0 ? '+' : ''}${position.unrealizedPnl!.toFixed(2)}`
      : '';
    const label = `${toTitleCase(position.side)} ${formatVol(position.quantity)} Entry ${formatPrice(position.entryPrice)}${pnlText}`;
    drawLineLabel(ctx, label, 8, y, color, chartWidth - 8);
  }

  for (const fill of recentFills) {
    if (!Number.isFinite(fill.price) || !Number.isFinite(fill.time)) continue;

    const candleIndex = findNearestCandleIndex(candles, fill.time);
    if (candleIndex === null || candleIndex < visibleRange.firstIndex || candleIndex > visibleRange.lastIndex) continue;

    const candle = candles[candleIndex];
    const x = indexToX(candleIndex);
    const color = fill.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
    const markerY = fill.side === 'buy'
      ? priceToY(candle.low) + 12
      : priceToY(candle.high) - 12;
    const y = Math.max(8, Math.min(chartHeight - 8, markerY));
    const direction = fill.side === 'buy' ? -1 : 1;

    ctx.fillStyle = chartColorToRgba(color, 0.86);
    ctx.strokeStyle = '#0F0F0F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + direction * 5);
    ctx.lineTo(x - 5, y - direction * 4);
    ctx.lineTo(x + 5, y - direction * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = SMALL_FONT;
    ctx.fillStyle = chartColorToRgba(color, 0.92);
    ctx.textAlign = 'center';
    ctx.textBaseline = fill.side === 'buy' ? 'top' : 'bottom';
    ctx.fillText(fill.side === 'buy' ? 'B' : 'S', x, y + direction * 8);
  }

  ctx.restore();
}

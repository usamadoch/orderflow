import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from '@/lib/config/chartColors';
import { formatPrice, formatVol } from '@/lib/utils/format';
import type { Candle } from '@/types/candle';
import type { BracketDragState, BracketOrder, Order, TradeFill, VirtualPosition, MarketOrderDragState } from '@/types/trading';

// ─── Fonts ────────────────────────────────────────────────────────────────────
const LABEL_FONT  = '600 11px "Inter", -apple-system, system-ui, sans-serif';
const SMALL_FONT  = '500 10px "Inter", -apple-system, system-ui, sans-serif';
const BADGE_FONT  = '700 10px "Inter", -apple-system, system-ui, sans-serif';

// ─── Colours ──────────────────────────────────────────────────────────────────
const SL_COLOR    = '#F23645';   // Red — stop loss
const TP_COLOR    = '#26A69A';   // Teal-green — take profit
const ENTRY_COLOR = '#B8B8B8';   // Neutral grey — entry line

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function toSeconds(timestamp: number) {
  return timestamp > 100_000_000_000 ? timestamp / 1000 : timestamp;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  radius: number,
) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

// ─── Limit-order label ───────────────────────────────────────────────────────

function drawOrderLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  color: string,
  maxRight: number,
) {
  ctx.font = LABEL_FONT;
  const measured   = Math.ceil(ctx.measureText(text).width) + 18;
  const width      = Math.min(maxRight - x, measured);
  if (width < 28) return;

  const height = 20;
  const labelY = y - height / 2;

  ctx.fillStyle   = 'rgba(15,15,15,0.92)';
  ctx.strokeStyle = chartColorToRgba(color, 0.65);
  ctx.lineWidth   = 1;
  drawRoundedRect(ctx, x, labelY, width, height, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = '#E8E8E8';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 8, y, width - 14);
}

// ─── Price-axis badge (right edge) ───────────────────────────────────────────

function drawPriceBadge(
  ctx: CanvasRenderingContext2D,
  price: number,
  y: number,
  color: string,
  chartWidth: number,
) {
  const label      = formatPrice(price);
  ctx.font         = BADGE_FONT;
  const textWidth  = ctx.measureText(label).width;
  const badgeW     = Math.max(60, textWidth + 14);
  const badgeH     = 18;
  const bx         = chartWidth + 1;
  const by         = y - badgeH / 2;

  ctx.fillStyle = color;
  drawRoundedRect(ctx, bx, by, badgeW, badgeH, 3);
  ctx.fill();

  ctx.fillStyle    = '#0F0F0F';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + badgeW / 2, y);
}

// ─── Horizontal trading line ──────────────────────────────────────────────────

function drawTradingLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  chartWidth: number,
  color: string,
  alpha: number,
  lineWidth: number,
  dashPattern: number[],
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.setLineDash(dashPattern);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── SL/TP drag handle ────────────────────────────────────────────────────────
/**
 * Draws the right-edge pill handle users grab to drag an SL or TP level.
 * Returns the bounding box so ChartCanvas can hit-test it.
 */
function drawBracketHandle(
  ctx: CanvasRenderingContext2D,
  label: string,
  y: number,
  color: string,
  chartWidth: number,
  isDragging: boolean,
): { x: number; y: number; w: number; h: number } {
  const W = 42, H = 18, MARGIN = 4;
  const x = chartWidth - W - MARGIN;
  const ty = y - H / 2;

  ctx.fillStyle   = isDragging ? color : chartColorToRgba(color, 0.82);
  ctx.strokeStyle = chartColorToRgba(color, isDragging ? 1 : 0.5);
  ctx.lineWidth   = isDragging ? 1.5 : 1;
  drawRoundedRect(ctx, x, ty, W, H, 3);
  ctx.fill();
  ctx.stroke();

  ctx.font         = BADGE_FONT;
  ctx.fillStyle    = '#0F0F0F';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + W / 2, y);

  return { x, y: ty, w: W, h: H };
}

// ─── Fill markers ─────────────────────────────────────────────────────────────

function findNearestCandleIndex(candles: Candle[], fillTime: number): number | null {
  if (candles.length === 0) return null;

  const seconds = toSeconds(fillTime);
  let left = 0;
  let right = candles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const t   = candles[mid].time;
    if (t === seconds) return mid;
    if (t < seconds) left = mid + 1;
    else right = mid - 1;
  }

  const candidates = [Math.max(0, right), Math.min(candles.length - 1, left)];
  let bestIndex = candidates[0];
  let bestDelta = Math.abs(candles[bestIndex].time - seconds);
  for (const index of candidates) {
    const delta = Math.abs(candles[index].time - seconds);
    if (delta < bestDelta) { bestIndex = index; bestDelta = delta; }
  }

  const interval = candles.length > 1
    ? Math.max(60, Math.abs((candles[Math.min(candles.length - 1, bestIndex + 1)]?.time ?? 0) - candles[bestIndex].time) || 60)
    : 60;

  return bestDelta <= interval ? bestIndex : null;
}

// ─── Public hit-test geometry returned from the draw call ────────────────────

export interface TradingOverlayHitZones {
  /** SL handle bounding boxes: map from positionId → box */
  slHandles: Map<string, { x: number; y: number; w: number; h: number }>;
  /** TP handle bounding boxes: map from positionId → box */
  tpHandles: Map<string, { x: number; y: number; w: number; h: number }>;
}

// ─── Main draw entry point ────────────────────────────────────────────────────

export function drawTradingOverlays(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (index: number) => number,
  priceToY: (price: number) => number,
  chartWidth: number,
  chartHeight: number,
  priceAxisWidth: number,
  orders: Order[],
  virtualPositions: Array<VirtualPosition & { liquidationPrice?: number }>,
  bracketOrders: BracketOrder[],
  recentFills: TradeFill[],
  dragPreview?: { orderId: string; price: number } | null,
  bracketDrag?: BracketDragState | null,
  marketOrderDrag?: MarketOrderDragState | null,
): TradingOverlayHitZones {
  ctx.save();

  const hitZones: TradingOverlayHitZones = {
    slHandles: new Map(),
    tpHandles: new Map(),
  };

  // ── 1. Recent fill markers ─────────────────────────────────────────────────
  for (const fill of recentFills) {
    if (!Number.isFinite(fill.price) || !Number.isFinite(fill.time)) continue;

    const candleIndex = findNearestCandleIndex(candles, fill.time);
    if (
      candleIndex === null ||
      candleIndex < visibleRange.firstIndex ||
      candleIndex > visibleRange.lastIndex
    ) continue;

    const candle  = candles[candleIndex];
    const x       = indexToX(candleIndex);
    const color   = fill.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
    const markerY = fill.side === 'buy'
      ? priceToY(candle.low) + 14
      : priceToY(candle.high) - 14;
    const y         = Math.max(10, Math.min(chartHeight - 10, markerY));
    const direction = fill.side === 'buy' ? -1 : 1;

    // Arrow triangle
    ctx.fillStyle   = chartColorToRgba(color, 0.88);
    ctx.strokeStyle = '#0F0F0F';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + direction * 6);
    ctx.lineTo(x - 5, y - direction * 4);
    ctx.lineTo(x + 5, y - direction * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // B / S label
    ctx.font         = SMALL_FONT;
    ctx.fillStyle    = chartColorToRgba(color, 0.95);
    ctx.textAlign    = 'center';
    ctx.textBaseline = fill.side === 'buy' ? 'top' : 'bottom';
    ctx.fillText(fill.side === 'buy' ? 'B' : 'S', x, y + direction * 10);
  }

  // ── 2. Open Limit Order lines ──────────────────────────────────────────────
  for (const order of orders) {
    if (order.type !== 'limit' || !Number.isFinite(order.price) || !order.price) continue;

    const y = Math.round(priceToY(order.price));
    if (y < -8 || y > chartHeight + 8) continue;

    const isBuy       = order.side === 'buy';
    const color       = isBuy ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;
    const isBeingDrag = dragPreview?.orderId === order.id;

    // Dashed line (dim when a drag preview is active for this order)
    drawTradingLine(
      ctx, y, chartWidth,
      color,
      isBeingDrag ? 0.3 : 0.82,
      isBeingDrag ? 1 : 1.4,
      [6, 4],
    );

    // Left-side coloured tick mark
    ctx.fillStyle = chartColorToRgba(color, isBeingDrag ? 0.3 : 0.92);
    ctx.fillRect(0, y - 1, 3, 3);

    // Label
    const remaining = Math.max(0, order.quantity - order.filledQuantity);
    const qty       = remaining > 0 ? remaining : order.quantity;
    const statusStr = order.status === 'partially_filled' ? 'Partial' : toTitleCase(order.status);
    const labelText = `${isBuy ? 'BUY' : 'SELL'}  ${formatVol(qty)}  ${statusStr}`;
    drawOrderLabel(ctx, labelText, 10, y, color, chartWidth - 90);

    // Price badge on the price axis
    drawPriceBadge(ctx, order.price, y, color, chartWidth);
  }

  // ── 3. Drag-modify preview line ────────────────────────────────────────────
  if (dragPreview && Number.isFinite(dragPreview.price) && dragPreview.price > 0) {
    const order = orders.find((o) => o.id === dragPreview.orderId);
    if (order) {
      const y = Math.round(priceToY(dragPreview.price));
      if (y >= -8 && y <= chartHeight + 8) {
        const color = order.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

        drawTradingLine(ctx, y, chartWidth, color, 0.96, 1.75, [2, 2]);

        const labelText = `New Price  ${formatPrice(dragPreview.price)}`;
        drawOrderLabel(ctx, labelText, 10, y, color, chartWidth - 90);
        drawPriceBadge(ctx, dragPreview.price, y, color, chartWidth);
      }
    }
  }

  // ── 4. Virtual Position entry lines ───────────────────────────────────────
  for (const vp of virtualPositions) {
    if (vp.status !== 'open' || !Number.isFinite(vp.entryPrice)) continue;

    const y = Math.round(priceToY(vp.entryPrice));
    if (y < -8 || y > chartHeight + 8) continue;

    const isLong = vp.side === 'long';
    const color  = isLong ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

    // Solid entry line
    drawTradingLine(ctx, y, chartWidth, color, 0.92, 1.75, []);

    // PnL text
    const pnlStr = Number.isFinite(vp.unrealizedPnl)
      ? ` ${vp.unrealizedPnl! >= 0 ? '+' : ''}${vp.unrealizedPnl!.toFixed(2)} USDT`
      : '';
    const sideStr  = isLong ? 'LONG' : 'SHORT';
    const entryStr = `${sideStr}  ${formatVol(vp.quantity)} @ ${formatPrice(vp.entryPrice)}${pnlStr}`;
    drawOrderLabel(ctx, entryStr, 10, y, color, chartWidth - 90);
    drawPriceBadge(ctx, vp.entryPrice, y, color, chartWidth);

    // Small fixed-entry indicator triangle on the left
    ctx.fillStyle = chartColorToRgba(color, 0.85);
    const triDir  = isLong ? -1 : 1; // pointing up for long, down for short
    const tx      = 6, ty2 = y;
    ctx.beginPath();
    ctx.moveTo(tx, ty2 + triDir * 6);
    ctx.lineTo(tx - 5, ty2 - triDir * 4);
    ctx.lineTo(tx + 5, ty2 - triDir * 4);
    ctx.closePath();
    ctx.fill();

    // Liquidation line (Futures only)
    if (Number.isFinite(vp.liquidationPrice)) {
      const liqY = Math.round(priceToY(vp.liquidationPrice!));
      if (liqY >= -8 && liqY <= chartHeight + 8) {
        const liqColor = '#E4A336'; // Warning orange/gold
        drawTradingLine(ctx, liqY, chartWidth, liqColor, 0.8, 1, [4, 4]);
        drawOrderLabel(ctx, `LIQ  ${formatPrice(vp.liquidationPrice!)}`, 10, liqY, liqColor, chartWidth - 90);
        drawPriceBadge(ctx, vp.liquidationPrice!, liqY, liqColor, chartWidth);
      }
    }
  }

  // ── 5. Bracket SL/TP lines ────────────────────────────────────────────────
  for (const vp of virtualPositions) {
    if (vp.status !== 'open') continue;

    const bracket   = bracketOrders.find((b) => b.positionId === vp.id);
    const isLong    = vp.side === 'long';

    // --- Stop Loss ---
    if (bracket?.stopLossPrice != null && bracket.stopLossStatus === 'active') {
      const isDraggingSL = bracketDrag?.positionId === vp.id && bracketDrag.handle === 'sl';
      const slPrice      = isDraggingSL ? bracketDrag!.previewPrice : bracket.stopLossPrice;
      const y            = Math.round(priceToY(slPrice));

      if (y >= -8 && y <= chartHeight + 8) {
        // Danger zone fill between SL and entry
        if (Number.isFinite(vp.entryPrice)) {
          const entryY = Math.round(priceToY(vp.entryPrice));
          const zoneTop    = Math.min(y, entryY);
          const zoneBottom = Math.max(y, entryY);
          ctx.save();
          ctx.globalAlpha  = 0.05;
          ctx.fillStyle    = SL_COLOR;
          ctx.fillRect(0, zoneTop, chartWidth, zoneBottom - zoneTop);
          ctx.restore();
        }

        drawTradingLine(ctx, y, chartWidth, SL_COLOR, isDraggingSL ? 0.95 : 0.75, isDraggingSL ? 1.5 : 1.2, [4, 3]);
        drawOrderLabel(ctx, `SL  ${formatPrice(slPrice)}`, 10, y, SL_COLOR, chartWidth - 90);
        drawPriceBadge(ctx, slPrice, y, SL_COLOR, chartWidth);

        const box = drawBracketHandle(ctx, 'SL', y, SL_COLOR, chartWidth, isDraggingSL);
        hitZones.slHandles.set(vp.id, box);
      }
    }

    // --- Take Profit ---
    if (bracket?.takeProfitPrice != null && bracket.takeProfitStatus === 'active') {
      const isDraggingTP = bracketDrag?.positionId === vp.id && bracketDrag.handle === 'tp';
      const tpPrice      = isDraggingTP ? bracketDrag!.previewPrice : bracket.takeProfitPrice;
      const y            = Math.round(priceToY(tpPrice));

      if (y >= -8 && y <= chartHeight + 8) {
        // Profit zone fill between TP and entry
        if (Number.isFinite(vp.entryPrice)) {
          const entryY = Math.round(priceToY(vp.entryPrice));
          const zoneTop    = Math.min(y, entryY);
          const zoneBottom = Math.max(y, entryY);
          ctx.save();
          ctx.globalAlpha  = 0.05;
          ctx.fillStyle    = TP_COLOR;
          ctx.fillRect(0, zoneTop, chartWidth, zoneBottom - zoneTop);
          ctx.restore();
        }

        drawTradingLine(ctx, y, chartWidth, TP_COLOR, isDraggingTP ? 0.95 : 0.75, isDraggingTP ? 1.5 : 1.2, [4, 3]);
        drawOrderLabel(ctx, `TP  ${formatPrice(tpPrice)}`, 10, y, TP_COLOR, chartWidth - 90);
        drawPriceBadge(ctx, tpPrice, y, TP_COLOR, chartWidth);

        const box = drawBracketHandle(ctx, 'TP', y, TP_COLOR, chartWidth, isDraggingTP);
        hitZones.tpHandles.set(vp.id, box);
      }
    }

    // Placeholder: if no bracket yet, show faint "Set SL / TP" nudge at ±2%
    if (!bracket) {
      const nudgeSL = isLong ? vp.entryPrice * 0.98 : vp.entryPrice * 1.02;
      const nudgeTP = isLong ? vp.entryPrice * 1.02 : vp.entryPrice * 0.98;

      for (const { price, label, color } of [
        { price: nudgeSL, label: '+ SL', color: SL_COLOR },
        { price: nudgeTP, label: '+ TP', color: TP_COLOR },
      ] as const) {
        const y = Math.round(priceToY(price));
        if (y < -8 || y > chartHeight + 8) continue;

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(chartWidth - 60, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font         = SMALL_FONT;
        ctx.fillStyle    = color;
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, chartWidth - 3, y);
        ctx.restore();
      }
    }
  }

  // ── 6. Market Order SL Drag ───────────────────────────────────────────────
  if (marketOrderDrag) {
    const slY = Math.round(priceToY(marketOrderDrag.slPrice));
    const startY = Math.round(priceToY(marketOrderDrag.startPrice));

    if (slY >= -8 && slY <= chartHeight + 8) {
      // Risk zone fill between SL and start price
      const zoneTop = Math.min(slY, startY);
      const zoneBottom = Math.max(slY, startY);
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = SL_COLOR;
      ctx.fillRect(0, zoneTop, chartWidth, zoneBottom - zoneTop);
      ctx.restore();

      drawTradingLine(ctx, slY, chartWidth, SL_COLOR, 0.95, 1.5, [4, 3]);
      
      const sideText = marketOrderDrag.direction === 'buy' ? 'LONG' : 'SHORT';
      drawOrderLabel(ctx, `SL ${sideText} MARKET`, 10, slY, SL_COLOR, chartWidth - 90);
      drawPriceBadge(ctx, marketOrderDrag.slPrice, slY, SL_COLOR, chartWidth);
      drawBracketHandle(ctx, 'SL', slY, SL_COLOR, chartWidth, true);
    }
  }

  ctx.restore();
  return hitZones;
}

// ─── Exported colour constants (used by ChartCanvas for hit-test rendering) ──

export { SL_COLOR, TP_COLOR, ENTRY_COLOR };

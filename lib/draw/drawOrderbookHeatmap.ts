/**
 * drawOrderbookHeatmap.ts — Bookmap-style Order Book Liquidity Heatmap renderer.
 *
 * Visual model (matching Bookmap):
 *
 * 1. PASSIVE LIQUIDITY (background heatmap):
 *    Resting limit orders shown as a cool-tone color ramp (navy → blue → cyan).
 *    Heavy walls glow bright cyan. Near-zero depth is invisible/navy.
 *    Warm tones (amber/red) are NOT used here — they are reserved for active trades only.
 *
 * 2. BEST BID / BEST ASK CORRIDOR LINES:
 *    Two polylines connecting each slot's bestBid and bestAsk over time.
 *    Creates the "two lines going around" visual from Bookmap.
 *
 * 3. ACTIVE LIQUIDITY BUBBLES:
 *    Executed trades rendered as green (aggressive buy) or red (aggressive sell)
 *    filled circles, scaled by quantity relative to a running p95 of trade sizes.
 *    Matching the aesthetic of the existing Bubble indicator.
 */

import { HeatmapSlot } from '../liquidity/orderbookHeatmap';
import { Trade } from '../../types/trade';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

// ─── Passive Depth Color Ramp (warm-capped) ───────────────────────────────
// Cold end = sparse/no resting orders, warm end = heavy walls.
// Ends in yellow/cream, not red — so hot walls don't compete visually with
// the red ask corridor line or red sell bubbles drawn on top.
const PASSIVE_ANCHORS: { t: number; rgb: Rgb }[] = [
  { t: 0.00, rgb: { r: 22,  g: 35,  b: 59  } },  // #16233b — deep navy (sparse)
  { t: 0.25, rgb: { r: 29,  g: 90,  b: 168 } },  // #1d5aa8 — royal blue
  { t: 0.50, rgb: { r: 34,  g: 199, b: 217 } },  // #22c7d9 — cyan
  { t: 0.75, rgb: { r: 245, g: 224, b: 122 } },  // #f5e07a — warm yellow
  { t: 1.00, rgb: { r: 254, g: 250, b: 240 } },  // #fefaf0 — near-white cream (max wall)
];

function interpolatePassiveColor(t: number): Rgb {
  const clampedT = Math.max(0, Math.min(1, t));

  for (let i = 0; i < PASSIVE_ANCHORS.length - 1; i++) {
    const a1 = PASSIVE_ANCHORS[i];
    const a2 = PASSIVE_ANCHORS[i + 1];
    if (clampedT >= a1.t && clampedT <= a2.t) {
      const span = a2.t - a1.t;
      const factor = span > 0 ? (clampedT - a1.t) / span : 0;
      return {
        r: a1.rgb.r + (a2.rgb.r - a1.rgb.r) * factor,
        g: a1.rgb.g + (a2.rgb.g - a1.rgb.g) * factor,
        b: a1.rgb.b + (a2.rgb.b - a1.rgb.b) * factor,
      };
    }
  }

  return PASSIVE_ANCHORS[PASSIVE_ANCHORS.length - 1].rgb;
}

// 256-entry LUT — precomputed once per module load
// Alpha curve: near-zero floor so sparse orders are nearly invisible;
// heavy walls become fully opaque cyan.
export const HEATMAP_COLOR_LUT: string[] = (() => {
  const lut: string[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const { r, g, b } = interpolatePassiveColor(t);
    // α = 0.08 + 0.88 * t^1.15 — low floor, steep acceleration at top
    const alpha = 0.08 + 0.88 * Math.pow(t, 1.15);
    lut[i] = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(4)})`;
  }
  return lut;
})();

export interface DrawOrderbookHeatmapOptions {
  ctx: CanvasRenderingContext2D;
  slots: HeatmapSlot[];
  priceToY: (price: number) => number;
  timeToX: (timeMs: number) => number;
  priceBucketSize: number;
  sampleIntervalMs: number;
  p95Clamp: number;
  chartWidth: number;
  chartHeight: number;
  trades?: Trade[];
  showTrades?: boolean;
  priceLineAccentColor?: string;
  isLatestLive?: boolean;
}

export function drawOrderbookHeatmap({
  ctx,
  slots,
  priceToY,
  timeToX,
  priceBucketSize,
  sampleIntervalMs,
  p95Clamp,
  chartWidth,
  chartHeight,
  trades = [],
  showTrades = true,
  priceLineAccentColor = '#F0B90B',
  isLatestLive = true,
}: DrawOrderbookHeatmapOptions): void {
  if (slots.length === 0) return;

  const safeP95 = Math.max(0.00001, p95Clamp);
  const lut = HEATMAP_COLOR_LUT;

  // ─── 1. Pixel-Column Quantization & Wall-Preserving Merge ─────────────────
  // Group time-slots by their left pixel X to collapse sub-pixel slots
  // into one draw call per pixel column, keeping max intensity per price row.
  interface PriceEntry {
    latest: number;
    max: number;
  }

  interface ColumnSlot {
    xLeft: number;
    colWidth: number;
    prices: Map<number, PriceEntry>;
  }

  const columnMap = new Map<number, ColumnSlot>();
  let latestSlotTime = 0;

  // Corridor tracking: sorted list of (timeMs, bestBid|null, bestAsk|null)
  // for drawing bid/ask lines across the chart.
  const corridorPoints: { x: number; bestBid: number | null; bestAsk: number | null }[] = [];

  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    if (slot.timeSlot > latestSlotTime) latestSlotTime = slot.timeSlot;

    const xLeft = timeToX(slot.timeSlot);
    const xRight = timeToX(slot.timeSlot + sampleIntervalMs);

    // Corridor: capture mid-column X for the line points
    const xMid = (xLeft + xRight) / 2;
    if (xMid >= -5 && xMid <= chartWidth + 5) {
      corridorPoints.push({ x: xMid, bestBid: slot.bestBid, bestAsk: slot.bestAsk });
    }

    // Skip depth cells if column is off-screen
    if (xRight < 0 || xLeft > chartWidth) continue;

    const px = Math.floor(xLeft);
    const colWidth = Math.max(1, Math.ceil(xRight - xLeft));

    let col = columnMap.get(px);
    if (!col) {
      col = {
        xLeft: px,
        colWidth,
        prices: new Map<number, PriceEntry>(),
      };
      columnMap.set(px, col);
    } else if (colWidth > col.colWidth) {
      col.colWidth = colWidth;
    }

    for (const cell of slot.cells.values()) {
      if (cell.totalSize <= 0) continue;
      const entry = col.prices.get(cell.price);
      if (!entry) {
        col.prices.set(cell.price, { latest: cell.totalSize, max: cell.totalSize });
      } else {
        entry.latest = cell.totalSize;
        if (cell.totalSize > entry.max) entry.max = cell.totalSize;
      }
    }
  }

  const wallThreshold = safeP95 * 0.6;

  // ─── Draw passive depth columns ────────────────────────────────────────────
  for (const col of columnMap.values()) {
    const { xLeft, colWidth, prices } = col;

    for (const [price, entry] of prices) {
      // Preserve genuine resting walls at their peak; blend noise subtly
      const renderSize = entry.max >= wallThreshold
        ? entry.max
        : (entry.latest * 0.75 + entry.max * 0.25);
      if (renderSize <= 0) continue;

      const yTop = priceToY(price + priceBucketSize);
      const yBottom = priceToY(price);
      const cellHeight = Math.max(1, yBottom - yTop);

      if (yBottom < 0 || yTop > chartHeight) continue;

      const tClamped = Math.min(1, Math.max(0, renderSize / safeP95));
      const lutIndex = Math.min(255, Math.max(0, Math.round(tClamped * 255)));

      ctx.fillStyle = lut[lutIndex];
      ctx.fillRect(xLeft, Math.floor(yTop), colWidth, Math.ceil(cellHeight));
    }
  }

  // ─── 2. Live Column Outline ────────────────────────────────────────────────
  if (isLatestLive && latestSlotTime > 0) {
    const liveXLeft = timeToX(latestSlotTime);
    const liveXRight = timeToX(latestSlotTime + sampleIntervalMs);
    const liveWidth = Math.max(1.5, liveXRight - liveXLeft);

    if (liveXRight >= 0 && liveXLeft <= chartWidth) {
      ctx.save();
      ctx.strokeStyle = priceLineAccentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.floor(liveXLeft) + 0.5, 0.5, Math.ceil(liveWidth), chartHeight - 1);
      ctx.restore();
    }
  }

  // ─── 3. Best Bid / Best Ask Corridor Lines ─────────────────────────────────
  // Two continuous polylines: green = best bid, red = best ask.
  // These create the "two lines tracking price" corridor from Bookmap.
  if (corridorPoints.length >= 2) {
    ctx.save();
    ctx.lineWidth = 1.5;

    // Sort corridor points by X (ascending = oldest → newest)
    corridorPoints.sort((a, b) => a.x - b.x);

    // Draw best bid line (green/teal)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 188, 140, 0.85)';
    let firstBidPoint = true;
    for (const pt of corridorPoints) {
      if (pt.bestBid === null) continue;
      const y = priceToY(pt.bestBid);
      if (y < 0 || y > chartHeight) { firstBidPoint = true; continue; }
      if (firstBidPoint) { ctx.moveTo(pt.x, y); firstBidPoint = false; }
      else { ctx.lineTo(pt.x, y); }
    }
    ctx.stroke();

    // Draw best ask line (red/coral)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(220, 75, 55, 0.85)';
    let firstAskPoint = true;
    for (const pt of corridorPoints) {
      if (pt.bestAsk === null) continue;
      const y = priceToY(pt.bestAsk);
      if (y < 0 || y > chartHeight) { firstAskPoint = true; continue; }
      if (firstAskPoint) { ctx.moveTo(pt.x, y); firstAskPoint = false; }
      else { ctx.lineTo(pt.x, y); }
    }
    ctx.stroke();

    ctx.restore();
  }

  // ─── 4. Active Liquidity Bubbles (executed trades) ─────────────────────────
  // Green = aggressive buy (isBuyerMaker === false, i.e. market buy hit resting ask).
  // Red   = aggressive sell (isBuyerMaker === true, i.e. market sell hit resting bid).
  // Radius scales with trade quantity relative to a rolling p95 of trade sizes.
  if (showTrades && trades.length > 0) {
    // Compute p95 of quantities in the visible set for radius scaling
    let p95Qty = 1;
    if (trades.length > 3) {
      const sorted = trades.map((t) => t.quantity).sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      p95Qty = Math.max(1, sorted[idx]);
    } else if (trades.length > 0) {
      p95Qty = Math.max(1, Math.max(...trades.map((t) => t.quantity)));
    }

    const MIN_RADIUS = 2.5;
    const MAX_RADIUS = 14;

    ctx.save();

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      const tradeTimeMs = trade.time > 1e11 ? trade.time : trade.time * 1000;
      const tx = timeToX(tradeTimeMs);
      const ty = priceToY(trade.price);

      if (tx < -MAX_RADIUS || tx > chartWidth + MAX_RADIUS) continue;
      if (ty < -MAX_RADIUS || ty > chartHeight + MAX_RADIUS) continue;

      // Scale radius using sqrt for perceptual area scaling
      const t = Math.sqrt(Math.min(1, Math.max(0, trade.quantity / p95Qty)));
      const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;

      // isBuyerMaker === false: market buy (aggressive), green
      // isBuyerMaker === true : market sell (aggressive), red
      const isBuy = !trade.isBuyerMaker;

      ctx.beginPath();
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);

      if (isBuy) {
        ctx.fillStyle = `rgba(0, 200, 120, ${0.45 + 0.35 * t})`;
        ctx.strokeStyle = 'rgba(0, 240, 150, 0.7)';
      } else {
        ctx.fillStyle = `rgba(220, 60, 50, ${0.45 + 0.35 * t})`;
        ctx.strokeStyle = 'rgba(255, 80, 60, 0.7)';
      }

      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

import { Candle } from '@/types/candle';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from '@/lib/config/chartColors';
import { getTimeframeSeconds } from '@/lib/utils/feedUtils';
import type { CandleColorOptions } from './drawCandles';

export interface SideBySideOptions {
  timeframe?: string;
  webColors?: CandleColorOptions;
  mt5BullishColor?: string;
  mt5BearishColor?: string;
  mt5Opacity?: number;
  showLegend?: boolean;
}

// Professional high-contrast compare colors for MT5:
// Electric Sky Blue for MT5 Bullish, Radiant Warm Orange for MT5 Bearish
const DEFAULT_MT5_BULLISH = '#00B0FF';
const DEFAULT_MT5_BEARISH = '#FF6D00';

/**
 * Draws Binance (Web) candle on the left sub-slot and MT5 candle on the right sub-slot
 * of each bar index, sharing the exact same price-to-Y coordinate scale.
 * 
 * - Unmatched candles (e.g. historical bars beyond MT5 cache) render centered at normal width.
 * - Matched candle pairs render side-by-side with crisp solid bodies and half-pixel aligned wicks.
 * - Renders a sleek floating glassmorphic comparison legend in the top-left corner.
 */
export function drawSideBySideCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  mt5Candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  options?: SideBySideOptions
) {
  const webUpBody = options?.webColors?.upColor || CHART_BULLISH_COLOR;
  const webUpOpacity = typeof options?.webColors?.upOpacity === 'number' ? options.webColors.upOpacity : 1;
  const webDownBody = options?.webColors?.downColor || CHART_BEARISH_COLOR;
  const webDownOpacity = typeof options?.webColors?.downOpacity === 'number' ? options.webColors.downOpacity : 1;
  const webUpWick = options?.webColors?.upWickColor || webUpBody;
  const webDownWick = options?.webColors?.downWickColor || webDownBody;

  const mt5UpColor = options?.mt5BullishColor || DEFAULT_MT5_BULLISH;
  const mt5DownColor = options?.mt5BearishColor || DEFAULT_MT5_BEARISH;
  const mt5Opacity = typeof options?.mt5Opacity === 'number' ? options.mt5Opacity : 0.92;

  const intervalSec = getTimeframeSeconds(options?.timeframe || '1m');

  // Build timestamp lookup map with timeframe interval alignment to handle clock drift
  const mt5Map = new Map<number, Candle>();
  if (Array.isArray(mt5Candles)) {
    for (let j = 0; j < mt5Candles.length; j++) {
      const mc = mt5Candles[j];
      if (mc && Number.isFinite(mc.time)) {
        const alignedTime = Math.round(mc.time / intervalSec) * intervalSec;
        mt5Map.set(alignedTime, mc);
      }
    }
  }

  ctx.save();

  // Dual-slot geometry
  const slotOffset = barWidth * 0.22;
  const slotWidth = Math.max(2, Math.floor(barWidth * 0.40));
  const fullCandleWidth = Math.max(1, Math.floor(barWidth * 0.82));

  let matchedPairsCount = 0;

  for (let i = firstIndex; i <= lastIndex; i++) {
    const cWeb = candles[i];
    if (!cWeb) continue;

    const x = indexToX(i);

    // Normalize Binance candle time to interval to find matching MT5 candle
    const webAlignedTime = Math.round(cWeb.time / intervalSec) * intervalSec;
    const cMt5 = mt5Map.get(webAlignedTime);

    const isWebBullish = cWeb.close >= cWeb.open;
    const webBodyColor = isWebBullish ? webUpBody : webDownBody;
    const webBodyOpacity = isWebBullish ? webUpOpacity : webDownOpacity;
    const webWickColor = isWebBullish ? webUpWick : webDownWick;

    const webBodyRgba = chartColorToRgba(webBodyColor, webBodyOpacity);
    const webWickRgba = chartColorToRgba(webWickColor, webBodyOpacity);

    const webOpenY = priceToY(cWeb.open);
    const webCloseY = priceToY(cWeb.close);
    const webHighY = priceToY(cWeb.high);
    const webLowY = priceToY(cWeb.low);

    const webTopY = Math.round(Math.min(webOpenY, webCloseY));
    const webBottomY = Math.round(Math.max(webOpenY, webCloseY));
    const webBodyHeight = Math.max(1, webBottomY - webTopY);

    // ── If NO MT5 candle exists for this bar: draw Web candle centered at full normal width ──
    if (!cMt5) {
      const leftX = Math.round(x - fullCandleWidth / 2);
      const wickX = Math.floor(x) + 0.5;

      ctx.lineWidth = 1;
      ctx.strokeStyle = webWickRgba;
      ctx.beginPath();
      ctx.moveTo(wickX, Math.round(webHighY));
      ctx.lineTo(wickX, webTopY);
      ctx.moveTo(wickX, webBottomY);
      ctx.lineTo(wickX, Math.round(webLowY));
      ctx.stroke();

      ctx.fillStyle = webBodyRgba;
      ctx.fillRect(leftX, webTopY, fullCandleWidth, webBodyHeight);
      continue;
    }

    matchedPairsCount++;

    // ── 1. Draw Left Sub-slot: Binance (Web) Candle ─────────────────────────
    const webCenterX = x - slotOffset;
    const webLeftX = Math.round(webCenterX - slotWidth / 2);
    const webWickX = Math.floor(webCenterX) + 0.5;

    ctx.lineWidth = 1;
    ctx.strokeStyle = webWickRgba;
    ctx.beginPath();
    ctx.moveTo(webWickX, Math.round(webHighY));
    ctx.lineTo(webWickX, webTopY);
    ctx.moveTo(webWickX, webBottomY);
    ctx.lineTo(webWickX, Math.round(webLowY));
    ctx.stroke();

    ctx.fillStyle = webBodyRgba;
    ctx.fillRect(webLeftX, webTopY, slotWidth, webBodyHeight);

    // ── 2. Draw Right Sub-slot: MT5 Broker Candle ───────────────────────────
    const mt5CenterX = x + slotOffset;
    const mt5LeftX = Math.round(mt5CenterX - slotWidth / 2);
    const mt5WickX = Math.floor(mt5CenterX) + 0.5;

    const isMt5Bullish = cMt5.close >= cMt5.open;
    const mt5Color = isMt5Bullish ? mt5UpColor : mt5DownColor;
    const mt5FillRgba = chartColorToRgba(mt5Color, mt5Opacity);
    const mt5BorderRgba = chartColorToRgba(mt5Color, 1.0);

    const mt5OpenY = priceToY(cMt5.open);
    const mt5CloseY = priceToY(cMt5.close);
    const mt5HighY = priceToY(cMt5.high);
    const mt5LowY = priceToY(cMt5.low);

    const mt5TopY = Math.round(Math.min(mt5OpenY, mt5CloseY));
    const mt5BottomY = Math.round(Math.max(mt5OpenY, mt5CloseY));
    const mt5BodyHeight = Math.max(1, mt5BottomY - mt5TopY);

    // MT5 Wick (half-pixel aligned)
    ctx.lineWidth = 1;
    ctx.strokeStyle = mt5BorderRgba;
    ctx.beginPath();
    ctx.moveTo(mt5WickX, Math.round(mt5HighY));
    ctx.lineTo(mt5WickX, mt5TopY);
    ctx.moveTo(mt5WickX, mt5BottomY);
    ctx.lineTo(mt5WickX, Math.round(mt5LowY));
    ctx.stroke();

    // MT5 Body: Solid vibrant body with crisp 1px border for high-definition clarity
    ctx.fillStyle = mt5FillRgba;
    ctx.fillRect(mt5LeftX, mt5TopY, slotWidth, mt5BodyHeight);
    if (slotWidth > 3 && mt5BodyHeight > 3) {
      ctx.strokeStyle = mt5BorderRgba;
      ctx.lineWidth = 1;
      ctx.strokeRect(mt5LeftX + 0.5, mt5TopY + 0.5, slotWidth - 1, mt5BodyHeight - 1);
    }
  }

  // ── 3. Render Subtle Floating HUD Legend in Canvas Top-Left ───────────────
  if (options?.showLegend !== false && matchedPairsCount > 0) {
    drawCompareLegend(ctx, webUpBody, webDownBody, mt5UpColor, mt5DownColor);
  }

  ctx.restore();
}

function drawCompareLegend(
  ctx: CanvasRenderingContext2D,
  webUp: string,
  webDown: string,
  mt5Up: string,
  mt5Down: string
) {
  const badgeX = 14;
  const badgeY = 12;
  const badgeHeight = 22;
  const badgeWidth = 264;

  ctx.save();
  // Pill background
  ctx.fillStyle = 'rgba(15, 17, 21, 0.82)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 5);
  ctx.fill();
  ctx.stroke();

  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';

  const midY = badgeY + badgeHeight / 2;

  // Binance Feed Dot & Text
  ctx.fillStyle = webUp;
  ctx.beginPath();
  ctx.arc(badgeX + 10, midY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Binance (L)', badgeX + 18, midY);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(badgeX + 90, badgeY + 4);
  ctx.lineTo(badgeX + 90, badgeY + badgeHeight - 4);
  ctx.stroke();

  // MT5 Feed Dot & Text
  ctx.fillStyle = mt5Up;
  ctx.beginPath();
  ctx.arc(badgeX + 102, midY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94A3B8';
  ctx.fillText('MT5 (R):', badgeX + 110, midY);

  // MT5 Bullish chip
  ctx.fillStyle = mt5Up;
  ctx.fillText('Bull', badgeX + 158, midY);

  // MT5 Bearish chip
  ctx.fillStyle = mt5Down;
  ctx.fillText('Bear', badgeX + 190, midY);

  ctx.restore();
}


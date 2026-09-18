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
  showBinance?: boolean;
  liveBid?: number | null;
}


/**
 * Draws Binance (Web) candle on the left sub-slot and MT5 candle on the right sub-slot
 * of each bar index, sharing the exact same price-to-Y coordinate scale.
 * When showBinance is false (default), renders MT5 broker candles centered at full bar width.
 * 
 * - Unmatched candles render centered if Binance is enabled.
 * - Matched candle pairs render side-by-side (or centered if showBinance is false).
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
  const showBinance = options?.showBinance ?? false;
  const webUpBody = options?.webColors?.upColor || CHART_BULLISH_COLOR;
  const webUpOpacity = typeof options?.webColors?.upOpacity === 'number' ? options.webColors.upOpacity : 1;
  const webDownBody = options?.webColors?.downColor || CHART_BEARISH_COLOR;
  const webDownOpacity = typeof options?.webColors?.downOpacity === 'number' ? options.webColors.downOpacity : 1;
  const webUpWick = options?.webColors?.upWickColor || webUpBody;
  const webDownWick = options?.webColors?.downWickColor || webDownBody;

  const mt5UpColor = options?.mt5BullishColor || webUpBody;
  const mt5DownColor = options?.mt5BearishColor || webDownBody;
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


  for (let i = firstIndex; i <= lastIndex; i++) {
    const cWeb = candles[i];
    if (!cWeb) continue;

    const x = indexToX(i);

    // Normalize Binance candle time to interval to find matching MT5 candle
    const webAlignedTime = Math.round(cWeb.time / intervalSec) * intervalSec;
    const cMt5 = mt5Map.get(webAlignedTime) || (i === candles.length - 1 && mt5Candles.length > 0 ? mt5Candles[mt5Candles.length - 1] : undefined);

    // ── Mode A: Binance Disabled (Show MT5 Only, Centered) ───────────────────
    if (!showBinance) {
      if (!cMt5) continue;

      const leftX = Math.round(x - fullCandleWidth / 2);
      const wickX = Math.floor(x) + 0.5;

      const isLatest = i === candles.length - 1 || i === lastIndex;
      const mt5ClosePrice = (isLatest && options?.liveBid != null && Number.isFinite(options.liveBid))
        ? options.liveBid
        : cMt5.close;
      const mt5HighPrice = Math.max(cMt5.high, mt5ClosePrice);
      const mt5LowPrice = Math.min(cMt5.low, mt5ClosePrice);

      const isMt5Bullish = mt5ClosePrice >= cMt5.open;
      const mt5Color = isMt5Bullish ? mt5UpColor : mt5DownColor;
      const mt5HollowFillRgba = chartColorToRgba(mt5Color, Math.min(0.15, mt5Opacity * 0.1));
      const mt5BorderRgba = chartColorToRgba(mt5Color, 1.0);

      const mt5OpenY = priceToY(cMt5.open);
      const mt5CloseY = priceToY(mt5ClosePrice);
      const mt5HighY = priceToY(mt5HighPrice);
      const mt5LowY = priceToY(mt5LowPrice);

      const mt5TopY = Math.round(Math.min(mt5OpenY, mt5CloseY));
      const mt5BottomY = Math.round(Math.max(mt5OpenY, mt5CloseY));
      const mt5BodyHeight = Math.max(1, mt5BottomY - mt5TopY);

      // MT5 Wick (half-pixel aligned)
      ctx.lineWidth = 1;
      ctx.strokeStyle = mt5BorderRgba;
      ctx.beginPath();
      ctx.moveTo(wickX, Math.round(mt5HighY));
      ctx.lineTo(wickX, mt5TopY);
      ctx.moveTo(wickX, mt5BottomY);
      ctx.lineTo(wickX, Math.round(mt5LowY));
      ctx.stroke();

      // MT5 Body: Crisp hollow body
      ctx.fillStyle = mt5HollowFillRgba;
      ctx.fillRect(leftX, mt5TopY, fullCandleWidth, mt5BodyHeight);

      ctx.strokeStyle = mt5BorderRgba;
      ctx.lineWidth = 1;
      if (fullCandleWidth > 2 && mt5BodyHeight > 2) {
        ctx.strokeRect(leftX + 0.5, mt5TopY + 0.5, fullCandleWidth - 1, mt5BodyHeight - 1);
      } else {
        ctx.fillRect(leftX, mt5TopY, fullCandleWidth, mt5BodyHeight);
      }
      continue;
    }

    // ── Mode B: Binance Enabled (Side-by-Side Dual Slots) ────────────────────
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

    // If NO MT5 candle exists for this bar: draw Web candle centered at full normal width
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

    // 1. Draw Left Sub-slot: Binance (Web) Candle
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

    // 2. Draw Right Sub-slot: MT5 Broker Candle
    const mt5CenterX = x + slotOffset;
    const mt5LeftX = Math.round(mt5CenterX - slotWidth / 2);
    const mt5WickX = Math.floor(mt5CenterX) + 0.5;

    const isLatest = i === candles.length - 1 || i === lastIndex;
    const mt5ClosePrice = (isLatest && options?.liveBid != null && Number.isFinite(options.liveBid))
      ? options.liveBid
      : cMt5.close;
    const mt5HighPrice = Math.max(cMt5.high, mt5ClosePrice);
    const mt5LowPrice = Math.min(cMt5.low, mt5ClosePrice);

    const isMt5Bullish = mt5ClosePrice >= cMt5.open;
    const mt5Color = isMt5Bullish ? mt5UpColor : mt5DownColor;
    const mt5HollowFillRgba = chartColorToRgba(mt5Color, Math.min(0.15, mt5Opacity * 0.1));
    const mt5BorderRgba = chartColorToRgba(mt5Color, 1.0);

    const mt5OpenY = priceToY(cMt5.open);
    const mt5CloseY = priceToY(mt5ClosePrice);
    const mt5HighY = priceToY(mt5HighPrice);
    const mt5LowY = priceToY(mt5LowPrice);

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

    // MT5 Body: Hollow body with crisp 1px border outline for unmistakable visual distinction
    ctx.fillStyle = mt5HollowFillRgba;
    ctx.fillRect(mt5LeftX, mt5TopY, slotWidth, mt5BodyHeight);

    ctx.strokeStyle = mt5BorderRgba;
    ctx.lineWidth = 1;
    if (slotWidth > 2 && mt5BodyHeight > 2) {
      ctx.strokeRect(mt5LeftX + 0.5, mt5TopY + 0.5, slotWidth - 1, mt5BodyHeight - 1);
    } else {
      ctx.fillRect(mt5LeftX, mt5TopY, slotWidth, mt5BodyHeight);
    }
  }

  ctx.restore();
}



import { Candle } from "@/types/candle";
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from "@/lib/config/chartColors";
import { timeframeToSeconds, formatCountdown, formatPrice } from "@/lib/utils/format";

const PRICE_LINE_FONT = 'bold 12px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
const COUNTDOWN_FONT = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

export function drawPriceLine(
  ctx: CanvasRenderingContext2D,
  lastCandle: Candle,
  priceToY: (price: number) => number,
  chartWidth: number,
  priceAxisWidth: number,
  canvasWidth: number,
  timeframe: string,
  isHovered: boolean = false
) {
  const rawY = priceToY(lastCandle.close);
  const isBullish = lastCandle.close >= lastCandle.open;
  // Bullish candle close border is at top (round + 0.5); bearish candle close border is at bottom (round - 0.5)
  const lineY = isBullish ? Math.round(rawY) + 0.5 : Math.round(rawY) - 0.5;
  const price = lastCandle.close;
  const color = isBullish ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

  // 1. Draw Horizontal Line across the chart area (half-pixel offset for crisp 1px stroke)
  ctx.save();
  ctx.setLineDash(isHovered ? [] : [4, 4]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = isHovered ? 0.9 : 0.6;
  ctx.lineWidth = isHovered ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(chartWidth, lineY);
  ctx.stroke();
  ctx.restore();

  // 2. Calculate remaining time
  const now = Date.now() / 1000;
  const tfSeconds = timeframeToSeconds(timeframe);
  const candleEnd = lastCandle.time + tfSeconds;
  const remaining = Math.max(0, Math.floor(candleEnd - now));
  const countdownText = formatCountdown(remaining);

  // 3. Draw Price Badge on the Price Axis
  const badgeHeight = 28;
  const badgeWidth = priceAxisWidth - 4;
  const badgeX = chartWidth + 2;
  const badgeY = Math.round(rawY - badgeHeight / 2);

  // Badge background
  ctx.fillStyle = color; 
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
  } else {
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  ctx.fill();

  // Badge text (Price) - integer pixel alignment
  ctx.font = PRICE_LINE_FONT;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const priceLabel = formatPrice(price);
  ctx.fillText(priceLabel, badgeX + 8, Math.round(badgeY + badgeHeight * 0.35));

  // Countdown at bottom half - integer pixel alignment
  ctx.font = COUNTDOWN_FONT;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(countdownText, badgeX + 8, Math.round(badgeY + badgeHeight * 0.75));
}



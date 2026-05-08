import { Candle } from "@/types/candle";
import { timeframeToSeconds, formatCountdown } from "@/lib/utils/format";

export function drawPriceLine(
  ctx: CanvasRenderingContext2D,
  lastCandle: Candle,
  priceToY: (price: number) => number,
  chartWidth: number,
  priceAxisWidth: number,
  canvasWidth: number,
  timeframe: string
) {
  const y = Math.round(priceToY(lastCandle.close));
  const price = lastCandle.close;
  
  const isBullish = lastCandle.close >= lastCandle.open;
  const color = isBullish ? '#26A69A' : '#EF5350';

  // 1. Draw Horizontal Line across the chart area
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color; // Match candle color
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.restore();

  // 2. Calculate remaining time
  const now = Date.now() / 1000;
  const tfSeconds = timeframeToSeconds(timeframe);
  const candleEnd = lastCandle.time + tfSeconds;
  const remaining = Math.max(0, Math.floor(candleEnd - now));
  const countdownText = formatCountdown(remaining);

  // 3. Draw Price Badge on the Price Axis
  const badgeHeight = 20; // Increased slightly for better look
  const badgeWidth = priceAxisWidth - 4;
  const badgeX = chartWidth + 2;
  const badgeY = y - badgeHeight / 2;

  // Badge background
  ctx.fillStyle = color; 
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);
  } else {
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  ctx.fill();

  // Badge text (Price)
  ctx.font = 'bold 11px "JetBrains Mono"';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  let priceLabel = price.toString();
  if (priceLabel.indexOf('.') !== -1) {
    const parts = priceLabel.split('.');
    if (parts[1].length > 4) priceLabel = price.toFixed(4);
  }
  
  // Price at top half
  ctx.fillText(priceLabel, badgeX + 4, badgeY + badgeHeight * 0.35);

  // Countdown at bottom half
  ctx.font = '9px "JetBrains Mono"';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(countdownText, badgeX + 4, badgeY + badgeHeight * 0.75);
}



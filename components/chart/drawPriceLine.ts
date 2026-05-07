import { Candle } from "@/types/candle";

export function drawPriceLine(
  ctx: CanvasRenderingContext2D,
  lastCandle: Candle,
  priceToY: (price: number) => number,
  chartWidth: number,
  priceAxisWidth: number,
  canvasWidth: number
) {
  const y = Math.round(priceToY(lastCandle.close));
  const price = lastCandle.close;

  // 1. Draw Horizontal Line across the chart area
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(138, 138, 138, 0.4)'; // Subtle dashed line
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.restore();

  // 2. Draw Price Badge on the Price Axis
  const badgeHeight = 18;
  const badgeWidth = priceAxisWidth - 5;
  const badgeX = chartWidth + 2;
  const badgeY = y - badgeHeight / 2;

  // Badge background - slightly brighter than axis background
  ctx.fillStyle = '#363636'; 
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);
  } else {
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  ctx.fill();

  // Accent border for the badge
  ctx.strokeStyle = '#4A4A4A';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Badge text
  ctx.font = 'bold 11px "JetBrains Mono"';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  let label = price.toString();
  if (label.indexOf('.') !== -1) {
    const parts = label.split('.');
    if (parts[1].length > 4) label = price.toFixed(4); // More precision for price
  }
  
  ctx.fillText(label, badgeX + 4, y);
}

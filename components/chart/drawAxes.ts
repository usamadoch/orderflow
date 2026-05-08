import { Candle } from "@/types/candle";
import { formatPrice, formatTime12h } from "@/lib/utils/format";

export function calculatePriceStep(priceRange: number, chartHeight: number, minSpacing: number = 50) {
  const pricePerPixel = priceRange / chartHeight;
  const targetPriceDelta = pricePerPixel * minSpacing;
  
  const magnitude = Math.pow(10, Math.floor(Math.log10(targetPriceDelta)));
  const relativeDelta = targetPriceDelta / magnitude;
  
  if (relativeDelta < 1.5) return magnitude * 1;
  if (relativeDelta < 3.5) return magnitude * 2;
  if (relativeDelta < 7.5) return magnitude * 5;
  return magnitude * 10;
}

const AXIS_FONT = '11px "Inter", -apple-system, system-ui, sans-serif';
const AXIS_TEXT_COLOR = '#8A8A8A';
const AXIS_BORDER_COLOR = '#1F1F1F';
const AXIS_BG_COLOR = '#141414';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  priceMin: number,
  priceMax: number,
  priceToY: (price: number) => number,
  indexToX: (i: number) => number,
  rawFirstIndex: number,
  rawLastIndex: number,
  canvasWidth: number,
  canvasHeight: number,
  priceAxisWidth: number,
  timeAxisHeight: number,
  barWidth: number
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  ctx.strokeStyle = AXIS_BORDER_COLOR;
  ctx.lineWidth = 1;

  // Horizontal Grid Lines
  const priceRange = priceMax - priceMin;
  if (priceRange > 0) {
    const step = calculatePriceStep(priceRange, chartHeight);
    const startPrice = Math.floor(priceMin / step) * step;

    ctx.beginPath();
    for (let p = startPrice; p <= priceMax; p += step) {
      const y = priceToY(p);
      ctx.moveTo(0, Math.round(y));
      ctx.lineTo(chartWidth, Math.round(y));
    }
    ctx.stroke();
  }

  // Vertical Grid Lines
  const skipCount = Math.max(1, Math.floor(120 / barWidth)); // Increased spacing for cleaner grid
  
  ctx.beginPath();
  for (let i = rawFirstIndex; i <= rawLastIndex; i++) {
    if (i % skipCount === 0) {
      const x = indexToX(i);
      ctx.moveTo(Math.round(x), 0);
      ctx.lineTo(Math.round(x), chartHeight);
    }
  }
  ctx.stroke();
}

export function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  priceMin: number,
  priceMax: number,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  priceAxisWidth: number
) {
  const chartWidth = canvasWidth - priceAxisWidth;

  // Background
  ctx.fillStyle = AXIS_BG_COLOR;
  ctx.fillRect(chartWidth, 0, priceAxisWidth, canvasHeight);

  // Border
  ctx.fillStyle = AXIS_BORDER_COLOR;
  ctx.fillRect(chartWidth, 0, 1, canvasHeight);

  const priceRange = priceMax - priceMin;
  if (priceRange <= 0) return;

  const chartHeight = canvasHeight - 24; // Align with timeAxisHeight
  const step = calculatePriceStep(priceRange, chartHeight);
  const startPrice = Math.floor(priceMin / step) * step;
  
  // Calculate precision based on step
  const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;

  ctx.font = AXIS_FONT;
  ctx.fillStyle = AXIS_TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = AXIS_BORDER_COLOR;

  for (let p = startPrice; p <= priceMax; p += step) {
    const y = priceToY(p);

    // Tick mark
    ctx.beginPath();
    ctx.moveTo(chartWidth, Math.round(y));
    ctx.lineTo(chartWidth + 5, Math.round(y));
    ctx.stroke();

    // Label with thousands separators
    const label = formatPrice(p, precision);
    ctx.fillText(label, chartWidth + 10, y);
  }
}

export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  rawFirstIndex: number,
  rawLastIndex: number,
  indexToX: (i: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  priceAxisWidth: number,
  timeAxisHeight: number,
  barWidth: number
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  // Background
  ctx.fillStyle = AXIS_BG_COLOR;
  ctx.fillRect(0, chartHeight, chartWidth, timeAxisHeight);

  // Border
  ctx.fillStyle = AXIS_BORDER_COLOR;
  ctx.fillRect(0, chartHeight, chartWidth, 1);

  const skipCount = Math.max(1, Math.floor(120 / barWidth)); // Increased spacing for cleaner labels
  
  ctx.font = AXIS_FONT;
  ctx.fillStyle = AXIS_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = AXIS_BORDER_COLOR;

  for (let i = rawFirstIndex; i <= rawLastIndex; i++) {
    if (i % skipCount === 0) {
      const x = indexToX(i);
      
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(Math.round(x), chartHeight);
      ctx.lineTo(Math.round(x), chartHeight + 4);
      ctx.stroke();

      // Label (12h format)
      let time = 0;
      if (candles[i]) {
        time = candles[i].time;
      } else if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const firstCandle = candles[0];
        const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
        time = lastCandle.time + (i - (candles.length - 1)) * avgInterval;
      }

      if (time > 0) {
        const label = formatTime12h(time);
        ctx.fillText(label, x, chartHeight + 8);
      }
    }
  }
}


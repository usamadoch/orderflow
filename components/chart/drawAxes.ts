import { Candle } from "@/types/candle";

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

  ctx.strokeStyle = '#1F1F1F';
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
  const skipCount = Math.max(1, Math.floor(100 / barWidth));
  
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
  ctx.fillStyle = '#141414';
  ctx.fillRect(chartWidth, 0, priceAxisWidth, canvasHeight);

  // Border
  ctx.fillStyle = '#1F1F1F';
  ctx.fillRect(chartWidth, 0, 1, canvasHeight);

  const priceRange = priceMax - priceMin;
  if (priceRange <= 0) return;

  const chartHeight = canvasHeight - 24; // Align with timeAxisHeight
  const step = calculatePriceStep(priceRange, chartHeight);
  const startPrice = Math.floor(priceMin / step) * step;
  
  // Calculate precision based on step
  const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;

  ctx.font = '11px "JetBrains Mono"';
  ctx.fillStyle = '#8A8A8A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#1F1F1F';

  for (let p = startPrice; p <= priceMax; p += step) {
    const y = priceToY(p);

    // Tick mark
    ctx.beginPath();
    ctx.moveTo(chartWidth, Math.round(y));
    ctx.lineTo(chartWidth + 5, Math.round(y));
    ctx.stroke();

    // Label
    const label = p.toFixed(precision);
    ctx.fillText(label, chartWidth + 8, y);
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
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, chartHeight, chartWidth, timeAxisHeight);

  // Border
  ctx.fillStyle = '#1F1F1F';
  ctx.fillRect(0, chartHeight, chartWidth, 1);

  const skipCount = Math.max(1, Math.floor(100 / barWidth));
  
  ctx.font = '11px "JetBrains Mono"';
  ctx.fillStyle = '#8A8A8A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#1F1F1F';

  for (let i = rawFirstIndex; i <= rawLastIndex; i++) {
    if (i % skipCount === 0) {
      const x = indexToX(i);
      
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(Math.round(x), chartHeight);
      ctx.lineTo(Math.round(x), chartHeight + 5);
      ctx.stroke();

      // Label
      if (candles[i]) {
        const d = new Date(candles[i].time * 1000);
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        ctx.fillText(`${hours}:${mins}`, x, chartHeight + 8);
      } else if (candles.length > 0) {
        // Extrapolate time based on last candle and interval (assuming 1m for now or using candle data)
        const lastCandle = candles[candles.length - 1];
        const firstCandle = candles[0];
        const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;
        
        const extrapolatedTime = lastCandle.time + (i - (candles.length - 1)) * avgInterval;
        const d = new Date(extrapolatedTime * 1000);
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        ctx.fillText(`${hours}:${mins}`, x, chartHeight + 8);
      }
    }
  }
}

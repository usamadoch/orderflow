import { Candle } from "@/types/candle";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  priceMin: number,
  priceMax: number,
  priceToY: (price: number) => number,
  indexToX: (i: number) => number,
  firstIndex: number,
  lastIndex: number,
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
    let step = 1;
    if (priceRange < 10) step = 1;
    else if (priceRange < 100) step = 10;
    else if (priceRange < 1000) step = 100;
    else if (priceRange < 10000) step = 1000;
    else step = 5000;

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
  for (let i = firstIndex; i <= lastIndex; i++) {
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

  let step = 1;
  if (priceRange < 10) step = 1;
  else if (priceRange < 100) step = 10;
  else if (priceRange < 1000) step = 100;
  else if (priceRange < 10000) step = 1000;
  else step = 5000;

  const startPrice = Math.floor(priceMin / step) * step;

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
    let label = p.toString();
    if (label.indexOf('.') !== -1) {
      const parts = label.split('.');
      if (parts[1].length > 2) label = p.toFixed(2);
    }
    ctx.fillText(label, chartWidth + 8, y);
  }
}

export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
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

  for (let i = firstIndex; i <= lastIndex; i++) {
    if (i % skipCount === 0 && candles[i]) {
      const x = indexToX(i);
      
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(Math.round(x), chartHeight);
      ctx.lineTo(Math.round(x), chartHeight + 5);
      ctx.stroke();

      // Label
      const d = new Date(candles[i].time * 1000);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      ctx.fillText(`${hours}:${mins}`, x, chartHeight + 8);
    }
  }
}

import { Candle } from "@/types/candle";
import { formatPrice, formatTime } from "@/lib/utils/format";
import { useChartStore } from "@/lib/store/chart";
import { chartColorToRgba } from "@/lib/config/chartColors";

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

const AXIS_FONT = 'bold 12px "Inter", -apple-system, system-ui, sans-serif';
const AXIS_TEXT_COLOR = '#909090';
const AXIS_BORDER_COLOR = '#1F1F1F';
const AXIS_BG_COLOR = '#0F0F0F';

export interface GridOptions {
  showHorizontal?: boolean;
  horizontalColor?: string;
  horizontalOpacity?: number;
  horizontalStyle?: 'solid' | 'dashed' | 'dotted';
  showVertical?: boolean;
  verticalColor?: string;
  verticalOpacity?: number;
  verticalStyle?: 'solid' | 'dashed' | 'dotted';
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
  barWidth: number,
  gridOptions?: GridOptions
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  const showHorz = gridOptions?.showHorizontal ?? true;
  const horzColor = gridOptions?.horizontalColor || AXIS_BORDER_COLOR;
  const horzOpacity = typeof gridOptions?.horizontalOpacity === 'number' ? gridOptions.horizontalOpacity : 1;
  const horzStyle = gridOptions?.horizontalStyle || 'solid';

  const showVert = gridOptions?.showVertical ?? true;
  const vertColor = gridOptions?.verticalColor || AXIS_BORDER_COLOR;
  const vertOpacity = typeof gridOptions?.verticalOpacity === 'number' ? gridOptions.verticalOpacity : 1;
  const vertStyle = gridOptions?.verticalStyle || 'solid';

  // Horizontal Grid Lines
  if (showHorz) {
    const priceRange = priceMax - priceMin;
    if (priceRange > 0) {
      const step = calculatePriceStep(priceRange, chartHeight);
      const startPrice = Math.floor(priceMin / step) * step;

      ctx.save();
      ctx.strokeStyle = chartColorToRgba(horzColor, horzOpacity);
      ctx.lineWidth = 1;
      if (horzStyle === 'solid') {
        ctx.setLineDash([]);
      } else if (horzStyle === 'dashed') {
        ctx.setLineDash([4, 4]);
      } else if (horzStyle === 'dotted') {
        ctx.setLineDash([2, 2]);
      }

      ctx.beginPath();
      for (let p = startPrice; p <= priceMax; p += step) {
        const y = priceToY(p);
        const alignedY = Math.round(y) + 0.5;
        ctx.moveTo(0, alignedY);
        ctx.lineTo(chartWidth, alignedY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Vertical Grid Lines
  if (showVert) {
    const skipCount = Math.max(1, Math.floor(120 / barWidth)); // Increased spacing for cleaner grid

    ctx.save();
    ctx.strokeStyle = chartColorToRgba(vertColor, vertOpacity);
    ctx.lineWidth = 1;
    if (vertStyle === 'solid') {
      ctx.setLineDash([]);
    } else if (vertStyle === 'dashed') {
      ctx.setLineDash([4, 4]);
    } else if (vertStyle === 'dotted') {
      ctx.setLineDash([2, 2]);
    }

    ctx.beginPath();
    for (let i = rawFirstIndex; i <= rawLastIndex; i++) {
      if (i % skipCount === 0) {
        const x = indexToX(i);
        const alignedX = Math.round(x) + 0.5;
        ctx.moveTo(alignedX, 0);
        ctx.lineTo(alignedX, chartHeight);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  priceMin: number,
  priceMax: number,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  priceAxisWidth: number,
  timeAxisHeight: number = 24
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

  const chartHeight = canvasHeight - timeAxisHeight;
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
    ctx.fillText(label, chartWidth + 12, y);
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
        const state = useChartStore.getState();
        const label = formatTime(time, state.globalTimezone, state.globalTimeFormat);
        ctx.fillText(label, x, chartHeight + 8);
      }
    }
  }
}

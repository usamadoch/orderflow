import { PanelState } from '@/types/chart';
import { VwapResult, VwapPoint } from '@/lib/utils/vwap';

export interface DrawVwapOptions {
  panel: PanelState;
  series: VwapResult;
  firstIndex: number;
  lastIndex: number;
  indexToX: (index: number) => number;
  priceToY: (price: number) => number;
  chartWidth: number;
  chartHeight: number;
}

const MONO_FONT = '11px "JetBrains Mono", monospace';
const MUTED_TEXT = '#5F6368';

export function drawVwap(ctx: CanvasRenderingContext2D, options: DrawVwapOptions) {
  const { panel, series, firstIndex, lastIndex, indexToX, priceToY, chartWidth, chartHeight } = options;

  if (!panel.vwapEnabled) return;

  if (series.status === 'pending') {
    ctx.font = MONO_FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = MUTED_TEXT;
    ctx.fillText('VWAP: Loading history...', chartWidth - 8, chartHeight - 8);
    return;
  }

  if (series.status === 'error' || !series.series) {
    return;
  }

  const points = series.series;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, chartWidth, chartHeight);
  ctx.clip();

  // Draw Fills
  if (panel.vwapBandFillOpacity > 0) {
    if (panel.vwapBand3Enabled && panel.vwapBand2Enabled) {
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band3Up', 'band2Up', panel.vwapBand3Color, panel.vwapBandFillOpacity);
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band3Dw', 'band2Dw', panel.vwapBand3Color, panel.vwapBandFillOpacity);
    }
    if (panel.vwapBand2Enabled && panel.vwapBand1Enabled) {
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band2Up', 'band1Up', panel.vwapBand2Color, panel.vwapBandFillOpacity);
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band2Dw', 'band1Dw', panel.vwapBand2Color, panel.vwapBandFillOpacity);
    }
    if (panel.vwapBand1Enabled) {
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band1Up', 'value', panel.vwapBand1Color, panel.vwapBandFillOpacity);
      drawBandFill(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band1Dw', 'value', panel.vwapBand1Color, panel.vwapBandFillOpacity);
    }
  }

  // Draw Lines
  if (panel.vwapBand3Enabled) {
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band3Up', panel.vwapBand3Color, panel.vwapBandWidth);
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band3Dw', panel.vwapBand3Color, panel.vwapBandWidth);
  }
  if (panel.vwapBand2Enabled) {
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band2Up', panel.vwapBand2Color, panel.vwapBandWidth);
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band2Dw', panel.vwapBand2Color, panel.vwapBandWidth);
  }
  if (panel.vwapBand1Enabled) {
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band1Up', panel.vwapBand1Color, panel.vwapBandWidth);
    drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'band1Dw', panel.vwapBand1Color, panel.vwapBandWidth);
  }

  // Draw Main VWAP
  drawLine(ctx, points, firstIndex, lastIndex, indexToX, priceToY, 'value', panel.vwapLineColor, panel.vwapLineWidth);

  ctx.restore();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  points: VwapPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  priceToY: (price: number) => number,
  key: keyof VwapPoint,
  color: string,
  width: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let moved = false;

  for (let i = Math.max(0, firstIndex - 1); i <= Math.min(points.length - 1, lastIndex + 1); i++) {
    const point = points[i];
    const val = point[key] as number | null;
    if (val == null) {
      moved = false;
      continue;
    }

    const x = indexToX(i);
    const y = priceToY(val);

    if (!moved) {
      ctx.moveTo(x, y);
      moved = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawBandFill(
  ctx: CanvasRenderingContext2D,
  points: VwapPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  priceToY: (price: number) => number,
  key1: keyof VwapPoint,
  key2: keyof VwapPoint,
  color: string,
  opacity: number
) {
  ctx.fillStyle = withAlpha(color, opacity);
  
  let currentSegmentStart = -1;

  for (let i = Math.max(0, firstIndex - 1); i <= Math.min(points.length - 1, lastIndex + 1); i++) {
    const point = points[i];
    const val1 = point[key1] as number | null;
    const val2 = point[key2] as number | null;

    if (val1 == null || val2 == null) {
      if (currentSegmentStart !== -1) {
        fillSegment(ctx, points, currentSegmentStart, i - 1, indexToX, priceToY, key1, key2);
        currentSegmentStart = -1;
      }
      continue;
    }

    if (currentSegmentStart === -1) {
      currentSegmentStart = i;
    }
  }

  if (currentSegmentStart !== -1) {
    fillSegment(ctx, points, currentSegmentStart, Math.min(points.length - 1, lastIndex + 1), indexToX, priceToY, key1, key2);
  }
}

function fillSegment(
  ctx: CanvasRenderingContext2D,
  points: VwapPoint[],
  startIdx: number,
  endIdx: number,
  indexToX: (index: number) => number,
  priceToY: (price: number) => number,
  key1: keyof VwapPoint,
  key2: keyof VwapPoint
) {
  if (startIdx >= endIdx) return;

  ctx.beginPath();
  
  for (let i = startIdx; i <= endIdx; i++) {
    const x = indexToX(i);
    const y = priceToY(points[i][key1] as number);
    if (i === startIdx) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  for (let i = endIdx; i >= startIdx; i--) {
    const x = indexToX(i);
    const y = priceToY(points[i][key2] as number);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}

function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

import type { CvdMode, CvdScaleMode } from '@/lib/store/chart';
import type { CvdDivergenceMarker, CvdPoint } from '@/lib/utils/delta';

const AXIS_FONT = 'bold 12px "Inter", -apple-system, system-ui, sans-serif';
const MONO_FONT = '11px "JetBrains Mono", monospace';
const BORDER = '#1F1F1F';
const AXIS_BG = '#141414';
const GRID = '#1F1F1F';
const TEXT = '#909090';
const MUTED_TEXT = '#5F6368';

export interface CvdScale {
  min: number;
  max: number;
  valueToY: (value: number) => number;
  yToValue: (y: number) => number;
}

interface DrawCvdOptions {
  mode: CvdMode;
  scaleMode: CvdScaleMode;
  fixedRange: number;
  positiveColor: string;
  negativeColor: string;
  showDivergenceMarkers: boolean;
  divergenceMarkers?: CvdDivergenceMarker[];
  chartWidth: number;
  chartHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  priceAxisWidth: number;
  timeAxisHeight: number;
  barWidth: number;
}

export function getCvdScale(
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  mode: CvdMode,
  scaleMode: CvdScaleMode,
  fixedRange: number,
  chartHeight: number
): CvdScale {
  let min = Infinity;
  let max = -Infinity;

  if (scaleMode === 'fixed') {
    const range = Math.max(1, Math.abs(fixedRange));
    min = -range;
    max = range;
  } else if (mode === 'histogram') {
    let maxAbs = 0;
    for (let i = firstIndex; i <= lastIndex; i += 1) {
      const point = points[i];
      if (!point) continue;
      maxAbs = Math.max(maxAbs, Math.abs(point.delta));
    }
    maxAbs = maxAbs || 1;
    min = -maxAbs;
    max = maxAbs;
  } else {
    min = 0;
    max = 0;
    for (let i = firstIndex; i <= lastIndex; i += 1) {
      const point = points[i];
      if (!point) continue;
      min = Math.min(min, point.low);
      max = Math.max(max, point.high);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = -1;
    max = 1;
  }

  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.1);
    min -= padding;
    max += padding;
  } else {
    const padding = (max - min) * 0.08;
    min -= padding;
    max += padding;
  }

  const valueToY = (value: number) => {
    const range = max - min;
    if (range <= 0) return chartHeight / 2;
    return ((max - value) / range) * chartHeight;
  };

  const yToValue = (y: number) => {
    const range = max - min;
    if (range <= 0) return min;
    return max - (y / chartHeight) * range;
  };

  return { min, max, valueToY, yToValue };
}

export function drawCvd(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  options: DrawCvdOptions
) {
  const {
    mode,
    positiveColor,
    negativeColor,
    showDivergenceMarkers,
    divergenceMarkers,
    chartWidth,
    chartHeight,
    canvasWidth,
    canvasHeight,
    priceAxisWidth,
    timeAxisHeight,
    barWidth,
  } = options;

  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  drawCvdGrid(ctx, scale, chartWidth, chartHeight);
  drawResetMarkers(ctx, points, firstIndex, lastIndex, indexToX, chartHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, chartWidth, chartHeight);
  ctx.clip();

  if (mode === 'line') {
    drawCvdLine(ctx, points, firstIndex, lastIndex, indexToX, scale, positiveColor, negativeColor);
  } else if (mode === 'histogram') {
    drawCvdHistogram(ctx, points, firstIndex, lastIndex, indexToX, scale, barWidth, positiveColor, negativeColor);
  } else if (mode === 'bars') {
    drawCvdBars(ctx, points, firstIndex, lastIndex, indexToX, scale, barWidth, positiveColor, negativeColor);
  } else {
    drawCvdCandles(ctx, points, firstIndex, lastIndex, indexToX, scale, barWidth, positiveColor, negativeColor);
  }

  if (showDivergenceMarkers && divergenceMarkers?.length) {
    drawDivergenceMarkers(ctx, divergenceMarkers, firstIndex, lastIndex, indexToX, scale, chartHeight, positiveColor, negativeColor);
  }

  ctx.restore();

  drawCvdAxis(ctx, scale, chartWidth, canvasHeight, priceAxisWidth, timeAxisHeight);
  drawCvdHeader(ctx, mode, points, lastIndex, positiveColor, negativeColor);
}

export function drawCvdCrosshairValueLabel(
  ctx: CanvasRenderingContext2D,
  mouseY: number,
  value: number,
  chartWidth: number,
  priceAxisWidth: number,
  chartHeight: number
) {
  if (mouseY < 0 || mouseY > chartHeight) return;

  const label = formatCvdValue(value);
  ctx.font = AXIS_FONT;
  const textWidth = ctx.measureText(label).width;
  const padding = 8;
  const rectHeight = 24;
  const rectWidth = Math.max(textWidth + padding * 2, priceAxisWidth - 2);

  ctx.fillStyle = '#2A2A2A';
  ctx.fillRect(chartWidth + 1, mouseY - rectHeight / 2, rectWidth, rectHeight);
  ctx.strokeStyle = '#8A8A8A';
  ctx.strokeRect(chartWidth + 1, mouseY - rectHeight / 2, rectWidth, rectHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, chartWidth + padding + 1, mouseY);
}

function drawCvdGrid(ctx: CanvasRenderingContext2D, scale: CvdScale, chartWidth: number, chartHeight: number) {
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;

  const step = calculateValueStep(scale.max - scale.min, chartHeight);
  const start = Math.floor(scale.min / step) * step;

  ctx.beginPath();
  for (let value = start; value <= scale.max; value += step) {
    const y = Math.round(scale.valueToY(value)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
  }
  ctx.stroke();

  if (scale.min < 0 && scale.max > 0) {
    const zeroY = Math.round(scale.valueToY(0)) + 0.5;
    ctx.strokeStyle = '#3A3A3A';
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(chartWidth, zeroY);
    ctx.stroke();
  }
}

function drawResetMarkers(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  chartHeight: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(144, 144, 144, 0.16)';
  ctx.setLineDash([3, 5]);
  ctx.beginPath();

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const point = points[i];
    if (!point?.reset || i === 0) continue;
    const x = Math.round(indexToX(i)) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chartHeight);
  }

  ctx.stroke();
  ctx.restore();
}

function drawCvdCandles(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  barWidth: number,
  positiveColor: string,
  negativeColor: string
) {
  const bodyWidth = Math.max(1, Math.floor(barWidth * 0.58));

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const point = points[i];
    if (!point) continue;

    const x = indexToX(i);
    const color = point.close >= point.open ? positiveColor : negativeColor;
    const highY = scale.valueToY(point.high);
    const lowY = scale.valueToY(point.low);
    const openY = scale.valueToY(point.open);
    const closeY = scale.valueToY(point.close);
    const topY = Math.round(Math.min(openY, closeY));
    const bottomY = Math.round(Math.max(openY, closeY));

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, Math.round(highY));
    ctx.lineTo(Math.round(x) + 0.5, Math.round(lowY));
    ctx.stroke();
    ctx.fillRect(Math.round(x - bodyWidth / 2), topY, bodyWidth, Math.max(1, bottomY - topY));
  }
}

function drawCvdBars(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  barWidth: number,
  positiveColor: string,
  negativeColor: string
) {
  const bodyWidth = Math.max(1, Math.floor(barWidth * 0.5));

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const point = points[i];
    if (!point) continue;

    const x = indexToX(i);
    const openY = scale.valueToY(point.open);
    const closeY = scale.valueToY(point.close);
    const topY = Math.round(Math.min(openY, closeY));
    const bottomY = Math.round(Math.max(openY, closeY));

    ctx.fillStyle = point.close >= point.open ? withAlpha(positiveColor, 0.72) : withAlpha(negativeColor, 0.72);
    ctx.fillRect(Math.round(x - bodyWidth / 2), topY, bodyWidth, Math.max(1, bottomY - topY));
  }
}

function drawCvdHistogram(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  barWidth: number,
  positiveColor: string,
  negativeColor: string
) {
  const bodyWidth = Math.max(1, Math.floor(barWidth * 0.62));
  const zeroY = scale.valueToY(0);

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const point = points[i];
    if (!point) continue;

    const value = point.delta;
    const x = indexToX(i);
    const y = scale.valueToY(value);
    const topY = Math.round(Math.min(y, zeroY));
    const bottomY = Math.round(Math.max(y, zeroY));

    ctx.fillStyle = value >= 0 ? withAlpha(positiveColor, 0.78) : withAlpha(negativeColor, 0.78);
    ctx.fillRect(Math.round(x - bodyWidth / 2), topY, bodyWidth, Math.max(1, bottomY - topY));
  }
}

function drawCvdLine(
  ctx: CanvasRenderingContext2D,
  points: CvdPoint[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  positiveColor: string,
  negativeColor: string
) {
  ctx.lineWidth = 2;

  for (let i = Math.max(firstIndex + 1, 1); i <= lastIndex; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    if (!previous || !point || point.reset) continue;

    ctx.strokeStyle = point.close >= previous.close ? positiveColor : negativeColor;
    ctx.beginPath();
    ctx.moveTo(indexToX(i - 1), scale.valueToY(previous.close));
    ctx.lineTo(indexToX(i), scale.valueToY(point.close));
    ctx.stroke();
  }
}

function drawDivergenceMarkers(
  ctx: CanvasRenderingContext2D,
  markers: CvdDivergenceMarker[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  scale: CvdScale,
  chartHeight: number,
  positiveColor: string,
  negativeColor: string
) {
  ctx.save();

  for (const marker of markers) {
    if (marker.index < firstIndex || marker.index > lastIndex) continue;

    const x = indexToX(marker.index);
    const baseY = scale.valueToY(marker.cvdValue);
    const isBullish = marker.direction === 'bullish';
    const y = Math.max(8, Math.min(chartHeight - 8, baseY + (isBullish ? 8 : -8)));
    const color = withAlpha(isBullish ? positiveColor : negativeColor, 0.58);

    ctx.fillStyle = color;
    ctx.strokeStyle = withAlpha(isBullish ? positiveColor : negativeColor, 0.82);
    ctx.lineWidth = 1;
    ctx.beginPath();

    if (isBullish) {
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.lineTo(x + 4, y + 4);
    } else {
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y - 4);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawCvdAxis(
  ctx: CanvasRenderingContext2D,
  scale: CvdScale,
  chartWidth: number,
  canvasHeight: number,
  priceAxisWidth: number,
  timeAxisHeight: number
) {
  const chartHeight = canvasHeight - timeAxisHeight;

  ctx.fillStyle = AXIS_BG;
  ctx.fillRect(chartWidth, 0, priceAxisWidth, canvasHeight);
  ctx.fillStyle = BORDER;
  ctx.fillRect(chartWidth, 0, 1, canvasHeight);

  const step = calculateValueStep(scale.max - scale.min, chartHeight);
  const start = Math.floor(scale.min / step) * step;

  ctx.font = AXIS_FONT;
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = BORDER;

  for (let value = start; value <= scale.max; value += step) {
    const y = scale.valueToY(value);
    ctx.beginPath();
    ctx.moveTo(chartWidth, Math.round(y));
    ctx.lineTo(chartWidth + 5, Math.round(y));
    ctx.stroke();
    ctx.fillText(formatCvdValue(value), chartWidth + 12, y);
  }
}

function drawCvdHeader(
  ctx: CanvasRenderingContext2D,
  mode: CvdMode,
  points: CvdPoint[],
  lastIndex: number,
  positiveColor: string,
  negativeColor: string
) {
  const point = points[Math.min(lastIndex, points.length - 1)];
  const value = point ? (mode === 'histogram' ? point.delta : point.close) : 0;

  ctx.font = MONO_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = MUTED_TEXT;
  ctx.fillText('CVD', 8, 7);
  ctx.fillStyle = value >= 0 ? positiveColor : negativeColor;
  ctx.fillText(formatCvdValue(value), 42, 7);
}

function calculateValueStep(range: number, chartHeight: number, minSpacing: number = 42) {
  const valuePerPixel = Math.max(range, 1) / Math.max(chartHeight, 1);
  const target = valuePerPixel * minSpacing;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const relative = target / magnitude;

  if (relative < 1.5) return magnitude;
  if (relative < 3.5) return magnitude * 2;
  if (relative < 7.5) return magnitude * 5;
  return magnitude * 10;
}

export function formatCvdValue(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${Math.round(abs)}`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toFixed(2)}`;
}

function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

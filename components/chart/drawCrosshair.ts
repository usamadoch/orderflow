import { formatPrice, formatTime } from "@/lib/utils/format";
import { useChartStore } from "@/lib/store/chart";

const CROSSHAIR_FONT = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
const CROSSHAIR_BG = '#1F1F1F';
const CROSSHAIR_TEXT = '#FFFFFF';

export interface CrosshairOptions {
  color?: string;
  opacity?: number;
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  verticalLineHeight?: number;
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  mouseX: number | null,
  mouseY: number | null,
  chartWidth: number,
  chartHeight: number,
  options?: CrosshairOptions
) {
  const color = options?.color || '#8A8A8A';
  const opacity = typeof options?.opacity === 'number' ? options.opacity : 1;
  const thickness = options?.thickness || 1;
  const style = options?.style || 'dashed';
  const verticalLineHeight = options?.verticalLineHeight ?? chartHeight;

  ctx.save();
  ctx.lineWidth = thickness;
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;

  if (style === 'solid') {
    ctx.setLineDash([]);
  } else if (style === 'dashed') {
    ctx.setLineDash([4 * thickness, 4 * thickness]);
  } else if (style === 'dotted') {
    ctx.setLineDash([2 * thickness, 2 * thickness]);
  }

  const alignCoord = (coord: number) => (thickness % 2 === 1 ? Math.floor(coord) + 0.5 : Math.round(coord));

  // Horizontal line
  if (mouseY !== null && mouseY >= 0 && mouseY <= chartHeight) {
    const y = alignCoord(mouseY);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
  }

  // Vertical line
  if (mouseX !== null && mouseX >= 0 && mouseX <= chartWidth) {
    const x = alignCoord(mouseX);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, verticalLineHeight);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawCrosshairPriceLabel(
  ctx: CanvasRenderingContext2D,
  mouseY: number,
  price: number,
  chartWidth: number,
  priceAxisWidth: number,
  chartHeight: number,
  precision: number
) {
  if (mouseY < 0 || mouseY > chartHeight) return;

  const label = formatPrice(price, precision);
  ctx.font = CROSSHAIR_FONT;
  const textWidth = ctx.measureText(label).width;
  const rectHeight = 22;
  const badgeX = chartWidth + 2;
  const badgeWidth = Math.max(textWidth + 16, priceAxisWidth - 4);
  const badgeY = Math.round(mouseY - rectHeight / 2);

  ctx.fillStyle = CROSSHAIR_BG;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, badgeWidth, rectHeight, 2);
  } else {
    ctx.fillRect(badgeX, badgeY, badgeWidth, rectHeight);
  }
  ctx.fill();

  ctx.fillStyle = CROSSHAIR_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, chartWidth + 10, Math.round(badgeY + rectHeight / 2));
}

export function drawCrosshairTimeLabel(
  ctx: CanvasRenderingContext2D,
  mouseX: number,
  time: number,
  timeAxisTop: number,
  timeAxisHeight: number,
  chartWidth: number
) {
  if (mouseX < 0 || mouseX > chartWidth) return;

  const state = useChartStore.getState();
  const label = formatTime(time, state.globalTimezone, state.globalTimeFormat);

  ctx.font = CROSSHAIR_FONT;
  const textWidth = ctx.measureText(label).width;
  const padding = 8;
  const rectHeight = 20;
  const rectWidth = Math.round(textWidth + padding * 2);
  const halfWidth = Math.round(rectWidth / 2);
  const clampedX = Math.round(Math.max(halfWidth, Math.min(chartWidth - halfWidth, mouseX)));

  const badgeX = clampedX - halfWidth;
  const badgeY = Math.round(timeAxisTop + Math.max(0, (timeAxisHeight - rectHeight) / 2));

  ctx.fillStyle = CROSSHAIR_BG;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, rectWidth, rectHeight, 2);
  } else {
    ctx.fillRect(badgeX, badgeY, rectWidth, rectHeight);
  }
  ctx.fill();

  ctx.fillStyle = CROSSHAIR_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, clampedX, Math.round(badgeY + rectHeight / 2));
}

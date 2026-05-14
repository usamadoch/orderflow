import { formatPrice, formatTime12h } from "@/lib/utils/format";

const CROSSHAIR_FONT = '12px "Inter", -apple-system, system-ui, sans-serif';
const CROSSHAIR_BG = '#2A2A2A';
const CROSSHAIR_BORDER = '#8A8A8A';
const CROSSHAIR_TEXT = '#FFFFFF';

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  mouseX: number | null,
  mouseY: number | null,
  chartWidth: number,
  chartHeight: number
) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#8A8A8A';
  ctx.lineWidth = 1;

  // Horizontal line
  if (mouseY !== null && mouseY >= 0 && mouseY <= chartHeight) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(mouseY) + 0.5);
    ctx.lineTo(chartWidth, Math.round(mouseY) + 0.5);
    ctx.stroke();
  }

  // Vertical line
  if (mouseX !== null && mouseX >= 0 && mouseX <= chartWidth) {
    ctx.beginPath();
    ctx.moveTo(Math.round(mouseX) + 0.5, 0);
    ctx.lineTo(Math.round(mouseX) + 0.5, chartHeight);
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
  const padding = 8;
  const rectHeight = 24;
  const rectWidth = Math.max(textWidth + padding * 2, priceAxisWidth - 2);

  ctx.fillStyle = CROSSHAIR_BG;
  ctx.fillRect(chartWidth + 1, mouseY - rectHeight / 2, rectWidth, rectHeight);

  ctx.strokeStyle = CROSSHAIR_BORDER;
  ctx.strokeRect(chartWidth + 1, mouseY - rectHeight / 2, rectWidth, rectHeight);

  ctx.fillStyle = CROSSHAIR_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, chartWidth + padding + 1, mouseY);
}

export function drawCrosshairTimeLabel(
  ctx: CanvasRenderingContext2D,
  mouseX: number,
  time: number,
  chartHeight: number,
  timeAxisHeight: number,
  chartWidth: number
) {
  if (mouseX < 0 || mouseX > chartWidth) return;

  const label = formatTime12h(time);

  ctx.font = CROSSHAIR_FONT;
  const textWidth = ctx.measureText(label).width;
  const padding = 10;
  const rectHeight = 24;
  const rectWidth = textWidth + padding * 2;

  ctx.fillStyle = CROSSHAIR_BG;
  ctx.fillRect(mouseX - rectWidth / 2, chartHeight + 1, rectWidth, rectHeight);

  ctx.strokeStyle = CROSSHAIR_BORDER;
  ctx.strokeRect(mouseX - rectWidth / 2, chartHeight + 1, rectWidth, rectHeight);

  ctx.fillStyle = CROSSHAIR_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mouseX, chartHeight + 1 + rectHeight / 2);
}


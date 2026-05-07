import { Candle } from "@/types/candle";

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  mouseX: number,
  mouseY: number,
  chartWidth: number,
  chartHeight: number
) {
  if (mouseX < 0 || mouseX > chartWidth || mouseY < 0 || mouseY > chartHeight) return;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#8A8A8A';
  ctx.lineWidth = 1;

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(0, Math.round(mouseY) + 0.5);
  ctx.lineTo(chartWidth, Math.round(mouseY) + 0.5);
  ctx.stroke();

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(Math.round(mouseX) + 0.5, 0);
  ctx.lineTo(Math.round(mouseX) + 0.5, chartHeight);
  ctx.stroke();

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

  const label = price.toFixed(precision);
  ctx.font = '11px "JetBrains Mono"';
  const textWidth = ctx.measureText(label).width;
  const padding = 6;
  const rectHeight = 20;
  const rectWidth = textWidth + padding * 2;

  ctx.fillStyle = '#2A2A2A';
  ctx.fillRect(chartWidth, mouseY - rectHeight / 2, rectWidth, rectHeight);

  ctx.strokeStyle = '#8A8A8A';
  ctx.strokeRect(chartWidth, mouseY - rectHeight / 2, rectWidth, rectHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, chartWidth + padding, mouseY);
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

  const d = new Date(time * 1000);
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  const label = `${hours}:${mins}`;

  ctx.font = '11px "JetBrains Mono"';
  const textWidth = ctx.measureText(label).width;
  const padding = 6;
  const rectHeight = 20;
  const rectWidth = textWidth + padding * 2;

  ctx.fillStyle = '#2A2A2A';
  ctx.fillRect(mouseX - rectWidth / 2, chartHeight, rectWidth, rectHeight);

  ctx.strokeStyle = '#8A8A8A';
  ctx.strokeRect(mouseX - rectWidth / 2, chartHeight, rectWidth, rectHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mouseX, chartHeight + rectHeight / 2);
}

// import { DrawnLine } from '../store/chart';

import { DrawnLine } from "@/lib/store/chart";
import { formatPrice } from "@/lib/utils/format";

export function drawLines(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  priceAxisWidth: number,
  barWidth: number,
  hoveredLineId: string | null,
  isHoveringDeleteDot: boolean
) {
  const drawableWidth = canvasWidth - priceAxisWidth;
  const drawableHeight = canvasHeight - timeAxisHeight;

  drawnLines.forEach((line) => {
    const isHovered = line.id === hoveredLineId;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeStyle = isHovered ? '#3D7EFF' : '#787B86';

    if (line.type === 'horizontal') {
      const y = priceToY(line.value);
      if (y < 0 || y > drawableHeight) return;

      // Draw Line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawableWidth, y);
      ctx.stroke();

      // Draw Delete Dot if hovered
      if (isHovered) {
        const dotX = drawableWidth - 6;
        const dotY = y;
        drawDeleteDot(ctx, dotX, dotY, isHoveringDeleteDot);
      }
    } else if (line.type === 'vertical') {
      const x = indexToX(line.value);
      if (x === null || x < 0 || x > drawableWidth) return;

      // Draw Line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, drawableHeight);
      ctx.stroke();

      // Draw Delete Dot if hovered
      if (isHovered) {
        const dotX = x;
        const dotY = 10;
        drawDeleteDot(ctx, dotX, dotY, isHoveringDeleteDot);
      }
    } else if (line.type === 'horizontal-ray') {
      const startIndex = line.startIndex ?? 0;
      const x = indexToX(startIndex);
      const y = priceToY(line.value);
      if (x === null || x > drawableWidth || y < 0 || y > drawableHeight) return;

      const startX = Math.max(0, x);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(drawableWidth, y);
      ctx.stroke();

      if (isHovered) {
        drawHandle(ctx, startX, y);
        drawDeleteDot(ctx, drawableWidth - 6, y, isHoveringDeleteDot);
      }
    } else if (line.type === 'box') {
      if (
        line.firstIndex === undefined ||
        line.lastIndex === undefined ||
        line.priceHigh === undefined ||
        line.priceLow === undefined
      ) {
        return;
      }

      const x1 = indexToX(line.firstIndex);
      const x2 = indexToX(line.lastIndex);
      if (x1 === null || x2 === null) return;

      const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
      const right = Math.min(drawableWidth, Math.max(x1, x2) + barWidth / 2);
      const top = priceToY(line.priceHigh);
      const bottom = priceToY(line.priceLow);
      if (right < 0 || left > drawableWidth || bottom < 0 || top > drawableHeight) return;

      const rectTop = Math.max(0, Math.min(top, bottom));
      const rectBottom = Math.min(drawableHeight, Math.max(top, bottom));

      ctx.fillStyle = isHovered ? 'rgba(61, 126, 255, 0.10)' : 'rgba(120, 123, 134, 0.08)';
      ctx.fillRect(left, rectTop, Math.max(1, right - left), Math.max(1, rectBottom - rectTop));
      ctx.strokeRect(left, rectTop, Math.max(1, right - left), Math.max(1, rectBottom - rectTop));

      if (isHovered) {
        drawHandle(ctx, left, rectTop);
        drawHandle(ctx, right, rectTop);
        drawHandle(ctx, left, rectBottom);
        drawHandle(ctx, right, rectBottom);
        drawDeleteDot(ctx, right, rectTop, isHoveringDeleteDot);
      }
    }
  });
}

export function drawDrawingPriceLabels(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  priceAxisWidth: number,
  barWidth: number
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  drawnLines.forEach((line) => {
    if (line.type === 'horizontal-ray') {
      const startX = indexToX(line.startIndex ?? 0);
      if (startX === null) return;

      drawAnchoredPriceLabel(ctx, Math.max(0, startX), priceToY(line.value) - 6, line.value, chartWidth, chartHeight, 'above');
    } else if (
      line.type === 'box' &&
      line.firstIndex !== undefined &&
      line.lastIndex !== undefined &&
      line.priceHigh !== undefined &&
      line.priceLow !== undefined
    ) {
      const x1 = indexToX(line.firstIndex);
      const x2 = indexToX(line.lastIndex);
      if (x1 === null || x2 === null) return;

      const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
      drawAnchoredPriceLabel(ctx, left, priceToY(line.priceHigh) - 6, line.priceHigh, chartWidth, chartHeight, 'above');
      drawAnchoredPriceLabel(ctx, left, priceToY(line.priceLow) + 6, line.priceLow, chartWidth, chartHeight, 'below');
    }
  });
}

function drawDeleteDot(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean) {
  const radius = 5;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (isHovered) {
    ctx.fillStyle = '#EF5350';
    ctx.fill();
  } else {
    ctx.fillStyle = '#1F1F1F';
    ctx.fill();
    ctx.strokeStyle = '#4A4A4A';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#0D0D0D';
  ctx.strokeStyle = '#3D7EFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 3, y - 3, 6, 6);
  ctx.fill();
  ctx.stroke();
}

function drawAnchoredPriceLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  price: number,
  chartWidth: number,
  chartHeight: number,
  placement: 'above' | 'below'
) {
  ctx.save();
  ctx.font = '600 11px "Inter", -apple-system, system-ui, sans-serif';

  const label = formatPrice(price);
  const width = Math.max(52, ctx.measureText(label).width + 12);
  const height = 17;
  const labelX = Math.max(2, Math.min(chartWidth - width - 2, x));
  const labelY = placement === 'above' ? y - height : y;
  const top = Math.max(1, Math.min(chartHeight - height - 1, labelY));

  ctx.fillStyle = 'rgba(13, 13, 13, 0.82)';
  ctx.fillRect(labelX, top, width, height);
  ctx.strokeStyle = 'rgba(61, 126, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX, top, width, height);
  ctx.fillStyle = '#E8E8E8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelX + 6, top + height / 2);
  ctx.restore();
}

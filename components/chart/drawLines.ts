// import { DrawnLine } from '../store/chart';

import { DrawnLine } from "@/lib/store/chart";

export function drawLines(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  priceAxisWidth: number,
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
    } else {
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

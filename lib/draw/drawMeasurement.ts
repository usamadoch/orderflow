import { Measurement } from '../store/chart';

export function drawMeasurementRect(
  ctx: CanvasRenderingContext2D,
  measurement: Measurement | null,
  barWidth: number = 12
) {
  if (!measurement) return;

  const { startX, startY, endX, endY, metrics } = measurement;

  // Compute rectangle bounds
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  if (w < 2 || h < 2) return;

  // Fill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]); // always reset after

  // Start point dot
  ctx.beginPath();
  ctx.arc(startX, startY, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  // Directional Arrow
  if (w > barWidth * 2) {
    const arrowY = y + h / 2;
    const arrowX1 = x;
    const arrowX2 = x + w;

    let color = '#8A8A8A'; // Neutral default
    if (metrics) {
      if (metrics.priceDiff > 0.0001) color = '#26A69A'; // Green
      else if (metrics.priceDiff < -0.0001) color = '#EF5350'; // Red
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Main line
    ctx.beginPath();
    ctx.moveTo(arrowX1, arrowY);
    ctx.lineTo(arrowX2, arrowY);
    ctx.stroke();

    // Arrow head (pointing right)
    ctx.beginPath();
    ctx.moveTo(arrowX2 - 8, arrowY - 5);
    ctx.lineTo(arrowX2, arrowY);
    ctx.lineTo(arrowX2 - 8, arrowY + 5);
    ctx.stroke();
  }
}

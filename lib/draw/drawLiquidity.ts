import { LiquidityZone } from '../../types/liquidity';

const BID_COLOR = [38, 166, 154]; // #26A69A — teal
const ASK_COLOR = [239, 83, 80];  // #EF5350 — red

/**
 * Renders liquidity zones as horizontal bands across the chart.
 * Zones sit behind everything else (lowest visual layer above grid).
 */
export function drawLiquidity(
  ctx: CanvasRenderingContext2D,
  liquidityZones: LiquidityZone[],
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  priceAxisWidth: number,
  profileWidth: number,
  liquidityOpacity: number,
  liquidityBucketSize: number,
  timeAxisHeight: number,
  visiblePriceMin: number,
  visiblePriceMax: number,
  currentPrice: number | null
): void {
  if (liquidityZones.length === 0) return;

  const drawableWidth = canvasWidth - priceAxisWidth;
  const drawableHeight = canvasHeight - timeAxisHeight;

  // Pre-filter zones to visible price range (with one bucket margin)
  const filteredZones = liquidityZones.filter(zone => {
    const zoneTop = zone.price + liquidityBucketSize / 2;
    const zoneBottom = zone.price - liquidityBucketSize / 2;
    return zoneTop >= visiblePriceMin - liquidityBucketSize &&
           zoneBottom <= visiblePriceMax + liquidityBucketSize;
  });

  if (filteredZones.length === 0) return;

  // Draw zone fills
  for (const zone of filteredZones) {
    const topY = priceToY(zone.price + liquidityBucketSize / 2);
    const bottomY = priceToY(zone.price - liquidityBucketSize / 2);
    let height = bottomY - topY;

    // Clamp to drawable area
    const clampedTop = Math.max(0, topY);
    const clampedBottom = Math.min(drawableHeight, bottomY);
    height = clampedBottom - clampedTop;

    if (height < 1) height = 1;

    const [r, g, b] = zone.side === 'bid' ? BID_COLOR : ASK_COLOR;
    const alpha = zone.intensity * liquidityOpacity * 0.4;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fillRect(0, clampedTop, drawableWidth, height);
  }

  // Draw right-edge intensity stripes
  for (const zone of filteredZones) {
    const topY = priceToY(zone.price + liquidityBucketSize / 2);
    const bottomY = priceToY(zone.price - liquidityBucketSize / 2);

    const clampedTop = Math.max(0, topY);
    const clampedBottom = Math.min(drawableHeight, bottomY);
    let height = clampedBottom - clampedTop;
    if (height < 1) height = 1;

    const [r, g, b] = zone.side === 'bid' ? BID_COLOR : ASK_COLOR;
    const stripeAlpha = liquidityOpacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${stripeAlpha})`;
    ctx.fillRect(drawableWidth - profileWidth - 2, clampedTop, 3, height);
  }

  // Draw current price reference line
  if (currentPrice !== null) {
    const y = priceToY(currentPrice);
    if (y >= 0 && y <= drawableHeight) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(drawableWidth, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.restore();
    }
  }
}

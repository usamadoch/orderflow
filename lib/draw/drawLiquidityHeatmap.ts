import { HeatmapRow } from '../../types/liquidity';
import { hexToRgba } from '../utils/format';

export interface HeatmapSettings {
  heatmapOpacity: number;
  ageFadeFactor: number;
  showPulled: boolean;
  showConsumed: boolean;
  showPersistence: boolean;
  totalSnapshots: number;
  currentPrice: number;
  isScrolled: boolean;
  showCurrentLabel: boolean;
  canvasHeight: number;
}

export function drawLiquidityHeatmap(
  ctx: CanvasRenderingContext2D,
  heatmapRows: HeatmapRow[],
  priceToY: (price: number) => number,
  stripX: number,
  stripWidth: number,
  bucketSize: number,
  settings: HeatmapSettings
) {
  if (heatmapRows.length === 0) return;

  // Check if we need simplified rendering (rows < 2px)
  const sampleHeight = Math.max(0, priceToY(heatmapRows[0].price - bucketSize / 2) - priceToY(heatmapRows[0].price + bucketSize / 2));
  const isSimplified = sampleHeight < 2;

  if (isSimplified) {
    let askIntensitySum = 0;
    let askCount = 0;
    let bidIntensitySum = 0;
    let bidCount = 0;

    for (const row of heatmapRows) {
      if (row.side === 'ask' || row.side === 'both') {
        askIntensitySum += row.intensity;
        askCount++;
      }
      if (row.side === 'bid' || row.side === 'both') {
        bidIntensitySum += row.intensity;
        bidCount++;
      }
    }

    const avgAskIntensity = askCount > 0 ? askIntensitySum / askCount : 0;
    const avgBidIntensity = bidCount > 0 ? bidIntensitySum / bidCount : 0;

    const askOpacity = Math.max(0.04, avgAskIntensity * settings.heatmapOpacity);
    const bidOpacity = Math.max(0.04, avgBidIntensity * settings.heatmapOpacity);

    const currentY = Math.max(0, Math.min(settings.canvasHeight, priceToY(settings.currentPrice)));

    // Draw ask gradient (top half)
    const askGradient = ctx.createLinearGradient(0, 0, 0, Math.max(1, currentY));
    askGradient.addColorStop(0, hexToRgba('#EF5350', 0));
    askGradient.addColorStop(1, hexToRgba('#EF5350', askOpacity));
    ctx.fillStyle = askGradient;
    ctx.fillRect(stripX, 0, stripWidth, currentY);

    // Draw bid gradient (bottom half)
    const bidGradient = ctx.createLinearGradient(0, currentY, 0, Math.max(currentY + 1, settings.canvasHeight));
    bidGradient.addColorStop(0, hexToRgba('#26A69A', bidOpacity));
    bidGradient.addColorStop(1, hexToRgba('#26A69A', 0));
    ctx.fillStyle = bidGradient;
    ctx.fillRect(stripX, currentY, stripWidth, settings.canvasHeight - currentY);

    // Divider
    ctx.fillStyle = hexToRgba('#F0B90B', 0.8);
    ctx.fillRect(stripX, currentY - 0.5, stripWidth, 1);
  } else {
    for (const row of heatmapRows) {
    const tY = priceToY(row.price + bucketSize / 2);
    const bY = priceToY(row.price - bucketSize / 2);
    const height = Math.max(1, bY - tY);

    let color = '#F0B90B'; // amber for contested/both
    if (row.side === 'bid') color = '#26A69A';
    else if (row.side === 'ask') color = '#EF5350';

    const finalOpacity = Math.max(0.04, row.intensity * (1 - row.ageScore * settings.ageFadeFactor) * settings.heatmapOpacity);

    ctx.fillStyle = hexToRgba(color, finalOpacity);
    ctx.fillRect(stripX, tY, stripWidth, height);

    if (height >= 6) {
      if (settings.showPulled && row.behavior.wasPulled) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 1.5;
        const cx = stripX + stripWidth - 5;
        const cy = tY + height / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 2);
        ctx.lineTo(cx + 2, cy + 2);
        ctx.moveTo(cx + 2, cy - 2);
        ctx.lineTo(cx - 2, cy + 2);
        ctx.stroke();
      } else if (settings.showConsumed && row.behavior.wasConsumed) {
        ctx.fillStyle = '#8A8A8A';
        const cx = stripX + stripWidth - 5;
        const cy = tY + height / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (settings.showPersistence && settings.totalSnapshots > 0) {
      if (row.behavior.appearances / settings.totalSnapshots > 0.7) {
        ctx.fillStyle = hexToRgba(color, 1);
        ctx.fillRect(stripX, tY, 2, height);
      }
    }
    }
  }

  // CURRENT label
  if (settings.isScrolled && settings.showCurrentLabel) {
    ctx.fillStyle = '#4A4A4A';
    ctx.font = '8px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('CURRENT', stripX + stripWidth / 2, 4);
  }
}

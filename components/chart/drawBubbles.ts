import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';

export type BubbleSide = 'both' | 'buy' | 'sell';

interface BubbleSettings {
  bubbleThreshold: number;
  bubbleThresholdMode?: 'absolute' | 'relative';
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
}

function abbreviateVol(vol: number): string {
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'k';
  return vol.toFixed(0);
}

export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  bucketSize: number,
  engine: AggregationEngine,
  barWidth: number,
  settings: BubbleSettings
) {
  const { bubbleThreshold, bubbleThresholdMode = 'absolute', bubbleMinRadius, bubbleMaxRadius, bubbleSide } = settings;

  // Performance guard — bars too small, bubbles would overlap and be unreadable
  if (barWidth < 4) return;

  // Compute adaptive threshold if relative
  let actualThreshold = bubbleThreshold;
  if (bubbleThresholdMode === 'relative') {
    let sumVol = 0;
    let count = 0;
    for (let i = firstIndex; i <= lastIndex; i++) {
      if (candles[i]) {
        sumVol += candles[i].volume;
        count++;
      }
    }
    const avgCandleVol = count > 0 ? sumVol / count : 0;
    const avgCellVol = avgCandleVol / 25; // Estimate average volume per bucket cell
    actualThreshold = bubbleThreshold * avgCellVol;
  }

  // Step 1 — Find maxVol across all visible cells (single-side)
  let maxVol = 0;
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fp = engine.getFootprintCandle(c.time);
    if (!fp) continue;
    fp.cells.forEach(cell => {
      if (bubbleSide !== 'sell' && cell.askVol > maxVol) maxVol = cell.askVol;
      if (bubbleSide !== 'buy' && cell.bidVol > maxVol) maxVol = cell.bidVol;
    });
  }

  if (maxVol === 0) return;

  // Step 2 — Iterate visible candles and draw bubbles
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fp = engine.getFootprintCandle(c.time);
    if (!fp) continue;
    const x = indexToX(i);
    if (x === null || x === undefined) continue;

    // Collect all qualifying cells for this candle
    const qualifiedCells: { price: number; vol: number; side: 'buy' | 'sell' }[] = [];

    fp.cells.forEach((cell, priceBucket) => {
      if (bubbleSide !== 'sell' && cell.askVol >= actualThreshold) {
        qualifiedCells.push({ price: priceBucket, vol: cell.askVol, side: 'buy' });
      }
      if (bubbleSide !== 'buy' && cell.bidVol >= actualThreshold) {
        qualifiedCells.push({ price: priceBucket, vol: cell.bidVol, side: 'sell' });
      }
    });

    // Cap at 20 bubbles per candle — keep highest volume ones
    if (qualifiedCells.length > 20) {
      qualifiedCells.sort((a, b) => b.vol - a.vol);
      qualifiedCells.length = 20;
    }

    // Render each bubble
    for (const { price, vol, side } of qualifiedCells) {
      const y = priceToY(price + bucketSize / 2);
      const t = vol / maxVol; // 0..1
      const radius = bubbleMinRadius + t * (bubbleMaxRadius - bubbleMinRadius);
      const opacity = 0.4 + t * 0.5;

      const isBuy = side === 'buy';
      const r = isBuy ? 38 : 239;
      const g = isBuy ? 166 : 83;
      const b = isBuy ? 154 : 80;

      // Fill
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      ctx.fill();

      // Stroke
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 1)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Volume label inside large bubbles
      if (radius >= 12) {
        const label = abbreviateVol(vol);
        ctx.font = '500 9px "JetBrains Mono"';
        const textWidth = ctx.measureText(label).width;
        if (radius * 1.6 >= textWidth) {
          ctx.fillStyle = '#E8E8E8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
        }
      }
    }
  }
}

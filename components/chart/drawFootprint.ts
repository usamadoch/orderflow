import { Candle } from "@/types/candle";
import { AggregationEngine } from "@/lib/aggregation/engine";
import { drawFootprintCell, drawDelta, drawDeltaCell } from "@/lib/utils/canvas";
import { FootprintMode } from "@/types/footprint";

interface CandleVisualStats {
  maxVol: number;
  maxDelta: number;
  avgVol: number;
  avgDelta: number;
  volumeScale: number;
  deltaScale: number;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function getSoftScale(maxValue: number, avgValue: number, visibleScale: number) {
  if (maxValue <= 0) return 0;

  const dominance = avgValue > 0 ? maxValue / avgValue : 1;
  const maxFactor = dominance >= 4 ? 1.08 : dominance >= 2.5 ? 1.22 : 1.55;

  return Math.max(
    visibleScale,
    avgValue * 2.2,
    maxValue * maxFactor
  );
}

export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  engine: AggregationEngine,
  bucketSize: number,
  canvasHeight: number,
  mode: FootprintMode
) {
  // Normalize each candle independently so viewport culling does not reshade
  // existing cells or resize delta bars while the chart is panned.
  const candleStats = new Map<number, CandleVisualStats>();
  const visibleVolumes: number[] = [];
  const visibleDeltas: number[] = [];

  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fpCandle = engine.getFootprintCandle(c.time);
    if (!fpCandle) continue;

    let maxVol = 0;
    let maxDelta = 0;
    let totalVol = 0;
    let volCount = 0;
    let totalDelta = 0;
    let deltaCount = 0;

    fpCandle.cells.forEach((cell) => {
      if (cell.bidVol > maxVol) maxVol = cell.bidVol;
      if (cell.askVol > maxVol) maxVol = cell.askVol;

      if (cell.bidVol > 0) {
        visibleVolumes.push(cell.bidVol);
        totalVol += cell.bidVol;
        volCount++;
      }
      if (cell.askVol > 0) {
        visibleVolumes.push(cell.askVol);
        totalVol += cell.askVol;
        volCount++;
      }

      const delta = Math.abs(cell.askVol - cell.bidVol);
      if (delta > maxDelta) maxDelta = delta;
      if (delta > 0) {
        visibleDeltas.push(delta);
        totalDelta += delta;
        deltaCount++;
      }
    });

    candleStats.set(i, {
      maxVol,
      maxDelta,
      avgVol: volCount > 0 ? totalVol / volCount : 0,
      avgDelta: deltaCount > 0 ? totalDelta / deltaCount : 0,
      volumeScale: 0,
      deltaScale: 0,
    });
  }

  const visibleVolumeScale = percentile(visibleVolumes, 0.85);
  const visibleDeltaScale = percentile(visibleDeltas, 0.85);
  candleStats.forEach((stats) => {
    stats.volumeScale = getSoftScale(stats.maxVol, stats.avgVol, visibleVolumeScale);
    stats.deltaScale = getSoftScale(stats.maxDelta, stats.avgDelta, visibleDeltaScale);
  });

  // Step 2 - Draw thin candle (wick + body) for all visible candles
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const highY = priceToY(c.high);
    const lowY = priceToY(c.low);
    const openY = priceToY(c.open);
    const closeY = priceToY(c.close);

    const candleWidth = 4;
    const candleX = Math.round(x - barWidth / 2 + candleWidth / 2);

    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(candleX, Math.round(highY));
    ctx.lineTo(candleX, Math.round(lowY));
    ctx.stroke();

    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    ctx.fillStyle = c.close >= c.open ? "#26A69A" : "#EF5350";
    ctx.fillRect(candleX - candleWidth / 2, Math.round(bodyTop), candleWidth, Math.round(bodyHeight));
  }

  // Step 3 - Draw footprint cells
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const fpCandle = engine.getFootprintCandle(c.time);
    if (!fpCandle) continue;

    fpCandle.cells.forEach((cell, priceBucket) => {
      const topY = priceToY(priceBucket + bucketSize);
      const bottomY = priceToY(priceBucket);
      const rowHeight = Math.max(0, bottomY - topY);

      if (rowHeight < 0.5) return;

      const candleWidth = 4;
      const candleGap = 4;
      const candleArea = candleWidth + candleGap;
      const boxesCenterX = x + candleArea / 2;
      const boxesWidth = Math.max(0, barWidth - candleArea);
      const stats = candleStats.get(i);
      if (!stats) return;

      if (mode === "bid-ask") {
        drawFootprintCell(
          ctx,
          boxesCenterX,
          topY,
          boxesWidth,
          rowHeight,
          cell,
          stats.volumeScale
        );
      } else {
        drawDeltaCell(
          ctx,
          boxesCenterX,
          topY,
          boxesWidth,
          rowHeight,
          cell.askVol - cell.bidVol,
          stats.deltaScale
        );
      }
    });
  }

  // Step 4 - Draw delta per candle
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const fpCandle = engine.getFootprintCandle(c.time);
    if (!fpCandle) continue;

    drawDelta(ctx, Math.round(x), fpCandle.delta, canvasHeight, barWidth);
  }
}

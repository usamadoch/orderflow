import { Candle } from "@/types/candle";
import { AggregationEngine } from "@/lib/aggregation/engine";
import { drawFootprintCell, drawDelta } from "@/lib/utils/canvas";

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
  canvasHeight: number
) {
  // Step 1 — Find maxVol across all visible candles
  let maxVol = 0;
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fpCandle = engine.getFootprintCandle(c.time);
    if (!fpCandle) continue;
    
    fpCandle.cells.forEach(cell => {
      if (cell.bidVol > maxVol) maxVol = cell.bidVol;
      if (cell.askVol > maxVol) maxVol = cell.askVol;
    });
  }

  // Step 2 — Draw wicks for all visible candles
  ctx.strokeStyle = '#4A4A4A';
  ctx.lineWidth = 1;
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const highY = priceToY(c.high);
    const lowY = priceToY(c.low);

    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(highY));
    ctx.lineTo(Math.round(x), Math.round(lowY));
    ctx.stroke();
  }

  // Step 3 — Draw footprint cells
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
      
      if (rowHeight < 2) return;

      drawFootprintCell(
        ctx, 
        Math.round(x), 
        Math.round(topY), 
        Math.round(barWidth), 
        Math.round(rowHeight), 
        cell, 
        maxVol
      );
    });
  }

  // Step 4 — Draw delta per candle
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const fpCandle = engine.getFootprintCandle(c.time);
    if (!fpCandle) continue;

    drawDelta(ctx, Math.round(x), fpCandle.delta, canvasHeight, barWidth);
  }
}

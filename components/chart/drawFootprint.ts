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

  // Step 2 — Draw thin candle (wick + body) for all visible candles
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const x = indexToX(i);
    const highY = priceToY(c.high);
    const lowY = priceToY(c.low);
    const openY = priceToY(c.open);
    const closeY = priceToY(c.close);

    const candleWidth = 4;
    const candleGap = 4;
    const candleArea = candleWidth + candleGap;
    const candleX = Math.round(x - barWidth / 2 + candleWidth / 2);

    // Wick
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(candleX, Math.round(highY));
    ctx.lineTo(candleX, Math.round(lowY));
    ctx.stroke();

    // Thin Body
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    
    ctx.fillStyle = c.close >= c.open ? '#26A69A' : '#EF5350';
    ctx.fillRect(candleX - candleWidth / 2, Math.round(bodyTop), candleWidth, Math.round(bodyHeight));
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

      const candleWidth = 4;
      const candleGap = 4;
      const candleArea = candleWidth + candleGap;
      const boxesCenterX = Math.round(x + candleArea / 2);
      const boxesWidth = Math.max(0, barWidth - candleArea);

      drawFootprintCell(
        ctx, 
        boxesCenterX, 
        Math.round(topY), 
        Math.round(boxesWidth), 
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

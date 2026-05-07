










// import { Candle } from '../../../types/candle';
// import { AggregationEngine } from '../../../lib/aggregation/engine';
// import { drawFootprintCell, drawDelta } from '../../../lib/utils/canvas';

import { Candle } from "@/types/candle";
import { AggregationEngine } from "@/lib/aggregation/engine";
import { drawDelta, drawFootprintCell } from "@/lib/utils/canvas";


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
  // 1. Find maxVol across visible cells
  let maxVol = 0;
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fpCandle = engine.getFootprintCandle(c.time);
    if (fpCandle) {
      fpCandle.cells.forEach((cell) => {
        if (cell.bidVol > maxVol) maxVol = cell.bidVol;
        if (cell.askVol > maxVol) maxVol = cell.askVol;
      });
    }
  }

  // 2. Draw footprint cells and delta
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;

    const x = indexToX(i);
    const fpCandle = engine.getFootprintCandle(c.time);

    // Fallback wick if no footprint data yet
    if (!fpCandle || fpCandle.cells.size === 0) {
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      const isBullish = c.close >= c.open;
      const color = isBullish ? '#26A69A' : '#EF5350';

      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(Math.round(x), Math.round(highY));
      ctx.lineTo(Math.round(x), Math.round(lowY));
      ctx.stroke();
      continue;
    }

    fpCandle.cells.forEach((cell, price) => {
      const topY = priceToY(price + bucketSize);
      const bottomY = priceToY(price);
      const rowHeight = bottomY - topY;

      drawFootprintCell(ctx, x, topY, barWidth, rowHeight, cell, maxVol);
    });

    drawDelta(ctx, x, fpCandle.delta, canvasHeight, barWidth);
  }
}

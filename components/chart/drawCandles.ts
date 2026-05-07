import { Candle } from "@/types/candle";

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number
) {
  const bodyWidth = Math.max(1, Math.floor(barWidth * 0.6));

  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;

    const x = indexToX(i);
    const openY = priceToY(c.open);
    const closeY = priceToY(c.close);
    const highY = priceToY(c.high);
    const lowY = priceToY(c.low);

    const isBullish = c.close >= c.open;
    const color = isBullish ? '#26A69A' : '#EF5350';

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // Draw Wick (draw wick before body so body overlaps cleanly)
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(highY));
    ctx.lineTo(Math.round(x), Math.round(lowY));
    ctx.stroke();

    // Draw Body
    const topY = Math.round(Math.min(openY, closeY));
    const bottomY = Math.round(Math.max(openY, closeY));
    const bodyHeight = Math.max(1, bottomY - topY);
    const leftX = Math.round(x - bodyWidth / 2);

    ctx.fillRect(leftX, topY, bodyWidth, bodyHeight);
  }
}

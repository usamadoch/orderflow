import { Candle } from "@/types/candle";
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from "@/lib/config/chartColors";

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  isHollowMode: boolean = false
) {
  const bodyWidth = Math.max(1, Math.floor(barWidth * 0.82));

  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;

    const x = indexToX(i);
    const openY = priceToY(c.open);
    const closeY = priceToY(c.close);
    const highY = priceToY(c.high);
    const lowY = priceToY(c.low);

    const isBullish = c.close >= c.open;
    // The user requested: "red candles must be hollow too", which means in Hollow mode, 
    // ALL candles should be rendered as hollow, preserving their normal up/down colors.
    const isHollow = isHollowMode;
    const color = isBullish ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    const topY = Math.round(Math.min(openY, closeY));
    const bottomY = Math.round(Math.max(openY, closeY));
    const bodyHeight = Math.max(1, bottomY - topY);
    const leftX = Math.round(x - bodyWidth / 2);

    // Draw Wick (draw in two parts: high to top of body, bottom of body to low)
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(highY));
    ctx.lineTo(Math.round(x), topY);
    ctx.moveTo(Math.round(x), bottomY);
    ctx.lineTo(Math.round(x), Math.round(lowY));
    ctx.stroke();

    // Draw Body
    if (isHollow) {
      ctx.strokeRect(leftX, topY, bodyWidth, bodyHeight);
    } else {
      ctx.fillRect(leftX, topY, bodyWidth, bodyHeight);
    }
  }
}

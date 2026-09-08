import { Candle } from "@/types/candle";
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from "@/lib/config/chartColors";

export interface CandleColorOptions {
  upColor?: string;
  upOpacity?: number;
  downColor?: string;
  downOpacity?: number;
  upWickColor?: string;
  upWickOpacity?: number;
  downWickColor?: string;
  downWickOpacity?: number;
}

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  isHollowMode: boolean = false,
  candleColors?: CandleColorOptions
) {
  const upBody = candleColors?.upColor || CHART_BULLISH_COLOR;
  const upBodyOpacity = typeof candleColors?.upOpacity === 'number' ? candleColors.upOpacity : 1;
  const downBody = candleColors?.downColor || CHART_BEARISH_COLOR;
  const downBodyOpacity = typeof candleColors?.downOpacity === 'number' ? candleColors.downOpacity : 1;
  const upWick = candleColors?.upWickColor || upBody;
  const upWickOpacity = typeof candleColors?.upWickOpacity === 'number' ? candleColors.upWickOpacity : upBodyOpacity;
  const downWick = candleColors?.downWickColor || downBody;
  const downWickOpacity = typeof candleColors?.downWickOpacity === 'number' ? candleColors.downWickOpacity : downBodyOpacity;

  ctx.save();
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
    const bodyColor = isBullish ? upBody : downBody;
    const bodyOpacity = isBullish ? upBodyOpacity : downBodyOpacity;
    const wickColor = isBullish ? upWick : downWick;
    const wickOpacity = isBullish ? upWickOpacity : downWickOpacity;

    const bodyRgba = chartColorToRgba(bodyColor, bodyOpacity);
    const wickRgba = chartColorToRgba(wickColor, wickOpacity);

    const topY = Math.round(Math.min(openY, closeY));
    const bottomY = Math.round(Math.max(openY, closeY));
    const bodyHeight = Math.max(1, bottomY - topY);
    const leftX = Math.round(x - bodyWidth / 2);

    // Draw Wick (aligned to half-pixels for crisp 1px stroke without blurring)
    const wickX = Math.floor(x) + 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = wickRgba;
    ctx.beginPath();
    ctx.moveTo(wickX, Math.round(highY));
    ctx.lineTo(wickX, topY);
    ctx.moveTo(wickX, bottomY);
    ctx.lineTo(wickX, Math.round(lowY));
    ctx.stroke();

    // Draw Body: in hollow mode, bullish is crisp hollow outline, bearish is solid filled
    if (isHollowMode && isBullish) {
      if (bodyHeight <= 2 || bodyWidth <= 2) {
        ctx.fillStyle = bodyRgba;
        ctx.fillRect(leftX, topY, bodyWidth, bodyHeight);
      } else {
        ctx.strokeStyle = bodyRgba;
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX + 0.5, topY + 0.5, bodyWidth - 1, bodyHeight - 1);
      }
    } else {
      ctx.fillStyle = bodyRgba;
      ctx.fillRect(leftX, topY, bodyWidth, bodyHeight);
    }
  }
  ctx.restore();
}

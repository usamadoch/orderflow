import { Candle } from "@/types/candle";

export function getVisibleRange(
  candles: Candle[],
  scrollOffset: number,
  barWidth: number,
  chartWidth: number
) {
  if (candles.length === 0) return { firstIndex: 0, lastIndex: 0 };
  
  let lastIndex = candles.length - 1 - Math.floor(scrollOffset / barWidth);
  let firstIndex = lastIndex - Math.ceil(chartWidth / barWidth) - 1;
  
  lastIndex = Math.max(0, Math.min(candles.length - 1, lastIndex));
  firstIndex = Math.max(0, Math.min(candles.length - 1, firstIndex));
  
  return { firstIndex, lastIndex };
}

export function getVisiblePriceRange(
  candles: Candle[],
  firstIndex: number,
  lastIndex: number
) {
  let priceMin = Infinity;
  let priceMax = -Infinity;

  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    if (c.high > priceMax) priceMax = c.high;
    if (c.low < priceMin) priceMin = c.low;
  }

  if (priceMin !== Infinity && priceMax !== -Infinity && priceMin !== priceMax) {
    const range = priceMax - priceMin;
    priceMax += range * 0.05;
    priceMin -= range * 0.05;
  } else if (priceMin !== Infinity && priceMin === priceMax) {
    priceMax = priceMin * 1.05;
    priceMin = priceMin * 0.95;
  } else {
    priceMin = 0;
    priceMax = 100;
  }

  return { priceMin, priceMax };
}

export function priceToY(price: number, priceMin: number, priceMax: number, drawableHeight: number) {
  const range = priceMax - priceMin;
  if (range <= 0) return drawableHeight / 2;
  return ((priceMax - price) / range) * drawableHeight;
}

export function indexToX(
  candleIndex: number,
  candlesLength: number,
  scrollOffset: number,
  barWidth: number,
  chartWidth: number
) {
  return chartWidth - barWidth / 2 - (candlesLength - 1 - candleIndex) * barWidth + scrollOffset;
}

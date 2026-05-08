import { Candle } from "@/types/candle";

export function getVisibleRange(
  candles: Candle[],
  scrollOffset: number,
  barWidth: number,
  chartWidth: number,
  profileWidth: number = 0
) {
  if (candles.length === 0) return { firstIndex: 0, lastIndex: 0, rawFirstIndex: 0, rawLastIndex: 0 };
  
  const drawableWidth = chartWidth - profileWidth;
  const lastIndexRaw = candles.length - 1 - Math.floor(scrollOffset / barWidth);
  const firstIndexRaw = lastIndexRaw - Math.ceil(drawableWidth / barWidth) - 1;
  
  const lastIndex = Math.max(0, Math.min(candles.length - 1, lastIndexRaw));
  const firstIndex = Math.max(0, Math.min(candles.length - 1, firstIndexRaw));
  
  return { 
    firstIndex, 
    lastIndex,
    rawFirstIndex: firstIndexRaw,
    rawLastIndex: lastIndexRaw
  };
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
  chartWidth: number,
  profileWidth: number = 0
) {
  const drawableWidth = chartWidth - profileWidth;
  return drawableWidth - barWidth / 2 - (candlesLength - 1 - candleIndex) * barWidth + scrollOffset;
}

export function yToPrice(y: number, priceMin: number, priceMax: number, drawableHeight: number) {
  const range = priceMax - priceMin;
  if (range <= 0) return priceMin;
  return priceMax - (y / drawableHeight) * range;
}

export function xToIndex(
  x: number,
  candlesLength: number,
  scrollOffset: number,
  barWidth: number,
  chartWidth: number,
  profileWidth: number = 0
) {
  const drawableWidth = chartWidth - profileWidth;
  return (candlesLength - 1) + (x - drawableWidth + barWidth / 2 - scrollOffset) / barWidth;
}

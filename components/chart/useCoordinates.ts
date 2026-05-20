import { Candle } from "@/types/candle";

export function getDrawableChartWidth(chartWidth: number, profileWidth: number = 0) {
  const safeChartWidth = Math.max(1, Number.isFinite(chartWidth) ? chartWidth : 1);
  const safeProfileWidth = Math.max(0, Number.isFinite(profileWidth) ? profileWidth : 0);
  return Math.max(1, safeChartWidth - Math.min(safeProfileWidth, safeChartWidth - 1));
}

export function getVisibleRange(
  candles: Candle[],
  scrollOffset: number,
  barWidth: number,
  chartWidth: number,
  profileWidth: number = 0
) {
  if (candles.length === 0) return { firstIndex: 0, lastIndex: 0, rawFirstIndex: 0, rawLastIndex: 0 };
  
  const safeBarWidth = Math.max(1, Number.isFinite(barWidth) ? barWidth : 1);
  const drawableWidth = getDrawableChartWidth(chartWidth, profileWidth);
  const lastIndexRaw = candles.length - 1 - Math.floor(scrollOffset / safeBarWidth);
  const firstIndexRaw = lastIndexRaw - Math.ceil(drawableWidth / safeBarWidth) - 1;
  const overscanBars = Math.max(2, Math.ceil(32 / safeBarWidth));
  
  const lastIndex = Math.max(0, Math.min(candles.length - 1, lastIndexRaw + overscanBars));
  const firstIndex = Math.max(0, Math.min(candles.length - 1, firstIndexRaw - overscanBars));
  
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
  const safeBarWidth = Math.max(1, Number.isFinite(barWidth) ? barWidth : 1);
  const drawableWidth = getDrawableChartWidth(chartWidth, profileWidth);
  return drawableWidth - safeBarWidth / 2 - (candlesLength - 1 - candleIndex) * safeBarWidth + scrollOffset;
}

export function yToPrice(y: number, priceMin: number, priceMax: number, drawableHeight: number) {
  const range = priceMax - priceMin;
  if (range <= 0) return priceMin;
  return priceMax - (y / drawableHeight) * range;
}

export function xToIndex(
  x: number,
  candles: Candle[],
  scrollOffset: number,
  barWidth: number,
  chartWidth: number,
  profileWidth: number = 0
) {
  if (candles.length === 0) return 0;
  const safeBarWidth = Math.max(1, Number.isFinite(barWidth) ? barWidth : 1);
  const drawableWidth = getDrawableChartWidth(chartWidth, profileWidth);
  const index = (candles.length - 1) + (x - drawableWidth + safeBarWidth / 2 - scrollOffset) / safeBarWidth;
  return Math.max(0, Math.min(candles.length - 1, Math.round(index)));
}

export function timeToIndex(time: number, candles: Candle[]) {
  if (candles.length === 0) return 0;
  
  let left = 0;
  let right = candles.length - 1;
  let result = 0;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (candles[mid].time === time) {
      return mid;
    } else if (candles[mid].time < time) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return result;
}

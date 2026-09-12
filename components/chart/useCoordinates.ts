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

  if (candles.length === 0) {
    return { priceMin: 0, priceMax: 100 };
  }

  const validFirst = Math.max(0, Math.min(candles.length - 1, firstIndex));
  const validLast = Math.max(0, Math.min(candles.length - 1, lastIndex));

  for (let i = validFirst; i <= validLast; i++) {
    const c = candles[i];
    if (!c) continue;
    if (c.high > priceMax) priceMax = c.high;
    if (c.low < priceMin) priceMin = c.low;
  }

  if (priceMin !== Infinity && priceMax !== -Infinity && priceMin !== priceMax) {
    let range = priceMax - priceMin;
    // Enforce a sensible minimum range (at least 0.3% of price) so small price moves never stretch vertically across the full canvas
    const minRange = Math.max(1, priceMax * 0.003);
    if (range < minRange) {
      const mid = (priceMax + priceMin) / 2;
      priceMax = mid + minRange / 2;
      priceMin = mid - minRange / 2;
      range = minRange;
    }
    // 8% vertical padding on top and bottom for spacious, beautiful candles
    priceMax += range * 0.08;
    priceMin -= range * 0.08;
  } else if (priceMin !== Infinity && priceMin === priceMax) {
    const spread = Math.max(1, priceMin * 0.005);
    priceMax = priceMin + spread;
    priceMin = priceMin - spread;
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
  return Math.max(0, Math.round(index));
}

export function timeToIndex(time: number, candles: Candle[]) {
  if (candles.length === 0) return 0;
  
  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  const avgInterval = candles.length > 1 ? (lastCandle.time - firstCandle.time) / (candles.length - 1) : 60;

  if (time > lastCandle.time) {
    const diff = Math.round((time - lastCandle.time) / (avgInterval || 60));
    return candles.length - 1 + diff;
  }
  if (time < firstCandle.time) {
    const diff = Math.round((firstCandle.time - time) / (avgInterval || 60));
    return Math.max(0, -diff);
  }
  
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

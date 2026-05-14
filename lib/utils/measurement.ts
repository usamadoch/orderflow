import { Candle } from "../../types/candle";
import { MeasurementMetrics, FootprintMeasurementMetrics } from "../../types/measurement";
import { yToPrice, xToIndex } from "../../components/chart/useCoordinates";
import { timeframeToSeconds, formatElapsed } from "./format";
import { AggregationEngine } from "../aggregation/engine";

export interface CoordinateSystem {
  visiblePriceMin: number;
  visiblePriceMax: number;
}

export function computeMeasurementMetrics(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  candles: Candle[],
  coords: CoordinateSystem,
  timeframe: string,
  canvasWidth: number,
  canvasHeight: number,
  scrollOffset: number,
  barWidth: number,
  profileWidth: number,
  timeAxisHeight: number
): MeasurementMetrics | null {
  if (candles.length === 0) return null;

  const drawableHeight = canvasHeight - timeAxisHeight;

  // Step 1 — Convert pixels to chart coordinates
  const startPrice = yToPrice(startY, coords.visiblePriceMin, coords.visiblePriceMax, drawableHeight);
  const endPrice = yToPrice(endY, coords.visiblePriceMin, coords.visiblePriceMax, drawableHeight);

  const rawStartIndex = xToIndex(startX, candles, scrollOffset, barWidth, canvasWidth, profileWidth);
  const rawEndIndex = xToIndex(endX, candles, scrollOffset, barWidth, canvasWidth, profileWidth);

  // Step 2 — Normalize direction
  const earlierIndex = Math.min(rawStartIndex, rawEndIndex);
  const laterIndex = Math.max(rawStartIndex, rawEndIndex);

  const priceDiff = endPrice - startPrice;
  const candleCount = laterIndex - earlierIndex + 1;
  
  // Step 3 — Compute values
  const timeframeSeconds = timeframeToSeconds(timeframe);
  const elapsedSeconds = candleCount * timeframeSeconds;
  const ticks = Math.round(Math.abs(priceDiff) / 0.01);
  const pricePercent = (priceDiff / startPrice) * 100;
  const isPositive = endPrice > startPrice;

  return {
    startPrice,
    endPrice,
    priceDiff,
    pricePercent,
    ticks,
    startIndex: earlierIndex,
    endIndex: laterIndex,
    candleCount,
    elapsedSeconds,
    elapsedLabel: formatElapsed(elapsedSeconds),
    isPositive
  };
}

export function computeFootprintMetrics(
  metrics: MeasurementMetrics,
  candles: Candle[],
  engine: AggregationEngine
): FootprintMeasurementMetrics | null {
  let totalBuyVol = 0;
  let totalSellVol = 0;
  let totalDelta = 0;
  let isPartial = false;
  let foundAny = false;

  for (let i = metrics.startIndex; i <= metrics.endIndex; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const fp = engine.getFootprintCandle(candle.time);
    if (!fp) {
      isPartial = true;
      continue;
    }

    foundAny = true;
    totalDelta += fp.delta;
    
    fp.cells.forEach(cell => {
      totalBuyVol += cell.askVol;
      totalSellVol += cell.bidVol;
    });
  }

  if (!foundAny) return null;

  return {
    totalVolume: totalBuyVol + totalSellVol,
    totalDelta,
    totalBuyVol,
    totalSellVol,
    buySellRatio: totalBuyVol / Math.max(totalSellVol, 0.0001),
    isPartial
  };
}

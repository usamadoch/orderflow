import { Candle } from '@/types/candle';
import { VwapPeriodMode, VwapSessionAnchor, VwapPriceSource, VwapEnvelopeMode } from '@/types/chart';

export interface VwapPoint {
  time: number; // Display candle time
  value: number | null;
  band1Up: number | null;
  band1Dw: number | null;
  band2Up: number | null;
  band2Dw: number | null;
  band3Up: number | null;
  band3Dw: number | null;
}

export interface VwapCalculateOptions {
  periodMode: VwapPeriodMode;
  sessionAnchor: VwapSessionAnchor;
  rollingDays: number;
  priceSource: VwapPriceSource;
  envelopeMode: VwapEnvelopeMode;
  band1Enabled: boolean;
  band1Value: number;
  band2Enabled: boolean;
  band2Value: number;
  band3Enabled: boolean;
  band3Value: number;
}

export type VwapResult =
  | { status: 'success'; series: VwapPoint[] }
  | { status: 'pending' }
  | { status: 'error'; reason: string };

function getTypicalPrice(candle: Candle, source: VwapPriceSource): number {
  switch (source) {
    case 'HLC3':
      return (candle.high + candle.low + candle.close) / 3;
    case 'HL2':
      return (candle.high + candle.low) / 2;
    case 'OHLC4':
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case 'Close':
      return candle.close;
    default:
      return (candle.high + candle.low + candle.close) / 3;
  }
}

export function getVwapAnchorTime(timeSeconds: number, options: VwapCalculateOptions): number {
  if (options.periodMode === 'Rolling') {
    return timeSeconds - options.rollingDays * 24 * 60 * 60;
  }

  const date = new Date(timeSeconds * 1000);
  
  if (options.sessionAnchor === 'Day') {
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }
  
  if (options.sessionAnchor === 'Week') {
    date.setUTCHours(0, 0, 0, 0);
    const day = date.getUTCDay(); // 0 is Sunday
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    date.setUTCDate(diff);
    return Math.floor(date.getTime() / 1000);
  }
  
  if (options.sessionAnchor === 'Month') {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(1);
    return Math.floor(date.getTime() / 1000);
  }

  // Fallback
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

export function calculateVwapSeries(
  displayCandles: Candle[],
  base1mCandles: Candle[],
  timeframeSeconds: number,
  options: VwapCalculateOptions,
  isHydrating: boolean
): VwapResult {
  if (displayCandles.length === 0) {
    return { status: 'success', series: [] };
  }

  // Find the required anchor time for the FIRST display candle
  const firstDisplayCandleTime = displayCandles[0].time;
  const requiredAnchorTime = getVwapAnchorTime(firstDisplayCandleTime, options);

  // Return pending ONLY if we are actively hydrating and we don't have the anchor yet.
  // If we finished hydrating (or failed) and STILL don't have the anchor, we calculate with what we have.
  if (base1mCandles.length === 0 || (isHydrating && base1mCandles[0].time > requiredAnchorTime)) {
    return { status: 'pending' };
  }

  const series: VwapPoint[] = [];
  let baseIndex = 0;

  // Track the rolling window for Rolling mode
  const rollingWindow: Candle[] = [];

  // Track accumulators
  let currentAnchorTime = -1;
  let cumPV = 0;
  let cumV = 0;
  let cumPV2 = 0;

  for (let i = 0; i < displayCandles.length; i++) {
    const displayCandle = displayCandles[i];
    const displayEndTime = displayCandle.time + timeframeSeconds;

    if (options.periodMode === 'Session') {
      const anchorTime = getVwapAnchorTime(displayCandle.time, options);
      if (anchorTime !== currentAnchorTime) {
        currentAnchorTime = anchorTime;
        cumPV = 0;
        cumV = 0;
        cumPV2 = 0;
        rollingWindow.length = 0; 
      }
    }

    // Process all 1m candles that fall before the END of this display candle
    while (baseIndex < base1mCandles.length && base1mCandles[baseIndex].time < displayEndTime) {
      const baseCandle = base1mCandles[baseIndex];
      const typicalPrice = getTypicalPrice(baseCandle, options.priceSource);
      
      if (options.periodMode === 'Rolling') {
        rollingWindow.push(baseCandle);
        cumPV += typicalPrice * baseCandle.volume;
        cumV += baseCandle.volume;
        cumPV2 += baseCandle.volume * typicalPrice * typicalPrice;
      } else {
        if (baseCandle.time >= currentAnchorTime) {
          cumPV += typicalPrice * baseCandle.volume;
          cumV += baseCandle.volume;
          cumPV2 += baseCandle.volume * typicalPrice * typicalPrice;
        }
      }
      baseIndex++;
    }

    if (options.periodMode === 'Rolling') {
      const rollingAnchorTime = displayEndTime - options.rollingDays * 24 * 60 * 60;
      // Remove expired candles from rolling window
      while (rollingWindow.length > 0 && rollingWindow[0].time < rollingAnchorTime) {
        const expiredCandle = rollingWindow.shift()!;
        const tp = getTypicalPrice(expiredCandle, options.priceSource);
        cumPV -= tp * expiredCandle.volume;
        cumV -= expiredCandle.volume;
        cumPV2 -= expiredCandle.volume * tp * tp;
      }
      // Prevent negative drift due to float precision
      if (cumV < 1e-8) {
        cumV = 0;
        cumPV = 0;
        cumPV2 = 0;
      }
    }

    let vwapValue = 0;
    let stdDev = 0;

    if (cumV > 0) {
      vwapValue = cumPV / cumV;
      
      if (options.envelopeMode === 'Standard Deviation') {
        // variance = E[X^2] - (E[X])^2
        const ex2 = cumPV2 / cumV;
        const ex = vwapValue;
        const variance = Math.max(0, ex2 - ex * ex);
        stdDev = Math.sqrt(variance);
      }
    }

    if (vwapValue === 0) {
      series.push({
        time: displayCandle.time,
        value: null,
        band1Up: null, band1Dw: null,
        band2Up: null, band2Dw: null,
        band3Up: null, band3Dw: null,
      });
      continue;
    }

    const point: VwapPoint = {
      time: displayCandle.time,
      value: vwapValue,
      band1Up: null,
      band1Dw: null,
      band2Up: null,
      band2Dw: null,
      band3Up: null,
      band3Dw: null,
    };

    if (options.envelopeMode === 'Standard Deviation') {
      if (options.band1Enabled) {
        point.band1Up = vwapValue + stdDev * options.band1Value;
        point.band1Dw = vwapValue - stdDev * options.band1Value;
      }
      if (options.band2Enabled) {
        point.band2Up = vwapValue + stdDev * options.band2Value;
        point.band2Dw = vwapValue - stdDev * options.band2Value;
      }
      if (options.band3Enabled) {
        point.band3Up = vwapValue + stdDev * options.band3Value;
        point.band3Dw = vwapValue - stdDev * options.band3Value;
      }
    } else if (options.envelopeMode === 'Percentage') {
      if (options.band1Enabled) {
        point.band1Up = vwapValue * (1 + options.band1Value / 100);
        point.band1Dw = vwapValue * (1 - options.band1Value / 100);
      }
      if (options.band2Enabled) {
        point.band2Up = vwapValue * (1 + options.band2Value / 100);
        point.band2Dw = vwapValue * (1 - options.band2Value / 100);
      }
      if (options.band3Enabled) {
        point.band3Up = vwapValue * (1 + options.band3Value / 100);
        point.band3Dw = vwapValue * (1 - options.band3Value / 100);
      }
    }

    series.push(point);
  }

  return { status: 'success', series };
}

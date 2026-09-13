import { Candle } from '@/types/candle';
import { markStart, markEnd } from '../debug/perfInstrumentation';
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
    case 'HLC3': return (candle.high + candle.low + candle.close) / 3;
    case 'HL2': return (candle.high + candle.low) / 2;
    case 'OHLC4': return (candle.open + candle.high + candle.low + candle.close) / 4;
    case 'Close': return candle.close;
    default: return (candle.high + candle.low + candle.close) / 3;
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
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

// --------------------------------------------------------------------------------
// LEGACY IMPLEMENTATION FOR DUAL-RUN VERIFICATION
// --------------------------------------------------------------------------------
export function calculateVwapSeriesLegacy(
  displayCandles: Candle[],
  base1mCandles: Candle[],
  timeframeSeconds: number,
  options: VwapCalculateOptions,
  _isHydrating?: boolean
): VwapResult {
  void _isHydrating;
  if (displayCandles.length === 0) return { status: 'success', series: [] };

  const hasSufficientBaseCandles = Boolean(
    base1mCandles &&
    base1mCandles.length > 0 &&
    base1mCandles[0].time <= displayCandles[0].time
  );
  const baseCandles = hasSufficientBaseCandles ? base1mCandles : displayCandles;
  if (baseCandles.length === 0) {
    return { status: 'pending' };
  }

  const series: VwapPoint[] = [];
  let baseIndex = 0;
  const rollingWindow: Candle[] = [];
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
        cumPV = 0; cumV = 0; cumPV2 = 0;
        rollingWindow.length = 0; 
      }
    }

    while (baseIndex < baseCandles.length && baseCandles[baseIndex].time < displayEndTime) {
      const baseCandle = baseCandles[baseIndex];
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
      while (rollingWindow.length > 0 && rollingWindow[0].time < rollingAnchorTime) {
        const expiredCandle = rollingWindow.shift()!;
        const tp = getTypicalPrice(expiredCandle, options.priceSource);
        cumPV -= tp * expiredCandle.volume;
        cumV -= expiredCandle.volume;
        cumPV2 -= expiredCandle.volume * tp * tp;
      }
      if (cumV < 1e-8) {
        cumV = 0; cumPV = 0; cumPV2 = 0;
      }
    }

    let vwapValue = 0;
    let stdDev = 0;

    if (cumV > 0) {
      vwapValue = cumPV / cumV;
      if (options.envelopeMode === 'Standard Deviation') {
        const ex2 = cumPV2 / cumV;
        const ex = vwapValue;
        const variance = Math.max(0, ex2 - ex * ex);
        stdDev = Math.sqrt(variance);
      }
    }

    if (vwapValue === 0) {
      series.push({ time: displayCandle.time, value: null, band1Up: null, band1Dw: null, band2Up: null, band2Dw: null, band3Up: null, band3Dw: null });
      continue;
    }

    const point: VwapPoint = { time: displayCandle.time, value: vwapValue, band1Up: null, band1Dw: null, band2Up: null, band2Dw: null, band3Up: null, band3Dw: null };
    if (options.envelopeMode === 'Standard Deviation') {
      if (options.band1Enabled) { point.band1Up = vwapValue + stdDev * options.band1Value; point.band1Dw = vwapValue - stdDev * options.band1Value; }
      if (options.band2Enabled) { point.band2Up = vwapValue + stdDev * options.band2Value; point.band2Dw = vwapValue - stdDev * options.band2Value; }
      if (options.band3Enabled) { point.band3Up = vwapValue + stdDev * options.band3Value; point.band3Dw = vwapValue - stdDev * options.band3Value; }
    } else if (options.envelopeMode === 'Percentage') {
      if (options.band1Enabled) { point.band1Up = vwapValue * (1 + options.band1Value / 100); point.band1Dw = vwapValue * (1 - options.band1Value / 100); }
      if (options.band2Enabled) { point.band2Up = vwapValue * (1 + options.band2Value / 100); point.band2Dw = vwapValue * (1 - options.band2Value / 100); }
      if (options.band3Enabled) { point.band3Up = vwapValue * (1 + options.band3Value / 100); point.band3Dw = vwapValue * (1 - options.band3Value / 100); }
    }
    series.push(point);
  }
  return { status: 'success', series };
}


// --------------------------------------------------------------------------------
// NEW INCREMENTAL IMPLEMENTATION
// --------------------------------------------------------------------------------

interface CandleContrib {
  pv: number;
  v: number;
  pv2: number;
}

export class VwapCalculator {
  private lastOptionsStr = '';
  private lastTfSeconds = -1;
  private lastFirstCandleTime = -1;
  private lastUsedBaseCandles: Candle[] = [];
  
  private lastDisplayCandles: Candle[] = [];
  private baseIndex = 0;
  
  private currentAnchorTime = -1;
  private cumPV = 0;
  private cumV = 0;
  private cumPV2 = 0;
  
  private series: VwapPoint[] = [];
  private contributions = new Map<number, CandleContrib>(); // time -> contrib
  private rollingWindow: Candle[] = [];
  
  private closeCountSinceFull = 0;
  
  public calculate(
    displayCandles: Candle[],
    base1mCandles: Candle[],
    timeframeSeconds: number,
    options: VwapCalculateOptions,
    _isHydrating?: boolean
  ): VwapResult {
    void _isHydrating;
    const optionsStr = JSON.stringify(options);
    
    if (displayCandles.length === 0) {
      return { status: 'success', series: [] };
    }

    const hasSufficientBaseCandles = Boolean(
      base1mCandles &&
      base1mCandles.length > 0 &&
      base1mCandles[0].time <= displayCandles[0].time
    );
    const baseCandles = hasSufficientBaseCandles ? base1mCandles : displayCandles;
    if (baseCandles.length === 0) {
      return { status: 'pending' };
    }

    const firstDisplayCandleTime = displayCandles[0].time;

    const isStructuralChange = 
      this.lastOptionsStr !== optionsStr || 
      this.lastTfSeconds !== timeframeSeconds ||
      this.lastFirstCandleTime !== firstDisplayCandleTime ||
      this.lastUsedBaseCandles !== baseCandles ||
      this.closeCountSinceFull >= 100 ||
      displayCandles.length < this.lastDisplayCandles.length ||
      this.series.length !== displayCandles.length;

    if (isStructuralChange) {
      markStart('calculateVwapSeries_full');
      this.fullRecompute(displayCandles, baseCandles, timeframeSeconds, options);
      this.lastOptionsStr = optionsStr;
      this.lastTfSeconds = timeframeSeconds;
      this.lastFirstCandleTime = firstDisplayCandleTime;
      this.lastUsedBaseCandles = baseCandles;
      this.closeCountSinceFull = 0;
      markEnd('calculateVwapSeries_full');
    } else {
      markStart('calculateVwapSeries_incremental');
      this.incrementalCompute(displayCandles, baseCandles, timeframeSeconds, options);
      markEnd('calculateVwapSeries_incremental');
    }

    // Check if a candle actually closed
    if (this.lastDisplayCandles.length > 0 && displayCandles.length > this.lastDisplayCandles.length) {
      this.closeCountSinceFull += (displayCandles.length - this.lastDisplayCandles.length);
    }
    
    this.lastDisplayCandles = displayCandles;
    
    return { status: 'success', series: this.series };
  }
  
  private fullRecompute(
    displayCandles: Candle[],
    baseCandles: Candle[],
    timeframeSeconds: number,
    options: VwapCalculateOptions
  ) {
    this.series = [];
    this.contributions.clear();
    this.rollingWindow = [];
    this.baseIndex = 0;
    this.currentAnchorTime = -1;
    this.cumPV = 0;
    this.cumV = 0;
    this.cumPV2 = 0;
    
    for (let i = 0; i < displayCandles.length; i++) {
      this.series.push(this.processDisplayCandle(displayCandles[i], baseCandles, timeframeSeconds, options));
    }
  }

  private incrementalCompute(
    displayCandles: Candle[],
    baseCandles: Candle[],
    timeframeSeconds: number,
    options: VwapCalculateOptions
  ) {
    // Find the first candle that changed
    let firstChangedIdx = -1;
    for (let i = Math.max(0, this.lastDisplayCandles.length - 2); i < displayCandles.length; i++) {
      if (i >= this.lastDisplayCandles.length || 
          displayCandles[i].volume !== this.lastDisplayCandles[i].volume ||
          displayCandles[i].close !== this.lastDisplayCandles[i].close) {
        firstChangedIdx = i;
        break;
      }
    }
    
    if (firstChangedIdx === -1) {
      return; // No changes
    }
    
    // We only support rolling back the very last display candle(s).
    // If a historical candle changed (rare), doing a full recompute is safer.
    if (firstChangedIdx < this.lastDisplayCandles.length - 1) {
      this.fullRecompute(displayCandles, baseCandles, timeframeSeconds, options);
      return;
    }
    
    // Incrementally update from firstChangedIdx
    for (let i = firstChangedIdx; i < displayCandles.length; i++) {
      const candle = displayCandles[i];
      
      // If we already processed this candle previously, rollback its contribution
      if (i < this.lastDisplayCandles.length) {
        const oldContrib = this.contributions.get(candle.time);
        if (oldContrib) {
          this.cumPV -= oldContrib.pv;
          this.cumV -= oldContrib.v;
          this.cumPV2 -= oldContrib.pv2;
          
          // Note: Rolling window rollback is complicated. But we only rollback the last open candle, 
          // which hasn't expired out of the rolling window yet anyway.
          // Wait, if it's the last open candle, any base candles added to it are just appended.
          // We can just roll back `baseIndex` by inspecting the rollingWindow.
          if (options.periodMode === 'Rolling') {
            // Remove base candles from the end of rollingWindow that belong to this display candle
            while (this.rollingWindow.length > 0 && this.rollingWindow[this.rollingWindow.length - 1].time >= candle.time) {
               this.rollingWindow.pop();
            }
          }
          
          // Reset baseIndex back to the start of this display candle
          while (this.baseIndex > 0 && baseCandles[this.baseIndex - 1].time >= candle.time) {
             this.baseIndex--;
          }
          
          // We don't rollback currentAnchorTime because the last candle wouldn't change its anchor.
        }
      }
      
      this.series[i] = this.processDisplayCandle(candle, baseCandles, timeframeSeconds, options);
    }
  }

  private processDisplayCandle(
    displayCandle: Candle,
    baseCandles: Candle[],
    timeframeSeconds: number,
    options: VwapCalculateOptions
  ): VwapPoint {
    const displayEndTime = displayCandle.time + timeframeSeconds;
    
    let contribPV = 0;
    let contribV = 0;
    let contribPV2 = 0;

    if (options.periodMode === 'Session') {
      const anchorTime = getVwapAnchorTime(displayCandle.time, options);
      if (anchorTime !== this.currentAnchorTime) {
        // session boundary crossed!
        this.currentAnchorTime = anchorTime;
        this.cumPV = 0; this.cumV = 0; this.cumPV2 = 0;
        this.rollingWindow.length = 0; 
      }
    }

    while (this.baseIndex < baseCandles.length && baseCandles[this.baseIndex].time < displayEndTime) {
      const baseCandle = baseCandles[this.baseIndex];
      const typicalPrice = getTypicalPrice(baseCandle, options.priceSource);
      
      const pv = typicalPrice * baseCandle.volume;
      const v = baseCandle.volume;
      const pv2 = baseCandle.volume * typicalPrice * typicalPrice;

      if (options.periodMode === 'Rolling') {
        this.rollingWindow.push(baseCandle);
        contribPV += pv; contribV += v; contribPV2 += pv2;
        this.cumPV += pv; this.cumV += v; this.cumPV2 += pv2;
      } else {
        if (baseCandle.time >= this.currentAnchorTime) {
          contribPV += pv; contribV += v; contribPV2 += pv2;
          this.cumPV += pv; this.cumV += v; this.cumPV2 += pv2;
        }
      }
      this.baseIndex++;
    }

    if (options.periodMode === 'Rolling') {
      const rollingAnchorTime = displayEndTime - options.rollingDays * 24 * 60 * 60;
      while (this.rollingWindow.length > 0 && this.rollingWindow[0].time < rollingAnchorTime) {
        const expiredCandle = this.rollingWindow.shift()!;
        const tp = getTypicalPrice(expiredCandle, options.priceSource);
        const pv = tp * expiredCandle.volume;
        const v = expiredCandle.volume;
        const pv2 = expiredCandle.volume * tp * tp;
        
        this.cumPV -= pv; this.cumV -= v; this.cumPV2 -= pv2;
        // The expiration affects the global accumulators, but not this candle's specific base-candle contribution
      }
      if (this.cumV < 1e-8) {
        this.cumV = 0; this.cumPV = 0; this.cumPV2 = 0;
      }
    }
    
    // Cache the exact contribution for rollback
    this.contributions.set(displayCandle.time, { pv: contribPV, v: contribV, pv2: contribPV2 });

    let vwapValue = 0;
    let stdDev = 0;

    if (this.cumV > 0) {
      vwapValue = this.cumPV / this.cumV;
      if (options.envelopeMode === 'Standard Deviation') {
        const ex2 = this.cumPV2 / this.cumV;
        const ex = vwapValue;
        const variance = Math.max(0, ex2 - ex * ex);
        stdDev = Math.sqrt(variance);
      }
    }

    const point: VwapPoint = { time: displayCandle.time, value: vwapValue > 0 ? vwapValue : null, band1Up: null, band1Dw: null, band2Up: null, band2Dw: null, band3Up: null, band3Dw: null };
    if (vwapValue > 0) {
      if (options.envelopeMode === 'Standard Deviation') {
        if (options.band1Enabled) { point.band1Up = vwapValue + stdDev * options.band1Value; point.band1Dw = vwapValue - stdDev * options.band1Value; }
        if (options.band2Enabled) { point.band2Up = vwapValue + stdDev * options.band2Value; point.band2Dw = vwapValue - stdDev * options.band2Value; }
        if (options.band3Enabled) { point.band3Up = vwapValue + stdDev * options.band3Value; point.band3Dw = vwapValue - stdDev * options.band3Value; }
      } else if (options.envelopeMode === 'Percentage') {
        if (options.band1Enabled) { point.band1Up = vwapValue * (1 + options.band1Value / 100); point.band1Dw = vwapValue * (1 - options.band1Value / 100); }
        if (options.band2Enabled) { point.band2Up = vwapValue * (1 + options.band2Value / 100); point.band2Dw = vwapValue * (1 - options.band2Value / 100); }
        if (options.band3Enabled) { point.band3Up = vwapValue * (1 + options.band3Value / 100); point.band3Dw = vwapValue * (1 - options.band3Value / 100); }
      }
    }
    
    return point;
  }
}

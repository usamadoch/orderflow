import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { Trade } from '../../types/trade';
import { Candle } from '../../types/candle';
import { normalizePriceToBucket } from '../utils/aggregation';

export class AggregationEngine {
  private footprintMap = new Map<number, FootprintCandle>();
  private bucketSize: number;
  private maxCandles: number;

  constructor(bucketSize: number, maxCandles: number = 500) {
    this.bucketSize = bucketSize;
    this.maxCandles = maxCandles;
  }

  ingestTrade(trade: Trade, currentCandleTime: number) {
    const bucketKey = normalizePriceToBucket(trade.price, this.bucketSize);
    
    let candle = this.footprintMap.get(currentCandleTime);
    if (!candle) {
      candle = {
        time: currentCandleTime,
        open: 0,
        high: -Infinity,
        low: Infinity,
        close: 0,
        volume: 0,
        delta: 0,
        cells: new Map<number, FootprintCell>(),
        isClosed: false
      };
      this.footprintMap.set(currentCandleTime, candle);
    }

    let cell = candle.cells.get(bucketKey);
    if (!cell) {
      cell = { askVol: 0, bidVol: 0 };
      candle.cells.set(bucketKey, cell);
    }

    if (!trade.isBuyerMaker) {
      cell.askVol += trade.quantity;
    } else {
      cell.bidVol += trade.quantity;
    }

    // Recalculate delta
    let totalDelta = 0;
    candle.cells.forEach((c) => {
      totalDelta += (c.askVol - c.bidVol);
    });
    candle.delta = totalDelta;
  }

  ingestCandle(candle: Candle) {
    let fpCandle = this.footprintMap.get(candle.time);
    if (!fpCandle) {
      fpCandle = {
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        delta: 0,
        cells: new Map<number, FootprintCell>(),
        isClosed: candle.isClosed
      };
      this.footprintMap.set(candle.time, fpCandle);
    } else {
      fpCandle.open = candle.open;
      fpCandle.high = candle.high;
      fpCandle.low = candle.low;
      fpCandle.close = candle.close;
      fpCandle.volume = candle.volume;
      fpCandle.isClosed = candle.isClosed;
    }

    if (candle.isClosed) {
      if (this.footprintMap.size > this.maxCandles) {
        // Find oldest keys and delete them
        const keys = Array.from(this.footprintMap.keys()).sort((a, b) => a - b);
        const toDelete = keys.slice(0, keys.length - this.maxCandles);
        for (const key of toDelete) {
          this.footprintMap.delete(key);
        }
      }
    }
  }

  getFootprintCandle(time: number): FootprintCandle | null {
    return this.footprintMap.get(time) || null;
  }

  getAllFootprintCandles(): FootprintCandle[] {
    return Array.from(this.footprintMap.values()).sort((a, b) => a.time - b.time);
  }

  reset(bucketSize?: number) {
    this.footprintMap.clear();
    if (bucketSize !== undefined) {
      this.bucketSize = bucketSize;
    }
  }
}

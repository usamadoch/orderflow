import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { normalizePriceToBucket } from './aggregation';

export interface ProfileRow {
  price:    number;   // normalized bucket price (same bucketing as footprint)
  totalVol: number;   // bid + ask volume combined
  bidVol:   number;   // sell aggression volume
  askVol:   number;   // buy aggression volume
  hasFP:    boolean;  // true if at least one source candle had footprint data
}

export interface VolumeProfile {
  rows:     ProfileRow[];   // sorted low → high by price
  poc:      number;         // price of highest volume bucket
  vaHigh:   number;         // top of 70% value area
  vaLow:    number;         // bottom of 70% value area
  maxVol:   number;         // highest single row volume (for bar width scaling)
  totalVol: number;         // sum of all row volumes
}

/**
 * Build a volume profile from visible candles + aggregation engine data.
 * Falls back to distributing OHLCV volume evenly across price range when
 * footprint data is unavailable.
 */
export function buildProfile(
  visibleCandles: Candle[],
  engine: AggregationEngine,
  bucketSize: number
): VolumeProfile | null {
  if (visibleCandles.length === 0 || bucketSize <= 0) return null;

  const map = new Map<number, ProfileRow>();

  const getOrCreate = (price: number, hasFP: boolean): ProfileRow => {
    let row = map.get(price);
    if (!row) {
      row = { price, totalVol: 0, bidVol: 0, askVol: 0, hasFP };
      map.set(price, row);
    }
    // If any contributing candle has FP data, mark the row
    if (hasFP) row.hasFP = true;
    return row;
  };

  for (const candle of visibleCandles) {
    const fpCandle = engine.getFootprintCandle(candle.time);

    if (fpCandle && fpCandle.cells.size > 0) {
      // Footprint data available — use exact bid/ask volumes
      fpCandle.cells.forEach((cell, bucketPrice) => {
        const row = getOrCreate(bucketPrice, true);
        row.bidVol += cell.bidVol;
        row.askVol += cell.askVol;
        row.totalVol += cell.bidVol + cell.askVol;
      });
    } else {
      // Fallback — distribute candle volume evenly across price range
      const high = candle.high;
      const low = candle.low;
      const vol = candle.volume;
      if (vol <= 0) continue;

      const bucketLow = normalizePriceToBucket(low, bucketSize);
      const bucketHigh = normalizePriceToBucket(high, bucketSize);
      const numBuckets = Math.max(1, Math.round((bucketHigh - bucketLow) / bucketSize) + 1);
      const volPerBucket = vol / numBuckets;

      for (let p = bucketLow; p <= bucketHigh; p += bucketSize) {
        const rounded = Math.round(p * 1e8) / 1e8; // avoid float drift
        const row = getOrCreate(rounded, false);
        row.totalVol += volPerBucket;
        // No bid/ask split in fallback — split evenly for bar rendering
        row.bidVol += volPerBucket / 2;
        row.askVol += volPerBucket / 2;
      }
    }
  }

  if (map.size === 0) return null;

  // Convert to sorted array (low → high)
  const rows = Array.from(map.values()).sort((a, b) => a.price - b.price);

  let maxVol = 0;
  let totalVol = 0;
  for (const row of rows) {
    if (row.totalVol > maxVol) maxVol = row.totalVol;
    totalVol += row.totalVol;
  }

  const poc = findPOC(rows);
  const { vaHigh, vaLow } = findValueArea(rows, totalVol);

  return { rows, poc, vaHigh, vaLow, maxVol, totalVol };
}

/**
 * Find the Point of Control — price with highest total volume.
 */
export function findPOC(rows: ProfileRow[]): number {
  let maxVol = -1;
  let pocPrice = rows[0]?.price ?? 0;

  for (const row of rows) {
    if (row.totalVol > maxVol) {
      maxVol = row.totalVol;
      pocPrice = row.price;
    }
  }

  return pocPrice;
}

/**
 * Find the Value Area — the price range containing `targetPercent` of total volume.
 * Expands outward from POC, always adding the higher-volume side first.
 */
export function findValueArea(
  rows: ProfileRow[],
  totalVol: number,
  targetPercent: number = 0.70
): { vaHigh: number; vaLow: number } {
  if (rows.length === 0) return { vaHigh: 0, vaLow: 0 };

  // Find POC index
  let pocIdx = 0;
  let maxVol = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].totalVol > maxVol) {
      maxVol = rows[i].totalVol;
      pocIdx = i;
    }
  }

  const targetVol = totalVol * targetPercent;
  let runningVol = rows[pocIdx].totalVol;
  let lo = pocIdx;
  let hi = pocIdx;

  while (runningVol < targetVol && (lo > 0 || hi < rows.length - 1)) {
    const loVol = lo > 0 ? rows[lo - 1].totalVol : -1;
    const hiVol = hi < rows.length - 1 ? rows[hi + 1].totalVol : -1;

    if (hiVol >= loVol) {
      hi++;
      runningVol += rows[hi].totalVol;
    } else {
      lo--;
      runningVol += rows[lo].totalVol;
    }
  }

  return {
    vaHigh: rows[hi].price,
    vaLow: rows[lo].price,
  };
}

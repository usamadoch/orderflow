import { LiquidityZone } from '../../types/liquidity';
import { normalizePriceToBucket } from '../utils/aggregation';

export interface LiquiditySettings {
  liquidityBucketSize: number;         // default 50 ($)
  minimumLiquidityThreshold: number;   // default 5 (BTC)
  liquidityRange: number;              // default 10 (percent from price)
}

/**
 * Aggregates raw orderbook levels into meaningful LiquidityZone objects.
 * 
 * Steps:
 *  1. Define aggregation bucket size
 *  2. Bucket both sides within range
 *  3. Filter by minimum quantity threshold
 *  4. Calculate intensity (0–1)
 *  5. Return sorted zones
 */
export function aggregateOrderbook(
  bids: Map<number, number>,
  asks: Map<number, number>,
  currentPrice: number,
  settings: LiquiditySettings
): LiquidityZone[] {
  const { liquidityBucketSize, minimumLiquidityThreshold, liquidityRange } = settings;

  // Range boundaries
  const rangeFraction = liquidityRange / 100;
  const bidLower = currentPrice * (1 - rangeFraction);    // e.g. 90% of price
  const bidUpper = currentPrice * 0.98;                    // exclude levels too close (within 2%)
  const askLower = currentPrice * 1.02;                    // exclude levels too close (within 2%)
  const askUpper = currentPrice * (1 + rangeFraction);    // e.g. 110% of price

  // Bucket accumulator: bucketPrice -> { totalQty, levelCount }
  const bidBuckets = new Map<number, { totalQty: number; levelCount: number }>();
  const askBuckets = new Map<number, { totalQty: number; levelCount: number }>();

  // Bucket bids
  for (const [price, qty] of bids) {
    if (price < bidLower || price > bidUpper) continue;
    const bucket = normalizePriceToBucket(price, liquidityBucketSize);
    const existing = bidBuckets.get(bucket);
    if (existing) {
      existing.totalQty += qty;
      existing.levelCount += 1;
    } else {
      bidBuckets.set(bucket, { totalQty: qty, levelCount: 1 });
    }
  }

  // Bucket asks
  for (const [price, qty] of asks) {
    if (price < askLower || price > askUpper) continue;
    const bucket = normalizePriceToBucket(price, liquidityBucketSize);
    const existing = askBuckets.get(bucket);
    if (existing) {
      existing.totalQty += qty;
      existing.levelCount += 1;
    } else {
      askBuckets.set(bucket, { totalQty: qty, levelCount: 1 });
    }
  }

  // Build zones (pre-filter)
  const zones: LiquidityZone[] = [];

  for (const [bucketPrice, data] of bidBuckets) {
    if (data.totalQty < minimumLiquidityThreshold) continue;
    zones.push({
      price: bucketPrice + liquidityBucketSize / 2, // center of bucket
      totalQty: data.totalQty,
      side: 'bid',
      zoneSize: liquidityBucketSize,
      intensity: 0, // calculated below
      levelCount: data.levelCount,
    });
  }

  for (const [bucketPrice, data] of askBuckets) {
    if (data.totalQty < minimumLiquidityThreshold) continue;
    zones.push({
      price: bucketPrice + liquidityBucketSize / 2, // center of bucket
      totalQty: data.totalQty,
      side: 'ask',
      zoneSize: liquidityBucketSize,
      intensity: 0, // calculated below
      levelCount: data.levelCount,
    });
  }

  // Calculate intensity
  if (zones.length === 0) return zones;

  const maxQty = Math.max(...zones.map(z => z.totalQty));
  for (const zone of zones) {
    zone.intensity = zone.totalQty / maxQty;
  }

  // Sort: asks ascending, bids descending (natural for rendering)
  zones.sort((a, b) => a.price - b.price);

  return zones;
}

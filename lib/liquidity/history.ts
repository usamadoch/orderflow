import { LiquiditySnapshot, SnapshotZone, LiquidityHistory } from '../../types/liquidity';
import { OrderbookManager } from './orderbook';
import { normalizePriceToBucket } from '../utils/aggregation';

export class LiquidityHistoryManager {
  private history: LiquidityHistory = { snapshots: [], maxSnapshots: 200 };
  private bucketSize: number = 50;

  constructor(bucketSize: number = 50, maxSnapshots: number = 200) {
    this.bucketSize = bucketSize;
    this.history.maxSnapshots = maxSnapshots;
  }

  setBucketSize(size: number) {
    this.bucketSize = size;
  }

  setMaxSnapshots(max: number) {
    this.history.maxSnapshots = max;
    this.trim();
  }

  private trim() {
    if (this.history.snapshots.length > this.history.maxSnapshots) {
      this.history.snapshots = this.history.snapshots.slice(-this.history.maxSnapshots);
    }
  }

  captureSnapshot(candleTime: number, orderbook: OrderbookManager) {
    if (!orderbook.isReady()) return;

    const bids = orderbook.getTopBids(150);
    const asks = orderbook.getTopAsks(150);

    const zones: SnapshotZone[] = [];

    // Apply bucketing, min threshold 1 BTC
    const bidBuckets = new Map<number, number>();
    for (const [price, qty] of bids) {
      if (qty < 1) continue; 
      const bucket = normalizePriceToBucket(price, this.bucketSize);
      bidBuckets.set(bucket, (bidBuckets.get(bucket) || 0) + qty);
    }

    const askBuckets = new Map<number, number>();
    for (const [price, qty] of asks) {
      if (qty < 1) continue;
      const bucket = normalizePriceToBucket(price, this.bucketSize);
      askBuckets.set(bucket, (askBuckets.get(bucket) || 0) + qty);
    }

    for (const [bucketPrice, qty] of bidBuckets) {
      zones.push({
        price: bucketPrice + this.bucketSize / 2,
        qty,
        side: 'bid'
      });
    }

    for (const [bucketPrice, qty] of askBuckets) {
      zones.push({
        price: bucketPrice + this.bucketSize / 2,
        qty,
        side: 'ask'
      });
    }

    this.history.snapshots.push({
      timestamp: Date.now(),
      candleTime,
      zones
    });

    this.trim();
  }

  getHistory(): LiquiditySnapshot[] {
    return this.history.snapshots;
  }

  getSnapshotForCandle(candleTime: number): LiquiditySnapshot | null {
    if (this.history.snapshots.length === 0) return null;
    
    // Find closest match
    let closest = this.history.snapshots[0];
    let minDiff = Math.abs(closest.candleTime - candleTime);

    for (let i = 1; i < this.history.snapshots.length; i++) {
      const diff = Math.abs(this.history.snapshots[i].candleTime - candleTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = this.history.snapshots[i];
      }
    }
    return closest;
  }

  getPriceHistory(price: number, side: 'bid' | 'ask'): number[] {
    return this.history.snapshots.map(snapshot => {
      const zone = snapshot.zones.find(z => z.price === price && z.side === side);
      return zone ? zone.qty : 0;
    });
  }

  reset() {
    this.history.snapshots = [];
  }
}

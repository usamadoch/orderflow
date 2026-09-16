/**
 * OrderbookHeatmapEngine — maintains a rolling sparse time-price grid
 * of resting liquidity over time with strict memory eviction.
 */

import { OrderbookManager } from './orderbook';

export interface HeatmapCell {
  price: number;
  bidSize: number;
  askSize: number;
  totalSize: number;
}

export interface HeatmapSlot {
  timeSlot: number; // timestamp in ms (quantized to sampleIntervalMs)
  cells: Map<number, HeatmapCell>; // priceBucket -> HeatmapCell
  bestBid: number | null; // best bid price at sample time (for corridor line)
  bestAsk: number | null; // best ask price at sample time (for corridor line)
}

export interface HeatmapEngineConfig {
  priceBucketSize: number;
  sampleIntervalMs: number;
  retentionWindowMs: number;
}

export class OrderbookHeatmapEngine {
  private config: HeatmapEngineConfig;
  private slots: Map<number, HeatmapSlot> = new Map(); // timeSlot -> HeatmapSlot
  private sortedTimeSlots: number[] = []; // Ascending order
  private cachedP95: number = 1;
  private lastP95CalcTime: number = 0;

  constructor(config: Partial<HeatmapEngineConfig> = {}) {
    this.config = {
      priceBucketSize: config.priceBucketSize || 1,
      sampleIntervalMs: config.sampleIntervalMs || 200,
      retentionWindowMs: config.retentionWindowMs || 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  updateConfig(newConfig: Partial<HeatmapEngineConfig>): void {
    if (newConfig.priceBucketSize && newConfig.priceBucketSize > 0) {
      this.config.priceBucketSize = newConfig.priceBucketSize;
    }
    if (newConfig.sampleIntervalMs && newConfig.sampleIntervalMs > 0) {
      this.config.sampleIntervalMs = newConfig.sampleIntervalMs;
    }
    if (newConfig.retentionWindowMs && newConfig.retentionWindowMs > 0) {
      this.config.retentionWindowMs = newConfig.retentionWindowMs;
    }
  }

  getConfig(): HeatmapEngineConfig {
    return { ...this.config };
  }

  /**
   * Sample current orderbook into a discrete time slot.
   * Returns the new slot's compressed cell array for worker-to-client messaging:
   * Array of [price, bidSize, askSize].
   */
  sample(orderbook: OrderbookManager, nowMs: number = Date.now()): { timeSlot: number; cells: [number, number, number][]; bestBid: number | null; bestAsk: number | null } | null {
    if (!orderbook.isReady()) return null;

    const interval = this.config.sampleIntervalMs;
    const timeSlot = Math.floor(nowMs / interval) * interval;

    // Do not re-sample the same time slot if already recorded
    if (this.slots.has(timeSlot)) {
      return null;
    }

    const bucketSize = this.config.priceBucketSize;
    const cellMap = new Map<number, HeatmapCell>();
    const cellsArray: [number, number, number][] = [];

    // Aggregate bids
    for (const [price, qty] of orderbook.getAllBids()) {
      if (qty <= 0) continue;
      const bucket = Math.floor(price / bucketSize) * bucketSize;
      let cell = cellMap.get(bucket);
      if (!cell) {
        cell = { price: bucket, bidSize: 0, askSize: 0, totalSize: 0 };
        cellMap.set(bucket, cell);
      }
      cell.bidSize += qty;
      cell.totalSize += qty;
    }

    // Aggregate asks
    for (const [price, qty] of orderbook.getAllAsks()) {
      if (qty <= 0) continue;
      const bucket = Math.floor(price / bucketSize) * bucketSize;
      let cell = cellMap.get(bucket);
      if (!cell) {
        cell = { price: bucket, bidSize: 0, askSize: 0, totalSize: 0 };
        cellMap.set(bucket, cell);
      }
      cell.askSize += qty;
      cell.totalSize += qty;
    }

    for (const cell of cellMap.values()) {
      cellsArray.push([cell.price, cell.bidSize, cell.askSize]);
    }

    const bestBid = orderbook.getBestBid();
    const bestAsk = orderbook.getBestAsk();

    const newSlot: HeatmapSlot = {
      timeSlot,
      cells: cellMap,
      bestBid,
      bestAsk,
    };

    this.slots.set(timeSlot, newSlot);
    this.sortedTimeSlots.push(timeSlot);

    // Prune expired slots
    this.prune(nowMs);

    return {
      timeSlot,
      cells: cellsArray,
      bestBid,
      bestAsk,
    };
  }

  /**
   * Ingest a slice received from worker into client-side engine (if maintaining local cache).
   */
  ingestSlice(
    timeSlot: number,
    cells: [number, number, number][],
    bestBid?: number | null,
    bestAsk?: number | null,
  ): void {
    if (this.slots.has(timeSlot)) return;

    const cellMap = new Map<number, HeatmapCell>();
    for (const [price, bidSize, askSize] of cells) {
      cellMap.set(price, {
        price,
        bidSize,
        askSize,
        totalSize: bidSize + askSize,
      });
    }

    this.slots.set(timeSlot, {
      timeSlot,
      cells: cellMap,
      bestBid: bestBid ?? null,
      bestAsk: bestAsk ?? null,
    });

    const len = this.sortedTimeSlots.length;
    if (len === 0 || timeSlot >= this.sortedTimeSlots[len - 1]) {
      this.sortedTimeSlots.push(timeSlot);
    } else {
      let low = 0;
      let high = len - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (this.sortedTimeSlots[mid] < timeSlot) low = mid + 1;
        else high = mid - 1;
      }
      this.sortedTimeSlots.splice(low, 0, timeSlot);
    }

    this.prune(Date.now());
  }

  /**
   * Evict slots older than retention window.
   * Explicitly deletes Map entries to guarantee memory deallocation.
   */
  prune(nowMs: number = Date.now()): number {
    const cutoff = nowMs - this.config.retentionWindowMs;
    let evicted = 0;

    while (this.sortedTimeSlots.length > 0 && this.sortedTimeSlots[0] < cutoff) {
      const oldest = this.sortedTimeSlots.shift()!;
      const slot = this.slots.get(oldest);
      if (slot) {
        slot.cells.clear();
        this.slots.delete(oldest);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Get visible grid cells and compute 95th percentile clamp.
   */
  getVisibleGrid(
    minTimeMs: number,
    maxTimeMs: number,
    minPrice: number,
    maxPrice: number,
    clampPercentile: number = 95
  ): {
    slots: HeatmapSlot[];
    p95Clamp: number;
  } {
    const visibleSlots: HeatmapSlot[] = [];
    const now = Date.now();
    const shouldRecomputeP95 = now - this.lastP95CalcTime >= 1000 || this.cachedP95 <= 0;
    const sizes: number[] = [];

    // Find slots within time range
    for (let i = 0; i < this.sortedTimeSlots.length; i++) {
      const timeSlot = this.sortedTimeSlots[i];
      if (timeSlot < minTimeMs) continue;
      if (timeSlot > maxTimeMs) break;

      const slot = this.slots.get(timeSlot);
      if (!slot) continue;

      visibleSlots.push(slot);

      // Collect cell sizes across visible range for 95th percentile clamp
      if (shouldRecomputeP95) {
        for (const cell of slot.cells.values()) {
          if (cell.price >= minPrice && cell.price <= maxPrice && cell.totalSize > 0) {
            sizes.push(cell.totalSize);
          }
        }
      }
    }

    // Recalculate 95th percentile periodically (once per second max)
    if (shouldRecomputeP95 && sizes.length > 0) {
      sizes.sort((a, b) => a - b);
      const idx = Math.min(sizes.length - 1, Math.floor(sizes.length * (clampPercentile / 100)));
      this.cachedP95 = Math.max(0.0001, sizes[idx]);
      this.lastP95CalcTime = now;
    }

    return {
      slots: visibleSlots,
      p95Clamp: this.cachedP95,
    };
  }

  /**
   * Returns total count of retained slots.
   */
  getSlotCount(): number {
    return this.slots.size;
  }

  /**
   * Clear all stored slots.
   */
  clear(): void {
    for (const slot of this.slots.values()) {
      slot.cells.clear();
    }
    this.slots.clear();
    this.sortedTimeSlots = [];
    this.cachedP95 = 1;
    this.lastP95CalcTime = 0;
  }
}

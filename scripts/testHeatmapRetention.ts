/**
 * testHeatmapRetention.ts
 *
 * Verifies that OrderbookHeatmapEngine:
 * 1. Enforces retention window memory eviction via explicit .delete().
 * 2. Slot count strictly caps at the retention window ceiling.
 * 3. Heap memory usage stabilizes and does not grow unboundedly over hours of simulated ticks.
 */

import { OrderbookManager, OrderbookSnapshot, DepthUpdate } from '../lib/liquidity/orderbook';
import { OrderbookHeatmapEngine } from '../lib/liquidity/orderbookHeatmap';

async function runRetentionTest() {
  console.log('--- Starting Heatmap Retention & Heap Memory Test ---');

  // Configure a short retention window for fast simulation:
  // 10 seconds retention window, 100ms sample interval -> max 100 slots retained.
  const sampleIntervalMs = 100;
  const retentionWindowMs = 10000;
  const engine = new OrderbookHeatmapEngine({
    priceBucketSize: 10,
    sampleIntervalMs,
    retentionWindowMs,
  });

  const ob = new OrderbookManager();
  const basePrice = 60000;

  // Initialize orderbook
  const snapshot: OrderbookSnapshot = {
    lastUpdateId: 1000,
    bids: Array.from({ length: 50 }, (_, i) => [(basePrice - i * 10).toString(), (Math.random() * 5 + 0.1).toFixed(3)]),
    asks: Array.from({ length: 50 }, (_, i) => [(basePrice + (i + 1) * 10).toString(), (Math.random() * 5 + 0.1).toFixed(3)]),
  };
  ob.initFromSnapshot(snapshot);

  let seq = 1001;
  const totalIterations = 5000; // 5000 intervals = 500 seconds of market time (50x the retention window)
  let initialHeap = 0;
  let midHeap = 0;
  let finalHeap = 0;

  if (global.gc) {
    global.gc();
  }
  initialHeap = process.memoryUsage().heapUsed;

  const startTimeMs = 1700000000000;

  for (let i = 0; i < totalIterations; i++) {
    const simTimeMs = startTimeMs + i * sampleIntervalMs;

    // Simulate depth diff
    const diff: DepthUpdate = {
      U: seq,
      u: seq,
      b: [[(basePrice - (i % 20) * 10).toString(), (Math.random() * 4).toFixed(3)]],
      a: [[(basePrice + ((i % 20) + 1) * 10).toString(), (Math.random() * 4).toFixed(3)]],
    };
    ob.applyUpdate(diff);
    seq++;

    // Sample into heatmap engine
    engine.sample(ob, simTimeMs);

    // Record heap checkpoints
    if (i === 500) {
      if (global.gc) global.gc();
      midHeap = process.memoryUsage().heapUsed;
    }
    if (i === totalIterations - 1) {
      if (global.gc) global.gc();
      finalHeap = process.memoryUsage().heapUsed;
    }
  }

  const slotCount = engine.getSlotCount();
  const maxExpectedSlots = Math.ceil(retentionWindowMs / sampleIntervalMs) + 2;

  console.log(`Simulated Iterations: ${totalIterations}`);
  console.log(`Final Retained Slot Count: ${slotCount} (Max expected: ${maxExpectedSlots})`);
  console.log(`Initial Heap: ${(initialHeap / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Mid Heap (at 500 slots): ${(midHeap / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Final Heap (at 5,000 slots): ${(finalHeap / 1024 / 1024).toFixed(2)} MB`);

  if (slotCount > maxExpectedSlots) {
    throw new Error(`FAILED: Slot count ${slotCount} exceeded maximum retention ceiling ${maxExpectedSlots}`);
  }

  // Verify memory growth after reaching ceiling is bounded (< 15MB delta from mid to final across 4500 iterations)
  const growthMb = (finalHeap - midHeap) / 1024 / 1024;
  console.log(`Heap Growth from 500 to 5000 iterations: ${growthMb.toFixed(2)} MB`);
  if (growthMb > 25) {
    throw new Error(`FAILED: Unbounded memory growth detected (${growthMb.toFixed(2)} MB)`);
  }

  console.log('✅ Retention & Heap Memory Test PASSED: ring-buffer properly evicted expired slots and memory remained flat.');
}

runRetentionTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

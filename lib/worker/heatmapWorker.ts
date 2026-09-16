/**
 * heatmapWorker.ts — Web Worker script running off the main thread.
 *
 * Responsibilities:
 * - Instantiates and executes OrderbookManager sync & rolling sequence checks off-thread.
 * - Parses incoming raw WS depth updates (string) without blocking main thread.
 * - Snapshots orderbook into OrderbookHeatmapEngine at sampleIntervalMs (200ms).
 * - Enforces sparse ring-buffer memory retention pruning.
 * - Posts aggregated time slices to main thread for canvas paint.
 * - Detects sequence gaps and triggers clean resync requests to main thread.
 */

import { OrderbookManager, OrderbookSnapshot, DepthUpdate } from '../liquidity/orderbook';
import { OrderbookHeatmapEngine, HeatmapEngineConfig } from '../liquidity/orderbookHeatmap';

export type HeatmapWorkerRequest =
  | { type: 'INIT'; payload: Partial<HeatmapEngineConfig> }
  | { type: 'SNAPSHOT'; payload: OrderbookSnapshot }
  | { type: 'RAW_DIFF'; payload: string | DepthUpdate }
  | { type: 'SET_CONFIG'; payload: Partial<HeatmapEngineConfig> }
  | { type: 'SIMULATE_GAP' }
  | { type: 'RESET' };

export type HeatmapWorkerResponse =
  | { type: 'HEATMAP_SLICE'; payload: { timeSlot: number; cells: [number, number, number][]; bestBid: number | null; bestAsk: number | null } }
  | { type: 'RESYNC_REQUEST'; payload: { reason: string; resyncCount: number } }
  | { type: 'STATUS'; payload: { isReady: boolean; rollingU: number; slotCount: number } };

const orderbook = new OrderbookManager();
const engine = new OrderbookHeatmapEngine();
let sampleTimer: ReturnType<typeof setInterval> | null = null;

function restartSampleTimer(intervalMs: number) {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
  sampleTimer = setInterval(() => {
    if (!orderbook.isReady()) return;

    const slice = engine.sample(orderbook, Date.now());
    if (slice) {
      self.postMessage({
        type: 'HEATMAP_SLICE',
        payload: slice,
      } as HeatmapWorkerResponse);
    }
  }, Math.max(50, intervalMs));
}

// Hook orderbook gap / resync notification
orderbook.onResync = (reason: string) => {
  self.postMessage({
    type: 'RESYNC_REQUEST',
    payload: {
      reason,
      resyncCount: orderbook.getResyncCount(),
    },
  } as HeatmapWorkerResponse);
};

self.addEventListener('message', (e: MessageEvent<HeatmapWorkerRequest>) => {
  const req = e.data;

  try {
    if (req.type === 'INIT') {
      engine.updateConfig(req.payload);
      restartSampleTimer(engine.getConfig().sampleIntervalMs);
    } else if (req.type === 'SNAPSHOT') {
      orderbook.initFromSnapshot(req.payload);
    } else if (req.type === 'RAW_DIFF') {
      orderbook.applyUpdate(req.payload);
    } else if (req.type === 'SET_CONFIG') {
      engine.updateConfig(req.payload);
      if (req.payload.sampleIntervalMs) {
        restartSampleTimer(req.payload.sampleIntervalMs);
      }
    } else if (req.type === 'SIMULATE_GAP') {
      orderbook.simulateGap();
    } else if (req.type === 'RESET') {
      orderbook.reset();
      engine.clear();
    }
  } catch (err) {
    console.error('[HeatmapWorker] Error handling message:', err);
  }
});

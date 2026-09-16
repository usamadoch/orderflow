/**
 * HeatmapWorkerClient — Main-thread client bridge coordinating with heatmapWorker.
 */

import { OrderbookSnapshot, DepthUpdate } from '../liquidity/orderbook';
import { OrderbookHeatmapEngine, HeatmapEngineConfig } from '../liquidity/orderbookHeatmap';
import { HeatmapWorkerRequest, HeatmapWorkerResponse } from './heatmapWorker';

export class HeatmapWorkerClient {
  private worker: Worker | null = null;
  private localEngine: OrderbookHeatmapEngine;

  public onHeatmapSlice?: (slice: { timeSlot: number; cells: [number, number, number][]; bestBid: number | null; bestAsk: number | null }) => void;
  public onResyncRequest?: (reason: string, resyncCount: number) => void;

  constructor(config: Partial<HeatmapEngineConfig> = {}) {
    this.localEngine = new OrderbookHeatmapEngine(config);
  }

  private getWorker(): Worker {
    if (!this.worker) {
      if (typeof window === 'undefined') {
        throw new Error('Worker cannot be instantiated during SSR');
      }
      this.worker = new Worker(new URL('./heatmapWorker.ts', import.meta.url));
      this.worker.addEventListener('message', this.handleMessage.bind(this));
      this.worker.addEventListener('error', (err) => {
        console.error('[HeatmapWorkerClient] Worker error:', err);
      });
    }
    return this.worker;
  }

  private handleMessage(event: MessageEvent<HeatmapWorkerResponse>) {
    const { type, payload } = event.data;

    if (type === 'HEATMAP_SLICE') {
      this.localEngine.ingestSlice(payload.timeSlot, payload.cells, payload.bestBid, payload.bestAsk);
      this.onHeatmapSlice?.(payload);
    } else if (type === 'RESYNC_REQUEST') {
      this.onResyncRequest?.(payload.reason, payload.resyncCount);
    }
  }

  init(config: Partial<HeatmapEngineConfig> = {}) {
    if (typeof window === 'undefined') return;
    this.localEngine.updateConfig(config);
    this.getWorker().postMessage({
      type: 'INIT',
      payload: config,
    } as HeatmapWorkerRequest);
  }

  postSnapshot(snapshot: OrderbookSnapshot) {
    if (typeof window === 'undefined') return;
    this.getWorker().postMessage({
      type: 'SNAPSHOT',
      payload: snapshot,
    } as HeatmapWorkerRequest);
  }

  postRawDiff(raw: string | DepthUpdate) {
    if (typeof window === 'undefined') return;
    this.getWorker().postMessage({
      type: 'RAW_DIFF',
      payload: raw,
    } as HeatmapWorkerRequest);
  }

  setConfig(config: Partial<HeatmapEngineConfig>) {
    if (typeof window === 'undefined') return;
    this.localEngine.updateConfig(config);
    this.getWorker().postMessage({
      type: 'SET_CONFIG',
      payload: config,
    } as HeatmapWorkerRequest);
  }

  simulateGap() {
    if (typeof window === 'undefined') return;
    this.getWorker().postMessage({
      type: 'SIMULATE_GAP',
    } as HeatmapWorkerRequest);
  }

  reset() {
    if (typeof window === 'undefined') return;
    this.localEngine.clear();
    this.getWorker().postMessage({
      type: 'RESET',
    } as HeatmapWorkerRequest);
  }

  getLocalEngine(): OrderbookHeatmapEngine {
    return this.localEngine;
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.localEngine.clear();
  }
}

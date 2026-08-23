import { Trade } from '../../types/trade';
import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { FineProfileRow } from '../../types/volumeProfile';
import { AggregationWorkerRequest, AggregationWorkerResponse } from './aggregationWorker';

export class AggregationWorkerClient {
  private worker: Worker | null = null;
  
  public onFootprintUpdate?: (footprints: FootprintCandle[]) => void;
  public onProfileUpdate?: (rows: FineProfileRow[]) => void;

  private getWorker(): Worker {
    if (!this.worker) {
      if (typeof window === 'undefined') {
        throw new Error('Worker cannot be instantiated during SSR');
      }
      this.worker = new Worker(new URL('./aggregationWorker.ts', import.meta.url));
      this.worker.addEventListener('message', this.handleMessage.bind(this));
      this.worker.addEventListener('error', (err) => {
        console.error('[AggregationWorkerClient] Worker error:', err);
      });
    }
    return this.worker;
  }

  private handleMessage(event: MessageEvent<AggregationWorkerResponse>) {
    const { type, payload } = event.data;

    if (type === 'FOOTPRINT_UPDATE') {
      this.onFootprintUpdate?.(payload.footprints);
    } else if (type === 'PROFILE_UPDATE') {
      this.onProfileUpdate?.(payload.rows);
    }
  }

  init(bucketSize: number, maxCandles?: number) {
    if (typeof window === 'undefined') return;
    this.getWorker().postMessage({ type: 'INIT', payload: { bucketSize, maxCandles } } as AggregationWorkerRequest);
  }

  ingestTradeBatch(trades: Trade[], currentCandleTime: number) {
    if (typeof window === 'undefined' || trades.length === 0) return;
    this.getWorker().postMessage({ type: 'INGEST_TRADE_BATCH', payload: { trades, currentCandleTime } } as AggregationWorkerRequest);
  }

  hydrateFootprints(time: number, cellsMap: Map<number, FootprintCell>) {
    if (typeof window === 'undefined') return;
    const cells = Array.from(cellsMap.entries());
    this.getWorker().postMessage({ type: 'HYDRATE_FOOTPRINTS', payload: { time, cells } } as AggregationWorkerRequest);
  }

  hydrateProfileRows(rows: FineProfileRow[]) {
    if (typeof window === 'undefined' || rows.length === 0) return;
    this.getWorker().postMessage({ type: 'HYDRATE_PROFILE_ROWS', payload: { rows } } as AggregationWorkerRequest);
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Export singleton instance per panel, or we can use one globally and pass panelId if needed.
// Wait, volumeProfileEngine is panel-local but baseCache is shared.
// For now, let's just make it a simple class and let FeedProvider instantiate it, because FeedProvider manages the socket.

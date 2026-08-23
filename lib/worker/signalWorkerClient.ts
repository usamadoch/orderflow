import type { 
  ComputeSignalsRequest, 
  ScoreLiveRequest, 
  ComputeSignalsResponse, 
  ScoreLiveResponse 
} from './signalWorker';

export class SignalWorkerClient {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string, { resolve: (val: unknown) => void, reject: (err: unknown) => void }>();

  private getWorker(): Worker {
    if (!this.worker) {
      if (typeof window === 'undefined') {
        throw new Error('Worker cannot be instantiated during SSR');
      }
      this.worker = new Worker(new URL('./signalWorker.ts', import.meta.url));
      this.worker.addEventListener('message', this.handleMessage.bind(this));
      this.worker.addEventListener('error', (err) => {
        console.error('[SignalWorkerClient] Worker error:', err);
      });
    }
    return this.worker;
  }

  private handleMessage(event: MessageEvent) {
    const { type, id, payload, error } = event.data;
    const request = this.pendingRequests.get(id);
    
    if (request) {
      this.pendingRequests.delete(id);
      if (type === 'ERROR') {
        request.reject(new Error(error));
      } else {
        request.resolve(payload);
      }
    }
  }

  async computeSignals(payload: ComputeSignalsRequest['payload']): Promise<ComputeSignalsResponse['payload']> {
    if (typeof window === 'undefined') return { absorptionMap: new Map(), exhaustionMap: new Map(), icebergLevels: [], liquidityVacuumZones: [] };
    const id = `req_${this.messageId++}`;
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.pendingRequests.set(id, { resolve: resolve as any, reject });
      this.getWorker().postMessage({ type: 'COMPUTE_SIGNALS', id, payload } as ComputeSignalsRequest);
    });
  }

  async scoreLive(payload: ScoreLiveRequest['payload']): Promise<ScoreLiveResponse['payload']> {
    if (typeof window === 'undefined') return { absorptionMap: payload.absorptionMap, exhaustionMap: payload.exhaustionMap, liquidityVacuumZones: [] };
    const id = `req_${this.messageId++}`;
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.pendingRequests.set(id, { resolve: resolve as any, reject });
      this.getWorker().postMessage({ type: 'SCORE_LIVE', id, payload } as ScoreLiveRequest);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const req of this.pendingRequests.values()) {
      req.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance for the app
export const signalWorkerClient = new SignalWorkerClient();

import type { 
  ComputeSignalsRequest, 
  ScoreLiveRequest, 
  ComputeSignalsResponse, 
  ScoreLiveResponse 
} from './signalWorker';

export class SignalWorkerClient {
  private worker: Worker;
  private messageId = 0;
  private pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./signalWorker.ts', import.meta.url));
    this.worker.addEventListener('message', this.handleMessage.bind(this));
    this.worker.addEventListener('error', (err) => {
      console.error('[SignalWorkerClient] Worker error:', err);
    });
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
    const id = `req_${this.messageId++}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'COMPUTE_SIGNALS', id, payload } as ComputeSignalsRequest);
    });
  }

  async scoreLive(payload: ScoreLiveRequest['payload']): Promise<ScoreLiveResponse['payload']> {
    const id = `req_${this.messageId++}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'SCORE_LIVE', id, payload } as ScoreLiveRequest);
    });
  }

  terminate() {
    this.worker.terminate();
    for (const req of this.pendingRequests.values()) {
      req.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance for the app
export const signalWorkerClient = new SignalWorkerClient();

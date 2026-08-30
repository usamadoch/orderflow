import { FeedAdapter } from './adapter';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { ConnectionState } from '../../types/feed';
import { OrderbookSnapshot, DepthUpdate, OrderbookManager } from '../liquidity/orderbook';

export class BinanceFuturesAdapter implements FeedAdapter {
  private ws: WebSocket | null = null;
  private currentPair: string | null = null;
  private currentTimeframe: string | null = null;
  private candleCb: ((candle: Candle) => void) | null = null;
  private tradeCb: ((trade: Trade) => void) | null = null;
  private reconnectAttempts: number = 0;
  private shouldReconnect: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private restBase = 'https://fapi.binance.com/fapi/v1';

  // Orderbook — separate WebSocket
  private obWs: WebSocket | null = null;
  private obCb: ((update: DepthUpdate) => void) | null = null;
  private obReconnectAttempts: number = 0;
  private obShouldReconnect: boolean = false;
  private obReconnectTimer: NodeJS.Timeout | null = null;
  private obPair: string | null = null;
  private obState: ConnectionState = 'DISCONNECTED';
  private obStateListeners = new Set<(state: ConnectionState) => void>();
  private obManager: OrderbookManager | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[BinanceFuturesAdapter] Network online detected, triggering immediate reconnect...');
        if (this.shouldReconnect && this.currentPair) {
          this.setState('RESYNCING');
          this.connect();
        }
        if (this.obShouldReconnect && this.obPair) {
          this.setObState('RESYNCING');
          this.connectOrderbook();
        }
      });
    }
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  onConnectionStateChange(cb: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of Array.from(this.stateListeners)) {
      try {
        listener(newState);
      } catch (e) {
        console.error('[BinanceFuturesAdapter] State listener error:', e);
      }
    }
  }

  getObConnectionState(): ConnectionState {
    return this.obState;
  }

  onObConnectionStateChange(cb: (state: ConnectionState) => void): () => void {
    this.obStateListeners.add(cb);
    return () => {
      this.obStateListeners.delete(cb);
    };
  }

  private setObState(newState: ConnectionState) {
    if (this.obState === newState) return;
    this.obState = newState;
    for (const listener of Array.from(this.obStateListeners)) {
      try {
        listener(newState);
      } catch (e) {
        console.error('[BinanceFuturesAdapter] Orderbook State listener error:', e);
      }
    }
  }

  async fetchHistory(pair: string, timeframe: string, limit: number = 500): Promise<Candle[]> {
    const symbol = pair.toUpperCase();
    const url = `${this.restBase}/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((k: any) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        tradeCount: parseInt(k[8], 10),
        isClosed: Number(k[6]) < now,
      }));
    } catch (e) {
      console.error('[BinanceFuturesAdapter] History fetch failed:', e);
      return [];
    }
  }

  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void {
    this.currentPair = pair.toLowerCase();
    this.currentTimeframe = timeframe;
    this.candleCb = cb;
    this.shouldReconnect = true;
    this.deferConnect();
  }

  subscribeTrades(pair: string, cb: (trade: Trade) => void): void {
    this.currentPair = pair.toLowerCase();
    this.tradeCb = cb;
    this.shouldReconnect = true;
    this.deferConnect();
  }

  private deferConnect(): void {
    if (this.state === 'CONNECTING') return;
    this.setState('CONNECTING');
    queueMicrotask(() => {
      this.connect();
    });
  }

  private connect(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    if (!this.currentPair) return;

    const streams: string[] = [];
    if (this.currentTimeframe && this.candleCb) {
      streams.push(`${this.currentPair}@kline_${this.currentTimeframe}`);
    }
    if (this.tradeCb) {
      streams.push(`${this.currentPair}@aggTrade`);
    }

    if (streams.length === 0) return;

    const url = `wss://fstream.binance.com/market/stream?streams=${streams.join('/')}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('LIVE');
      console.log(`[BinanceFuturesAdapter] Connected to ${streams.join('/')}`);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        console.error('[BinanceFuturesAdapter] WebSocket error:', error);
      }
    };

    this.ws.onclose = (event) => {
      if (this.shouldReconnect && event.code !== 1000) {
        this.setState('RESYNCING');
        this.scheduleReconnect();
      } else {
        this.setState('DISCONNECTED');
      }
    };
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.stream || !parsed.data) return;

      if (parsed.stream.includes('@kline') && this.candleCb) {
        const k = parsed.data.k;
        const candle: Candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          tradeCount: k.n,
          isClosed: k.x,
        };
        this.candleCb(candle);
      } else if (parsed.stream.includes('@aggTrade') && this.tradeCb) {
        const data = parsed.data;
        const trade: Trade = {
          id: data.a,
          firstTradeId: data.f,
          lastTradeId: data.l,
          time: data.T,
          price: parseFloat(data.p),
          quantity: parseFloat(data.q),
          isBuyerMaker: data.m,
        };
        this.tradeCb(trade);
      }
    } catch (e) {
      console.error('[BinanceFuturesAdapter] Error parsing message:', e);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 10) {
      console.error('[BinanceFuturesAdapter] Max reconnect attempts reached.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = baseDelay + jitter;
    this.reconnectAttempts++;
    console.log(`[BinanceFuturesAdapter] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setState('DISCONNECTED');
    this.currentPair = null;
    this.currentTimeframe = null;
    this.candleCb = null;
    this.tradeCb = null;
  }

  async fetchOrderbookSnapshot(pair: string, limit: number = 500): Promise<OrderbookSnapshot> {
    const symbol = pair.toUpperCase();
    const url = `${this.restBase}/depth?symbol=${symbol}&limit=${limit}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return {
        lastUpdateId: data.lastUpdateId,
        bids: data.bids,
        asks: data.asks,
      };
    } catch (e) {
      console.error(`[BinanceFuturesAdapter] Orderbook snapshot fetch failed:`, e);
      return { lastUpdateId: 0, bids: [], asks: [] };
    }
  }

  subscribeOrderbook(pair: string, cb: (update: DepthUpdate) => void): void {
    this.obPair = pair.toLowerCase();
    this.obCb = cb;
    this.obShouldReconnect = true;
    this.obReconnectAttempts = 0;
    this.setObState('CONNECTING');
    this.connectOrderbook();
  }

  private connectOrderbook(): void {
    if (this.obWs) {
      this.obWs.onopen = null;
      this.obWs.onmessage = null;
      this.obWs.onerror = null;
      this.obWs.onclose = null;
      this.obWs.close();
      this.obWs = null;
    }

    if (!this.obPair || !this.obCb) return;

    this.obManager = new OrderbookManager();
    this.obManager.onGapDetected = () => {
      console.warn(`[BinanceFuturesAdapter] Orderbook gap detected, forcing resync...`);
      if (this.obWs) {
        this.obWs.close();
      }
    };

    const url = `wss://fstream.binance.com/ws/${this.obPair}@depth@100ms`;
    this.obWs = new WebSocket(url);

    this.obWs.onopen = () => {
      this.obReconnectAttempts = 0;
      this.setObState('SYNCING');
      console.log(`[BinanceFuturesAdapter] Orderbook stream connected: ${this.obPair}@depth@100ms, syncing...`);
      
      this.fetchOrderbookSnapshot(this.obPair as string).then((snapshot) => {
        if (this.obManager) {
          this.obManager.initFromSnapshot(snapshot);
          this.setObState('LIVE');
          console.log(`[BinanceFuturesAdapter] Orderbook LIVE for ${this.obPair}`);
        }
      });
    };

    this.obWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DepthUpdate;
        if (this.obManager) {
          this.obManager.applyUpdate(data);
          
          if (this.obState === 'LIVE' && this.obCb) {
            this.obCb(data);
          }
        }
      } catch (e) {
        console.error(`[BinanceFuturesAdapter] Error parsing orderbook message:`, e);
      }
    };

    this.obWs.onerror = (error) => {
      if (this.obWs && this.obWs.readyState !== WebSocket.CLOSED) {
        console.error(`[BinanceFuturesAdapter] Orderbook WS error:`, error);
      }
    };

    this.obWs.onclose = (event) => {
      if (this.obShouldReconnect && event.code !== 1000) {
        this.setObState('RESYNCING');
        this.scheduleObReconnect();
      } else {
        this.setObState('DISCONNECTED');
      }
    };
  }

  private scheduleObReconnect(): void {
    if (this.obReconnectAttempts >= 10) {
      console.error(`[BinanceFuturesAdapter] Max orderbook reconnect attempts reached.`);
      return;
    }
    if (this.obReconnectTimer) clearTimeout(this.obReconnectTimer);

    const baseDelay = Math.min(1000 * Math.pow(2, this.obReconnectAttempts), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = baseDelay + jitter;
    this.obReconnectAttempts++;
    console.log(`[BinanceFuturesAdapter] Orderbook reconnecting in ${delay}ms (Attempt ${this.obReconnectAttempts})`);

    this.obReconnectTimer = setTimeout(() => {
      this.connectOrderbook();
    }, delay);
  }

  disconnectOrderbook(): void {
    this.obShouldReconnect = false;
    if (this.obReconnectTimer) {
      clearTimeout(this.obReconnectTimer);
      this.obReconnectTimer = null;
    }
    if (this.obWs) {
      this.obWs.onopen = null;
      this.obWs.onmessage = null;
      this.obWs.onerror = null;
      this.obWs.onclose = null;
      this.obWs.close();
      this.obWs = null;
    }
    this.setObState('DISCONNECTED');
    this.obCb = null;
  }

  clone(): BinanceFuturesAdapter {
    return new BinanceFuturesAdapter();
  }
}

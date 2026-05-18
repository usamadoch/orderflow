import { FeedAdapter } from './adapter';
import { Candle } from '../../types/candle';
import { OrderbookSnapshot, DepthUpdate } from '../liquidity/orderbook';
import { Trade } from '../../types/trade';

export class BinanceAdapter implements FeedAdapter {
  private ws: WebSocket | null = null;
  private currentPair: string | null = null;
  private currentTimeframe: string | null = null;
  private candleCb: ((candle: Candle) => void) | null = null;
  private tradeCb: ((trade: Trade) => void) | null = null;
  private reconnectAttempts: number = 0;
  private shouldReconnect: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPending: boolean = false;
  private restBase = 'https://api.binance.com/api/v3';

  // Orderbook — separate WebSocket
  private obWs: WebSocket | null = null;
  private obCb: ((update: DepthUpdate) => void) | null = null;
  private obReconnectAttempts: number = 0;
  private obShouldReconnect: boolean = false;
  private obReconnectTimer: NodeJS.Timeout | null = null;
  private obPair: string | null = null;

  async fetchHistory(pair: string, timeframe: string, limit: number = 500): Promise<Candle[]> {
    const symbol = pair.toUpperCase();
    const url = `${this.restBase}/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((k: any) => ({
        time: Math.floor(k[0] / 1000), // openTime is index 0
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isClosed: true
      }));
    } catch (e) {
      console.error(`[BinanceAdapter] History fetch failed:`, e);
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
    this.tradeCb = cb;
    this.shouldReconnect = true;
    this.deferConnect();
  }

  /**
   * Coalesce rapid subscribe calls into a single connect via microtask.
   * This prevents the second subscribe from tearing down a socket
   * that the first subscribe just opened.
   */
  private deferConnect(): void {
    if (this.connectPending) return;
    this.connectPending = true;
    queueMicrotask(() => {
      this.connectPending = false;
      this.connect();
    });
  }

  private connect(): void {
    // Detach handlers from old socket BEFORE closing to prevent
    // ghost onclose/onerror events from triggering reconnects
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    if (!this.currentPair) return;

    // Build the combined stream URL
    const streams: string[] = [];
    if (this.currentTimeframe && this.candleCb) {
      streams.push(`${this.currentPair}@kline_${this.currentTimeframe}`);
    }
    if (this.tradeCb) {
      streams.push(`${this.currentPair}@aggTrade`);
    }

    if (streams.length === 0) return;

    const url = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log(`[BinanceAdapter] Connected to ${streams.join('/')}`);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      // Only log if the socket isn't already being replaced
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        console.error(`[BinanceAdapter] WebSocket error:`, error);
      }
    };

    this.ws.onclose = (event) => {
      // code 1000 = normal close (we called .close()), don't reconnect
      if (this.shouldReconnect && event.code !== 1000) {
        this.scheduleReconnect();
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
          time: Math.floor(k.t / 1000), // unix seconds
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          isClosed: k.x
        };
        this.candleCb(candle);
      } else if (parsed.stream.includes('@aggTrade') && this.tradeCb) {
        const data = parsed.data;
        const trade: Trade = {
          id: data.a,
          time: data.T, // unix ms
          price: parseFloat(data.p),
          quantity: parseFloat(data.q),
          isBuyerMaker: data.m
        };
        this.tradeCb(trade);
      }
    } catch (e) {
      console.error(`[BinanceAdapter] Error parsing message:`, e);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 10) {
      console.error(`[BinanceAdapter] Max reconnect attempts reached.`);
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[BinanceAdapter] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.connectPending = false;
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
  }

  // ─── Orderbook Support ─────────────────────────────────────────

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
      console.error(`[BinanceAdapter] Orderbook snapshot fetch failed:`, e);
      return { lastUpdateId: 0, bids: [], asks: [] };
    }
  }

  subscribeOrderbook(pair: string, cb: (update: DepthUpdate) => void): void {
    this.obPair = pair.toLowerCase();
    this.obCb = cb;
    this.obShouldReconnect = true;
    this.obReconnectAttempts = 0;
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

    const url = `wss://stream.binance.com:9443/ws/${this.obPair}@depth@100ms`;
    this.obWs = new WebSocket(url);

    this.obWs.onopen = () => {
      this.obReconnectAttempts = 0;
      console.log(`[BinanceAdapter] Orderbook stream connected: ${this.obPair}@depth@100ms`);
    };

    this.obWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DepthUpdate;
        if (this.obCb) this.obCb(data);
      } catch (e) {
        console.error(`[BinanceAdapter] Error parsing orderbook message:`, e);
      }
    };

    this.obWs.onerror = (error) => {
      if (this.obWs && this.obWs.readyState !== WebSocket.CLOSED) {
        console.error(`[BinanceAdapter] Orderbook WS error:`, error);
      }
    };

    this.obWs.onclose = (event) => {
      if (this.obShouldReconnect && event.code !== 1000) {
        this.scheduleObReconnect();
      }
    };
  }

  private scheduleObReconnect(): void {
    if (this.obReconnectAttempts >= 10) {
      console.error(`[BinanceAdapter] Max orderbook reconnect attempts reached.`);
      return;
    }
    if (this.obReconnectTimer) clearTimeout(this.obReconnectTimer);

    const delay = Math.min(1000 * Math.pow(2, this.obReconnectAttempts), 30000);
    this.obReconnectAttempts++;
    console.log(`[BinanceAdapter] Orderbook reconnecting in ${delay}ms (Attempt ${this.obReconnectAttempts})`);

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
    this.obCb = null;
  }

  clone(): BinanceAdapter {
    return new BinanceAdapter();
  }
}

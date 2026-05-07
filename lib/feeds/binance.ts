import { FeedAdapter } from './adapter';
import { Candle } from '../../types/candle';
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

  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void {
    this.currentPair = pair.toLowerCase();
    this.currentTimeframe = timeframe;
    this.candleCb = cb;
    this.shouldReconnect = true;
    this.connect();
  }

  subscribeTrades(pair: string, cb: (trade: Trade) => void): void {
    this.tradeCb = cb;
    
    // If subscribeTrades is called standalone (currentPair is null), we need to set it and connect
    if (!this.currentPair || this.currentPair !== pair.toLowerCase()) {
      this.currentPair = pair.toLowerCase();
      this.shouldReconnect = true;
      this.connect();
    }
  }

  private connect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (!this.currentPair) return;

    // Build the combined stream URL
    let streams = [];
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
      console.error(`[BinanceAdapter] WebSocket error:`, error);
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

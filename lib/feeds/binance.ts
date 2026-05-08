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
  private restBase = 'https://api.binance.com/api/v3';

  async fetchHistory(pair: string, timeframe: string, limit: number = 500): Promise<Candle[]> {
    const symbol = pair.toUpperCase();
    const url = `${this.restBase}/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
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
    
    // Always connect to ensure the new candle stream/timeframe is picked up
    this.connect();
  }

  subscribeTrades(pair: string, cb: (trade: Trade) => void): void {
    this.tradeCb = cb;
    
    // Always connect to ensure the trade stream is added to the combined streams
    this.currentPair = pair.toLowerCase();
    this.shouldReconnect = true;
    this.connect();
  }

  private connect(): void {
    if (this.ws) {
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

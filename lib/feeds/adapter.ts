import { Candle } from "../../types/candle";
import { Trade } from "../../types/trade";
import { OrderbookSnapshot, DepthUpdate } from "../liquidity/orderbook";

export interface FeedAdapter {
  fetchHistory(pair: string, timeframe: string, limit?: number): Promise<Candle[]>;
  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void;
  subscribeTrades(pair: string, cb: (trade: Trade) => void): void;
  disconnect(): void;
  clone(): FeedAdapter;

  // Orderbook support (optional — implemented by adapters that support it)
  fetchOrderbookSnapshot?(pair: string, limit?: number): Promise<OrderbookSnapshot>;
  subscribeOrderbook?(pair: string, cb: (update: DepthUpdate) => void): void;
  disconnectOrderbook?(): void;
}

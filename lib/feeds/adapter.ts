import { Candle } from "../../types/candle";
import { Trade } from "../../types/trade";

export interface FeedAdapter {
  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void;
  subscribeTrades(pair: string, cb: (trade: Trade) => void): void;
  disconnect(): void;
}

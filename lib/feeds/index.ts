import { BinanceAdapter } from './binance';
import { BinanceFuturesAdapter } from './binanceFutures';
import { FeedAdapter } from './adapter';

export const feedAdapter: FeedAdapter = new BinanceAdapter();
export const futuresFeedAdapter: FeedAdapter = new BinanceFuturesAdapter();

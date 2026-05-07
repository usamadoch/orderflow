import { BinanceAdapter } from './binance';
import { FeedAdapter } from './adapter';

export const feedAdapter: FeedAdapter = new BinanceAdapter();

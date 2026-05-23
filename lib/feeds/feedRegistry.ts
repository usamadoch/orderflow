import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { DepthUpdate, OrderbookSnapshot } from '../liquidity/orderbook';
import type { ContractType } from '../store/chart';
import {
  recordRestoreDiagnostic,
  recordStreamClosed,
  recordStreamCreated,
  recordStreamEvent,
  recordStreamReused,
  recordStreamSubscriberCount,
} from '../debug/marketMetrics';
import type { FeedAdapter } from './adapter';
import { feedAdapter, futuresFeedAdapter } from './index';

type SourceType = 'spot' | 'futures';
type Unsubscribe = () => void;

interface StreamEntry<T> {
  adapter: FeedAdapter;
  subscribers: Set<(event: T) => void>;
}

interface InFlightHistoryEntry {
  promise: Promise<Candle[]>;
}

interface InFlightSnapshotEntry {
  promise: Promise<OrderbookSnapshot>;
}

const candleStreams = new Map<string, StreamEntry<Candle>>();
const tradeStreams = new Map<string, StreamEntry<Trade>>();
const depthStreams = new Map<string, StreamEntry<DepthUpdate>>();
const inFlightHistory = new Map<string, InFlightHistoryEntry>();
const inFlightOrderbookSnapshots = new Map<string, InFlightSnapshotEntry>();

function normalizeSymbol(symbol: string) {
  return symbol.trim().toLowerCase();
}

function getAdapter(type: SourceType | ContractType) {
  return type === 'futures' ? futuresFeedAdapter.clone() : feedAdapter.clone();
}

function getCandleKey(contractType: ContractType, symbol: string, timeframe: string) {
  return `${contractType}::${normalizeSymbol(symbol)}::${timeframe}`;
}

function getTradeKey(sourceType: SourceType, symbol: string) {
  return `${sourceType}::${normalizeSymbol(symbol)}`;
}

function getDepthKey(symbol: string) {
  return `spot::${normalizeSymbol(symbol)}`;
}

function getSnapshotKey(symbol: string, limit: number) {
  return `${getDepthKey(symbol)}::${limit}`;
}

function log(message: string, details: Record<string, unknown>) {
  const streamKey = String(details.streamKey ?? 'n/a');
  const subscriberCount = String(details.subscriberCount ?? 'n/a');
  const runtime = typeof window === 'undefined' ? 'server' : 'client';

  // console.log(
  //   `[FEED_REGISTRY] ${message} | key=${streamKey} | subscribers=${subscriberCount} | runtime=${runtime}`,
  //   details,
  // );
}

function cloneSnapshot(snapshot: OrderbookSnapshot): OrderbookSnapshot {
  return {
    lastUpdateId: snapshot.lastUpdateId,
    bids: snapshot.bids.map(([price, quantity]) => [price, quantity]),
    asks: snapshot.asks.map(([price, quantity]) => [price, quantity]),
  };
}

function removeSubscriber<T>(
  streams: Map<string, StreamEntry<T>>,
  key: string,
  streamType: string,
  callback: (event: T) => void,
  close: (entry: StreamEntry<T>) => void,
) {
  const entry = streams.get(key);
  if (!entry) return;

  entry.subscribers.delete(callback);
  if (streamType === 'kline' || streamType === 'aggTrade' || streamType === 'depth') {
    recordStreamSubscriberCount(streamType, key, entry.subscribers.size);
  }
  log('subscriber removed', {
    streamType,
    streamKey: key,
    subscriberCount: entry.subscribers.size,
  });

  if (entry.subscribers.size > 0) return;

  close(entry);
  streams.delete(key);
  if (streamType === 'kline' || streamType === 'aggTrade' || streamType === 'depth') {
    recordStreamClosed(streamType, key);
  }
  log('stream closed', {
    streamType,
    streamKey: key,
    subscriberCount: 0,
  });
}

export function subscribeCandleStream(
  contractType: ContractType,
  symbol: string,
  timeframe: string,
  callback: (candle: Candle) => void,
): Unsubscribe {
  const key = getCandleKey(contractType, symbol, timeframe);
  let entry = candleStreams.get(key);

  if (!entry) {
    const adapter = getAdapter(contractType);
    entry = {
      adapter,
      subscribers: new Set(),
    };
    candleStreams.set(key, entry);
    recordStreamCreated('kline', key, 0);
    log('stream created', {
      streamType: 'kline',
      streamKey: key,
      subscriberCount: 0,
    });

    adapter.subscribeCandles(symbol, timeframe, (candle) => {
      const current = candleStreams.get(key);
      if (!current) return;
      recordStreamEvent('kline', key, candle.time * 1000);
      for (const subscriber of Array.from(current.subscribers)) {
        subscriber(candle);
      }
    });
  } else {
    recordStreamReused('kline', key, entry.subscribers.size);
    log('stream reused', {
      streamType: 'kline',
      streamKey: key,
      subscriberCount: entry.subscribers.size,
    });
  }

  entry.subscribers.add(callback);
  recordStreamSubscriberCount('kline', key, entry.subscribers.size);
  log('subscriber added', {
    streamType: 'kline',
    streamKey: key,
    subscriberCount: entry.subscribers.size,
  });

  return () => removeSubscriber(candleStreams, key, 'kline', callback, (current) => {
    current.adapter.disconnect();
  });
}

export function subscribeTradeStream(
  sourceType: SourceType,
  symbol: string,
  callback: (trade: Trade) => void,
): Unsubscribe {
  const key = getTradeKey(sourceType, symbol);
  let entry = tradeStreams.get(key);

  if (!entry) {
    const adapter = getAdapter(sourceType);
    entry = {
      adapter,
      subscribers: new Set(),
    };
    tradeStreams.set(key, entry);
    recordStreamCreated('aggTrade', key, 0);
    log('stream created', {
      streamType: 'aggTrade',
      streamKey: key,
      subscriberCount: 0,
    });

    adapter.subscribeTrades(symbol, (trade) => {
      const current = tradeStreams.get(key);
      if (!current) return;
      recordStreamEvent('aggTrade', key, trade.time);
      for (const subscriber of Array.from(current.subscribers)) {
        subscriber(trade);
      }
    });
  } else {
    recordStreamReused('aggTrade', key, entry.subscribers.size);
    log('stream reused', {
      streamType: 'aggTrade',
      streamKey: key,
      subscriberCount: entry.subscribers.size,
    });
  }

  entry.subscribers.add(callback);
  recordStreamSubscriberCount('aggTrade', key, entry.subscribers.size);
  log('subscriber added', {
    streamType: 'aggTrade',
    streamKey: key,
    subscriberCount: entry.subscribers.size,
  });

  return () => removeSubscriber(tradeStreams, key, 'aggTrade', callback, (current) => {
    current.adapter.disconnect();
  });
}

export function subscribeDepthStream(
  symbol: string,
  callback: (update: DepthUpdate) => void,
): Unsubscribe {
  const key = getDepthKey(symbol);
  let entry = depthStreams.get(key);

  if (!entry) {
    const adapter = getAdapter('spot');
    if (!adapter.subscribeOrderbook || !adapter.disconnectOrderbook) {
      log('stream skipped: adapter has no depth support', {
        streamType: 'depth',
        streamKey: key,
        subscriberCount: 0,
      });
      return () => {};
    }

    entry = {
      adapter,
      subscribers: new Set(),
    };
    depthStreams.set(key, entry);
    recordStreamCreated('depth', key, 0);
    log('stream created', {
      streamType: 'depth',
      streamKey: key,
      subscriberCount: 0,
    });

    adapter.subscribeOrderbook(symbol, (update) => {
      const current = depthStreams.get(key);
      if (!current) return;
      recordStreamEvent('depth', key);
      for (const subscriber of Array.from(current.subscribers)) {
        subscriber(update);
      }
    });
  } else {
    recordStreamReused('depth', key, entry.subscribers.size);
    log('stream reused', {
      streamType: 'depth',
      streamKey: key,
      subscriberCount: entry.subscribers.size,
    });
  }

  entry.subscribers.add(callback);
  recordStreamSubscriberCount('depth', key, entry.subscribers.size);
  log('subscriber added', {
    streamType: 'depth',
    streamKey: key,
    subscriberCount: entry.subscribers.size,
  });

  return () => removeSubscriber(depthStreams, key, 'depth', callback, (current) => {
    current.adapter.disconnectOrderbook?.();
    current.adapter.disconnect();
  });
}

export async function fetchSharedHistory(
  contractType: ContractType,
  symbol: string,
  timeframe: string,
  limit?: number,
) {
  const key = `${getCandleKey(contractType, symbol, timeframe)}::${limit ?? 'default'}`;
  const existing = inFlightHistory.get(key);

  if (existing) {
    recordRestoreDiagnostic({
      kind: 'candles',
      key,
      timestamp: Date.now(),
      details: {
        source: 'shared-history',
        deduped: true,
        contractType,
        symbol,
        timeframe,
        limit: limit ?? 'default',
      },
    });
    log('existing history request reused', {
      streamType: 'history',
      streamKey: key,
      subscriberCount: 0,
    });
    return existing.promise;
  }

  log('history request created', {
    streamType: 'history',
    streamKey: key,
    subscriberCount: 0,
  });

  const adapter = getAdapter(contractType);
  const promise = adapter.fetchHistory(symbol, timeframe, limit)
    .then((candles) => {
      recordRestoreDiagnostic({
        kind: 'candles',
        key,
        timestamp: Date.now(),
        rowsFetched: candles.length,
        distinctCandleTimeCount: new Set(candles.map((candle) => candle.time)).size,
        details: {
          source: 'shared-history',
          deduped: false,
          contractType,
          symbol,
          timeframe,
          limit: limit ?? 'default',
        },
      });
      return candles;
    })
    .finally(() => {
      inFlightHistory.delete(key);
    });

  inFlightHistory.set(key, { promise });
  return promise;
}

export async function fetchSharedOrderbookSnapshot(symbol: string, limit = 500) {
  const key = getSnapshotKey(symbol, limit);
  const existing = inFlightOrderbookSnapshots.get(key);

  if (existing) {
    recordRestoreDiagnostic({
      kind: 'orderbook',
      key,
      timestamp: Date.now(),
      details: {
        source: 'shared-orderbook-snapshot',
        deduped: true,
        symbol,
        limit,
      },
    });
    log('existing orderbook snapshot request reused', {
      streamType: 'depth-snapshot',
      streamKey: key,
      subscriberCount: 0,
    });
    return cloneSnapshot(await existing.promise);
  }

  const adapter = getAdapter('spot');
  if (!adapter.fetchOrderbookSnapshot) {
    return { lastUpdateId: 0, bids: [], asks: [] };
  }

  log('orderbook snapshot request created', {
    streamType: 'depth-snapshot',
    streamKey: key,
    subscriberCount: 0,
  });

  const promise = adapter.fetchOrderbookSnapshot(symbol, limit)
    .then((snapshot) => {
      recordRestoreDiagnostic({
        kind: 'orderbook',
        key,
        timestamp: Date.now(),
        rowsFetched: snapshot.bids.length + snapshot.asks.length,
        details: {
          source: 'shared-orderbook-snapshot',
          deduped: false,
          symbol,
          limit,
          bids: snapshot.bids.length,
          asks: snapshot.asks.length,
        },
      });
      return snapshot;
    })
    .finally(() => {
      inFlightOrderbookSnapshots.delete(key);
    });

  inFlightOrderbookSnapshots.set(key, { promise });
  return cloneSnapshot(await promise);
}

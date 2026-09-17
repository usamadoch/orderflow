/**
 * Module-level candle retention cache.
 *
 * Survives React remounts, timeframe switches, and component unmounts.
 * Cleared only on symbol + contractType change.
 *
 * Key: `${symbol}::${contractType}::${timeframe}`
 *
 * Purpose: when the user switches timeframes, the canvas can immediately
 * display previously-loaded candles for the new timeframe (if present)
 * instead of blanking and waiting for a network fetch.
 */

import type { Candle } from '../../types/candle';

type CacheKey = string;

interface CachedCandles {
  candles: Candle[];
  lastUpdated: number; // performance.now()
  symbol: string;
  contractType: string;
  timeframe: string;
}

function makeKey(symbol: string, contractType: string, timeframe: string): CacheKey {
  return `${symbol}::${contractType}::${timeframe}`;
}

class CandleRetentionCache {
  private store = new Map<CacheKey, CachedCandles>();

  /**
   * Store a snapshot of the candle array for the given key.
   * Stores a shallow copy — the live Zustand array and the cached entry
   * are independent references.
   */
  set(symbol: string, contractType: string, timeframe: string, candles: Candle[]): void {
    if (candles.length === 0) return; // don't cache empty state
    const key = makeKey(symbol, contractType, timeframe);
    this.store.set(key, {
      candles: [...candles],
      lastUpdated: performance.now(),
      symbol,
      contractType,
      timeframe,
    });
  }

  /**
   * Returns the most recently stored candle array for this key, or null
   * if nothing has been cached yet for this (symbol, contractType, timeframe).
   */
  get(symbol: string, contractType: string, timeframe: string): Candle[] | null {
    const entry = this.store.get(makeKey(symbol, contractType, timeframe));
    if (!entry) return null;
    return entry.candles;
  }

  /**
   * Call on symbol change to free memory for all timeframes of the old symbol.
   * This is the ONLY place where cached candles should be discarded.
   */
  clearSymbol(symbol: string, contractType: string): void {
    for (const [key, entry] of this.store) {
      if (entry.symbol === symbol && entry.contractType === contractType) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Returns the number of timeframes cached for a given symbol.
   * Useful for memory sanity checks in development.
   */
  debugCount(symbol: string): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.symbol === symbol) count += 1;
    }
    return count;
  }
}

export const candleRetentionCache = new CandleRetentionCache();

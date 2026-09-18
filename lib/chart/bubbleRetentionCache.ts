/**
 * Module-level bubble retention cache.
 *
 * Survives React remounts, timeframe switches, and component unmounts.
 * Cleared only on symbol + contractType change.
 *
 * Key: `${symbol}::${contractType}::${timeframe}`
 *
 * Purpose: when the user switches timeframes, the canvas can immediately
 * display previously-loaded aggregate bubbles for the target timeframe
 * instead of blanking and waiting for a network fetch.
 */

import type { BubbleEvent } from '../../types/bubble';

type CacheKey = string;

interface CachedBubbles {
  bubbles: BubbleEvent[];
  lastUpdated: number; // performance.now()
  symbol: string;
  contractType: string;
  timeframe: string;
}

function makeKey(symbol: string, contractType: string, timeframe: string): CacheKey {
  return `${symbol}::${contractType}::${timeframe}`;
}

class BubbleRetentionCache {
  private store = new Map<CacheKey, CachedBubbles>();

  /**
   * Store a snapshot of the aggregate bubble events array for the given key.
   * Stores a shallow copy — the live Zustand array and the cached entry
   * are independent references.
   */
  set(symbol: string, contractType: string, timeframe: string, bubbles: BubbleEvent[]): void {
    if (bubbles.length === 0) return; // don't cache empty state
    const key = makeKey(symbol, contractType, timeframe);
    this.store.set(key, {
      bubbles: [...bubbles],
      lastUpdated: performance.now(),
      symbol,
      contractType,
      timeframe,
    });
  }

  /**
   * Returns the most recently stored bubble events array for this key, or null
   * if nothing has been cached yet for this (symbol, contractType, timeframe).
   */
  get(symbol: string, contractType: string, timeframe: string): BubbleEvent[] | null {
    const entry = this.store.get(makeKey(symbol, contractType, timeframe));
    if (!entry) return null;
    return entry.bubbles;
  }

  /**
   * Call on symbol change to free memory for all timeframes of the old symbol.
   * This is the ONLY place where cached bubbles should be discarded.
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

export const bubbleRetentionCache = new BubbleRetentionCache();

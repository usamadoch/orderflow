'use client';

import { useEffect, useRef } from 'react';
import { useChartStore } from '../lib/store/chart';
import { useChartRuntimeStore } from '../lib/store/chartRuntime';

/**
 * Polls Binance testnet for account snapshots.
 * - Runs immediately on mount.
 * - Runs again 3 seconds later (catches fills from orders placed at startup).
 * - Then settles into a 10-second polling interval.
 */
export function useTradingSync() {
  const symbol = useChartStore(s => s.panels.left.pair);
  const refreshAccountSnapshot = useChartRuntimeStore(s => s.refreshAccountSnapshot);
  const mountCount = useRef(0);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') {
      return;
    }

    let mounted = true;
    mountCount.current += 1;

    const sync = async () => {
      if (!mounted) return;
      try {
        // Request up to 100 trades so recent fills always show up
        await refreshAccountSnapshot(symbol, 100);
      } catch (e) {
        console.error('[useTradingSync] sync failed', e);
      }
    };

    // Immediate sync on mount
    void sync();

    // Quick follow-up at 3s to catch fills from orders placed right before mount
    const earlyTimer = setTimeout(() => { void sync(); }, 3000);

    // Standard polling every 10 seconds
    const intervalId = setInterval(() => { void sync(); }, 10_000);

    return () => {
      mounted = false;
      clearTimeout(earlyTimer);
      clearInterval(intervalId);
    };
  // Re-run if the symbol changes so trades are always fetched for the active pair
  }, [symbol, refreshAccountSnapshot]);
}

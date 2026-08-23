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
    let mounted = true;
    mountCount.current += 1;

    const sync = async () => {
      if (!mounted) return;
      if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return;
      
      try {
        // Request up to 100 trades so recent fills always show up
        await refreshAccountSnapshot(symbol, 100);
      } catch (e) {
        console.error('[useTradingSync] sync failed', e);
      }
    };

    const mt5Sync = async () => {
      if (!mounted) return;
      try {
        const res = await fetch('http://localhost:3001/status', {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          useChartRuntimeStore.getState().setMT5Status(data.connected, data.accountName, data.pnl);
          if (Array.isArray(data.positions)) {
            useChartRuntimeStore.getState().syncMT5Positions(data.positions);
          }
        }
      } catch {
        // bridge offline
        useChartRuntimeStore.getState().setMT5Status(false, '', 0);
      }
    };

    // Immediate sync on mount
    void sync();
    void mt5Sync();

    // Quick follow-up at 3s to catch fills from orders placed right before mount
    const earlyTimer = setTimeout(() => { void sync(); void mt5Sync(); }, 3000);

    // Standard polling every 10 seconds for Binance, 2s for MT5
    const intervalId = setInterval(() => { void sync(); }, 10_000);
    const mt5IntervalId = setInterval(() => { void mt5Sync(); }, 2000);

    return () => {
      mounted = false;
      clearTimeout(earlyTimer);
      clearInterval(intervalId);
      clearInterval(mt5IntervalId);
    };
  // Re-run if the symbol changes so trades are always fetched for the active pair
  }, [symbol, refreshAccountSnapshot]);
}

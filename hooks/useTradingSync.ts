'use client';

import { useEffect, useRef } from 'react';
import { useChartStore } from '../lib/store/chart';
import { useChartRuntimeStore } from '../lib/store/chartRuntime';

const MAX_MT5_CONSECUTIVE_FAILURES = 3;

/**
 * Polls Binance testnet and MT5 bridge for account snapshots and position updates.
 * - Binance: Polls on mount, at 3s, then every 10s.
 * - MT5 Bridge: Polls every 2s. If disconnected for 3 consecutive attempts,
 *   it automatically pauses polling to prevent ERR_CONNECTION_REFUSED console noise.
 *   Can be resumed manually via the Header Connect button.
 */
export function useTradingSync() {
  const symbol = useChartStore(s => s.panels.left.pair);
  const refreshAccountSnapshot = useChartRuntimeStore(s => s.refreshAccountSnapshot);
  const syncMT5Bridge = useChartRuntimeStore(s => s.syncMT5Bridge);
  const mt5BridgeStatus = useChartRuntimeStore(s => s.tradingStatus.mt5BridgeStatus);
  const mt5Failures = useRef(0);

  // Binance snapshot sync
  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      if (!mounted) return;
      if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return;

      try {
        await refreshAccountSnapshot(symbol, 100);
      } catch (e) {
        console.error('[useTradingSync] sync failed', e);
      }
    };

    void sync();
    const earlyTimer = setTimeout(() => { void sync(); }, 3000);
    const intervalId = setInterval(() => { void sync(); }, 10_000);

    return () => {
      mounted = false;
      clearTimeout(earlyTimer);
      clearInterval(intervalId);
    };
  }, [symbol, refreshAccountSnapshot]);

  // MT5 bridge sync with failure backoff & pause
  useEffect(() => {
    let mounted = true;

    if (mt5BridgeStatus === 'paused') {
      return;
    }

    const doSync = async () => {
      if (!mounted) return;
      const success = await syncMT5Bridge();
      if (!mounted) return;

      if (success) {
        mt5Failures.current = 0;
      } else {
        mt5Failures.current += 1;
        if (mt5Failures.current >= MAX_MT5_CONSECUTIVE_FAILURES) {
          useChartRuntimeStore.getState().setMT5BridgeStatus('paused');
        }
      }
    };

    // If connecting (e.g. manual retry), reset failure count
    if (mt5BridgeStatus === 'connecting') {
      mt5Failures.current = 0;
    }

    void doSync();

    const intervalId = setInterval(() => {
      void doSync();
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [mt5BridgeStatus, syncMT5Bridge]);
}

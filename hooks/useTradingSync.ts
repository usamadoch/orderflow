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
  const activePanelId = useChartStore(s => s.activePanel);
  const activePanel = useChartStore(s => s.panels[activePanelId]);
  const chartMode = activePanel?.chartMode;
  const timeframe = activePanel?.timeframe;
  const pair = activePanel?.pair;

  const refreshAccountSnapshot = useChartRuntimeStore(s => s.refreshAccountSnapshot);
  const syncMT5Bridge = useChartRuntimeStore(s => s.syncMT5Bridge);
  const mt5BridgeStatus = useChartRuntimeStore(s => s.tradingStatus.mt5BridgeStatus);
  const fetchMT5Candles = useChartRuntimeStore(s => s.fetchMT5Candles);
  const notifyMT5ViewState = useChartRuntimeStore(s => s.notifyMT5ViewState);
  const mt5Failures = useRef(0);
  const wasMode4Active = useRef(false);

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
    }, 1000);

    // Ultra-fast 250ms polling when open MT5 positions exist to keep PnL live
    const fastPosIntervalId = setInterval(() => {
      const hasOpenMt5 = useChartRuntimeStore.getState().tradingStatus.virtualPositions.some(
        (p) => p.status === 'open' && /^\d+$/.test(p.id)
      );
      if (hasOpenMt5) {
        void doSync();
      }
    }, 250);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      clearInterval(fastPosIntervalId);
    };
  }, [mt5BridgeStatus, syncMT5Bridge]);

  // MT5 Mode 4 (Side-by-Side) reverse-channel view state, SSE stream & candle sync
  useEffect(() => {
    let mounted = true;
    const isMode4 = chartMode === 'side-by-side';

    if (!isMode4) {
      if (wasMode4Active.current) {
        wasMode4Active.current = false;
        // Inform bridge/EA that Mode 4 is now inactive
        void notifyMT5ViewState(false, pair || 'BTCUSD', timeframe || '1m');
      }
      return;
    }

    wasMode4Active.current = true;
    // Inform bridge/EA that Mode 4 is active with current pair & timeframe
    void notifyMT5ViewState(true, pair || 'BTCUSD', timeframe || '1m');

    // Initial fetch of MT5 candles
    void fetchMT5Candles(activePanelId, pair, timeframe);

    // Connect to Server-Sent Events (SSE) for instant push updates from the bridge
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('http://localhost:3001/mt5-stream');
      eventSource.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'candle') {
            if (data.candle) {
              useChartRuntimeStore.getState().pushMt5LiveCandle(
                activePanelId,
                data.candle,
                data.previousCandle,
                data.bid,
                data.ask
              );
            } else if (data.bid != null || data.ask != null) {
              useChartRuntimeStore.getState().setMt5Quotes(activePanelId, data.bid ?? null, data.ask ?? null);
            }
          } else if (data.type === 'account') {
            if (Array.isArray(data.positions)) {
              useChartRuntimeStore.getState().syncMT5Positions(data.positions);
            }
            if (data.bid != null || data.ask != null) {
              useChartRuntimeStore.getState().setMt5Quotes(activePanelId, data.bid ?? null, data.ask ?? null);
            }
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch {
      // EventSource fallback
    }

    // Safety fallback poll for MT5 candles (e.g. gap filling or if SSE dropped)
    const intervalId = setInterval(() => {
      if (!mounted) return;
      if (useChartRuntimeStore.getState().tradingStatus.mt5BridgeStatus !== 'connected') return;
      void fetchMT5Candles(activePanelId, pair, timeframe);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [chartMode, timeframe, pair, activePanelId, fetchMT5Candles, notifyMT5ViewState]);
}

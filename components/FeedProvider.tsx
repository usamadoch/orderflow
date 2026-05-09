'use client';

import { useEffect, useRef } from 'react';
import { useChartStore, PanelId } from '../lib/store/chart';
import { feedAdapter } from '../lib/feeds';
import { AggregationEngine } from '../lib/aggregation/engine';
import { buildAbsorptionMap, scoreLatestCandle } from '../lib/absorption/engine';
import { getCandleTimeForTrade } from '../lib/utils/aggregation';
import { ChartEngineContext } from './ChartEngineContext';
import { Candle } from '../types/candle';
import { Trade } from '../types/trade';
import { AbsorptionResult } from '../types/absorption';

interface PanelFeedProviderProps {
  panelId: PanelId;
  children: React.ReactNode;
}

export function PanelFeedProvider({ panelId, children }: PanelFeedProviderProps) {
  const pair = useChartStore(s => s.panels[panelId].pair);
  const timeframe = useChartStore(s => s.panels[panelId].timeframe);
  const bucketSize = useChartStore(s => s.panels[panelId].bucketSize);
  const chartMode = useChartStore(s => s.panels[panelId].chartMode);
  const pushCandle = useChartStore(s => s.pushCandle);
  const pushTrade = useChartStore(s => s.pushTrade);
  const setConnected = useChartStore(s => s.setConnected);
  const pushAllCandles = useChartStore(s => s.pushAllCandles);
  const setLoadingHistory = useChartStore(s => s.setLoadingHistory);
  const triggerFootprintRedraw = useChartStore(s => s.triggerFootprintRedraw);
  const setAbsorptionMap = useChartStore(s => s.setAbsorptionMap);

  const connectedRef = useRef(false);
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const pendingFootprintRedrawRef = useRef(false);
  const absorptionMapRef = useRef<Map<number, AbsorptionResult>>(new Map());
  const lastScoredCandleTimeRef = useRef<number | null>(null);
  // Each panel needs its own adapter instance for independent connections
  const adapterRef = useRef(feedAdapter.clone());

  // Throttled redraw loop for footprint updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFootprintRedrawRef.current && chartMode === 'footprint') {
        pendingFootprintRedrawRef.current = false;
        triggerFootprintRedraw(panelId);
      }

      // Re-score provisional (live) candle on footprint updates
      if (pendingFootprintRedrawRef.current || chartMode === 'footprint') {
        const candles = useChartStore.getState().panels[panelId].candles || [];
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          if (!last.isClosed) {
            const newMap = scoreLatestCandle(candles, engineRef.current, absorptionMapRef.current);
            if (newMap !== absorptionMapRef.current) {
              absorptionMapRef.current = newMap;
              setAbsorptionMap(panelId, newMap);
            }
          }
        }
      }
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFootprintRedraw, chartMode, panelId, setAbsorptionMap]);

  // Handle engine bucket size updates without reconnecting socket
  useEffect(() => {
    engineRef.current.reset(bucketSize);
    const currentCandles = useChartStore.getState().panels[panelId].candles || [];
    currentCandles.forEach(c => engineRef.current.ingestCandle(c));
    // Rebuild absorption map with new bucket size
    const newMap = buildAbsorptionMap(currentCandles, engineRef.current);
    absorptionMapRef.current = newMap;
    setAbsorptionMap(panelId, newMap);
    triggerFootprintRedraw(panelId);
  }, [bucketSize, triggerFootprintRedraw, panelId, setAbsorptionMap]);

  useEffect(() => {
    let active = true;
    connectedRef.current = false;
    setConnected(panelId, false);
    engineRef.current.reset();
    absorptionMapRef.current = new Map();
    lastScoredCandleTimeRef.current = null;

    const adapter = adapterRef.current;
    adapter.disconnect();

    const handleCandle = (candle: Candle) => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        setConnected(panelId, true);
      }
      engineRef.current.ingestCandle(candle);
      pushCandle(panelId, candle);

      // Score closed candles incrementally
      if (candle.isClosed && candle.time !== lastScoredCandleTimeRef.current) {
        lastScoredCandleTimeRef.current = candle.time;
        const currentCandles = useChartStore.getState().panels[panelId].candles || [];
        const newMap = scoreLatestCandle(currentCandles, engineRef.current, absorptionMapRef.current);
        absorptionMapRef.current = newMap;
        setAbsorptionMap(panelId, newMap);
      }
    };

    const handleTrade = (trade: Trade) => {
      let timeframeSeconds = 60;
      if (timeframe.endsWith('m')) timeframeSeconds = parseInt(timeframe) * 60;
      else if (timeframe.endsWith('h')) timeframeSeconds = parseInt(timeframe) * 3600;
      else if (timeframe.endsWith('d')) timeframeSeconds = parseInt(timeframe) * 86400;

      engineRef.current.ingestTrade(trade, getCandleTimeForTrade(trade.time, timeframeSeconds));
      pushTrade(panelId, trade);
      pendingFootprintRedrawRef.current = true;
    };

    const init = async () => {
      try {
        setLoadingHistory(panelId, true);
        console.log(`[PanelFeed:${panelId}] Fetching history for ${pair} ${timeframe}...`);
        const history = await adapter.fetchHistory(pair, timeframe);

        if (!active) return;

        pushAllCandles(panelId, history);
        history.forEach(c => engineRef.current.ingestCandle(c));

        console.log(`[PanelFeed:${panelId}] History loaded (${history.length} candles). Connecting WS...`);
        setLoadingHistory(panelId, false);

        // Build initial absorption map from history
        const absMap = buildAbsorptionMap(history, engineRef.current);
        absorptionMapRef.current = absMap;
        setAbsorptionMap(panelId, absMap);

        adapter.subscribeCandles(pair, timeframe, handleCandle);
        adapter.subscribeTrades(pair, handleTrade);
      } catch (err) {
        console.error(`[PanelFeed:${panelId}] Initialization failed:`, err);
        if (active) setLoadingHistory(panelId, false);
      }
    };

    init();

    return () => {
      active = false;
      adapter.disconnect();
      setConnected(panelId, false);
      connectedRef.current = false;
    };
  }, [pair, timeframe, panelId, pushCandle, pushTrade, setConnected, pushAllCandles, setLoadingHistory, setAbsorptionMap]);

  return <ChartEngineContext.Provider value={engineRef.current}>{children}</ChartEngineContext.Provider>;
}

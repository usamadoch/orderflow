'use client';

import { useEffect, useRef } from 'react';
import { useChartStore } from '../lib/store/chart';
import { feedAdapter } from '../lib/feeds';
import { AggregationEngine } from '../lib/aggregation/engine';
import { getCandleTimeForTrade } from '../lib/utils/aggregation';
import { ChartEngineContext } from './ChartEngineContext';
import { Candle } from '../types/candle';
import { Trade } from '../types/trade';

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const pair = useChartStore(s => s.pair);
  const timeframe = useChartStore(s => s.timeframe);
  const pushCandle = useChartStore(s => s.pushCandle);
  const pushTrade = useChartStore(s => s.pushTrade);
  const setConnected = useChartStore(s => s.setConnected);
  const bucketSize = useChartStore(s => s.bucketSize);
  const triggerFootprintRedraw = useChartStore(s => s.triggerFootprintRedraw);
  const chartMode = useChartStore(s => s.chartMode);
  
  const connectedRef = useRef(false);
  // Persist engine across re-renders
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const pendingFootprintRedrawRef = useRef(false);

  // Throttled redraw loop for footprint updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFootprintRedrawRef.current && chartMode === 'footprint') {
        pendingFootprintRedrawRef.current = false;
        triggerFootprintRedraw();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [triggerFootprintRedraw, chartMode]);

  // Handle engine bucket size updates without reconnecting socket
  useEffect(() => {
    engineRef.current.reset(bucketSize);
  }, [bucketSize]);

  useEffect(() => {
    // Reset connection state on new subscription
    connectedRef.current = false;
    setConnected(false);
    
    // Reset engine on pair/timeframe change
    engineRef.current.reset();
    
    // Kill existing connection
    feedAdapter.disconnect();

    const handleCandle = (candle: Candle) => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        setConnected(true);
      }
      engineRef.current.ingestCandle(candle);
      pushCandle(candle);
    };

    const handleTrade = (trade: Trade) => {
      let timeframeSeconds = 60; // default 1m
      if (timeframe.endsWith('m')) timeframeSeconds = parseInt(timeframe) * 60;
      else if (timeframe.endsWith('h')) timeframeSeconds = parseInt(timeframe) * 3600;
      else if (timeframe.endsWith('d')) timeframeSeconds = parseInt(timeframe) * 86400;

      engineRef.current.ingestTrade(trade, getCandleTimeForTrade(trade.time, timeframeSeconds));
      pushTrade(trade);
      pendingFootprintRedrawRef.current = true;
    };

    feedAdapter.subscribeCandles(pair, timeframe, handleCandle);
    feedAdapter.subscribeTrades(pair, handleTrade);

    return () => {
      feedAdapter.disconnect();
      setConnected(false);
      connectedRef.current = false;
    };
  }, [pair, timeframe, pushCandle, pushTrade, setConnected]);

  return <ChartEngineContext.Provider value={engineRef.current}>{children}</ChartEngineContext.Provider>;
}

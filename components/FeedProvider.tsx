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
  const { 
    pair, 
    timeframe, 
    pushCandle, 
    pushTrade, 
    setConnected,
    bucketSize
  } = useChartStore();
  
  const connectedRef = useRef(false);
  // Persist engine across re-renders
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));

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

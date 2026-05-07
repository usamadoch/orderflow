'use client';

import { useEffect, useRef } from 'react';
import { useChartStore } from '../lib/store/chart';
import { feedAdapter } from '../lib/feeds';

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { 
    pair, 
    timeframe, 
    pushCandle, 
    pushTrade, 
    setConnected 
  } = useChartStore();
  
  const connectedRef = useRef(false);

  useEffect(() => {
    // Reset connection state on new subscription
    connectedRef.current = false;
    setConnected(false);
    
    // Kill existing connection
    feedAdapter.disconnect();

    const handleCandle = (candle: any) => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        setConnected(true);
      }
      pushCandle(candle);
    };

    feedAdapter.subscribeCandles(pair, timeframe, handleCandle);
    feedAdapter.subscribeTrades(pair, pushTrade);

    return () => {
      feedAdapter.disconnect();
      setConnected(false);
      connectedRef.current = false;
    };
  }, [pair, timeframe, pushCandle, pushTrade, setConnected]);

  return <>{children}</>;
}

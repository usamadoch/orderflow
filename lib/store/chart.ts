import { create } from 'zustand';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';

interface ChartState {
  pair: string;
  timeframe: string;
  candles: Candle[];
  trades: Trade[];
  connected: boolean;
  chartMode: 'candle' | 'footprint';

  setPair: (pair: string) => void;
  setTimeframe: (timeframe: string) => void;
  setConnected: (connected: boolean) => void;
  toggleMode: () => void;
  pushCandle: (candle: Candle) => void;
  pushTrade: (trade: Trade) => void;
  bucketSize: number;
  setBucketSize: (size: number) => void;
}

export const useChartStore = create<ChartState>((set) => ({
  pair: 'BTCUSDT',
  timeframe: '1m',
  candles: [],
  trades: [],
  connected: false,
  chartMode: 'candle',
  bucketSize: 100,

  setPair: (pair) => set({ pair, candles: [], trades: [] }),
  
  setTimeframe: (timeframe) => set({ timeframe, candles: [], trades: [] }),
  
  setConnected: (connected) => set({ connected }),
  
  toggleMode: () => set((state) => ({ chartMode: state.chartMode === 'candle' ? 'footprint' : 'candle' })),

  setBucketSize: (bucketSize) => set({ bucketSize }),
  
  pushCandle: (candle) => set((state) => {
    const newCandles = [...state.candles];
    if (newCandles.length > 0 && newCandles[newCandles.length - 1].time === candle.time) {
      // Replace last candle
      newCandles[newCandles.length - 1] = candle;
    } else {
      // Append new candle
      newCandles.push(candle);
    }
    
    // Cap at 500
    if (newCandles.length > 500) {
      newCandles.splice(0, newCandles.length - 500);
    }
    
    return { candles: newCandles };
  }),
  
  pushTrade: (trade) => set((state) => {
    const newTrades = [...state.trades, trade];
    // Cap at 5000
    if (newTrades.length > 5000) {
      newTrades.splice(0, newTrades.length - 5000);
    }
    return { trades: newTrades };
  }),
}));

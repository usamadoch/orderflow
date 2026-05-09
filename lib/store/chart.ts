import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { FootprintMode } from '../../types/footprint';

export type ChartMode = 'candle' | 'footprint';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';

export interface PanelState {
  id: PanelId;
  pair: string;
  timeframe: string;
  chartMode: ChartMode;
  footprintMode: FootprintMode;
  bucketSize: number;
  barWidth: number;
  scrollOffset: number;
  candles: Candle[];
  trades: Trade[];
  connected: boolean;
  isLoadingHistory: boolean;
  footprintTrigger: number;
}

interface ChartState {
  panels: {
    left: PanelState;
    right: PanelState;
  };
  layoutMode: LayoutMode;
  activePanel: PanelId;
  splitRatio: number;

  // Shared settings
  tickSize: number;
  sidebarCollapsed: boolean;

  // Per-panel actions
  setPair: (panelId: PanelId, pair: string) => void;
  setTimeframe: (panelId: PanelId, timeframe: string) => void;
  setChartMode: (panelId: PanelId, mode: ChartMode) => void;
  setFootprintMode: (panelId: PanelId, mode: FootprintMode) => void;
  setBucketSize: (panelId: PanelId, size: number) => void;
  setBarWidth: (panelId: PanelId, width: number) => void;
  setScrollOffset: (panelId: PanelId, offset: number) => void;
  setConnected: (panelId: PanelId, connected: boolean) => void;
  setLoadingHistory: (panelId: PanelId, v: boolean) => void;
  pushCandle: (panelId: PanelId, candle: Candle) => void;
  pushTrade: (panelId: PanelId, trade: Trade) => void;
  pushAllCandles: (panelId: PanelId, candles: Candle[]) => void;
  triggerFootprintRedraw: (panelId: PanelId) => void;

  // Global actions
  setLayoutMode: (mode: LayoutMode) => void;
  setActivePanel: (panelId: PanelId) => void;
  setSplitRatio: (ratio: number) => void;
  setTickSize: (size: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

function createDefaultPanel(id: PanelId): PanelState {
  return {
    id,
    pair: 'BTCUSDT',
    timeframe: '1m',
    chartMode: 'candle',
    footprintMode: 'bid-ask',
    bucketSize: 10,
    barWidth: 12,
    scrollOffset: 0,
    candles: [],
    trades: [],
    connected: false,
    isLoadingHistory: false,
    footprintTrigger: 0,
  };
}

function updatePanel(state: ChartState, panelId: PanelId, updates: Partial<PanelState>): Partial<ChartState> {
  return {
    panels: {
      ...state.panels,
      [panelId]: {
        ...state.panels[panelId],
        ...updates,
      },
    },
  };
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      panels: {
        left: createDefaultPanel('left'),
        right: createDefaultPanel('right'),
      },
      layoutMode: 'single',
      activePanel: 'left',
      splitRatio: 0.5,
      tickSize: 0.5,
      sidebarCollapsed: false,

      // Per-panel actions
      setPair: (panelId, pair) =>
        set((state) => updatePanel(state, panelId, { pair, candles: [], trades: [] })),

      setTimeframe: (panelId, timeframe) =>
        set((state) => updatePanel(state, panelId, { timeframe, candles: [], trades: [] })),

      setChartMode: (panelId, chartMode) =>
        set((state) => updatePanel(state, panelId, { chartMode })),

      setFootprintMode: (panelId, footprintMode) =>
        set((state) => updatePanel(state, panelId, { footprintMode })),

      setBucketSize: (panelId, bucketSize) =>
        set((state) => updatePanel(state, panelId, { bucketSize })),

      setBarWidth: (panelId, barWidth) =>
        set((state) => updatePanel(state, panelId, { barWidth })),

      setScrollOffset: (panelId, scrollOffset) =>
        set((state) => updatePanel(state, panelId, { scrollOffset })),

      setConnected: (panelId, connected) =>
        set((state) => updatePanel(state, panelId, { connected })),

      setLoadingHistory: (panelId, isLoadingHistory) =>
        set((state) => updatePanel(state, panelId, { isLoadingHistory })),

      triggerFootprintRedraw: (panelId) =>
        set((state) => updatePanel(state, panelId, { footprintTrigger: Date.now() })),

      pushAllCandles: (panelId, candles) =>
        set((state) => updatePanel(state, panelId, { candles: candles.slice(-500) })),

      pushCandle: (panelId, candle) =>
        set((state) => {
          const panel = state.panels[panelId];
          const newCandles = [...panel.candles];
          if (newCandles.length > 0 && newCandles[newCandles.length - 1].time === candle.time) {
            newCandles[newCandles.length - 1] = candle;
          } else {
            newCandles.push(candle);
          }
          if (newCandles.length > 500) {
            newCandles.splice(0, newCandles.length - 500);
          }
          return updatePanel(state, panelId, { candles: newCandles });
        }),

      pushTrade: (panelId, trade) =>
        set((state) => {
          const panel = state.panels[panelId];
          const newTrades = [...panel.trades, trade];
          if (newTrades.length > 5000) {
            newTrades.splice(0, newTrades.length - 5000);
          }
          return updatePanel(state, panelId, { trades: newTrades });
        }),

      // Global actions
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setActivePanel: (activePanel) => set({ activePanel }),
      setSplitRatio: (splitRatio) => set({ splitRatio: Math.max(0.15, Math.min(0.85, splitRatio)) }),
      setTickSize: (tickSize) => set({ tickSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'orderflow-settings',
      version: 4,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version: number) => {
        if (version < 3) {
          // Clear stale v1/v2 data — return fresh defaults
          return {};
        }
        if (version === 3) {
          // Ensure footprintMode is initialized
          const update = (p: any) => ({
            ...p,
            footprintMode: p.footprintMode || 'bid-ask'
          });
          if (persisted.panels) {
            if (persisted.panels.left) persisted.panels.left = update(persisted.panels.left);
            if (persisted.panels.right) persisted.panels.right = update(persisted.panels.right);
          }
        }
        return persisted;
      },
      merge: (persistedState: any, currentState: ChartState) => {
        if (!persistedState) return currentState;
        return {
          ...currentState,
          ...persistedState,
          panels: {
            left: {
              ...currentState.panels.left,
              ...(persistedState.panels?.left || {}),
            },
            right: {
              ...currentState.panels.right,
              ...(persistedState.panels?.right || {}),
            },
          },
        };
      },
      partialize: (state) => ({
        layoutMode: state.layoutMode,
        splitRatio: state.splitRatio,
        panels: {
          left: {
            pair: state.panels.left.pair,
            timeframe: state.panels.left.timeframe,
            chartMode: state.panels.left.chartMode,
            footprintMode: state.panels.left.footprintMode,
            bucketSize: state.panels.left.bucketSize,
            barWidth: state.panels.left.barWidth,
          },
          right: {
            pair: state.panels.right.pair,
            timeframe: state.panels.right.timeframe,
            chartMode: state.panels.right.chartMode,
            footprintMode: state.panels.right.footprintMode,
            bucketSize: state.panels.right.bucketSize,
            barWidth: state.panels.right.barWidth,
          },
        },
        tickSize: state.tickSize,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

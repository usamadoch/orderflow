import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { FootprintMode } from '../../types/footprint';
import { AbsorptionResult } from '../../types/absorption';
import { BubbleSide } from '../../components/chart/drawBubbles';

export type ChartMode = 'candle' | 'footprint';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';
export type AbsorptionSide = 'both' | 'buyer' | 'seller';
export type { BubbleSide };

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
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  absorptionMap: Map<number, AbsorptionResult>;
  bubblesEnabled: boolean;
  bubbleThreshold: number;
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
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
  setAbsorptionEnabled: (panelId: PanelId, enabled: boolean) => void;
  setAbsorptionMinScore: (panelId: PanelId, score: number) => void;
  setAbsorptionSide: (panelId: PanelId, side: AbsorptionSide) => void;
  setAbsorptionShowLabels: (panelId: PanelId, show: boolean) => void;
  setAbsorptionMap: (panelId: PanelId, map: Map<number, AbsorptionResult>) => void;
  setBubblesEnabled: (panelId: PanelId, enabled: boolean) => void;
  setBubbleThreshold: (panelId: PanelId, threshold: number) => void;
  setBubbleMinRadius: (panelId: PanelId, radius: number) => void;
  setBubbleMaxRadius: (panelId: PanelId, radius: number) => void;
  setBubbleSide: (panelId: PanelId, side: BubbleSide) => void;

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
    absorptionEnabled: true,
    absorptionMinScore: 50,
    absorptionSide: 'both' as AbsorptionSide,
    absorptionShowLabels: true,
    absorptionMap: new Map(),
    bubblesEnabled: true,
    bubbleThreshold: 50,
    bubbleMinRadius: 4,
    bubbleMaxRadius: 20,
    bubbleSide: 'both' as BubbleSide,
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

      setAbsorptionEnabled: (panelId, absorptionEnabled) =>
        set((state) => updatePanel(state, panelId, { absorptionEnabled })),

      setAbsorptionMinScore: (panelId, absorptionMinScore) =>
        set((state) => updatePanel(state, panelId, { absorptionMinScore: Math.max(0, Math.min(100, absorptionMinScore)) })),

      setAbsorptionSide: (panelId, absorptionSide) =>
        set((state) => updatePanel(state, panelId, { absorptionSide })),

      setAbsorptionShowLabels: (panelId, absorptionShowLabels) =>
        set((state) => updatePanel(state, panelId, { absorptionShowLabels })),

      setAbsorptionMap: (panelId, absorptionMap) =>
        set((state) => updatePanel(state, panelId, { absorptionMap })),

      setBubblesEnabled: (panelId, bubblesEnabled) =>
        set((state) => updatePanel(state, panelId, { bubblesEnabled })),

      setBubbleThreshold: (panelId, bubbleThreshold) =>
        set((state) => updatePanel(state, panelId, { bubbleThreshold: Math.max(1, bubbleThreshold) })),

      setBubbleMinRadius: (panelId, bubbleMinRadius) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { bubbleMinRadius: Math.min(bubbleMinRadius, panel.bubbleMaxRadius - 1) });
        }),

      setBubbleMaxRadius: (panelId, bubbleMaxRadius) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { bubbleMaxRadius: Math.max(bubbleMaxRadius, panel.bubbleMinRadius + 1) });
        }),

      setBubbleSide: (panelId, bubbleSide) =>
        set((state) => updatePanel(state, panelId, { bubbleSide })),

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
      version: 6,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version: number) => {
        if (version < 3) {
          // Clear stale v1/v2 data — return fresh defaults
          return {};
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ensurePanel = (p: any) => {
          if (!p) return p;
          return {
            ...p,
            footprintMode: p.footprintMode || 'bid-ask',
            absorptionEnabled: p.absorptionEnabled ?? true,
            absorptionMinScore: p.absorptionMinScore ?? 50,
            absorptionSide: p.absorptionSide || 'both',
            absorptionShowLabels: p.absorptionShowLabels ?? true,
            bubblesEnabled: p.bubblesEnabled ?? true,
            bubbleThreshold: p.bubbleThreshold ?? 50,
            bubbleMinRadius: p.bubbleMinRadius ?? 4,
            bubbleMaxRadius: p.bubbleMaxRadius ?? 20,
            bubbleSide: p.bubbleSide || 'both',
          };
        };
        if (persisted.panels) {
          if (persisted.panels.left) persisted.panels.left = ensurePanel(persisted.panels.left);
          if (persisted.panels.right) persisted.panels.right = ensurePanel(persisted.panels.right);
        }
        return persisted;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            absorptionEnabled: state.panels.left.absorptionEnabled,
            absorptionMinScore: state.panels.left.absorptionMinScore,
            absorptionSide: state.panels.left.absorptionSide,
            absorptionShowLabels: state.panels.left.absorptionShowLabels,
            bubblesEnabled: state.panels.left.bubblesEnabled,
            bubbleThreshold: state.panels.left.bubbleThreshold,
            bubbleMinRadius: state.panels.left.bubbleMinRadius,
            bubbleMaxRadius: state.panels.left.bubbleMaxRadius,
            bubbleSide: state.panels.left.bubbleSide,
          },
          right: {
            pair: state.panels.right.pair,
            timeframe: state.panels.right.timeframe,
            chartMode: state.panels.right.chartMode,
            footprintMode: state.panels.right.footprintMode,
            bucketSize: state.panels.right.bucketSize,
            barWidth: state.panels.right.barWidth,
            absorptionEnabled: state.panels.right.absorptionEnabled,
            absorptionMinScore: state.panels.right.absorptionMinScore,
            absorptionSide: state.panels.right.absorptionSide,
            absorptionShowLabels: state.panels.right.absorptionShowLabels,
            bubblesEnabled: state.panels.right.bubblesEnabled,
            bubbleThreshold: state.panels.right.bubbleThreshold,
            bubbleMinRadius: state.panels.right.bubbleMinRadius,
            bubbleMaxRadius: state.panels.right.bubbleMaxRadius,
            bubbleSide: state.panels.right.bubbleSide,
          },
        },
        tickSize: state.tickSize,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

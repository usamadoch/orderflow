import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { AbsorptionResult } from '../../types/absorption';
import { ExhaustionResult } from '../../types/exhaustion';
import { IcebergLevel } from '../../types/iceberg';
import { LiquidityVacuumZone } from '../../types/liquidityVacuum';
import { LiquidityZone } from '../../types/liquidity';
import type { BubbleEvent } from '../../types/bubble';
import { MAX_AGGREGATE_BUBBLE_EVENTS } from './chart';
import type { GlobalCrosshair, HistoryRestoreStatus, Measurement, PanelId } from './chart';

export interface PanelRuntimeState {
  candles: Candle[];
  trades: Trade[];
  connected: boolean;
  isLoadingHistory: boolean;
  historyRestoreStatus: HistoryRestoreStatus | null;
  footprintTrigger: number;
  absorptionMap: Map<number, AbsorptionResult>;
  exhaustionMap: Map<number, ExhaustionResult>;
  aggregateBubbleEvents: BubbleEvent[];
  isProfileSelected: boolean;
  icebergLevels: IcebergLevel[];
  liquidityVacuumZones: LiquidityVacuumZone[];
  liquidityZones: LiquidityZone[];
  measureToolActive: boolean;
  activeMeasurement: Measurement | null;
}

interface ChartRuntimeState {
  panels: Record<PanelId, PanelRuntimeState>;
  crosshair: GlobalCrosshair;
  resetPanelRuntime: (panelId: PanelId) => void;
  setConnected: (panelId: PanelId, connected: boolean) => void;
  setLoadingHistory: (panelId: PanelId, isLoadingHistory: boolean) => void;
  setHistoryRestoreStatus: (panelId: PanelId, status: HistoryRestoreStatus | null) => void;
  pushCandle: (panelId: PanelId, candle: Candle) => void;
  pushAllCandles: (panelId: PanelId, candles: Candle[]) => void;
  pushTrade: (panelId: PanelId, trade: Trade) => void;
  triggerFootprintRedraw: (panelId: PanelId) => void;
  setAbsorptionMap: (panelId: PanelId, map: Map<number, AbsorptionResult>) => void;
  setExhaustionMap: (panelId: PanelId, map: Map<number, ExhaustionResult>) => void;
  appendAggregateBubbleEvents: (panelId: PanelId, events: BubbleEvent[]) => void;
  clearAggregateBubbleEvents: (panelId: PanelId) => void;
  setProfileSelected: (panelId: PanelId, selected: boolean) => void;
  setIcebergLevels: (panelId: PanelId, levels: IcebergLevel[]) => void;
  setLiquidityVacuumZones: (panelId: PanelId, zones: LiquidityVacuumZone[]) => void;
  setLiquidityZones: (panelId: PanelId, zones: LiquidityZone[]) => void;
  setMeasureToolActive: (panelId: PanelId, active: boolean) => void;
  setActiveMeasurement: (panelId: PanelId, measurement: Measurement | null) => void;
  setCrosshair: (crosshair: GlobalCrosshair) => void;
}

function createDefaultRuntimePanel(): PanelRuntimeState {
  return {
    candles: [],
    trades: [],
    connected: false,
    isLoadingHistory: false,
    historyRestoreStatus: null,
    footprintTrigger: 0,
    absorptionMap: new Map(),
    exhaustionMap: new Map(),
    aggregateBubbleEvents: [],
    isProfileSelected: false,
    icebergLevels: [],
    liquidityVacuumZones: [],
    liquidityZones: [],
    measureToolActive: false,
    activeMeasurement: null,
  };
}

function updateRuntimePanel(
  state: ChartRuntimeState,
  panelId: PanelId,
  updates: Partial<PanelRuntimeState>,
): Partial<ChartRuntimeState> {
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

function mergeCandles(existing: Candle[], incoming: Candle[]) {
  const byTime = new Map<number, Candle>();

  for (const candle of existing) {
    byTime.set(candle.time, candle);
  }

  for (const candle of incoming) {
    const current = byTime.get(candle.time);
    if (!current) {
      byTime.set(candle.time, candle);
      continue;
    }

    if (current.isClosed && !candle.isClosed) {
      continue;
    }

    byTime.set(candle.time, candle);
  }

  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-500);
}

function getAggregateBubbleEventKey(event: BubbleEvent) {
  if (Number.isFinite(event.aggregateTradeId)) {
    return `${event.symbol}:${event.contractType}:id:${event.aggregateTradeId}`;
  }

  return `${event.symbol}:${event.contractType}:${event.time}:${event.price}:${event.volume}:${event.side}`;
}

function mergeAggregateBubbleEvents(existing: BubbleEvent[], incoming: BubbleEvent[]) {
  const byKey = new Map<string, BubbleEvent>();

  for (const event of existing) {
    byKey.set(getAggregateBubbleEventKey(event), event);
  }

  for (const event of incoming) {
    const key = getAggregateBubbleEventKey(event);
    if (byKey.has(key)) continue;
    byKey.set(key, event);
  }

  return Array.from(byKey.values())
    .sort((a, b) => a.time - b.time || (a.aggregateTradeId ?? 0) - (b.aggregateTradeId ?? 0))
    .slice(-MAX_AGGREGATE_BUBBLE_EVENTS);
}

export const useChartRuntimeStore = create<ChartRuntimeState>()(
  subscribeWithSelector((set) => ({
  panels: {
    left: createDefaultRuntimePanel(),
    right: createDefaultRuntimePanel(),
  },
  crosshair: { activePanel: null, time: null, price: null },

  resetPanelRuntime: (panelId) =>
    set((state) => updateRuntimePanel(state, panelId, createDefaultRuntimePanel())),

  setConnected: (panelId, connected) =>
    set((state) => updateRuntimePanel(state, panelId, { connected })),

  setLoadingHistory: (panelId, isLoadingHistory) =>
    set((state) => updateRuntimePanel(state, panelId, { isLoadingHistory })),

  setHistoryRestoreStatus: (panelId, historyRestoreStatus) =>
    set((state) => updateRuntimePanel(state, panelId, { historyRestoreStatus })),

  pushAllCandles: (panelId, candles) =>
    set((state) => {
      const panel = state.panels[panelId];
      return updateRuntimePanel(state, panelId, { candles: mergeCandles(panel.candles, candles) });
    }),

  pushCandle: (panelId, candle) =>
    set((state) => {
      const panel = state.panels[panelId];
      return updateRuntimePanel(state, panelId, { candles: mergeCandles(panel.candles, [candle]) });
    }),

  pushTrade: (panelId, trade) =>
    set((state) => {
      const panel = state.panels[panelId];
      const trades = [...panel.trades, trade];
      if (trades.length > 5000) {
        trades.splice(0, trades.length - 5000);
      }
      return updateRuntimePanel(state, panelId, { trades });
    }),

  triggerFootprintRedraw: (panelId) =>
    set((state) => updateRuntimePanel(state, panelId, { footprintTrigger: Date.now() })),

  setAbsorptionMap: (panelId, absorptionMap) =>
    set((state) => updateRuntimePanel(state, panelId, { absorptionMap })),

  setExhaustionMap: (panelId, exhaustionMap) =>
    set((state) => updateRuntimePanel(state, panelId, { exhaustionMap })),

  appendAggregateBubbleEvents: (panelId, events) =>
    set((state) => {
      if (events.length === 0) return {};
      const panel = state.panels[panelId];
      const aggregateBubbleEvents = mergeAggregateBubbleEvents(panel.aggregateBubbleEvents, events);
      return updateRuntimePanel(state, panelId, { aggregateBubbleEvents });
    }),

  clearAggregateBubbleEvents: (panelId) =>
    set((state) => updateRuntimePanel(state, panelId, { aggregateBubbleEvents: [] })),

  setProfileSelected: (panelId, isProfileSelected) =>
    set((state) => updateRuntimePanel(state, panelId, { isProfileSelected })),

  setIcebergLevels: (panelId, icebergLevels) =>
    set((state) => updateRuntimePanel(state, panelId, { icebergLevels })),

  setLiquidityVacuumZones: (panelId, liquidityVacuumZones) =>
    set((state) => updateRuntimePanel(state, panelId, { liquidityVacuumZones })),

  setLiquidityZones: (panelId, liquidityZones) =>
    set((state) => updateRuntimePanel(state, panelId, { liquidityZones })),

  setMeasureToolActive: (panelId, measureToolActive) =>
    set((state) => {
      const updates: Partial<PanelRuntimeState> = { measureToolActive };
      if (!measureToolActive) {
        updates.activeMeasurement = null;
      }
      return updateRuntimePanel(state, panelId, updates);
    }),

  setActiveMeasurement: (panelId, activeMeasurement) =>
    set((state) => updateRuntimePanel(state, panelId, { activeMeasurement })),

  setCrosshair: (crosshair) => set({ crosshair }),
  })),
);

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
import type {
  AccountSnapshot,
  BracketDragState,
  BracketOrder,
  MarketOrderDragState,
  OrderCancelRequest,
  OrderModifyRequest,
  OrderRequest,
  OrderResult,
  TradingConnectionStatus,
  TradingMode,
  TradingModeBadge,
  TradingRiskStatusPayload,
  TradingUserStreamStatusPayload,
  VirtualPosition,
} from '../../types/trading';
import { MAX_AGGREGATE_BUBBLE_EVENTS } from './chart';
import type { PanelRuntimeState, TradingRuntimeStatus, GlobalCrosshair, HistoryRestoreStatus, Measurement, PanelId } from '../../types/chart';

export type { PanelRuntimeState, TradingRuntimeStatus };

export interface MT5PositionPayload {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  openPrice: number;
  sl: number;
  tp: number;
  profit: number;
  volume: number;
}

interface ChartRuntimeState {
  panels: Record<PanelId, PanelRuntimeState>;
  crosshair: GlobalCrosshair;
  tradingStatus: TradingRuntimeStatus;
  resetPanelRuntime: (panelId: PanelId) => void;
  triggerPanelRefresh: (panelId: PanelId) => void;
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
  setTradingStatus: (status: Partial<TradingRuntimeStatus>) => void;
  setMT5Status: (connected: boolean, accountName: string, pnl: number) => void;
  setMT5BridgeStatus: (status: 'connected' | 'disconnected' | 'connecting' | 'paused') => void;
  syncMT5Bridge: () => Promise<boolean>;
  syncMT5Positions: (positions: MT5PositionPayload[]) => void;
  // ── Virtual Position actions ──────────────────────────────────────────────
  /** Upsert a virtual position derived from fills; updates unrealized PnL if markPrice is supplied. */
  upsertVirtualPosition: (position: VirtualPosition) => void;
  /** Remove a virtual position and its associated bracket by id. */
  removeVirtualPosition: (positionId: string) => void;
  /** Upsert a bracket order for the given virtual position. */
  upsertBracketOrder: (bracket: BracketOrder) => void;
  /** Remove a bracket order by id. */
  removeBracketOrder: (bracketId: string) => void;
  /** Set or clear the bracket drag state (used while the user drags SL/TP handles). */
  setBracketDrag: (drag: BracketDragState | null) => void;
  /** Set or clear the market order drag state (used while dragging the price line). */
  setMarketOrderDrag: (drag: MarketOrderDragState | null) => void;
  /** Set or clear the pending market order ID during an in-flight order. */
  setPendingMarketOrderId: (id: string | null) => void;
  /** Recalculate unrealized PnL for all open virtual positions against a new mark price. */
  updateVirtualPnl: (symbol: string, markPrice: number) => void;
  refreshRiskStatus: () => Promise<TradingRiskStatusPayload | null>;
  refreshAccountSnapshot: (symbol?: string, limit?: number) => Promise<void>;
  refreshUserStreamStatus: (symbol?: string, limit?: number) => Promise<void>;
  placeOrder: (request: OrderRequest) => Promise<OrderResult>;
  cancelOrder: (request: OrderCancelRequest) => Promise<OrderResult>;
  modifyOrder: (request: OrderModifyRequest) => Promise<OrderResult>;
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
    refreshKey: 0,
    dataVersion: 0,
  };
}

function createDefaultTradingStatus(): TradingRuntimeStatus {
  return {
    currentMode: 'binance_testnet',
    connectionStatus: 'unknown',
    modeBadge: 'testnet',
    lastHealthCheckAt: null,
    lastErrorMessage: null,
    balances: [],
    openOrders: [],
    positions: [],
    recentTrades: [],
    lastSnapshotAt: null,
    snapshotLoading: false,
    snapshotError: null,
    userStreamStatus: 'idle',
    userStreamConnected: false,
    userStreamLastEventAt: null,
    userStreamReconnectCount: 0,
    userStreamLastError: null,
    reconciliationLoading: false,
    lastReconciledAt: null,
    orderActionLoading: false,
    orderActionError: null,
    orderActionSuccess: null,
    modifyingOrderId: null,
    dragPreviewPrice: null,
    modifyLoading: false,
    modifyError: null,
    modifySuccess: null,
    riskStatus: null,
    riskLoading: false,
    riskError: null,
    liveBlocked: false,
    killSwitchActive: false,
    riskBlockReasons: [],
    virtualPositions: [],
    bracketOrders: [],
    bracketDrag: null,
    marketOrderDrag: null,
    pendingMarketOrderId: null,
    mt5Connected: false,
    mt5AccountName: '',
    mt5Pnl: 0,
    mt5BridgeStatus: 'connecting',
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

function mergeCandlesInPlace(existing: Candle[], incoming: Candle[]) {
  if (incoming.length === 0) return;

  // Fast path for live ticks
  if (incoming.length === 1 && existing.length > 0) {
    const newCandle = incoming[0];
    const lastExisting = existing[existing.length - 1];
    
    if (newCandle.time === lastExisting.time) {
      if (!(lastExisting.isClosed && !newCandle.isClosed)) {
        existing[existing.length - 1] = newCandle;
      }
      return;
    } else if (newCandle.time > lastExisting.time) {
      existing.push(newCandle);
      if (existing.length > 50000) {
        existing.splice(0, existing.length - 50000);
      }
      return;
    }
  }

  const byTime = new Map<number, Candle>();

  for (let i = 0; i < existing.length; i++) {
    const candle = existing[i];
    byTime.set(candle.time, candle);
  }

  for (let i = 0; i < incoming.length; i++) {
    const candle = incoming[i];
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

  const merged = Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-50000);
    
  existing.length = 0;
  for (let i = 0; i < merged.length; i++) {
    existing.push(merged[i]);
  }
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
  subscribeWithSelector((set, get) => ({
  panels: {
    left: createDefaultRuntimePanel(),
    right: createDefaultRuntimePanel(),
  },
  crosshair: { activePanel: null, time: null, price: null },
  tradingStatus: createDefaultTradingStatus(),

  resetPanelRuntime: (panelId) =>
    set((state) => updateRuntimePanel(state, panelId, createDefaultRuntimePanel())),

  triggerPanelRefresh: (panelId) =>
    set((state) => updateRuntimePanel(state, panelId, { refreshKey: state.panels[panelId].refreshKey + 1 })),

  setConnected: (panelId, connected) =>
    set((state) => updateRuntimePanel(state, panelId, { connected })),

  setLoadingHistory: (panelId, isLoadingHistory) =>
    set((state) => updateRuntimePanel(state, panelId, { isLoadingHistory })),

  setHistoryRestoreStatus: (panelId, historyRestoreStatus) =>
    set((state) => updateRuntimePanel(state, panelId, { historyRestoreStatus })),

  pushAllCandles: (panelId, candles) =>
    set((state) => {
      const panel = state.panels[panelId];
      mergeCandlesInPlace(panel.candles, candles);
      return updateRuntimePanel(state, panelId, { dataVersion: (panel.dataVersion || 0) + 1 });
    }),

  pushCandle: (panelId, candle) =>
    set((state) => {
      const panel = state.panels[panelId];
      mergeCandlesInPlace(panel.candles, [candle]);
      return updateRuntimePanel(state, panelId, { dataVersion: (panel.dataVersion || 0) + 1 });
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

  setTradingStatus: (status) =>
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        ...status,
      },
    })),

  setMT5Status: (connected, accountName, pnl) =>
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        mt5Connected: connected,
        mt5AccountName: accountName,
        mt5Pnl: pnl,
      },
    })),

  setMT5BridgeStatus: (status) =>
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        mt5BridgeStatus: status,
      },
    })),

  syncMT5Bridge: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('http://localhost:3001/status', {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        set((state) => ({
          tradingStatus: {
            ...state.tradingStatus,
            mt5Connected: Boolean(data.connected),
            mt5AccountName: data.accountName || '',
            mt5Pnl: typeof data.pnl === 'number' ? data.pnl : 0,
            mt5BridgeStatus: data.connected ? 'connected' : 'disconnected',
          },
        }));

        if (Array.isArray(data.positions)) {
          get().syncMT5Positions(data.positions);
        }
        return true;
      } else {
        set((state) => ({
          tradingStatus: {
            ...state.tradingStatus,
            mt5Connected: false,
            mt5AccountName: '',
            mt5Pnl: 0,
            mt5BridgeStatus: 'disconnected',
          },
        }));
        return false;
      }
    } catch {
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          mt5Connected: false,
          mt5AccountName: '',
          mt5Pnl: 0,
          mt5BridgeStatus: 'disconnected',
        },
      }));
      return false;
    }
  },

  syncMT5Positions: (positions) =>
    set((state) => {
      const activeTickets = new Set(positions.map((p) => p.ticket.toString()));
      const currentVps = state.tradingStatus.virtualPositions;
      const currentBrackets = state.tradingStatus.bracketOrders;

      const nextVps = currentVps.filter((p) => {
        const isMt5Ticket = /^\d+$/.test(p.id);
        if (!isMt5Ticket) return true;
        return activeTickets.has(p.id);
      });

      const nextBrackets = currentBrackets.filter((b) => {
        const isMt5Ticket = /^\d+$/.test(b.positionId);
        if (!isMt5Ticket) return true;
        return activeTickets.has(b.positionId);
      });

      for (const pos of positions) {
        const vpId = pos.ticket.toString();
        const symbol = pos.symbol.endsWith('USD') ? pos.symbol.replace('USD', 'USDT') : pos.symbol;
        const side = (pos.type === 'BUY' || (pos.type as string) === 'buy') ? 'long' : 'short';

        const existingVpIdx = nextVps.findIndex((p) => p.id === vpId);
        const vp: VirtualPosition = {
          id: vpId,
          symbol,
          side,
          quantity: pos.volume || 1,
          entryPrice: pos.openPrice,
          unrealizedPnl: pos.profit,
          status: 'open',
          openedAt: existingVpIdx !== -1 ? nextVps[existingVpIdx].openedAt : Date.now(),
          fillIds: [],
        };

        if (existingVpIdx === -1) {
          nextVps.push(vp);
        } else {
          nextVps[existingVpIdx] = { ...nextVps[existingVpIdx], ...vp };
        }

        const existingBracketIdx = nextBrackets.findIndex((b) => b.positionId === vpId);
        const existingBracket = existingBracketIdx !== -1 ? nextBrackets[existingBracketIdx] : undefined;
        const isRecentUserModification = existingBracket?.updatedAt && (Date.now() - existingBracket.updatedAt < 6000);

        let finalSl: number | undefined;
        let finalSlStatus: BracketOrder['stopLossStatus'] = 'none';
        if (isRecentUserModification) {
          finalSl = existingBracket?.stopLossPrice;
          finalSlStatus = existingBracket?.stopLossStatus ?? 'none';
        } else {
          finalSl = pos.sl > 0 ? pos.sl : undefined;
          finalSlStatus = pos.sl > 0 ? 'active' : 'none';
        }

        let finalTp: number | undefined;
        let finalTpStatus: BracketOrder['takeProfitStatus'] = 'none';
        if (isRecentUserModification) {
          finalTp = existingBracket?.takeProfitPrice;
          finalTpStatus = existingBracket?.takeProfitStatus ?? 'none';
        } else {
          finalTp = pos.tp > 0 ? pos.tp : undefined;
          finalTpStatus = pos.tp > 0 ? 'active' : 'none';
        }

        const bracket: BracketOrder = {
          id: `bracket-${vpId}`,
          positionId: vpId,
          symbol,
          stopLossPrice: finalSl,
          takeProfitPrice: finalTp,
          stopLossStatus: finalSlStatus,
          takeProfitStatus: finalTpStatus,
          updatedAt: existingBracket?.updatedAt ?? Date.now(),
        };

        if (existingBracketIdx === -1) {
          nextBrackets.push(bracket);
        } else {
          nextBrackets[existingBracketIdx] = { ...nextBrackets[existingBracketIdx], ...bracket };
        }
      }

      return {
        tradingStatus: {
          ...state.tradingStatus,
          virtualPositions: nextVps,
          bracketOrders: nextBrackets,
        },
      };
    }),

  upsertVirtualPosition: (position) =>
    set((state) => {
      const existing = state.tradingStatus.virtualPositions;
      const idx = existing.findIndex((p) => p.id === position.id);
      const next = idx === -1
        ? [...existing, position]
        : existing.map((p) => (p.id === position.id ? { ...p, ...position } : p));
      return { tradingStatus: { ...state.tradingStatus, virtualPositions: next } };
    }),

  removeVirtualPosition: (positionId) =>
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        virtualPositions: state.tradingStatus.virtualPositions.filter((p) => p.id !== positionId),
        bracketOrders: state.tradingStatus.bracketOrders.filter((b) => b.positionId !== positionId),
      },
    })),

  upsertBracketOrder: (bracket) =>
    set((state) => {
      const existing = state.tradingStatus.bracketOrders;
      const idx = existing.findIndex((b) => b.id === bracket.id);
      const next = idx === -1
        ? [...existing, bracket]
        : existing.map((b) => (b.id === bracket.id ? { ...b, ...bracket } : b));
      return { tradingStatus: { ...state.tradingStatus, bracketOrders: next } };
    }),

  removeBracketOrder: (bracketId) =>
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        bracketOrders: state.tradingStatus.bracketOrders.filter((b) => b.id !== bracketId),
      },
    })),

  setBracketDrag: (drag) =>
    set((state) => ({ tradingStatus: { ...state.tradingStatus, bracketDrag: drag } })),

  setMarketOrderDrag: (drag) =>
    set((state) => ({ tradingStatus: { ...state.tradingStatus, marketOrderDrag: drag } })),

  setPendingMarketOrderId: (id) =>
    set((state) => ({ tradingStatus: { ...state.tradingStatus, pendingMarketOrderId: id } })),

  updateVirtualPnl: (symbol, markPrice) =>
    set((state) => {
      const virtualPositions = state.tradingStatus.virtualPositions.map((p) => {
        if (p.symbol.toUpperCase() !== symbol.toUpperCase() || p.status !== 'open') return p;
        const pnlPerUnit = p.side === 'long'
          ? markPrice - p.entryPrice
          : p.entryPrice - markPrice;
        return { ...p, unrealizedPnl: pnlPerUnit * p.quantity };
      });
      return { tradingStatus: { ...state.tradingStatus, virtualPositions } };
    }),

  refreshRiskStatus: async () => {
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        riskLoading: true,
        riskError: null,
      },
    }));

    try {
      const response = await fetch('/api/trading/risk-status', { cache: 'no-store' });
      const body = (await response.json()) as TradingRiskStatusPayload & { errorMessage?: string };

      if (!response.ok) {
        throw new Error(body.errorMessage ?? `Risk status refresh failed with HTTP ${response.status}.`);
      }

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: body.mode,
          modeBadge: body.modeBadge,
          riskStatus: body,
          riskLoading: false,
          riskError: null,
          liveBlocked: body.liveBlocked,
          killSwitchActive: body.killSwitchActive,
          riskBlockReasons: body.blockReasons,
        },
      }));

      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Risk status refresh failed.';
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          riskLoading: false,
          riskError: message,
          lastErrorMessage: message,
        },
      }));
      return null;
    }
  },

  refreshAccountSnapshot: async (symbol, limit = 50) => {
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        snapshotLoading: true,
        snapshotError: null,
        reconciliationLoading: true,
      },
    }));

    try {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol.toUpperCase());
      if (Number.isFinite(limit)) params.set('limit', String(Math.trunc(limit)));

      const query = params.toString();
      const response = await fetch(`/api/trading/account-snapshot${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as AccountSnapshot & { errorMessage?: string };

      if (!response.ok) {
        throw new Error(body.errorMessage ?? `Account snapshot refresh failed with HTTP ${response.status}.`);
      }

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: body.mode,
          connectionStatus: body.connectionStatus,
          modeBadge: getModeBadge(body.mode),
          balances: body.balances,
          openOrders: body.openOrders,
          positions: body.positions,
          recentTrades: body.recentTrades,
          lastSnapshotAt: body.checkedAt,
          lastReconciledAt: body.checkedAt,
          snapshotLoading: false,
          reconciliationLoading: false,
          snapshotError: null,
          lastErrorMessage: null,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Account snapshot refresh failed.';
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          snapshotLoading: false,
          reconciliationLoading: false,
          snapshotError: message,
          lastErrorMessage: message,
        },
      }));
    }
  },

  refreshUserStreamStatus: async (symbol, limit = 50) => {
    try {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol.toUpperCase());
      if (Number.isFinite(limit)) params.set('limit', String(Math.trunc(limit)));

      const query = params.toString();
      const response = await fetch(`/api/trading/stream-status${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as TradingUserStreamStatusPayload;

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: body.mode,
          modeBadge: getModeBadge(body.mode),
          connectionStatus: getConnectionStatusFromUserStream(body),
          userStreamStatus: body.streamStatus,
          userStreamConnected: body.connected,
          userStreamLastEventAt: body.lastEventAt,
          userStreamReconnectCount: body.reconnectCount,
          userStreamLastError: body.lastErrorMessage,
          reconciliationLoading: body.reconciliationLoading,
          lastReconciledAt: body.lastReconciledAt,
          lastErrorMessage: response.ok ? body.lastErrorMessage : body.lastErrorMessage ?? 'User stream status refresh failed.',
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'User stream status refresh failed.';
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          userStreamStatus: 'error',
          userStreamConnected: false,
          userStreamLastError: message,
          lastErrorMessage: message,
        },
      }));
    }
  },

  placeOrder: async (request) => {
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        orderActionLoading: true,
        orderActionError: null,
        orderActionSuccess: null,
      },
    }));

    try {
      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      const body = (await response.json()) as OrderResult;

      if (!response.ok || !body.success) {
        throw new Error(body.errorMessage ?? `Order placement failed with HTTP ${response.status}.`);
      }

      const successMessage = formatOrderActionSuccess('Placed', body);
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: body.mode,
          modeBadge: getModeBadge(body.mode),
          orderActionLoading: false,
          orderActionError: null,
          orderActionSuccess: successMessage,
          lastErrorMessage: null,
        },
      }));

      await Promise.allSettled([
        get().refreshRiskStatus(),
        get().refreshAccountSnapshot(request.symbol, 50),
        get().refreshUserStreamStatus(request.symbol, 50),
      ]);

      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order placement failed.';
      const result: OrderResult = {
        success: false,
        mode: get().tradingStatus.currentMode,
        errorMessage: message,
        rejectedReason: 'order_place_failed',
      };

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          orderActionLoading: false,
          orderActionError: message,
          orderActionSuccess: null,
          lastErrorMessage: message,
        },
      }));

      void get().refreshRiskStatus();
      return result;
    }
  },

  cancelOrder: async (request) => {
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        orderActionLoading: true,
        orderActionError: null,
        orderActionSuccess: null,
      },
    }));

    try {
      const response = await fetch('/api/trading/orders', {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      const body = (await response.json()) as OrderResult;

      if (!response.ok || !body.success) {
        throw new Error(body.errorMessage ?? `Order cancellation failed with HTTP ${response.status}.`);
      }

      const successMessage = formatOrderActionSuccess('Cancelled', body);
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: body.mode,
          modeBadge: getModeBadge(body.mode),
          orderActionLoading: false,
          orderActionError: null,
          orderActionSuccess: successMessage,
          lastErrorMessage: null,
        },
      }));

      await Promise.allSettled([
        get().refreshRiskStatus(),
        get().refreshAccountSnapshot(request.symbol, 50),
        get().refreshUserStreamStatus(request.symbol, 50),
      ]);

      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order cancellation failed.';
      const result: OrderResult = {
        success: false,
        mode: get().tradingStatus.currentMode,
        errorMessage: message,
        rejectedReason: 'order_cancel_failed',
      };

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          orderActionLoading: false,
          orderActionError: message,
          orderActionSuccess: null,
          lastErrorMessage: message,
        },
      }));

      return result;
    }
  },

  modifyOrder: async (request) => {
    const validationError = validateModifyRequest(request, get().tradingStatus.currentMode);
    if (validationError) {
      const result: OrderResult = {
        success: false,
        mode: get().tradingStatus.currentMode,
        errorMessage: validationError,
        rejectedReason: 'order_modify_invalid',
      };

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          modifyingOrderId: request.orderId ?? request.clientOrderId ?? null,
          modifyLoading: false,
          modifyError: validationError,
          modifySuccess: null,
          lastErrorMessage: validationError,
        },
      }));

      return result;
    }

    const riskStatus = await get().refreshRiskStatus();
    const riskBlock = getClientOrderRiskBlock(request, riskStatus);
    if (riskBlock) {
      const result: OrderResult = {
        success: false,
        mode: get().tradingStatus.currentMode,
        errorMessage: riskBlock,
        rejectedReason: 'order_modify_risk_blocked',
      };

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          modifyingOrderId: request.orderId ?? request.clientOrderId ?? null,
          modifyLoading: false,
          modifyError: riskBlock,
          modifySuccess: null,
          lastErrorMessage: riskBlock,
        },
      }));

      return result;
    }

    const modifyingOrderId = request.orderId ?? request.clientOrderId ?? null;
    set((state) => ({
      tradingStatus: {
        ...state.tradingStatus,
        modifyingOrderId,
        modifyLoading: true,
        modifyError: null,
        modifySuccess: null,
        orderActionError: null,
        orderActionSuccess: null,
      },
    }));

    try {
      const cancelResponse = await fetch('/api/trading/orders', {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: request.symbol,
          contractType: 'spot',
          orderId: request.orderId,
          clientOrderId: request.clientOrderId,
        }),
      });
      const cancelBody = (await cancelResponse.json()) as OrderResult;

      if (!cancelResponse.ok || !cancelBody.success) {
        throw new Error(cancelBody.errorMessage ?? `Order cancellation failed with HTTP ${cancelResponse.status}.`);
      }

      const placeResponse = await fetch('/api/trading/orders', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: request.symbol,
          contractType: 'spot',
          side: request.side,
          type: 'limit',
          quantity: request.quantity,
          price: request.price,
          timeInForce: request.timeInForce ?? 'GTC',
          confirmed: true,
        }),
      });
      const placeBody = (await placeResponse.json()) as OrderResult;

      if (!placeResponse.ok || !placeBody.success) {
        throw new Error(placeBody.errorMessage ?? `Replacement order failed with HTTP ${placeResponse.status}.`);
      }

      const successMessage = formatModifySuccess(request, placeBody);
      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          currentMode: placeBody.mode,
          modeBadge: getModeBadge(placeBody.mode),
          modifyingOrderId: null,
          dragPreviewPrice: null,
          modifyLoading: false,
          modifyError: null,
          modifySuccess: successMessage,
          lastErrorMessage: null,
        },
      }));

      await Promise.allSettled([
        get().refreshRiskStatus(),
        get().refreshAccountSnapshot(request.symbol, 50),
        get().refreshUserStreamStatus(request.symbol, 50),
      ]);

      return placeBody;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order modification failed.';
      const result: OrderResult = {
        success: false,
        mode: get().tradingStatus.currentMode,
        errorMessage: message,
        rejectedReason: 'order_modify_failed',
      };

      set((state) => ({
        tradingStatus: {
          ...state.tradingStatus,
          modifyLoading: false,
          modifyError: message,
          modifySuccess: null,
          lastErrorMessage: message,
        },
      }));

      void get().refreshRiskStatus();
      return result;
    }
  },
  })),
);

function getModeBadge(mode: TradingMode): TradingModeBadge {
  if (mode === 'binance_live') return 'live';
  if (mode === 'local_paper') return 'paper';
  return 'testnet';
}

function getConnectionStatusFromUserStream(status: TradingUserStreamStatusPayload): TradingConnectionStatus {
  if (status.streamStatus === 'blocked') return 'blocked';
  if (status.connected) return 'connected';
  if (status.reconnecting || status.streamStatus === 'starting') return 'degraded';
  if (status.streamStatus === 'disconnected') return 'disconnected';
  if (status.streamStatus === 'error') return 'degraded';
  return 'unknown';
}

function formatOrderActionSuccess(action: string, result: OrderResult) {
  const order = result.order;
  if (!order) return `${action} order.`;
  return `${action} order ${order.id} (${order.status}).`;
}

function validateModifyRequest(request: OrderModifyRequest, mode: TradingMode) {
  if (mode !== 'binance_testnet') return 'Only Binance testnet spot order modification is supported.';
  if (request.contractType !== undefined && request.contractType !== 'spot') return 'Only spot limit orders can be modified.';
  if (!request.symbol || typeof request.symbol !== 'string') return 'A symbol is required to modify an order.';
  if (!request.orderId && !request.clientOrderId) return 'An order id or client order id is required to modify an order.';
  if (request.side !== 'buy' && request.side !== 'sell') return 'Order side is required to modify an order.';
  if (!Number.isFinite(request.quantity) || request.quantity <= 0) return 'Remaining quantity must be greater than 0.';
  if (!Number.isFinite(request.price) || request.price <= 0) return 'Replacement limit price must be greater than 0.';
  return null;
}

function formatModifySuccess(request: OrderModifyRequest, result: OrderResult) {
  const newOrderId = result.order?.id;
  const oldOrderId = request.orderId ?? request.clientOrderId;
  return newOrderId
    ? `Modified order ${oldOrderId}; replacement ${newOrderId} submitted.`
    : `Modified order ${oldOrderId}.`;
}

function getClientOrderRiskBlock(request: OrderModifyRequest, riskStatus: TradingRiskStatusPayload | null) {
  if (!riskStatus) return null;
  if (riskStatus.killSwitchActive) return riskStatus.blockReasons[0] ?? 'Trading kill switch is active.';
  if (riskStatus.liveBlocked) return riskStatus.blockReasons[0] ?? 'Live trading is blocked.';
  if (riskStatus.blockReasons.length > 0) return riskStatus.blockReasons[0];
  if (request.quantity > riskStatus.maxOrderQty) return `Order quantity exceeds max quantity ${riskStatus.maxOrderQty}.`;

  const notional = request.quantity * request.price;
  if (Number.isFinite(notional) && notional > riskStatus.maxOrderNotional) {
    return `Order notional exceeds max notional ${riskStatus.maxOrderNotional}.`;
  }

  if (riskStatus.dailyOrderCountUsed >= riskStatus.dailyOrderCountLimit) {
    return `Daily order count limit ${riskStatus.dailyOrderCountLimit} has been reached.`;
  }

  return null;
}

import type { MarketDebugSnapshot } from './marketMetrics';
import { useChartRuntimeStore, type PanelRuntimeState, type TradingRuntimeStatus } from '@/lib/store/chartRuntime';
import { useChartStore, type PanelId, type PanelState } from '@/lib/store/chart';

const PANEL_IDS: PanelId[] = ['left', 'right'];
const COPY_ARRAY_LIMIT = 10;
const DISPLAY_RESTORE_LIMIT = 20;

type UnknownRecord = Record<string, unknown>;

export interface DebugPanelSnapshot {
  timestamp: number;
  enabled: boolean;
  marketDebug: MarketDebugSnapshot | null;
  runtime: RuntimeSummary;
  settings: SettingsSummary;
}

export interface RuntimeSummary {
  panels: Record<PanelId, RuntimePanelSummary>;
  trading: TradingDebugSummary;
  crosshair: {
    activePanel: PanelId | null;
    time: number | null;
    price: number | null;
  };
}

export interface RuntimePanelSummary {
  connected: boolean;
  isLoadingHistory: boolean;
  candleCount: number;
  tradeCount: number;
  aggregateBubbleEventCount: number;
  aggregateBubbleRestoredCount: number;
  aggregateBubbleLiveCount: number;
  absorptionCount: number;
  exhaustionCount: number;
  icebergCount: number;
  liquidityVacuumCount: number;
  liquidityZoneCount: number;
  footprintTrigger: number;
  historyRestoreStatus: PanelRuntimeState['historyRestoreStatus'];
}

export interface TradingDebugSummary {
  tradingMode: TradingRuntimeStatus['currentMode'];
  accountSnapshotConnected: boolean;
  userStreamConnected: boolean;
  userStreamStatus: TradingRuntimeStatus['userStreamStatus'];
  userStreamLastEventAt: string | null;
  reconnectCount: number;
  lastReconciledAt: string | null;
  balancesCount: number;
  openOrdersCount: number;
  positionsCount: number;
  recentTradesCount: number;
  lastSnapshotAt: string | null;
  lastSnapshotError: string | null;
  orderActionLoading: boolean;
  orderActionError: string | null;
  orderActionSuccess: string | null;
  riskStatus: TradingRuntimeStatus['riskStatus'];
  liveBlocked: boolean;
  killSwitchActive: boolean;
  dailyOrderCount: number | null;
  dailyOrderLimit: number | null;
  maxOrderNotional: number | null;
  maxOrderQty: number | null;
  lastRiskRejectionReason: string | null;
}

export interface SettingsSummary {
  layoutMode: string;
  focusMode: boolean;
  activePanel: PanelId;
  panelCount: number;
  activePanelIds: PanelId[];
  panels: Record<PanelId, SettingsPanelSummary>;
}

export interface SettingsPanelSummary {
  pair: string;
  timeframe: string;
  chartMode: string;
  contractType: string;
  dataSourceMode: string;

  aggregateBubbleMarketSource: string;
  bubbleSizeBy: string;
  bubbleScaleMode: string;
  bubblesEnabled: boolean;
  volumeBarsEnabled: boolean;
  volumeBarsInputData: string;
  volumeBarsMarketSource: string;
  defaultProfileEnabled: boolean;
  cvdEnabled: boolean;
  liquidityEnabled: boolean;
  liquidityHeatmapEnabled: boolean;
  absorptionEnabled: boolean;
  exhaustionEnabled: boolean;
  icebergEnabled: boolean;
  liquidityVacuumEnabled: boolean;
  needsFootprintWork: boolean;
  footprintWorkReasons: string[];
}

export function isDebugPanelEnabled() {
  return process.env.NODE_ENV === 'development'
    || process.env.NEXT_PUBLIC_ENABLE_DEBUG_PANEL === 'true';
}

export function getDebugPanelSnapshot(): DebugPanelSnapshot {
  const marketDebug = getMarketDebugSnapshot();
  return {
    timestamp: Date.now(),
    enabled: isDebugPanelEnabled(),
    marketDebug,
    runtime: getRuntimeSummary(),
    settings: getSettingsSummary(),
  };
}

export function createCopySnapshot(snapshot: DebugPanelSnapshot) {
  return trimForCopy({
    timestamp: snapshot.timestamp,
    generatedAtIso: new Date(snapshot.timestamp).toISOString(),
    marketDebug: snapshot.marketDebug,
    runtime: snapshot.runtime,
    chartSettings: snapshot.settings,
  }) as UnknownRecord;
}

export function getRecentRestoreCalls(snapshot: DebugPanelSnapshot) {
  return (snapshot.marketDebug?.storage.recentRestoreCalls ?? []).slice(-DISPLAY_RESTORE_LIMIT);
}

function getMarketDebugSnapshot() {
  if (typeof window === 'undefined') return null;
  return window.__MARKET_DEBUG__?.getSnapshot?.() ?? null;
}

function getRuntimeSummary(): RuntimeSummary {
  const runtimeState = useChartRuntimeStore.getState();
  return {
    panels: {
      left: summarizeRuntimePanel(runtimeState.panels.left),
      right: summarizeRuntimePanel(runtimeState.panels.right),
    },
    trading: summarizeTradingStatus(runtimeState.tradingStatus),
    crosshair: {
      activePanel: runtimeState.crosshair.activePanel,
      time: runtimeState.crosshair.time,
      price: runtimeState.crosshair.price,
    },
  };
}

function summarizeRuntimePanel(panel: PanelRuntimeState): RuntimePanelSummary {
  const restoredBubbleCount = panel.aggregateBubbleEvents.reduce((count, event) => (
    count + (event.origin === 'restored' ? 1 : 0)
  ), 0);

  return {
    connected: panel.connected,
    isLoadingHistory: panel.isLoadingHistory,
    candleCount: panel.candles.length,
    tradeCount: panel.trades.length,
    aggregateBubbleEventCount: panel.aggregateBubbleEvents.length,
    aggregateBubbleRestoredCount: restoredBubbleCount,
    aggregateBubbleLiveCount: Math.max(0, panel.aggregateBubbleEvents.length - restoredBubbleCount),
    absorptionCount: panel.absorptionMap.size,
    exhaustionCount: panel.exhaustionMap.size,
    icebergCount: panel.icebergLevels.length,
    liquidityVacuumCount: panel.liquidityVacuumZones.length,
    liquidityZoneCount: panel.liquidityZones.length,
    footprintTrigger: panel.footprintTrigger,
    historyRestoreStatus: panel.historyRestoreStatus,
  };
}

function summarizeTradingStatus(status: TradingRuntimeStatus): TradingDebugSummary {
  return {
    tradingMode: status.currentMode,
    accountSnapshotConnected: status.connectionStatus === 'connected' && !status.snapshotError,
    userStreamConnected: status.userStreamConnected,
    userStreamStatus: status.userStreamStatus,
    userStreamLastEventAt: status.userStreamLastEventAt,
    reconnectCount: status.userStreamReconnectCount,
    lastReconciledAt: status.lastReconciledAt,
    balancesCount: status.balances.length,
    openOrdersCount: status.openOrders.length,
    positionsCount: status.positions.length,
    recentTradesCount: status.recentTrades.length,
    lastSnapshotAt: status.lastSnapshotAt,
    lastSnapshotError: status.snapshotError,
    orderActionLoading: status.orderActionLoading,
    orderActionError: status.orderActionError,
    orderActionSuccess: status.orderActionSuccess,
    riskStatus: status.riskStatus,
    liveBlocked: status.liveBlocked,
    killSwitchActive: status.killSwitchActive,
    dailyOrderCount: status.riskStatus?.dailyOrderCountUsed ?? null,
    dailyOrderLimit: status.riskStatus?.dailyOrderCountLimit ?? null,
    maxOrderNotional: status.riskStatus?.maxOrderNotional ?? null,
    maxOrderQty: status.riskStatus?.maxOrderQty ?? null,
    lastRiskRejectionReason: status.riskStatus?.lastRiskRejectionReason ?? null,
  };
}

function getSettingsSummary(): SettingsSummary {
  const chartState = useChartStore.getState();
  const activePanelIds: PanelId[] = chartState.layoutMode === 'dual' ? PANEL_IDS : ['left'];

  return {
    layoutMode: chartState.layoutMode,
    focusMode: chartState.focusMode,
    activePanel: chartState.activePanel,
    panelCount: activePanelIds.length,
    activePanelIds,
    panels: {
      left: summarizeSettingsPanel(chartState.panels.left),
      right: summarizeSettingsPanel(chartState.panels.right),
    },
  };
}

function summarizeSettingsPanel(panel: PanelState): SettingsPanelSummary {
  const footprintWorkReasons = getFootprintWorkReasons(panel);
  return {
    pair: panel.pair,
    timeframe: panel.timeframe,
    chartMode: panel.chartMode,
    contractType: panel.contractType,
    dataSourceMode: panel.dataSourceMode,

    aggregateBubbleMarketSource: panel.aggregateBubbleMarketSource,
    bubbleSizeBy: panel.bubbleSizeBy,
    bubbleScaleMode: panel.bubbleScaleMode,
    bubblesEnabled: panel.bubblesEnabled,
    volumeBarsEnabled: panel.volumeBarsEnabled,
    volumeBarsInputData: panel.volumeBarsInputData,
    volumeBarsMarketSource: panel.volumeBarsMarketSource,
    defaultProfileEnabled: panel.defaultProfileEnabled,
    cvdEnabled: panel.cvdEnabled,
    liquidityEnabled: panel.liquidityEnabled,
    liquidityHeatmapEnabled: panel.liquidityHeatmapEnabled,
    absorptionEnabled: panel.absorptionEnabled,
    exhaustionEnabled: panel.exhaustionEnabled,
    icebergEnabled: panel.icebergEnabled,
    liquidityVacuumEnabled: panel.liquidityVacuumEnabled,
    needsFootprintWork: footprintWorkReasons.length > 0,
    footprintWorkReasons,
  };
}

function getFootprintWorkReasons(panel: PanelState) {
  const reasons: string[] = [];
  if (panel.chartMode === 'footprint') reasons.push('chart-mode-footprint');

  if (panel.cvdEnabled) reasons.push('cvd');
  if (panel.absorptionEnabled) reasons.push('absorption');
  if (panel.exhaustionEnabled) reasons.push('exhaustion');
  if (panel.icebergEnabled) reasons.push('iceberg');
  if (panel.liquidityVacuumEnabled) reasons.push('liquidity-vacuum');
  if (process.env.NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES === 'true') reasons.push('browser-market-writes');
  return reasons;
}

function trimForCopy(value: unknown): unknown {
  if (Array.isArray(value)) {
    const truncated = value.slice(-COPY_ARRAY_LIMIT).map(trimForCopy);
    return value.length > COPY_ARRAY_LIMIT
      ? {
        truncated: true,
        totalCount: value.length,
        showingLast: COPY_ARRAY_LIMIT,
        items: truncated,
      }
      : truncated;
  }

  if (!value || typeof value !== 'object') return value;

  if (value instanceof Map) {
    return trimForCopy(Array.from(value.entries()));
  }

  const result: UnknownRecord = {};
  for (const [key, entry] of Object.entries(value as UnknownRecord)) {
    result[key] = trimForCopy(entry);
  }
  return result;
}

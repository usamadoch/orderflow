import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Candle } from '../../types/candle';
import { Trade } from '../../types/trade';
import { FootprintMode } from '../../types/footprint';
import { AbsorptionResult } from '../../types/absorption';
import { BubbleSide } from '../../components/chart/drawBubbles';
import { ExhaustionResult } from '../../types/exhaustion';
import { IcebergLevel } from '../../types/iceberg';
import { LiquidityVacuumZone } from '../../types/liquidityVacuum';
import { MeasurementMetrics, FootprintMeasurementMetrics } from '../../types/measurement';
import { LiquidityZone } from '../../types/liquidity';

export type ChartMode = 'candle' | 'footprint';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';
export type AbsorptionSide = 'both' | 'buyer' | 'seller';
export type { BubbleSide };
export type ExhaustionSide = 'both' | 'buyer' | 'seller';
export type LineDrawMode = 'none' | 'horizontal' | 'vertical' | 'horizontal-ray' | 'box';
export type SessionId = 'tokyo' | 'london' | 'newYork';
export type CvdMode = 'candles' | 'bars' | 'line' | 'histogram';
export type CvdResetMode = 'none' | 'daily' | 'session';
export type CvdScaleMode = 'auto' | 'fixed';
export type ContractType = 'spot' | 'futures';
export type DataSourceMode = 'spot' | 'futures' | 'both';

export interface SessionConfig {
  enabled: boolean;
  startHour: number; // 0–23, UTC
  startMin: number; // 0 or 30 only
  endHour: number;
  endMin: number;
  color: string; // hex color
}

export interface GlobalCrosshair {
  activePanel: PanelId | null;
  time: number | null;
  price: number | null;
}

export type BubbleThresholdMode = 'absolute' | 'relative';

export interface TimeframeSettings {
  bucketSize: number;
  autoBucketSize: boolean;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  absorptionMinScore: number;
  exhaustionMinScore: number;
  exhaustionLookback: number;
  icebergMinScore: number;
  icebergLookback: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  liquidityVacuumMinScore: number;
  liquidityVacuumShowLabels: boolean;
  liquidityVacuumOpacity: number;
  liquidityVacuumMaxZones: number;
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  profileResolutionTicks: number;
  profileMinRowHeight: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileShowDelta: boolean;
  deltaProfileWidth: number;
  cvdEnabled: boolean;
  cvdPanelHeightPct: number;
  cvdMode: CvdMode;
  cvdSmoothing: number;
  cvdResetMode: CvdResetMode;
  cvdPositiveColor: string;
  cvdNegativeColor: string;
  cvdScaleMode: CvdScaleMode;
  cvdFixedRange: number;
  cvdShowDivergence: boolean;
  cvdDivergenceLookback: number;
  cvdMinimized: boolean;
}

export interface Measurement {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  live: boolean;
  metrics: MeasurementMetrics | null;
  footprintMetrics: FootprintMeasurementMetrics | null;
}

export interface DrawnLine {
  id: string;
  type: 'horizontal' | 'vertical' | 'horizontal-ray' | 'box';
  value: number; // price for horizontal/ray, candle index for vertical, top price fallback for box
  startIndex?: number;
  firstIndex?: number;
  lastIndex?: number;
  priceHigh?: number;
  priceLow?: number;
}

export interface PanelState {
  id: PanelId;
  pair: string;
  timeframe: string;
  chartMode: ChartMode;
  footprintMode: FootprintMode;
  bucketSize: number;
  autoBucketSize: boolean;
  barWidth: number;
  scrollOffset: number;
  candles: Candle[];
  trades: Trade[];
  connected: boolean;
  isLoadingHistory: boolean;
  contractType: ContractType;
  dataSourceMode: DataSourceMode;
  footprintTrigger: number;
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  absorptionMap: Map<number, AbsorptionResult>;
  bubblesEnabled: boolean;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
  isDrawMode: boolean;
  customProfileRange: {
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null;
  customProfileLocked: boolean;
  isProfileSelected: boolean;
  drawnLines: DrawnLine[];
  lineDrawMode: LineDrawMode;
  exhaustionEnabled: boolean;
  exhaustionMinScore: number;
  exhaustionSide: ExhaustionSide;
  exhaustionLookback: number;
  exhaustionShowProvisional: boolean;
  exhaustionMap: Map<number, ExhaustionResult>;
  icebergEnabled: boolean;
  icebergMinScore: number;
  icebergLookback: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  icebergLevels: IcebergLevel[];
  liquidityVacuumEnabled: boolean;
  liquidityVacuumMinScore: number;
  liquidityVacuumShowLabels: boolean;
  liquidityVacuumOpacity: number;
  liquidityVacuumMaxZones: number;
  liquidityVacuumZones: LiquidityVacuumZone[];
  // Volume Profile Visuals
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  profileResolutionTicks: number;
  profileMinRowHeight: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileShowDelta: boolean;
  deltaProfileWidth: number;
  // CVD Panel
  cvdEnabled: boolean;
  cvdPanelHeightPct: number;
  cvdMode: CvdMode;
  cvdSmoothing: number;
  cvdResetMode: CvdResetMode;
  cvdPositiveColor: string;
  cvdNegativeColor: string;
  cvdScaleMode: CvdScaleMode;
  cvdFixedRange: number;
  cvdShowDivergence: boolean;
  cvdDivergenceLookback: number;
  cvdMinimized: boolean;
  measureToolActive: boolean;
  activeMeasurement: Measurement | null;
  // Session Visualization
  sessionsEnabled: boolean;
  sessions: {
    tokyo: SessionConfig;
    london: SessionConfig;
    newYork: SessionConfig;
  };
  settingsByTimeframe: Record<string, Partial<TimeframeSettings>>;
  // Liquidity Map
  liquidityZones: LiquidityZone[];       // session only, not persisted
  liquidityEnabled: boolean;              // default true, persisted
  liquidityBucketSize: number;            // default 50, persisted
  minimumLiquidityThreshold: number;      // default 5, persisted
  liquidityOpacity: number;               // default 0.6, persisted
  liquidityRange: number;                 // default 10 (percent), persisted
  liquidityHistoryEnabled: boolean;       // default true, persisted
  liquidityHistoryDepth: number;          // max snapshots, default 200, persisted
  liquidityHeatmapEnabled: boolean;
  liquidityHeatmapOpacity: number;
  liquidityHeatmapAgeFade: number;
  liquidityHeatmapWidth: number;
  liquidityHeatmapShowPulled: boolean;
  liquidityHeatmapShowConsumed: boolean;
  liquidityHeatmapShowPersistence: boolean;
  liquidityHeatmapShowCurrentLabel: boolean;
  liquidityHeatmapProfileSync: boolean;
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
  crosshair: GlobalCrosshair;
  crosshairSyncEnabled: boolean;

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
  setContractType: (panelId: PanelId, contractType: ContractType) => void;
  setDataSourceMode: (panelId: PanelId, mode: DataSourceMode) => void;
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
  setBubbleThresholdMode: (panelId: PanelId, mode: BubbleThresholdMode) => void;
  setBubbleMinRadius: (panelId: PanelId, radius: number) => void;
  setAutoBucketSize: (panelId: PanelId, auto: boolean) => void;
  setComputedBucketSize: (panelId: PanelId, bucketSize: number) => void;
  setBubbleMaxRadius: (panelId: PanelId, radius: number) => void;
  setBubbleSide: (panelId: PanelId, side: BubbleSide) => void;
  setDrawMode: (panelId: PanelId, enabled: boolean) => void;
  setCustomProfileRange: (panelId: PanelId, range: PanelState['customProfileRange']) => void;
  setCustomProfileLocked: (panelId: PanelId, locked: boolean) => void;
  setProfileSelected: (panelId: PanelId, selected: boolean) => void;
  addLine: (panelId: PanelId, line: DrawnLine) => void;
  updateLine: (panelId: PanelId, id: string, updates: Partial<DrawnLine>) => void;
  removeLine: (panelId: PanelId, id: string) => void;
  setLineDrawMode: (panelId: PanelId, mode: LineDrawMode) => void;
  setExhaustionEnabled: (panelId: PanelId, enabled: boolean) => void;
  setExhaustionMinScore: (panelId: PanelId, score: number) => void;
  setExhaustionSide: (panelId: PanelId, side: ExhaustionSide) => void;
  setExhaustionLookback: (panelId: PanelId, lookback: number) => void;
  setExhaustionShowProvisional: (panelId: PanelId, show: boolean) => void;
  setExhaustionMap: (panelId: PanelId, map: Map<number, ExhaustionResult>) => void;
  setIcebergEnabled: (panelId: PanelId, enabled: boolean) => void;
  setIcebergMinScore: (panelId: PanelId, score: number) => void;
  setIcebergLookback: (panelId: PanelId, lookback: number) => void;
  setIcebergShowSuspected: (panelId: PanelId, show: boolean) => void;
  setIcebergShowLabels: (panelId: PanelId, show: boolean) => void;
  setIcebergShowTint: (panelId: PanelId, show: boolean) => void;
  setIcebergLevels: (panelId: PanelId, levels: IcebergLevel[]) => void;
  setLiquidityVacuumEnabled: (panelId: PanelId, enabled: boolean) => void;
  setLiquidityVacuumMinScore: (panelId: PanelId, score: number) => void;
  setLiquidityVacuumShowLabels: (panelId: PanelId, show: boolean) => void;
  setLiquidityVacuumOpacity: (panelId: PanelId, opacity: number) => void;
  setLiquidityVacuumMaxZones: (panelId: PanelId, maxZones: number) => void;
  setLiquidityVacuumZones: (panelId: PanelId, zones: LiquidityVacuumZone[]) => void;
  setProfileWidthPct: (panelId: PanelId, pct: number) => void;
  setDefaultProfileEnabled: (panelId: PanelId, enabled: boolean) => void;
  setProfileResolutionTicks: (panelId: PanelId, ticks: number) => void;
  setProfileMinRowHeight: (panelId: PanelId, height: number) => void;
  setProfileOpacity: (panelId: PanelId, opacity: number) => void;
  setProfileMinRowWidth: (panelId: PanelId, width: number) => void;
  setProfileScaleMode: (panelId: PanelId, mode: 'linear' | 'sqrt') => void;
  setProfileShowPocHighlight: (panelId: PanelId, show: boolean) => void;
  setProfileShowVaFill: (panelId: PanelId, show: boolean) => void;
  setProfileShowPocLine: (panelId: PanelId, show: boolean) => void;
  setProfileShowVaLines: (panelId: PanelId, show: boolean) => void;
  setProfileShowDelta: (panelId: PanelId, show: boolean) => void;
  setDeltaProfileWidth: (panelId: PanelId, width: number) => void;
  setCvdEnabled: (panelId: PanelId, enabled: boolean) => void;
  setCvdPanelHeightPct: (panelId: PanelId, pct: number) => void;
  setCvdMode: (panelId: PanelId, mode: CvdMode) => void;
  setCvdSmoothing: (panelId: PanelId, smoothing: number) => void;
  setCvdResetMode: (panelId: PanelId, mode: CvdResetMode) => void;
  setCvdPositiveColor: (panelId: PanelId, color: string) => void;
  setCvdNegativeColor: (panelId: PanelId, color: string) => void;
  setCvdScaleMode: (panelId: PanelId, mode: CvdScaleMode) => void;
  setCvdFixedRange: (panelId: PanelId, range: number) => void;
  setCvdShowDivergence: (panelId: PanelId, show: boolean) => void;
  setCvdDivergenceLookback: (panelId: PanelId, lookback: number) => void;
  setCvdMinimized: (panelId: PanelId, minimized: boolean) => void;
  setMeasureToolActive: (panelId: PanelId, active: boolean) => void;
  setActiveMeasurement: (panelId: PanelId, measurement: Measurement | null) => void;
  setSessionsEnabled: (panelId: PanelId, enabled: boolean) => void;
  setSessionEnabled: (panelId: PanelId, sessionId: SessionId, enabled: boolean) => void;
  setSessionTime: (panelId: PanelId, sessionId: SessionId, field: 'startHour' | 'startMin' | 'endHour' | 'endMin', value: number) => void;
  setSessionColor: (panelId: PanelId, sessionId: SessionId, color: string) => void;

  // Liquidity
  setLiquidityZones: (panelId: PanelId, zones: LiquidityZone[]) => void;
  setLiquidityEnabled: (panelId: PanelId, enabled: boolean) => void;
  setLiquidityBucketSize: (panelId: PanelId, size: number) => void;
  setMinimumLiquidityThreshold: (panelId: PanelId, threshold: number) => void;
  setLiquidityOpacity: (panelId: PanelId, opacity: number) => void;
  setLiquidityRange: (panelId: PanelId, range: number) => void;
  setLiquidityHistoryEnabled: (panelId: PanelId, enabled: boolean) => void;
  setLiquidityHistoryDepth: (panelId: PanelId, depth: number) => void;
  setLiquidityHeatmapEnabled: (panelId: PanelId, enabled: boolean) => void;
  setLiquidityHeatmapOpacity: (panelId: PanelId, opacity: number) => void;
  setLiquidityHeatmapAgeFade: (panelId: PanelId, fade: number) => void;
  setLiquidityHeatmapWidth: (panelId: PanelId, width: number) => void;
  setLiquidityHeatmapShowPulled: (panelId: PanelId, show: boolean) => void;
  setLiquidityHeatmapShowConsumed: (panelId: PanelId, show: boolean) => void;
  setLiquidityHeatmapShowPersistence: (panelId: PanelId, show: boolean) => void;
  setLiquidityHeatmapShowCurrentLabel: (panelId: PanelId, show: boolean) => void;
  setLiquidityHeatmapProfileSync: (panelId: PanelId, sync: boolean) => void;

  // Global actions
  setLayoutMode: (mode: LayoutMode) => void;
  setActivePanel: (panelId: PanelId) => void;
  setSplitRatio: (ratio: number) => void;
  setTickSize: (size: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCrosshair: (crosshair: GlobalCrosshair) => void;
  setCrosshairSyncEnabled: (enabled: boolean) => void;

  // Auth
  isAuthenticated: boolean;
  authenticate: (password: string) => boolean;
  logout: () => void;
}

function createDefaultPanel(id: PanelId): PanelState {
  return {
    id,
    pair: 'BTCUSDT',
    timeframe: '1m',
    chartMode: 'candle',
    footprintMode: 'bid-ask',
    bucketSize: 10,
    autoBucketSize: false,
    barWidth: 12,
    scrollOffset: 0,
    candles: [],
    trades: [],
    connected: false,
    isLoadingHistory: false,
    contractType: 'spot',
    dataSourceMode: 'both',
    footprintTrigger: 0,
    absorptionEnabled: true,
    absorptionMinScore: 50,
    absorptionSide: 'both' as AbsorptionSide,
    absorptionShowLabels: true,
    absorptionMap: new Map(),
    bubblesEnabled: true,
    bubbleThreshold: 50,
    bubbleThresholdMode: 'absolute',
    bubbleMinRadius: 4,
    bubbleMaxRadius: 20,
    bubbleSide: 'both' as BubbleSide,
    isDrawMode: false,
    customProfileRange: null,
    customProfileLocked: false,
    isProfileSelected: false,
    drawnLines: [],
    lineDrawMode: 'none',
    exhaustionEnabled: true,
    exhaustionMinScore: 40,
    exhaustionSide: 'both' as ExhaustionSide,
    exhaustionLookback: 5,
    exhaustionShowProvisional: true,
    exhaustionMap: new Map(),
    icebergEnabled: true,
    icebergMinScore: 45,
    icebergLookback: 10,
    icebergShowSuspected: true,
    icebergShowLabels: true,
    icebergShowTint: true,
    icebergLevels: [],
    liquidityVacuumEnabled: true,
    liquidityVacuumMinScore: 55,
    liquidityVacuumShowLabels: false,
    liquidityVacuumOpacity: 0.18,
    liquidityVacuumMaxZones: 6,
    liquidityVacuumZones: [],
    profileWidthPct: 70,
    defaultProfileEnabled: true,
    profileResolutionTicks: 1,
    profileMinRowHeight: 1,
    profileOpacity: 0.4,
    profileMinRowWidth: 2,
    profileScaleMode: 'sqrt',
    profileShowPocHighlight: true,
    profileShowVaFill: true,
    profileShowPocLine: true,
    profileShowVaLines: true,
    profileShowDelta: true,
    deltaProfileWidth: 80,
    cvdEnabled: true,
    cvdPanelHeightPct: 24,
    cvdMode: 'candles',
    cvdSmoothing: 1,
    cvdResetMode: 'daily',
    cvdPositiveColor: '#26A69A',
    cvdNegativeColor: '#EF5350',
    cvdScaleMode: 'auto',
    cvdFixedRange: 1000,
    cvdShowDivergence: false,
    cvdDivergenceLookback: 8,
    cvdMinimized: false,
    measureToolActive: false,
    activeMeasurement: null,
    sessionsEnabled: true,
    sessions: {
      tokyo: {
        enabled: true,
        startHour: 0, startMin: 0,
        endHour: 6, endMin: 0,
        color: '#B39DDB',
      },
      london: {
        enabled: true,
        startHour: 7, startMin: 0,
        endHour: 16, endMin: 0,
        color: '#4FC3F7',
      },
      newYork: {
        enabled: true,
        startHour: 13, startMin: 0,
        endHour: 22, endMin: 0,
        color: '#81C784',
      },
    },
    settingsByTimeframe: {},
    // Liquidity Map
    liquidityZones: [],
    liquidityEnabled: true,
    liquidityBucketSize: 50,
    minimumLiquidityThreshold: 5,
    liquidityOpacity: 0.6,
    liquidityRange: 10,
    liquidityHistoryEnabled: true,
    liquidityHistoryDepth: 200,
    liquidityHeatmapEnabled: true,
    liquidityHeatmapOpacity: 0.7,
    liquidityHeatmapAgeFade: 0.6,
    liquidityHeatmapWidth: 60,
    liquidityHeatmapShowPulled: true,
    liquidityHeatmapShowConsumed: true,
    liquidityHeatmapShowPersistence: true,
    liquidityHeatmapShowCurrentLabel: true,
    liquidityHeatmapProfileSync: false,
  };
}

function updatePanel(state: ChartState, panelId: PanelId, updates: Partial<PanelState>): Partial<ChartState> {
  const panel = state.panels[panelId];
  const newPanel = { ...panel, ...updates };

  // If any timeframe setting is updated, save it to settingsByTimeframe for the CURRENT timeframe
  const timeframeSettingsKeys: (keyof TimeframeSettings)[] = [
    'bucketSize', 'autoBucketSize', 'bubbleThreshold', 'bubbleThresholdMode',
    'absorptionMinScore', 'exhaustionMinScore', 'exhaustionLookback',
    'icebergMinScore', 'icebergLookback', 'icebergShowSuspected',
    'icebergShowLabels', 'icebergShowTint', 'liquidityVacuumMinScore',
    'liquidityVacuumShowLabels', 'liquidityVacuumOpacity', 'liquidityVacuumMaxZones',
    'profileWidthPct', 'defaultProfileEnabled', 'profileResolutionTicks', 'profileMinRowHeight',
    'profileOpacity', 'profileMinRowWidth', 'profileScaleMode',
    'profileShowPocHighlight', 'profileShowVaFill', 'profileShowPocLine',
    'profileShowVaLines', 'profileShowDelta', 'deltaProfileWidth',
    'cvdEnabled', 'cvdPanelHeightPct', 'cvdMode', 'cvdSmoothing',
    'cvdResetMode', 'cvdPositiveColor', 'cvdNegativeColor',
    'cvdScaleMode', 'cvdFixedRange', 'cvdShowDivergence',
    'cvdDivergenceLookback', 'cvdMinimized'
  ];
  
  let settingsChanged = false;
  const currentTfSettings: Partial<TimeframeSettings> = { ...newPanel.settingsByTimeframe[newPanel.timeframe] };
  for (const key of timeframeSettingsKeys) {
    if (key in updates) {
      const value = updates[key as keyof PanelState];
      if (value !== undefined) {
        Object.assign(currentTfSettings, { [key]: value });
        settingsChanged = true;
      }
    }
  }

  if (settingsChanged) {
    newPanel.settingsByTimeframe = {
      ...newPanel.settingsByTimeframe,
      [newPanel.timeframe]: currentTfSettings
    };
  }

  return {
    panels: {
      ...state.panels,
      [panelId]: newPanel,
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
      crosshair: { activePanel: null, time: null, price: null },
      crosshairSyncEnabled: true,
      isAuthenticated: false,

      // Per-panel actions
      setPair: (panelId, pair) =>
        set((state) => updatePanel(state, panelId, { pair, candles: [], trades: [], icebergLevels: [], liquidityVacuumZones: [] })),

      setTimeframe: (panelId, timeframe) =>
        set((state) => {
          const panel = state.panels[panelId];
          const savedSettings = panel.settingsByTimeframe[timeframe] || {};
          return updatePanel(state, panelId, { 
            timeframe, 
            candles: [], 
            trades: [],
            icebergLevels: [],
            liquidityVacuumZones: [],
            ...savedSettings
          });
        }),

      setChartMode: (panelId, chartMode) =>
        set((state) => updatePanel(state, panelId, { chartMode })),

      setFootprintMode: (panelId, footprintMode) =>
        set((state) => updatePanel(state, panelId, { footprintMode })),

      setBucketSize: (panelId, bucketSize) =>
        set((state) => updatePanel(state, panelId, { bucketSize, autoBucketSize: false })),

      setComputedBucketSize: (panelId, bucketSize) =>
        set((state) => updatePanel(state, panelId, { bucketSize })),

      setAutoBucketSize: (panelId, autoBucketSize) =>
        set((state) => updatePanel(state, panelId, { autoBucketSize })),

      setBarWidth: (panelId, barWidth) =>
        set((state) => updatePanel(state, panelId, { barWidth })),

      setScrollOffset: (panelId, scrollOffset) =>
        set((state) => updatePanel(state, panelId, { scrollOffset })),

      setConnected: (panelId, connected) =>
        set((state) => updatePanel(state, panelId, { connected })),

      setLoadingHistory: (panelId, isLoadingHistory) =>
        set((state) => updatePanel(state, panelId, { isLoadingHistory })),

      setContractType: (panelId, contractType) =>
        set((state) => updatePanel(state, panelId, { contractType, candles: [], trades: [], icebergLevels: [], liquidityVacuumZones: [] })),

      setDataSourceMode: (panelId, dataSourceMode) =>
        set((state) => updatePanel(state, panelId, { dataSourceMode })),

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
        set((state) => updatePanel(state, panelId, { bubbleThreshold: Math.max(0.1, bubbleThreshold) })),

      setBubbleThresholdMode: (panelId, bubbleThresholdMode) =>
        set((state) => updatePanel(state, panelId, { bubbleThresholdMode })),

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

      setDrawMode: (panelId, isDrawMode) =>
        set((state) => {
          const updates: Partial<PanelState> = { isDrawMode };
          if (isDrawMode) {
            updates.measureToolActive = false;
            updates.activeMeasurement = null;
            updates.lineDrawMode = 'none';
          }
          return updatePanel(state, panelId, updates);
        }),

      setCustomProfileRange: (panelId, customProfileRange) =>
        set((state) => updatePanel(state, panelId, { customProfileRange, isProfileSelected: !!customProfileRange })),

      setCustomProfileLocked: (panelId, customProfileLocked) =>
        set((state) => updatePanel(state, panelId, { customProfileLocked })),

      setProfileSelected: (panelId, isProfileSelected) =>
        set((state) => updatePanel(state, panelId, { isProfileSelected })),

      addLine: (panelId, line) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { drawnLines: [...panel.drawnLines, line] });
        }),

      updateLine: (panelId, id, updates) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            drawnLines: panel.drawnLines.map((line) => line.id === id ? { ...line, ...updates } : line),
          });
        }),

      removeLine: (panelId, id) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { drawnLines: panel.drawnLines.filter((l) => l.id !== id) });
        }),

      setLineDrawMode: (panelId, lineDrawMode) =>
        set((state) => {
          const updates: Partial<PanelState> = { lineDrawMode };
          if (lineDrawMode !== 'none') {
            updates.measureToolActive = false;
            updates.activeMeasurement = null;
            updates.isDrawMode = false;
          }
          return updatePanel(state, panelId, updates);
        }),

      setExhaustionEnabled: (panelId, exhaustionEnabled) =>
        set((state) => updatePanel(state, panelId, { exhaustionEnabled })),

      setExhaustionMinScore: (panelId, exhaustionMinScore) =>
        set((state) => updatePanel(state, panelId, { exhaustionMinScore: Math.max(0, Math.min(100, exhaustionMinScore)) })),

      setExhaustionSide: (panelId, exhaustionSide) =>
        set((state) => updatePanel(state, panelId, { exhaustionSide })),

      setExhaustionLookback: (panelId, exhaustionLookback) =>
        set((state) => updatePanel(state, panelId, { exhaustionLookback: Math.max(3, Math.min(8, exhaustionLookback)) })),

      setExhaustionShowProvisional: (panelId, exhaustionShowProvisional) =>
        set((state) => updatePanel(state, panelId, { exhaustionShowProvisional })),

      setExhaustionMap: (panelId, exhaustionMap) =>
        set((state) => updatePanel(state, panelId, { exhaustionMap })),

      setIcebergEnabled: (panelId, icebergEnabled) =>
        set((state) => updatePanel(state, panelId, { icebergEnabled })),

      setIcebergMinScore: (panelId, icebergMinScore) =>
        set((state) => updatePanel(state, panelId, { icebergMinScore: Math.max(30, Math.min(80, icebergMinScore)) })),

      setIcebergLookback: (panelId, icebergLookback) =>
        set((state) => updatePanel(state, panelId, { icebergLookback: Math.max(5, Math.min(20, icebergLookback)) })),

      setIcebergShowSuspected: (panelId, icebergShowSuspected) =>
        set((state) => updatePanel(state, panelId, { icebergShowSuspected })),

      setIcebergShowLabels: (panelId, icebergShowLabels) =>
        set((state) => updatePanel(state, panelId, { icebergShowLabels })),

      setIcebergShowTint: (panelId, icebergShowTint) =>
        set((state) => updatePanel(state, panelId, { icebergShowTint })),

      setIcebergLevels: (panelId, icebergLevels) =>
        set((state) => updatePanel(state, panelId, { icebergLevels })),

      setLiquidityVacuumEnabled: (panelId, liquidityVacuumEnabled) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumEnabled })),

      setLiquidityVacuumMinScore: (panelId, liquidityVacuumMinScore) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumMinScore: Math.max(30, Math.min(90, liquidityVacuumMinScore)) })),

      setLiquidityVacuumShowLabels: (panelId, liquidityVacuumShowLabels) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumShowLabels })),

      setLiquidityVacuumOpacity: (panelId, liquidityVacuumOpacity) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumOpacity: Math.max(0.05, Math.min(0.5, liquidityVacuumOpacity)) })),

      setLiquidityVacuumMaxZones: (panelId, liquidityVacuumMaxZones) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumMaxZones: Math.max(1, Math.min(20, Math.round(liquidityVacuumMaxZones))) })),

      setLiquidityVacuumZones: (panelId, liquidityVacuumZones) =>
        set((state) => updatePanel(state, panelId, { liquidityVacuumZones })),

      setProfileWidthPct: (panelId, profileWidthPct) =>
        set((state) => updatePanel(state, panelId, { profileWidthPct: Math.max(10, Math.min(100, profileWidthPct)) })),

      setDefaultProfileEnabled: (panelId, defaultProfileEnabled) =>
        set((state) => updatePanel(state, panelId, { defaultProfileEnabled })),

      setProfileResolutionTicks: (panelId, profileResolutionTicks) =>
        set((state) => updatePanel(state, panelId, { profileResolutionTicks: Math.max(1, Math.min(100, Math.round(profileResolutionTicks))) })),

      setProfileMinRowHeight: (panelId, profileMinRowHeight) =>
        set((state) => updatePanel(state, panelId, { profileMinRowHeight: Math.max(0, Math.min(4, profileMinRowHeight)) })),

      setProfileOpacity: (panelId, profileOpacity) =>
        set((state) => updatePanel(state, panelId, { profileOpacity: Math.max(0.1, Math.min(1.0, profileOpacity)) })),

      setProfileMinRowWidth: (panelId, profileMinRowWidth) =>
        set((state) => updatePanel(state, panelId, { profileMinRowWidth: Math.max(0, Math.min(8, profileMinRowWidth)) })),

      setProfileScaleMode: (panelId, profileScaleMode) =>
        set((state) => updatePanel(state, panelId, { profileScaleMode })),

      setProfileShowPocHighlight: (panelId, profileShowPocHighlight) =>
        set((state) => updatePanel(state, panelId, { profileShowPocHighlight })),

      setProfileShowVaFill: (panelId, profileShowVaFill) =>
        set((state) => updatePanel(state, panelId, { profileShowVaFill })),

      setProfileShowPocLine: (panelId, profileShowPocLine) =>
        set((state) => updatePanel(state, panelId, { profileShowPocLine })),

      setProfileShowVaLines: (panelId, profileShowVaLines) =>
        set((state) => updatePanel(state, panelId, { profileShowVaLines })),

      setProfileShowDelta: (panelId, profileShowDelta) =>
        set((state) => updatePanel(state, panelId, { profileShowDelta })),

      setDeltaProfileWidth: (panelId, deltaProfileWidth) =>
        set((state) => updatePanel(state, panelId, { deltaProfileWidth })),

      setCvdEnabled: (panelId, cvdEnabled) =>
        set((state) => updatePanel(state, panelId, { cvdEnabled })),

      setCvdPanelHeightPct: (panelId, cvdPanelHeightPct) =>
        set((state) => updatePanel(state, panelId, { cvdPanelHeightPct: Math.max(12, Math.min(45, cvdPanelHeightPct)) })),

      setCvdMode: (panelId, cvdMode) =>
        set((state) => updatePanel(state, panelId, { cvdMode })),

      setCvdSmoothing: (panelId, cvdSmoothing) =>
        set((state) => updatePanel(state, panelId, { cvdSmoothing: Math.max(1, Math.min(50, Math.round(cvdSmoothing))) })),

      setCvdResetMode: (panelId, cvdResetMode) =>
        set((state) => updatePanel(state, panelId, { cvdResetMode })),

      setCvdPositiveColor: (panelId, cvdPositiveColor) =>
        set((state) => updatePanel(state, panelId, { cvdPositiveColor })),

      setCvdNegativeColor: (panelId, cvdNegativeColor) =>
        set((state) => updatePanel(state, panelId, { cvdNegativeColor })),

      setCvdScaleMode: (panelId, cvdScaleMode) =>
        set((state) => updatePanel(state, panelId, { cvdScaleMode })),

      setCvdFixedRange: (panelId, cvdFixedRange) =>
        set((state) => updatePanel(state, panelId, { cvdFixedRange: Math.max(1, cvdFixedRange) })),

      setCvdShowDivergence: (panelId, cvdShowDivergence) =>
        set((state) => updatePanel(state, panelId, { cvdShowDivergence })),

      setCvdDivergenceLookback: (panelId, cvdDivergenceLookback) =>
        set((state) => updatePanel(state, panelId, { cvdDivergenceLookback: Math.max(3, Math.min(30, Math.round(cvdDivergenceLookback))) })),

      setCvdMinimized: (panelId, cvdMinimized) =>
        set((state) => updatePanel(state, panelId, { cvdMinimized })),

      setMeasureToolActive: (panelId, measureToolActive) =>
        set((state) => {
          const updates: Partial<PanelState> = { measureToolActive };
          if (measureToolActive) {
            updates.isDrawMode = false;
            updates.lineDrawMode = 'none';
          } else {
            updates.activeMeasurement = null;
          }
          return updatePanel(state, panelId, updates);
        }),

      setActiveMeasurement: (panelId, activeMeasurement) =>
        set((state) => updatePanel(state, panelId, { activeMeasurement })),

      setSessionsEnabled: (panelId, sessionsEnabled) =>
        set((state) => updatePanel(state, panelId, { sessionsEnabled })),

      // Liquidity actions
      setLiquidityZones: (panelId, liquidityZones) =>
        set((state) => updatePanel(state, panelId, { liquidityZones })),

      setLiquidityEnabled: (panelId, liquidityEnabled) =>
        set((state) => updatePanel(state, panelId, { liquidityEnabled })),

      setLiquidityBucketSize: (panelId, liquidityBucketSize) =>
        set((state) => updatePanel(state, panelId, { liquidityBucketSize: Math.max(1, liquidityBucketSize) })),

      setMinimumLiquidityThreshold: (panelId, minimumLiquidityThreshold) =>
        set((state) => updatePanel(state, panelId, { minimumLiquidityThreshold: Math.max(0.1, minimumLiquidityThreshold) })),

      setLiquidityOpacity: (panelId, liquidityOpacity) =>
        set((state) => updatePanel(state, panelId, { liquidityOpacity: Math.max(0.1, Math.min(1.0, liquidityOpacity)) })),

      setLiquidityRange: (panelId, liquidityRange) =>
        set((state) => updatePanel(state, panelId, { liquidityRange: Math.max(1, Math.min(50, liquidityRange)) })),

      setLiquidityHistoryEnabled: (panelId, liquidityHistoryEnabled) =>
        set((state) => updatePanel(state, panelId, { liquidityHistoryEnabled })),

      setLiquidityHistoryDepth: (panelId, liquidityHistoryDepth) =>
        set((state) => updatePanel(state, panelId, { liquidityHistoryDepth: Math.max(50, Math.min(500, liquidityHistoryDepth)) })),

      setLiquidityHeatmapEnabled: (panelId, liquidityHeatmapEnabled) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapEnabled })),

      setLiquidityHeatmapOpacity: (panelId, liquidityHeatmapOpacity) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapOpacity: Math.max(0, Math.min(1.0, liquidityHeatmapOpacity)) })),

      setLiquidityHeatmapAgeFade: (panelId, liquidityHeatmapAgeFade) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapAgeFade: Math.max(0, Math.min(1.0, liquidityHeatmapAgeFade)) })),

      setLiquidityHeatmapWidth: (panelId, liquidityHeatmapWidth) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapWidth: Math.max(30, Math.min(120, liquidityHeatmapWidth)) })),

      setLiquidityHeatmapShowPulled: (panelId, liquidityHeatmapShowPulled) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapShowPulled })),

      setLiquidityHeatmapShowConsumed: (panelId, liquidityHeatmapShowConsumed) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapShowConsumed })),

      setLiquidityHeatmapShowPersistence: (panelId, liquidityHeatmapShowPersistence) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapShowPersistence })),

      setLiquidityHeatmapShowCurrentLabel: (panelId, liquidityHeatmapShowCurrentLabel) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapShowCurrentLabel })),

      setLiquidityHeatmapProfileSync: (panelId, liquidityHeatmapProfileSync) =>
        set((state) => updatePanel(state, panelId, { liquidityHeatmapProfileSync })),

      setSessionEnabled: (panelId, sessionId, enabled) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: { ...panel.sessions[sessionId], enabled }
            }
          });
        }),

      setSessionTime: (panelId, sessionId, field, value) =>
        set((state) => {
          const panel = state.panels[panelId];
          const session = panel.sessions[sessionId];
          const nextSession = { ...session, [field]: value };

          // Validation: end time must be after start time
          const startTotal = nextSession.startHour * 60 + nextSession.startMin;
          const endTotal = nextSession.endHour * 60 + nextSession.endMin;

          if (endTotal <= startTotal) {
            // Revert if invalid
            return state;
          }

          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: nextSession
            }
          });
        }),

      setSessionColor: (panelId, sessionId, color) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: { ...panel.sessions[sessionId], color }
            }
          });
        }),

      pushAllCandles: (panelId, candles) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { candles: mergeCandles(panel.candles, candles) });
        }),

      pushCandle: (panelId, candle) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, { candles: mergeCandles(panel.candles, [candle]) });
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
      setCrosshair: (crosshair) => set({ crosshair }),
      setCrosshairSyncEnabled: (crosshairSyncEnabled) => {
        if (!crosshairSyncEnabled) {
          set({ crosshairSyncEnabled, crosshair: { activePanel: null, time: null, price: null } });
        } else {
          set({ crosshairSyncEnabled });
        }
      },

      // Auth actions
      authenticate: (password) => {
        if (password === 'alpha') {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'orderflow-settings',
      version: 24,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version: number) => {
        if (version < 3) {
          // Clear stale v1/v2 data — return fresh defaults
          return {};
        }
        const ensureContractType = (contractType: unknown): ContractType =>
          contractType === 'futures' ? 'futures' : 'spot';
        const ensureDataSourceMode = (mode: unknown): DataSourceMode =>
          mode === 'spot' || mode === 'futures' || mode === 'both' ? mode : 'both';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ensurePanel = (p: any) => {
          if (!p) return p;
          return {
            ...p,
            footprintMode: p.footprintMode || 'bid-ask',
            autoBucketSize: p.autoBucketSize ?? false,
            contractType: ensureContractType(p.contractType),
            dataSourceMode: ensureDataSourceMode(p.dataSourceMode),
            absorptionEnabled: p.absorptionEnabled ?? true,
            absorptionMinScore: p.absorptionMinScore ?? 50,
            absorptionSide: p.absorptionSide || 'both',
            absorptionShowLabels: p.absorptionShowLabels ?? true,
            bubblesEnabled: p.bubblesEnabled ?? true,
            bubbleThreshold: p.bubbleThreshold ?? 50,
            bubbleThresholdMode: p.bubbleThresholdMode || 'absolute',
            bubbleMinRadius: p.bubbleMinRadius ?? 4,
            bubbleMaxRadius: p.bubbleMaxRadius ?? 20,
            bubbleSide: p.bubbleSide || 'both',
            isDrawMode: p.isDrawMode ?? false,
            customProfileRange: p.customProfileRange ?? null,
            customProfileLocked: p.customProfileLocked ?? false,
            isProfileSelected: false,
            drawnLines: p.drawnLines ?? [],
            lineDrawMode: p.lineDrawMode || 'none',
            exhaustionEnabled: p.exhaustionEnabled ?? true,
            exhaustionMinScore: p.exhaustionMinScore ?? 40,
            exhaustionSide: p.exhaustionSide || 'both',
            exhaustionLookback: p.exhaustionLookback ?? 5,
            exhaustionShowProvisional: p.exhaustionShowProvisional ?? true,
            icebergEnabled: p.icebergEnabled ?? true,
            icebergMinScore: p.icebergMinScore ?? 45,
            icebergLookback: Math.max(5, Math.min(20, p.icebergLookback ?? 10)),
            icebergShowSuspected: p.icebergShowSuspected ?? true,
            icebergShowLabels: p.icebergShowLabels ?? true,
            icebergShowTint: p.icebergShowTint ?? true,
            icebergLevels: [],
            liquidityVacuumEnabled: p.liquidityVacuumEnabled ?? true,
            liquidityVacuumMinScore: Math.max(30, Math.min(90, p.liquidityVacuumMinScore ?? 55)),
            liquidityVacuumShowLabels: p.liquidityVacuumShowLabels ?? false,
            liquidityVacuumOpacity: Math.max(0.05, Math.min(0.5, p.liquidityVacuumOpacity ?? 0.18)),
            liquidityVacuumMaxZones: Math.max(1, Math.min(20, p.liquidityVacuumMaxZones ?? 6)),
            liquidityVacuumZones: [],
            profileWidthPct: p.profileWidthPct ?? 70,
            defaultProfileEnabled: p.defaultProfileEnabled ?? true,
            profileResolutionTicks: p.profileResolutionTicks ?? 1,
            profileMinRowHeight: p.profileMinRowHeight ?? 1,
            profileOpacity: p.profileOpacity ?? 0.4,
            profileMinRowWidth: p.profileMinRowWidth ?? 2,
            profileScaleMode: p.profileScaleMode || 'sqrt',
            profileShowPocHighlight: p.profileShowPocHighlight ?? true,
            profileShowVaFill: p.profileShowVaFill ?? true,
            profileShowPocLine: p.profileShowPocLine ?? true,
            profileShowVaLines: p.profileShowVaLines ?? true,
            profileShowDelta: p.profileShowDelta ?? true,
            deltaProfileWidth: p.deltaProfileWidth ?? 80,
            cvdEnabled: p.cvdEnabled ?? true,
            cvdPanelHeightPct: Math.max(12, Math.min(45, p.cvdPanelHeightPct ?? 24)),
            cvdMode: p.cvdMode || 'candles',
            cvdSmoothing: Math.max(1, Math.min(50, p.cvdSmoothing ?? 1)),
            cvdResetMode: p.cvdResetMode || 'daily',
            cvdPositiveColor: p.cvdPositiveColor || '#26A69A',
            cvdNegativeColor: p.cvdNegativeColor || '#EF5350',
            cvdScaleMode: p.cvdScaleMode || 'auto',
            cvdFixedRange: Math.max(1, p.cvdFixedRange ?? 1000),
            cvdShowDivergence: p.cvdShowDivergence ?? false,
            cvdDivergenceLookback: Math.max(3, Math.min(30, p.cvdDivergenceLookback ?? 8)),
            cvdMinimized: p.cvdMinimized ?? false,
            sessionsEnabled: p.sessionsEnabled ?? true,
            sessions: p.sessions ?? {
              tokyo: { enabled: true, startHour: 0, startMin: 0, endHour: 6, endMin: 0, color: '#B39DDB' },
              london: { enabled: true, startHour: 7, startMin: 0, endHour: 16, endMin: 0, color: '#4FC3F7' },
              newYork: { enabled: true, startHour: 13, startMin: 0, endHour: 22, endMin: 0, color: '#81C784' },
            },
            settingsByTimeframe: p.settingsByTimeframe ?? {},
            // Liquidity Map (v13 & v14)
            liquidityEnabled: p.liquidityEnabled ?? true,
            liquidityBucketSize: p.liquidityBucketSize ?? 50,
            minimumLiquidityThreshold: p.minimumLiquidityThreshold ?? 5,
            liquidityOpacity: p.liquidityOpacity ?? 0.6,
            liquidityRange: p.liquidityRange ?? 10,
            liquidityHistoryEnabled: p.liquidityHistoryEnabled ?? true,
            liquidityHistoryDepth: Math.max(50, Math.min(500, p.liquidityHistoryDepth ?? 200)),
            // Heatmap (v15)
            liquidityHeatmapEnabled: p.liquidityHeatmapEnabled ?? true,
            liquidityHeatmapOpacity: p.liquidityHeatmapOpacity ?? 0.7,
            liquidityHeatmapAgeFade: p.liquidityHeatmapAgeFade ?? 0.6,
            liquidityHeatmapWidth: p.liquidityHeatmapWidth ?? 60,
            liquidityHeatmapShowPulled: p.liquidityHeatmapShowPulled ?? true,
            liquidityHeatmapShowConsumed: p.liquidityHeatmapShowConsumed ?? true,
            liquidityHeatmapShowPersistence: p.liquidityHeatmapShowPersistence ?? true,
            liquidityHeatmapShowCurrentLabel: p.liquidityHeatmapShowCurrentLabel ?? true,
            liquidityHeatmapProfileSync: p.liquidityHeatmapProfileSync ?? false,
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
            autoBucketSize: state.panels.left.autoBucketSize,
            barWidth: state.panels.left.barWidth,
            contractType: state.panels.left.contractType,
            dataSourceMode: state.panels.left.dataSourceMode,
            absorptionEnabled: state.panels.left.absorptionEnabled,
            absorptionMinScore: state.panels.left.absorptionMinScore,
            absorptionSide: state.panels.left.absorptionSide,
            absorptionShowLabels: state.panels.left.absorptionShowLabels,
            bubblesEnabled: state.panels.left.bubblesEnabled,
            bubbleThreshold: state.panels.left.bubbleThreshold,
            bubbleThresholdMode: state.panels.left.bubbleThresholdMode,
            bubbleMinRadius: state.panels.left.bubbleMinRadius,
            bubbleMaxRadius: state.panels.left.bubbleMaxRadius,
            bubbleSide: state.panels.left.bubbleSide,
            isDrawMode: state.panels.left.isDrawMode,
            customProfileRange: state.panels.left.customProfileRange,
            customProfileLocked: state.panels.left.customProfileLocked,
            drawnLines: state.panels.left.drawnLines,
            lineDrawMode: state.panels.left.lineDrawMode,
            exhaustionEnabled: state.panels.left.exhaustionEnabled,
            exhaustionMinScore: state.panels.left.exhaustionMinScore,
            exhaustionSide: state.panels.left.exhaustionSide,
            exhaustionLookback: state.panels.left.exhaustionLookback,
            exhaustionShowProvisional: state.panels.left.exhaustionShowProvisional,
            icebergEnabled: state.panels.left.icebergEnabled,
            icebergMinScore: state.panels.left.icebergMinScore,
            icebergLookback: state.panels.left.icebergLookback,
            icebergShowSuspected: state.panels.left.icebergShowSuspected,
            icebergShowLabels: state.panels.left.icebergShowLabels,
            icebergShowTint: state.panels.left.icebergShowTint,
            liquidityVacuumEnabled: state.panels.left.liquidityVacuumEnabled,
            liquidityVacuumMinScore: state.panels.left.liquidityVacuumMinScore,
            liquidityVacuumShowLabels: state.panels.left.liquidityVacuumShowLabels,
            liquidityVacuumOpacity: state.panels.left.liquidityVacuumOpacity,
            liquidityVacuumMaxZones: state.panels.left.liquidityVacuumMaxZones,
            profileWidthPct: state.panels.left.profileWidthPct,
            defaultProfileEnabled: state.panels.left.defaultProfileEnabled,
            profileResolutionTicks: state.panels.left.profileResolutionTicks,
            profileMinRowHeight: state.panels.left.profileMinRowHeight,
            profileOpacity: state.panels.left.profileOpacity,
            profileMinRowWidth: state.panels.left.profileMinRowWidth,
            profileScaleMode: state.panels.left.profileScaleMode,
            profileShowPocHighlight: state.panels.left.profileShowPocHighlight,
            profileShowVaFill: state.panels.left.profileShowVaFill,
            profileShowPocLine: state.panels.left.profileShowPocLine,
            profileShowVaLines: state.panels.left.profileShowVaLines,
            profileShowDelta: state.panels.left.profileShowDelta,
            deltaProfileWidth: state.panels.left.deltaProfileWidth,
            cvdEnabled: state.panels.left.cvdEnabled,
            cvdPanelHeightPct: state.panels.left.cvdPanelHeightPct,
            cvdMode: state.panels.left.cvdMode,
            cvdSmoothing: state.panels.left.cvdSmoothing,
            cvdResetMode: state.panels.left.cvdResetMode,
            cvdPositiveColor: state.panels.left.cvdPositiveColor,
            cvdNegativeColor: state.panels.left.cvdNegativeColor,
            cvdScaleMode: state.panels.left.cvdScaleMode,
            cvdFixedRange: state.panels.left.cvdFixedRange,
            cvdShowDivergence: state.panels.left.cvdShowDivergence,
            cvdDivergenceLookback: state.panels.left.cvdDivergenceLookback,
            cvdMinimized: state.panels.left.cvdMinimized,
            sessionsEnabled: state.panels.left.sessionsEnabled,
            sessions: state.panels.left.sessions,
            liquidityEnabled: state.panels.left.liquidityEnabled,
            liquidityBucketSize: state.panels.left.liquidityBucketSize,
            minimumLiquidityThreshold: state.panels.left.minimumLiquidityThreshold,
            liquidityOpacity: state.panels.left.liquidityOpacity,
            liquidityRange: state.panels.left.liquidityRange,
            liquidityHistoryEnabled: state.panels.left.liquidityHistoryEnabled,
            liquidityHistoryDepth: state.panels.left.liquidityHistoryDepth,
            liquidityHeatmapEnabled: state.panels.left.liquidityHeatmapEnabled,
            liquidityHeatmapOpacity: state.panels.left.liquidityHeatmapOpacity,
            liquidityHeatmapAgeFade: state.panels.left.liquidityHeatmapAgeFade,
            liquidityHeatmapWidth: state.panels.left.liquidityHeatmapWidth,
            liquidityHeatmapShowPulled: state.panels.left.liquidityHeatmapShowPulled,
            liquidityHeatmapShowConsumed: state.panels.left.liquidityHeatmapShowConsumed,
            liquidityHeatmapShowPersistence: state.panels.left.liquidityHeatmapShowPersistence,
            liquidityHeatmapShowCurrentLabel: state.panels.left.liquidityHeatmapShowCurrentLabel,
            liquidityHeatmapProfileSync: state.panels.left.liquidityHeatmapProfileSync,
            settingsByTimeframe: state.panels.left.settingsByTimeframe,
          },
          right: {
            pair: state.panels.right.pair,
            timeframe: state.panels.right.timeframe,
            chartMode: state.panels.right.chartMode,
            footprintMode: state.panels.right.footprintMode,
            bucketSize: state.panels.right.bucketSize,
            autoBucketSize: state.panels.right.autoBucketSize,
            barWidth: state.panels.right.barWidth,
            contractType: state.panels.right.contractType,
            dataSourceMode: state.panels.right.dataSourceMode,
            absorptionEnabled: state.panels.right.absorptionEnabled,
            absorptionMinScore: state.panels.right.absorptionMinScore,
            absorptionSide: state.panels.right.absorptionSide,
            absorptionShowLabels: state.panels.right.absorptionShowLabels,
            bubblesEnabled: state.panels.right.bubblesEnabled,
            bubbleThreshold: state.panels.right.bubbleThreshold,
            bubbleThresholdMode: state.panels.right.bubbleThresholdMode,
            bubbleMinRadius: state.panels.right.bubbleMinRadius,
            bubbleMaxRadius: state.panels.right.bubbleMaxRadius,
            bubbleSide: state.panels.right.bubbleSide,
            isDrawMode: state.panels.right.isDrawMode,
            customProfileRange: state.panels.right.customProfileRange,
            customProfileLocked: state.panels.right.customProfileLocked,
            drawnLines: state.panels.right.drawnLines,
            lineDrawMode: state.panels.right.lineDrawMode,
            exhaustionEnabled: state.panels.right.exhaustionEnabled,
            exhaustionMinScore: state.panels.right.exhaustionMinScore,
            exhaustionSide: state.panels.right.exhaustionSide,
            exhaustionLookback: state.panels.right.exhaustionLookback,
            exhaustionShowProvisional: state.panels.right.exhaustionShowProvisional,
            icebergEnabled: state.panels.right.icebergEnabled,
            icebergMinScore: state.panels.right.icebergMinScore,
            icebergLookback: state.panels.right.icebergLookback,
            icebergShowSuspected: state.panels.right.icebergShowSuspected,
            icebergShowLabels: state.panels.right.icebergShowLabels,
            icebergShowTint: state.panels.right.icebergShowTint,
            liquidityVacuumEnabled: state.panels.right.liquidityVacuumEnabled,
            liquidityVacuumMinScore: state.panels.right.liquidityVacuumMinScore,
            liquidityVacuumShowLabels: state.panels.right.liquidityVacuumShowLabels,
            liquidityVacuumOpacity: state.panels.right.liquidityVacuumOpacity,
            liquidityVacuumMaxZones: state.panels.right.liquidityVacuumMaxZones,
            profileWidthPct: state.panels.right.profileWidthPct,
            defaultProfileEnabled: state.panels.right.defaultProfileEnabled,
            profileResolutionTicks: state.panels.right.profileResolutionTicks,
            profileMinRowHeight: state.panels.right.profileMinRowHeight,
            profileOpacity: state.panels.right.profileOpacity,
            profileMinRowWidth: state.panels.right.profileMinRowWidth,
            profileScaleMode: state.panels.right.profileScaleMode,
            profileShowPocHighlight: state.panels.right.profileShowPocHighlight,
            profileShowVaFill: state.panels.right.profileShowVaFill,
            profileShowPocLine: state.panels.right.profileShowPocLine,
            profileShowVaLines: state.panels.right.profileShowVaLines,
            profileShowDelta: state.panels.right.profileShowDelta,
            deltaProfileWidth: state.panels.right.deltaProfileWidth,
            cvdEnabled: state.panels.right.cvdEnabled,
            cvdPanelHeightPct: state.panels.right.cvdPanelHeightPct,
            cvdMode: state.panels.right.cvdMode,
            cvdSmoothing: state.panels.right.cvdSmoothing,
            cvdResetMode: state.panels.right.cvdResetMode,
            cvdPositiveColor: state.panels.right.cvdPositiveColor,
            cvdNegativeColor: state.panels.right.cvdNegativeColor,
            cvdScaleMode: state.panels.right.cvdScaleMode,
            cvdFixedRange: state.panels.right.cvdFixedRange,
            cvdShowDivergence: state.panels.right.cvdShowDivergence,
            cvdDivergenceLookback: state.panels.right.cvdDivergenceLookback,
            cvdMinimized: state.panels.right.cvdMinimized,
            sessionsEnabled: state.panels.right.sessionsEnabled,
            sessions: state.panels.right.sessions,
            liquidityEnabled: state.panels.right.liquidityEnabled,
            liquidityBucketSize: state.panels.right.liquidityBucketSize,
            minimumLiquidityThreshold: state.panels.right.minimumLiquidityThreshold,
            liquidityOpacity: state.panels.right.liquidityOpacity,
            liquidityRange: state.panels.right.liquidityRange,
            liquidityHistoryEnabled: state.panels.right.liquidityHistoryEnabled,
            liquidityHistoryDepth: state.panels.right.liquidityHistoryDepth,
            liquidityHeatmapEnabled: state.panels.right.liquidityHeatmapEnabled,
            liquidityHeatmapOpacity: state.panels.right.liquidityHeatmapOpacity,
            liquidityHeatmapAgeFade: state.panels.right.liquidityHeatmapAgeFade,
            liquidityHeatmapWidth: state.panels.right.liquidityHeatmapWidth,
            liquidityHeatmapShowPulled: state.panels.right.liquidityHeatmapShowPulled,
            liquidityHeatmapShowConsumed: state.panels.right.liquidityHeatmapShowConsumed,
            liquidityHeatmapShowPersistence: state.panels.right.liquidityHeatmapShowPersistence,
            liquidityHeatmapShowCurrentLabel: state.panels.right.liquidityHeatmapShowCurrentLabel,
            liquidityHeatmapProfileSync: state.panels.right.liquidityHeatmapProfileSync,
            settingsByTimeframe: state.panels.right.settingsByTimeframe,
          },
        },
        tickSize: state.tickSize,
        sidebarCollapsed: state.sidebarCollapsed,
        crosshairSyncEnabled: state.crosshairSyncEnabled,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

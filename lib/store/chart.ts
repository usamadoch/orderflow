import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FootprintMode } from '../../types/footprint';
import { BubbleScaleMode, BubbleSide } from '../../components/chart/drawBubbles';
import type { AggregateBubbleMarketSource, BubbleSizeBy, BubbleSource } from '../../types/bubble';
import { MeasurementMetrics, FootprintMeasurementMetrics } from '../../types/measurement';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, normalizeChartSemanticColor } from '../config/chartColors';
import { getMinimumFineProfileResolutionTicks } from '../config/markets';

export type ChartMode = 'candle' | 'footprint';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';
export type AbsorptionSide = 'both' | 'buyer' | 'seller';
export type { AggregateBubbleMarketSource, BubbleScaleMode, BubbleSide, BubbleSizeBy, BubbleSource };
export type ExhaustionSide = 'both' | 'buyer' | 'seller';
export type LineDrawMode = 'none' | 'horizontal' | 'vertical' | 'horizontal-ray' | 'box' | 'long-position' | 'short-position';
export type DrawingStrokeWidth = 1 | 2 | 3 | 4;
export type SessionId = 'tokyo' | 'london' | 'newYork';
export type CvdMode = 'candles' | 'bars' | 'line' | 'histogram';
export type CvdResetMode = 'none' | 'daily' | 'session';
export type CvdScaleMode = 'auto' | 'fixed';
export type ContractType = 'spot' | 'futures';
export type DataSourceMode = 'spot' | 'futures' | 'both';
export type VolumeBarsInputData = 'volume' | 'orders' | 'aggregateTrades';
export type VolumeBarsMarketSource = 'active' | 'spot' | 'futures' | 'both';
export type VolumeBarsColorMode = 'fixed' | 'priceDirection' | 'delta' | 'volumeSlope';
export type VolumeBarsFilterMode = 'absolute' | 'relative';
export type IndicatorSettingsSection = 'sessions' | 'historicalSessions' | 'cvd' | 'bubbles' | 'volumeBars' | 'heatmap' | 'liquidityMap' | 'stats';
export type SettingsFocusSection = IndicatorSettingsSection | 'profiles';
export type StatsIndicatorItem = 'volume' | 'delta' | 'cvd';
export type HistoryRestoreStage = 'idle' | 'connecting' | 'candles' | 'volumeProfile' | 'rawTrades' | 'footprint' | 'complete' | 'error';

export interface HistoryRestoreStatus {
  stage: HistoryRestoreStage;
  message: string;
  startedAt: number;
  updatedAt: number;
  source?: 'Binance' | 'stored' | 'stored+Binance' | 'cache' | 'none';
  liveConnected: boolean;
  candleCount: number;
  storedCandleCount: number;
  binanceCandleCount: number;
  profileRowCount: number;
  profileCandleCount: number;
  footprintRowCount: number;
  footprintCellCount: number;
  footprintCandleCount: number;
  rawTradeCount: number;
  rawTradeRestoreSkipped?: boolean;
  profileRestoreSkipped?: boolean;
  footprintRestoreSkipped?: boolean;
  needsFootprintWork?: boolean;
  footprintWorkReasons?: string[];
  footprintIngestionSkipped?: number;
  icebergDisabledNoopSkipped?: number;
  footprintRequestedRange?: { startSeconds: number; endSeconds: number } | null;
  footprintClampedRange?: { startSeconds: number; endSeconds: number } | null;
  footprintChunkCount?: number;
  footprintRowsPerChunk?: number[];
  footprintRangeTooLargeSkipped?: boolean;
  footprintRestoreFailureReason?: string | null;
}

export interface SettingsOpenRequest {
  panelId: PanelId;
  section: SettingsFocusSection;
  requestId: number;
}

export interface DrawingToolbarPosition {
  x: number;
  y: number;
}

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
export const MAX_AGGREGATE_BUBBLE_EVENTS = 20000;

export interface TimeframeSettings {
  bucketSize: number;
  autoBucketSize: boolean;
  bubbleSource: BubbleSource;
  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  bubbleMinOrders: number;
  bubbleScaleMode: BubbleScaleMode;
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
  volumeBarsEnabled: boolean;
  volumeBarsInputData: VolumeBarsInputData;
  volumeBarsMarketSource: VolumeBarsMarketSource;
  volumeBarsFilterMode: VolumeBarsFilterMode;
  volumeBarsMovingAverageLength: number;
  volumeBarsFilterMin: number;
  volumeBarsFilterMax: number;
  volumeBarsColorMode: VolumeBarsColorMode;
  volumeBarsOpacity: number;
  volumeBarsHeightPct: number;
  volumeBarsShowValueText: boolean;
  volumeBarsTextSize: number;
  volumeBarsAverageLineEnabled: boolean;
  volumeBarsAverageLength: number;
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
  type: 'horizontal' | 'vertical' | 'horizontal-ray' | 'box' | 'long-position' | 'short-position';
  value: number; // price for horizontal/ray, legacy candle index for vertical, top price fallback for box
  color?: string;
  strokeWidth?: DrawingStrokeWidth;
  locked?: boolean;
  time?: number;
  startTime?: number;
  startIndex?: number;
  firstTime?: number;
  lastTime?: number;
  firstIndex?: number;
  lastIndex?: number;
  priceHigh?: number;
  priceLow?: number;
  stopPrice?: number;
  targetPrice?: number;
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
  contractType: ContractType;
  dataSourceMode: DataSourceMode;
  absorptionEnabled: boolean;
  absorptionMinScore: number;
  absorptionSide: AbsorptionSide;
  absorptionShowLabels: boolean;
  bubblesEnabled: boolean;
  bubbleSource: BubbleSource;
  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  bubbleMinOrders: number;
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode: BubbleScaleMode;
  isDrawMode: boolean;
  customProfileRange: {
    firstTime?: number;
    lastTime?: number;
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null;
  customProfileLocked: boolean;
  drawnLines: DrawnLine[];
  lineDrawMode: LineDrawMode;
  drawingToolbarPosition: DrawingToolbarPosition;
  exhaustionEnabled: boolean;
  exhaustionMinScore: number;
  exhaustionSide: ExhaustionSide;
  exhaustionLookback: number;
  exhaustionShowProvisional: boolean;
  icebergEnabled: boolean;
  icebergMinScore: number;
  icebergLookback: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  liquidityVacuumEnabled: boolean;
  liquidityVacuumMinScore: number;
  liquidityVacuumShowLabels: boolean;
  liquidityVacuumOpacity: number;
  liquidityVacuumMaxZones: number;
  indicatorLabelsCollapsed: boolean;
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
  // Volume Bars
  volumeBarsEnabled: boolean;
  volumeBarsInputData: VolumeBarsInputData;
  volumeBarsMarketSource: VolumeBarsMarketSource;
  volumeBarsFilterMode: VolumeBarsFilterMode;
  volumeBarsMovingAverageLength: number;
  volumeBarsFilterMin: number;
  volumeBarsFilterMax: number;
  volumeBarsColorMode: VolumeBarsColorMode;
  volumeBarsOpacity: number;
  volumeBarsHeightPct: number;
  volumeBarsShowValueText: boolean;
  volumeBarsTextSize: number;
  volumeBarsAverageLineEnabled: boolean;
  volumeBarsAverageLength: number;
  // Session Visualization
  sessionsEnabled: boolean;
  sessions: {
    tokyo: SessionConfig;
    london: SessionConfig;
    newYork: SessionConfig;
  };
  // Historical Session Volume Profile
  historicalSessionProfileEnabled: boolean;
  historicalSessionProfileStartHour: number;
  historicalSessionProfileStartMin: number;
  historicalSessionProfileEndHour: number;
  historicalSessionProfileEndMin: number;
  historicalSessionProfileCount: number;
  historicalSessionProfileMinTimeframe: string;

  settingsByTimeframe: Record<string, Partial<TimeframeSettings>>;
  // Liquidity Map
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
  // Stats Indicator
  statsIndicatorEnabled: boolean;
  statsIndicatorCount: number;
  statsIndicatorItems: StatsIndicatorItem[];
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
  focusMode: boolean;
  settingsDropdownHeight: number;
  settingsOpenRequest: SettingsOpenRequest | null;
  crosshairSyncEnabled: boolean;
  globalTimezone: string;
  globalTimeFormat: '12h' | '24h';

  // Per-panel actions
  setPair: (panelId: PanelId, pair: string) => void;
  setTimeframe: (panelId: PanelId, timeframe: string) => void;
  setChartMode: (panelId: PanelId, mode: ChartMode) => void;
  setFootprintMode: (panelId: PanelId, mode: FootprintMode) => void;
  setBucketSize: (panelId: PanelId, size: number) => void;
  setBarWidth: (panelId: PanelId, width: number) => void;
  setScrollOffset: (panelId: PanelId, offset: number) => void;
  setContractType: (panelId: PanelId, contractType: ContractType) => void;
  setDataSourceMode: (panelId: PanelId, mode: DataSourceMode) => void;
  setAbsorptionEnabled: (panelId: PanelId, enabled: boolean) => void;
  setAbsorptionMinScore: (panelId: PanelId, score: number) => void;
  setAbsorptionSide: (panelId: PanelId, side: AbsorptionSide) => void;
  setAbsorptionShowLabels: (panelId: PanelId, show: boolean) => void;
  setBubblesEnabled: (panelId: PanelId, enabled: boolean) => void;
  setBubbleSource: (panelId: PanelId, source: BubbleSource) => void;
  setBubbleSizeBy: (panelId: PanelId, sizeBy: BubbleSizeBy) => void;
  setAggregateBubbleMarketSource: (panelId: PanelId, source: AggregateBubbleMarketSource) => void;
  setBubbleThreshold: (panelId: PanelId, threshold: number) => void;
  setBubbleThresholdMode: (panelId: PanelId, mode: BubbleThresholdMode) => void;
  setBubbleMinOrders: (panelId: PanelId, minOrders: number) => void;
  setBubbleMinRadius: (panelId: PanelId, radius: number) => void;
  setAutoBucketSize: (panelId: PanelId, auto: boolean) => void;
  setComputedBucketSize: (panelId: PanelId, bucketSize: number) => void;
  setBubbleMaxRadius: (panelId: PanelId, radius: number) => void;
  setBubbleSide: (panelId: PanelId, side: BubbleSide) => void;
  setBubbleScaleMode: (panelId: PanelId, mode: BubbleScaleMode) => void;
  setDrawMode: (panelId: PanelId, enabled: boolean) => void;
  setCustomProfileRange: (panelId: PanelId, range: PanelState['customProfileRange']) => void;
  setCustomProfileLocked: (panelId: PanelId, locked: boolean) => void;
  addLine: (panelId: PanelId, line: DrawnLine) => void;
  updateLine: (panelId: PanelId, id: string, updates: Partial<DrawnLine>) => void;
  removeLine: (panelId: PanelId, id: string) => void;
  setLineDrawMode: (panelId: PanelId, mode: LineDrawMode) => void;
  setDrawingToolbarPosition: (panelId: PanelId, position: DrawingToolbarPosition) => void;
  setExhaustionEnabled: (panelId: PanelId, enabled: boolean) => void;
  setExhaustionMinScore: (panelId: PanelId, score: number) => void;
  setExhaustionSide: (panelId: PanelId, side: ExhaustionSide) => void;
  setExhaustionLookback: (panelId: PanelId, lookback: number) => void;
  setExhaustionShowProvisional: (panelId: PanelId, show: boolean) => void;
  setIcebergEnabled: (panelId: PanelId, enabled: boolean) => void;
  setIcebergMinScore: (panelId: PanelId, score: number) => void;
  setIcebergLookback: (panelId: PanelId, lookback: number) => void;
  setIcebergShowSuspected: (panelId: PanelId, show: boolean) => void;
  setIcebergShowLabels: (panelId: PanelId, show: boolean) => void;
  setIcebergShowTint: (panelId: PanelId, show: boolean) => void;
  setLiquidityVacuumEnabled: (panelId: PanelId, enabled: boolean) => void;
  setLiquidityVacuumMinScore: (panelId: PanelId, score: number) => void;
  setLiquidityVacuumShowLabels: (panelId: PanelId, show: boolean) => void;
  setLiquidityVacuumOpacity: (panelId: PanelId, opacity: number) => void;
  setLiquidityVacuumMaxZones: (panelId: PanelId, maxZones: number) => void;
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
  setVolumeBarsEnabled: (panelId: PanelId, enabled: boolean) => void;
  setVolumeBarsInputData: (panelId: PanelId, inputData: VolumeBarsInputData) => void;
  setVolumeBarsMarketSource: (panelId: PanelId, source: VolumeBarsMarketSource) => void;
  setVolumeBarsFilterMode: (panelId: PanelId, mode: VolumeBarsFilterMode) => void;
  setVolumeBarsMovingAverageLength: (panelId: PanelId, length: number) => void;
  setVolumeBarsFilterMin: (panelId: PanelId, min: number) => void;
  setVolumeBarsFilterMax: (panelId: PanelId, max: number) => void;
  setVolumeBarsColorMode: (panelId: PanelId, mode: VolumeBarsColorMode) => void;
  setVolumeBarsOpacity: (panelId: PanelId, opacity: number) => void;
  setVolumeBarsHeightPct: (panelId: PanelId, pct: number) => void;
  setVolumeBarsShowValueText: (panelId: PanelId, show: boolean) => void;
  setVolumeBarsTextSize: (panelId: PanelId, size: number) => void;
  setVolumeBarsAverageLineEnabled: (panelId: PanelId, enabled: boolean) => void;
  setVolumeBarsAverageLength: (panelId: PanelId, length: number) => void;
  setSessionsEnabled: (panelId: PanelId, enabled: boolean) => void;
  setSessionEnabled: (panelId: PanelId, sessionId: SessionId, enabled: boolean) => void;
  setSessionTime: (panelId: PanelId, sessionId: SessionId, field: 'startHour' | 'startMin' | 'endHour' | 'endMin', value: number) => void;
  setSessionColor: (panelId: PanelId, sessionId: SessionId, color: string) => void;

  setHistoricalSessionProfileEnabled: (panelId: PanelId, enabled: boolean) => void;
  setHistoricalSessionProfileTime: (panelId: PanelId, field: 'startHour' | 'startMin' | 'endHour' | 'endMin', value: number) => void;
  setHistoricalSessionProfileCount: (panelId: PanelId, count: number) => void;
  setHistoricalSessionProfileMinTimeframe: (panelId: PanelId, minTimeframe: string) => void;

  // Liquidity
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

  // Stats Indicator
  setStatsIndicatorEnabled: (panelId: PanelId, enabled: boolean) => void;
  setStatsIndicatorCount: (panelId: PanelId, count: number) => void;
  setStatsIndicatorItems: (panelId: PanelId, items: StatsIndicatorItem[]) => void;

  // Global actions
  setLayoutMode: (mode: LayoutMode) => void;
  setActivePanel: (panelId: PanelId) => void;
  setSplitRatio: (ratio: number) => void;
  setTickSize: (size: number) => void;
  setGlobalTimezone: (timezone: string) => void;
  setGlobalTimeFormat: (format: '12h' | '24h') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setFocusMode: (focusMode: boolean) => void;
  setSettingsDropdownHeight: (height: number) => void;
  setIndicatorLabelsCollapsed: (panelId: PanelId, collapsed: boolean) => void;
  openIndicatorSettings: (panelId: PanelId, section: SettingsFocusSection) => void;
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
    contractType: 'spot',
    dataSourceMode: 'both',
    absorptionEnabled: true,
    absorptionMinScore: 50,
    absorptionSide: 'both' as AbsorptionSide,
    absorptionShowLabels: true,
    bubblesEnabled: false,
    bubbleSource: 'footprintCells',
    bubbleSizeBy: 'volume',
    aggregateBubbleMarketSource: 'active',
    bubbleThreshold: 50,
    bubbleThresholdMode: 'absolute',
    bubbleMinOrders: 1,
    bubbleMinRadius: 2,
    bubbleMaxRadius: 8,
    bubbleSide: 'both' as BubbleSide,
    bubbleScaleMode: 'sqrt' as BubbleScaleMode,
    isDrawMode: false,
    customProfileRange: null,
    customProfileLocked: false,
    drawnLines: [],
    lineDrawMode: 'none',
    drawingToolbarPosition: { x: 16, y: 48 },
    exhaustionEnabled: true,
    exhaustionMinScore: 40,
    exhaustionSide: 'both' as ExhaustionSide,
    exhaustionLookback: 5,
    exhaustionShowProvisional: true,
    icebergEnabled: true,
    icebergMinScore: 45,
    icebergLookback: 10,
    icebergShowSuspected: true,
    icebergShowLabels: true,
    icebergShowTint: true,
    liquidityVacuumEnabled: true,
    liquidityVacuumMinScore: 55,
    liquidityVacuumShowLabels: false,
    liquidityVacuumOpacity: 0.18,
    liquidityVacuumMaxZones: 6,
    indicatorLabelsCollapsed: false,
    profileWidthPct: 70,
    defaultProfileEnabled: false,
    profileResolutionTicks: 0,
    profileMinRowHeight: 1,
    profileOpacity: 0.4,
    profileMinRowWidth: 2,
    profileScaleMode: 'linear',
    profileShowPocHighlight: true,
    profileShowVaFill: true,
    profileShowPocLine: true,
    profileShowVaLines: true,
    profileShowDelta: true,
    deltaProfileWidth: 80,
    cvdEnabled: false,
    cvdPanelHeightPct: 24,
    cvdMode: 'candles',
    cvdSmoothing: 1,
    cvdResetMode: 'daily',
    cvdPositiveColor: CHART_BULLISH_COLOR,
    cvdNegativeColor: CHART_BEARISH_COLOR,
    cvdScaleMode: 'auto',
    cvdFixedRange: 1000,
    cvdShowDivergence: false,
    cvdDivergenceLookback: 8,
    cvdMinimized: false,
    volumeBarsEnabled: false,
    volumeBarsInputData: 'volume',
    volumeBarsMarketSource: 'active',
    volumeBarsFilterMode: 'absolute',
    volumeBarsMovingAverageLength: 20,
    volumeBarsFilterMin: 0,
    volumeBarsFilterMax: 0,
    volumeBarsColorMode: 'priceDirection',
    volumeBarsOpacity: 0.45,
    volumeBarsHeightPct: 18,
    volumeBarsShowValueText: false,
    volumeBarsTextSize: 10,
    volumeBarsAverageLineEnabled: false,
    volumeBarsAverageLength: 20,
    sessionsEnabled: false,
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
    historicalSessionProfileEnabled: false,
    historicalSessionProfileStartHour: 13,
    historicalSessionProfileStartMin: 0,
    historicalSessionProfileEndHour: 22,
    historicalSessionProfileEndMin: 0,
    historicalSessionProfileCount: 1,
    historicalSessionProfileMinTimeframe: '15m',
    settingsByTimeframe: {},
    // Liquidity Map
    liquidityEnabled: false,
    liquidityBucketSize: 50,
    minimumLiquidityThreshold: 5,
    liquidityOpacity: 0.6,
    liquidityRange: 10,
    liquidityHistoryEnabled: true,
    liquidityHistoryDepth: 200,
    liquidityHeatmapEnabled: false,
    liquidityHeatmapOpacity: 0.7,
    liquidityHeatmapAgeFade: 0.6,
    liquidityHeatmapWidth: 60,
    liquidityHeatmapShowPulled: true,
    liquidityHeatmapShowConsumed: true,
    liquidityHeatmapShowPersistence: true,
    liquidityHeatmapShowCurrentLabel: true,
    liquidityHeatmapProfileSync: false,
    // Stats Indicator
    statsIndicatorEnabled: false,
    statsIndicatorCount: 3,
    statsIndicatorItems: ['volume', 'delta', 'cvd'],
  };
}

function clampProfileResolutionTicks(profileResolutionTicks: unknown, tickSize: number) {
  const ticks = Number(profileResolutionTicks);
  if (!Number.isFinite(ticks) || ticks <= 0) return 0;

  return Math.max(
    getMinimumFineProfileResolutionTicks(tickSize),
    Math.min(100, Math.round(ticks)),
  );
}

function clampTimeframeSettings(settings: Partial<TimeframeSettings>, tickSize: number) {
  return {
    ...settings,
    ...(settings.profileResolutionTicks === undefined
      ? {}
      : { profileResolutionTicks: clampProfileResolutionTicks(settings.profileResolutionTicks, tickSize) }),
    ...(settings.bubbleSource === undefined
      ? {}
      : { bubbleSource: normalizeBubbleSource(settings.bubbleSource) }),
    ...(settings.bubbleSizeBy === undefined
      ? {}
      : { bubbleSizeBy: normalizeBubbleSizeBy(settings.bubbleSizeBy) }),
    ...(settings.aggregateBubbleMarketSource === undefined
      ? {}
      : { aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(settings.aggregateBubbleMarketSource) }),
    ...(settings.bubbleMinOrders === undefined
      ? {}
      : { bubbleMinOrders: clampBubbleMinOrders(settings.bubbleMinOrders) }),
    ...(settings.bubbleScaleMode === undefined
      ? {}
      : { bubbleScaleMode: normalizeBubbleScaleMode(settings.bubbleScaleMode) }),
    ...(settings.volumeBarsInputData === undefined
      ? {}
      : { volumeBarsInputData: normalizeVolumeBarsInputData(settings.volumeBarsInputData) }),
    ...(settings.volumeBarsMarketSource === undefined
      ? {}
      : { volumeBarsMarketSource: normalizeVolumeBarsMarketSource(settings.volumeBarsMarketSource) }),
    ...(settings.volumeBarsFilterMode === undefined
      ? {}
      : { volumeBarsFilterMode: (settings.volumeBarsFilterMode === 'relative' ? 'relative' : 'absolute') as VolumeBarsFilterMode }),
    ...(settings.volumeBarsMovingAverageLength === undefined
      ? {}
      : { volumeBarsMovingAverageLength: Math.max(1, Math.min(200, Number(settings.volumeBarsMovingAverageLength) || 20)) }),
    ...(settings.volumeBarsFilterMin === undefined
      ? {}
      : { volumeBarsFilterMin: clampVolumeBarsFilter(settings.volumeBarsFilterMin) }),
    ...(settings.volumeBarsFilterMax === undefined
      ? {}
      : { volumeBarsFilterMax: clampVolumeBarsFilter(settings.volumeBarsFilterMax) }),
    ...(settings.volumeBarsColorMode === undefined
      ? {}
      : { volumeBarsColorMode: normalizeVolumeBarsColorMode(settings.volumeBarsColorMode) }),
    ...(settings.volumeBarsOpacity === undefined
      ? {}
      : { volumeBarsOpacity: clampVolumeBarsOpacity(settings.volumeBarsOpacity) }),
    ...(settings.volumeBarsHeightPct === undefined
      ? {}
      : { volumeBarsHeightPct: clampVolumeBarsHeightPct(settings.volumeBarsHeightPct) }),
    ...(settings.volumeBarsTextSize === undefined
      ? {}
      : { volumeBarsTextSize: clampVolumeBarsTextSize(settings.volumeBarsTextSize) }),
    ...(settings.volumeBarsAverageLength === undefined
      ? {}
      : { volumeBarsAverageLength: clampVolumeBarsAverageLength(settings.volumeBarsAverageLength) }),
  };
}

function clampSettingsByTimeframe(
  settingsByTimeframe: Record<string, Partial<TimeframeSettings>> | undefined,
  tickSize: number,
) {
  if (!settingsByTimeframe) return {};

  return Object.fromEntries(
    Object.entries(settingsByTimeframe).map(([timeframe, settings]) => [
      timeframe,
      clampTimeframeSettings(settings, tickSize),
    ]),
  );
}

function normalizeBubbleScaleMode(scaleMode: unknown): BubbleScaleMode {
  return scaleMode === 'linear' || scaleMode === 'sqrt' || scaleMode === 'log'
    ? scaleMode
    : 'sqrt';
}

function normalizeBubbleSizeBy(sizeBy: unknown): BubbleSizeBy {
  return sizeBy === 'orders' ? 'orders' : 'volume';
}

function normalizeBubbleSource(source: unknown): BubbleSource {
  return source === 'aggregateTrades' ? 'aggregateTrades' : 'footprintCells';
}

function normalizeAggregateBubbleMarketSource(source: unknown): AggregateBubbleMarketSource {
  return source === 'spot' || source === 'futures' || source === 'both'
    ? source
    : 'active';
}

function normalizeVolumeBarsInputData(inputData: unknown): VolumeBarsInputData {
  return inputData === 'orders' || inputData === 'aggregateTrades' ? inputData : 'volume';
}

function normalizeVolumeBarsMarketSource(source: unknown): VolumeBarsMarketSource {
  return source === 'spot' || source === 'futures' || source === 'both' ? source : 'active';
}

function normalizeVolumeBarsColorMode(mode: unknown): VolumeBarsColorMode {
  if (mode === 'fixed' || mode === 'delta' || mode === 'volumeSlope') return mode;
  return 'priceDirection';
}

function clampVolumeBarsFilter(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, next);
}

function clampVolumeBarsOpacity(opacity: unknown) {
  const next = Number(opacity);
  if (!Number.isFinite(next)) return 0.45;
  return Math.max(0.1, Math.min(1, next));
}

function clampVolumeBarsHeightPct(pct: unknown) {
  const next = Number(pct);
  if (!Number.isFinite(next)) return 18;
  return Math.max(8, Math.min(35, Math.round(next)));
}

function clampVolumeBarsTextSize(size: unknown) {
  const next = Number(size);
  if (!Number.isFinite(next)) return 10;
  return Math.max(8, Math.min(16, Math.round(next)));
}

function clampVolumeBarsAverageLength(length: unknown) {
  const next = Number(length);
  if (!Number.isFinite(next)) return 20;
  return Math.max(1, Math.min(500, Math.round(next)));
}

function clampBubbleMinOrders(minOrders: unknown) {
  const value = Number(minOrders);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(1000, Math.round(value)));
}

function updatePanel(state: ChartState, panelId: PanelId, updates: Partial<PanelState>): Partial<ChartState> {
  const panel = state.panels[panelId];
  const newPanel = { ...panel, ...updates };

  // If any timeframe setting is updated, save it to settingsByTimeframe for the CURRENT timeframe
  const timeframeSettingsKeys: (keyof TimeframeSettings)[] = [
    'bucketSize', 'autoBucketSize', 'bubbleSource', 'bubbleThreshold', 'bubbleThresholdMode',
    'bubbleSizeBy', 'aggregateBubbleMarketSource', 'bubbleMinOrders', 'bubbleScaleMode',
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
    'cvdDivergenceLookback', 'cvdMinimized',
    'volumeBarsEnabled', 'volumeBarsInputData', 'volumeBarsMarketSource',
    'volumeBarsFilterMode', 'volumeBarsMovingAverageLength',
    'volumeBarsFilterMin', 'volumeBarsFilterMax', 'volumeBarsColorMode',
    'volumeBarsOpacity', 'volumeBarsHeightPct', 'volumeBarsShowValueText',
    'volumeBarsTextSize', 'volumeBarsAverageLineEnabled', 'volumeBarsAverageLength'
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
      focusMode: false,
      settingsDropdownHeight: 500,
      settingsOpenRequest: null,
      crosshairSyncEnabled: true,
      globalTimezone: 'local',
      globalTimeFormat: '24h',
      isAuthenticated: false,

      // Per-panel actions
      setPair: (panelId, pair) =>
        set((state) => updatePanel(state, panelId, { pair })),

      setTimeframe: (panelId, timeframe) =>
        set((state) => {
          const panel = state.panels[panelId];
          const savedSettings = clampTimeframeSettings(panel.settingsByTimeframe[timeframe] || {}, state.tickSize);
          return updatePanel(state, panelId, { 
            timeframe, 
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

      setContractType: (panelId, contractType) =>
        set((state) => updatePanel(state, panelId, { contractType })),

      setDataSourceMode: (panelId, dataSourceMode) =>
        set((state) => updatePanel(state, panelId, { dataSourceMode })),

      setAbsorptionEnabled: (panelId, absorptionEnabled) =>
        set((state) => updatePanel(state, panelId, { absorptionEnabled })),

      setAbsorptionMinScore: (panelId, absorptionMinScore) =>
        set((state) => updatePanel(state, panelId, { absorptionMinScore: Math.max(0, Math.min(100, absorptionMinScore)) })),

      setAbsorptionSide: (panelId, absorptionSide) =>
        set((state) => updatePanel(state, panelId, { absorptionSide })),

      setAbsorptionShowLabels: (panelId, absorptionShowLabels) =>
        set((state) => updatePanel(state, panelId, { absorptionShowLabels })),

      setBubblesEnabled: (panelId, bubblesEnabled) =>
        set((state) => updatePanel(state, panelId, { bubblesEnabled })),

      setBubbleSource: (panelId, bubbleSource) =>
        set((state) => updatePanel(state, panelId, { bubbleSource: normalizeBubbleSource(bubbleSource) })),

      setBubbleSizeBy: (panelId, bubbleSizeBy) =>
        set((state) => updatePanel(state, panelId, { bubbleSizeBy: normalizeBubbleSizeBy(bubbleSizeBy) })),

      setAggregateBubbleMarketSource: (panelId, aggregateBubbleMarketSource) =>
        set((state) => updatePanel(state, panelId, { aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(aggregateBubbleMarketSource) })),

      setBubbleThreshold: (panelId, bubbleThreshold) =>
        set((state) => updatePanel(state, panelId, { bubbleThreshold: Math.max(0.1, bubbleThreshold) })),

      setBubbleThresholdMode: (panelId, bubbleThresholdMode) =>
        set((state) => updatePanel(state, panelId, { bubbleThresholdMode })),

      setBubbleMinOrders: (panelId, bubbleMinOrders) =>
        set((state) => updatePanel(state, panelId, { bubbleMinOrders: clampBubbleMinOrders(bubbleMinOrders) })),

      setBubbleMinRadius: (panelId, bubbleMinRadius) =>
        set((state) => {
          const panel = state.panels[panelId];
          const nextMinRadius = Math.max(1, Math.min(20, bubbleMinRadius));
          return updatePanel(state, panelId, { bubbleMinRadius: Math.min(nextMinRadius, panel.bubbleMaxRadius - 1) });
        }),

      setBubbleMaxRadius: (panelId, bubbleMaxRadius) =>
        set((state) => {
          const panel = state.panels[panelId];
          const nextMaxRadius = Math.max(5, Math.min(60, bubbleMaxRadius));
          return updatePanel(state, panelId, { bubbleMaxRadius: Math.max(nextMaxRadius, panel.bubbleMinRadius + 1) });
        }),

      setBubbleSide: (panelId, bubbleSide) =>
        set((state) => updatePanel(state, panelId, { bubbleSide })),

      setBubbleScaleMode: (panelId, bubbleScaleMode) =>
        set((state) => updatePanel(state, panelId, { bubbleScaleMode })),

      setDrawMode: (panelId, isDrawMode) =>
        set((state) => {
          const updates: Partial<PanelState> = { isDrawMode };
          if (isDrawMode) {
            updates.lineDrawMode = 'none';
          }
          return updatePanel(state, panelId, updates);
        }),

      setCustomProfileRange: (panelId, customProfileRange) =>
        set((state) => updatePanel(state, panelId, { customProfileRange })),

      setCustomProfileLocked: (panelId, customProfileLocked) =>
        set((state) => updatePanel(state, panelId, { customProfileLocked })),

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
            updates.isDrawMode = false;
          }
          return updatePanel(state, panelId, updates);
        }),

      setDrawingToolbarPosition: (panelId, drawingToolbarPosition) =>
        set((state) => updatePanel(state, panelId, {
          drawingToolbarPosition: {
            x: Math.round(drawingToolbarPosition.x),
            y: Math.max(0, Math.round(drawingToolbarPosition.y)),
          },
        })),

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

      setProfileWidthPct: (panelId, profileWidthPct) =>
        set((state) => updatePanel(state, panelId, { profileWidthPct: Math.max(10, Math.min(100, profileWidthPct)) })),

      setDefaultProfileEnabled: (panelId, defaultProfileEnabled) =>
        set((state) => updatePanel(state, panelId, { defaultProfileEnabled })),

      setProfileResolutionTicks: (panelId, profileResolutionTicks) =>
        set((state) => updatePanel(state, panelId, { profileResolutionTicks: clampProfileResolutionTicks(profileResolutionTicks, state.tickSize) })),

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

      setVolumeBarsEnabled: (panelId, volumeBarsEnabled) =>
        set((state) => updatePanel(state, panelId, { volumeBarsEnabled })),

      setVolumeBarsInputData: (panelId, volumeBarsInputData) =>
        set((state) => updatePanel(state, panelId, { volumeBarsInputData: normalizeVolumeBarsInputData(volumeBarsInputData) })),

      setVolumeBarsMarketSource: (panelId, volumeBarsMarketSource) =>
        set((state) => updatePanel(state, panelId, { volumeBarsMarketSource: normalizeVolumeBarsMarketSource(volumeBarsMarketSource) })),

      setVolumeBarsFilterMode: (panelId, volumeBarsFilterMode) =>
        set((state) => updatePanel(state, panelId, { volumeBarsFilterMode })),

      setVolumeBarsMovingAverageLength: (panelId, volumeBarsMovingAverageLength) =>
        set((state) => updatePanel(state, panelId, { volumeBarsMovingAverageLength: Math.max(1, Math.min(200, volumeBarsMovingAverageLength)) })),

      setVolumeBarsFilterMin: (panelId, volumeBarsFilterMin) =>
        set((state) => updatePanel(state, panelId, { volumeBarsFilterMin: clampVolumeBarsFilter(volumeBarsFilterMin) })),

      setVolumeBarsFilterMax: (panelId, volumeBarsFilterMax) =>
        set((state) => updatePanel(state, panelId, { volumeBarsFilterMax: clampVolumeBarsFilter(volumeBarsFilterMax) })),

      setVolumeBarsColorMode: (panelId, volumeBarsColorMode) =>
        set((state) => updatePanel(state, panelId, { volumeBarsColorMode: normalizeVolumeBarsColorMode(volumeBarsColorMode) })),

      setVolumeBarsOpacity: (panelId, volumeBarsOpacity) =>
        set((state) => updatePanel(state, panelId, { volumeBarsOpacity: clampVolumeBarsOpacity(volumeBarsOpacity) })),

      setVolumeBarsHeightPct: (panelId, volumeBarsHeightPct) =>
        set((state) => updatePanel(state, panelId, { volumeBarsHeightPct: clampVolumeBarsHeightPct(volumeBarsHeightPct) })),

      setVolumeBarsShowValueText: (panelId, volumeBarsShowValueText) =>
        set((state) => updatePanel(state, panelId, { volumeBarsShowValueText })),

      setVolumeBarsTextSize: (panelId, volumeBarsTextSize) =>
        set((state) => updatePanel(state, panelId, { volumeBarsTextSize: clampVolumeBarsTextSize(volumeBarsTextSize) })),

      setVolumeBarsAverageLineEnabled: (panelId, volumeBarsAverageLineEnabled) =>
        set((state) => updatePanel(state, panelId, { volumeBarsAverageLineEnabled })),

      setVolumeBarsAverageLength: (panelId, volumeBarsAverageLength) =>
        set((state) => updatePanel(state, panelId, { volumeBarsAverageLength: clampVolumeBarsAverageLength(volumeBarsAverageLength) })),

      setSessionsEnabled: (panelId, sessionsEnabled) =>
        set((state) => updatePanel(state, panelId, { sessionsEnabled })),

      // Liquidity actions
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

      // Stats Indicator actions
      setStatsIndicatorEnabled: (panelId, statsIndicatorEnabled) =>
        set((state) => updatePanel(state, panelId, { statsIndicatorEnabled })),

      setStatsIndicatorCount: (panelId, statsIndicatorCount) =>
        set((state) => updatePanel(state, panelId, { statsIndicatorCount: Math.max(1, Math.min(4, Math.round(statsIndicatorCount))) })),

      setStatsIndicatorItems: (panelId, statsIndicatorItems) =>
        set((state) => updatePanel(state, panelId, { statsIndicatorItems })),

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

      setHistoricalSessionProfileEnabled: (panelId, historicalSessionProfileEnabled) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileEnabled })),

      setHistoricalSessionProfileTime: (panelId, field, value) =>
        set((state) => {
          const panel = state.panels[panelId];
          const startTotal = (field === 'startHour' ? value : panel.historicalSessionProfileStartHour) * 60 +
            (field === 'startMin' ? value : panel.historicalSessionProfileStartMin);
          const endTotal = (field === 'endHour' ? value : panel.historicalSessionProfileEndHour) * 60 +
            (field === 'endMin' ? value : panel.historicalSessionProfileEndMin);

          if (endTotal <= startTotal && startTotal - endTotal < 12 * 60) {
              // Allows crossing midnight by just setting it. We don't strictly revert here because midnight crossing is valid
          }
          
          if (field === 'startHour') return updatePanel(state, panelId, { historicalSessionProfileStartHour: value });
          if (field === 'startMin') return updatePanel(state, panelId, { historicalSessionProfileStartMin: value });
          if (field === 'endHour') return updatePanel(state, panelId, { historicalSessionProfileEndHour: value });
          if (field === 'endMin') return updatePanel(state, panelId, { historicalSessionProfileEndMin: value });
          return {};
        }),

      setHistoricalSessionProfileCount: (panelId, historicalSessionProfileCount) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileCount: Math.max(1, Math.min(15, historicalSessionProfileCount)) })),

      setHistoricalSessionProfileMinTimeframe: (panelId, historicalSessionProfileMinTimeframe) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileMinTimeframe })),



      // Global actions
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setActivePanel: (activePanel) => set({ activePanel }),
      setSplitRatio: (splitRatio) => set({ splitRatio: Math.max(0.15, Math.min(0.85, splitRatio)) }),
      setTickSize: (tickSize) => set((state) => ({
        tickSize,
        panels: {
          left: {
            ...state.panels.left,
            profileResolutionTicks: clampProfileResolutionTicks(state.panels.left.profileResolutionTicks, tickSize),
            settingsByTimeframe: clampSettingsByTimeframe(state.panels.left.settingsByTimeframe, tickSize),
          },
          right: {
            ...state.panels.right,
            profileResolutionTicks: clampProfileResolutionTicks(state.panels.right.profileResolutionTicks, tickSize),
            settingsByTimeframe: clampSettingsByTimeframe(state.panels.right.settingsByTimeframe, tickSize),
          },
        },
      })),
      setGlobalTimezone: (globalTimezone) => set({ globalTimezone }),
      setGlobalTimeFormat: (globalTimeFormat) => set({ globalTimeFormat }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setFocusMode: (focusMode) => set({ focusMode }),
      setSettingsDropdownHeight: (settingsDropdownHeight) =>
        set({ settingsDropdownHeight: Math.max(350, Math.min(900, Math.round(settingsDropdownHeight))) }),
      setIndicatorLabelsCollapsed: (panelId, indicatorLabelsCollapsed) =>
        set((state) => updatePanel(state, panelId, { indicatorLabelsCollapsed })),
      openIndicatorSettings: (panelId, section) =>
        set((state) => ({
          activePanel: panelId,
          settingsOpenRequest: {
            panelId,
            section,
            requestId: (state.settingsOpenRequest?.requestId ?? 0) + 1,
          },
        })),
      setCrosshairSyncEnabled: (crosshairSyncEnabled) => set({ crosshairSyncEnabled }),

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
      version: 36,
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
        const tickSize = Number.isFinite(Number(persisted.tickSize)) ? Number(persisted.tickSize) : 0.5;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ensureDrawingToolbarPosition = (position: any): DrawingToolbarPosition => {
          const x = Number(position?.x);
          const y = Number(position?.y);
          const panelHeaderOffset = version < 28 ? 32 : 0;
          return {
            x: Number.isFinite(x) ? Math.max(0, Math.round(x)) : 16,
            y: Number.isFinite(y) ? Math.max(0, Math.round(y + panelHeaderOffset)) : 48,
          };
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ensurePanel = (p: any) => {
          if (!p) return p;
          const panelRest = { ...p };
          delete panelRest.panelHeaderCollapsed;
          delete panelRest.candles;
          delete panelRest.trades;
          delete panelRest.connected;
          delete panelRest.isLoadingHistory;
          delete panelRest.historyRestoreStatus;
          delete panelRest.footprintTrigger;
          delete panelRest.absorptionMap;
          delete panelRest.exhaustionMap;
          delete panelRest.aggregateBubbleEvents;
          delete panelRest.isProfileSelected;
          delete panelRest.icebergLevels;
          delete panelRest.liquidityVacuumZones;
          delete panelRest.liquidityZones;
          delete panelRest.measureToolActive;
          delete panelRest.activeMeasurement;
          return {
            ...panelRest,
            footprintMode: p.footprintMode || 'bid-ask',
            autoBucketSize: p.autoBucketSize ?? false,
            contractType: ensureContractType(p.contractType),
            dataSourceMode: ensureDataSourceMode(p.dataSourceMode),
            absorptionEnabled: p.absorptionEnabled ?? true,
            absorptionMinScore: p.absorptionMinScore ?? 50,
            absorptionSide: p.absorptionSide || 'both',
            absorptionShowLabels: p.absorptionShowLabels ?? true,
            bubblesEnabled: p.bubblesEnabled ?? false,
            bubbleSource: normalizeBubbleSource(p.bubbleSource),
            bubbleSizeBy: normalizeBubbleSizeBy(p.bubbleSizeBy),
            aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(p.aggregateBubbleMarketSource),
            bubbleThreshold: p.bubbleThreshold ?? 50,
            bubbleThresholdMode: p.bubbleThresholdMode || 'absolute',
            bubbleMinOrders: clampBubbleMinOrders(p.bubbleMinOrders),
            bubbleMinRadius: p.bubbleMinRadius ?? 4,
            bubbleMaxRadius: p.bubbleMaxRadius ?? 20,
            bubbleSide: p.bubbleSide || 'both',
            bubbleScaleMode: normalizeBubbleScaleMode(p.bubbleScaleMode),
            isDrawMode: p.isDrawMode ?? false,
            customProfileRange: p.customProfileRange ?? null,
            customProfileLocked: p.customProfileLocked ?? false,
            drawnLines: p.drawnLines ?? [],
            lineDrawMode: p.lineDrawMode || 'none',
            drawingToolbarPosition: ensureDrawingToolbarPosition(p.drawingToolbarPosition),
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
            liquidityVacuumEnabled: p.liquidityVacuumEnabled ?? true,
            liquidityVacuumMinScore: Math.max(30, Math.min(90, p.liquidityVacuumMinScore ?? 55)),
            liquidityVacuumShowLabels: p.liquidityVacuumShowLabels ?? false,
            liquidityVacuumOpacity: Math.max(0.05, Math.min(0.5, p.liquidityVacuumOpacity ?? 0.18)),
            liquidityVacuumMaxZones: Math.max(1, Math.min(20, p.liquidityVacuumMaxZones ?? 6)),
            indicatorLabelsCollapsed: p.indicatorLabelsCollapsed ?? persisted.indicatorLabelsCollapsed ?? false,
            profileWidthPct: p.profileWidthPct ?? 70,
            defaultProfileEnabled: p.defaultProfileEnabled ?? false,
            profileResolutionTicks: clampProfileResolutionTicks(p.profileResolutionTicks, tickSize),
            profileMinRowHeight: p.profileMinRowHeight ?? 1,
            profileOpacity: p.profileOpacity ?? 0.4,
            profileMinRowWidth: p.profileMinRowWidth ?? 2,
            profileScaleMode: p.profileScaleMode || 'linear',
            profileShowPocHighlight: p.profileShowPocHighlight ?? true,
            profileShowVaFill: p.profileShowVaFill ?? true,
            profileShowPocLine: p.profileShowPocLine ?? true,
            profileShowVaLines: p.profileShowVaLines ?? true,
            profileShowDelta: p.profileShowDelta ?? true,
            deltaProfileWidth: p.deltaProfileWidth ?? 80,
            cvdEnabled: p.cvdEnabled ?? false,
            cvdPanelHeightPct: Math.max(12, Math.min(45, p.cvdPanelHeightPct ?? 24)),
            cvdMode: p.cvdMode || 'candles',
            cvdSmoothing: Math.max(1, Math.min(50, p.cvdSmoothing ?? 1)),
            cvdResetMode: p.cvdResetMode || 'daily',
            cvdPositiveColor: normalizeChartSemanticColor(p.cvdPositiveColor, CHART_BULLISH_COLOR),
            cvdNegativeColor: normalizeChartSemanticColor(p.cvdNegativeColor, CHART_BEARISH_COLOR),
            cvdScaleMode: p.cvdScaleMode || 'auto',
            cvdFixedRange: Math.max(1, p.cvdFixedRange ?? 1000),
            cvdShowDivergence: p.cvdShowDivergence ?? false,
            cvdDivergenceLookback: Math.max(3, Math.min(30, p.cvdDivergenceLookback ?? 8)),
            cvdMinimized: p.cvdMinimized ?? false,
            volumeBarsEnabled: p.volumeBarsEnabled ?? false,
            volumeBarsInputData: normalizeVolumeBarsInputData(p.volumeBarsInputData),
            volumeBarsMarketSource: normalizeVolumeBarsMarketSource(p.volumeBarsMarketSource),
            volumeBarsFilterMode: p.volumeBarsFilterMode === 'relative' ? 'relative' : 'absolute',
            volumeBarsMovingAverageLength: Math.max(1, Math.min(200, Number(p.volumeBarsMovingAverageLength) || 20)),
            volumeBarsFilterMin: clampVolumeBarsFilter(p.volumeBarsFilterMin),
            volumeBarsFilterMax: clampVolumeBarsFilter(p.volumeBarsFilterMax),
            volumeBarsColorMode: normalizeVolumeBarsColorMode(p.volumeBarsColorMode),
            volumeBarsOpacity: clampVolumeBarsOpacity(p.volumeBarsOpacity),
            volumeBarsHeightPct: clampVolumeBarsHeightPct(p.volumeBarsHeightPct),
            volumeBarsShowValueText: p.volumeBarsShowValueText ?? false,
            volumeBarsTextSize: clampVolumeBarsTextSize(p.volumeBarsTextSize),
            volumeBarsAverageLineEnabled: p.volumeBarsAverageLineEnabled ?? false,
            volumeBarsAverageLength: clampVolumeBarsAverageLength(p.volumeBarsAverageLength),
            sessionsEnabled: p.sessionsEnabled ?? false,
            sessions: p.sessions ?? {
              tokyo: { enabled: true, startHour: 0, startMin: 0, endHour: 6, endMin: 0, color: '#B39DDB' },
              london: { enabled: true, startHour: 7, startMin: 0, endHour: 16, endMin: 0, color: '#4FC3F7' },
              newYork: { enabled: true, startHour: 13, startMin: 0, endHour: 22, endMin: 0, color: '#81C784' },
            },
            historicalSessionProfileEnabled: p.historicalSessionProfileEnabled ?? false,
            historicalSessionProfileTimezone: p.historicalSessionProfileTimezone ?? 'America/New_York',
            historicalSessionProfileStartHour: p.historicalSessionProfileStartHour ?? 9,
            historicalSessionProfileStartMin: p.historicalSessionProfileStartMin ?? 30,
            historicalSessionProfileEndHour: p.historicalSessionProfileEndHour ?? 16,
            historicalSessionProfileEndMin: p.historicalSessionProfileEndMin ?? 0,
            historicalSessionProfileCount: p.historicalSessionProfileCount ?? 1,
            historicalSessionProfileMinTimeframe: p.historicalSessionProfileMinTimeframe ?? '15m',
            historicalSessionProfileResolutionTicks: clampProfileResolutionTicks(p.historicalSessionProfileResolutionTicks ?? 0, tickSize),
            historicalSessionProfileMinRowHeight: p.historicalSessionProfileMinRowHeight ?? 1,
            historicalSessionProfileOpacity: p.historicalSessionProfileOpacity ?? 0.3,
            historicalSessionProfileMinRowWidth: p.historicalSessionProfileMinRowWidth ?? 2,
            historicalSessionProfileScaleMode: p.historicalSessionProfileScaleMode || 'linear',
            historicalSessionProfileShowPocHighlight: p.historicalSessionProfileShowPocHighlight ?? true,
            historicalSessionProfileShowVaFill: p.historicalSessionProfileShowVaFill ?? true,
            historicalSessionProfileShowPocLine: p.historicalSessionProfileShowPocLine ?? true,
            historicalSessionProfileShowVaLines: p.historicalSessionProfileShowVaLines ?? true,
            historicalSessionProfileShowDelta: p.historicalSessionProfileShowDelta ?? true,
            historicalSessionProfileDeltaWidth: p.historicalSessionProfileDeltaWidth ?? 80,
            settingsByTimeframe: clampSettingsByTimeframe(p.settingsByTimeframe, tickSize),
            // Liquidity Map (v13 & v14)
            liquidityEnabled: p.liquidityEnabled ?? false,
            liquidityBucketSize: p.liquidityBucketSize ?? 50,
            minimumLiquidityThreshold: p.minimumLiquidityThreshold ?? 5,
            liquidityOpacity: p.liquidityOpacity ?? 0.6,
            liquidityRange: p.liquidityRange ?? 10,
            liquidityHistoryEnabled: p.liquidityHistoryEnabled ?? true,
            liquidityHistoryDepth: Math.max(50, Math.min(500, p.liquidityHistoryDepth ?? 200)),
            // Heatmap (v15)
            liquidityHeatmapEnabled: p.liquidityHeatmapEnabled ?? false,
            liquidityHeatmapOpacity: p.liquidityHeatmapOpacity ?? 0.7,
            liquidityHeatmapAgeFade: p.liquidityHeatmapAgeFade ?? 0.6,
            liquidityHeatmapWidth: p.liquidityHeatmapWidth ?? 60,
            liquidityHeatmapShowPulled: p.liquidityHeatmapShowPulled ?? true,
            liquidityHeatmapShowConsumed: p.liquidityHeatmapShowConsumed ?? true,
            liquidityHeatmapShowPersistence: p.liquidityHeatmapShowPersistence ?? true,
            liquidityHeatmapShowCurrentLabel: p.liquidityHeatmapShowCurrentLabel ?? true,
            liquidityHeatmapProfileSync: p.liquidityHeatmapProfileSync ?? false,
            // Stats Indicator (v36)
            statsIndicatorEnabled: p.statsIndicatorEnabled ?? false,
            statsIndicatorCount: Math.max(1, Math.min(4, p.statsIndicatorCount ?? 4)),
            statsIndicatorItems: p.statsIndicatorItems ?? ['volume', 'delta', 'cvd', 'liquidity'],
          };
        };
        if (persisted.panels) {
          if (persisted.panels.left) persisted.panels.left = ensurePanel(persisted.panels.left);
          if (persisted.panels.right) persisted.panels.right = ensurePanel(persisted.panels.right);
        }
        persisted.settingsDropdownHeight = Math.max(350, Math.min(900, persisted.settingsDropdownHeight ?? 500));
        delete persisted.crosshair;
        delete persisted.indicatorLabelsCollapsed;
        return persisted;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merge: (persistedState: any, currentState: ChartState) => {
        if (!persistedState) return currentState;
        const tickSize = Number.isFinite(Number(persistedState.tickSize))
          ? Number(persistedState.tickSize)
          : currentState.tickSize;
        const persistedLeft = persistedState.panels?.left || {};
        const persistedRight = persistedState.panels?.right || {};
        const persistedSettings = { ...persistedState };
        delete persistedSettings.crosshair;
        return {
          ...currentState,
          ...persistedSettings,
          panels: {
            left: {
              ...currentState.panels.left,
              ...persistedLeft,
              profileResolutionTicks: clampProfileResolutionTicks(
                persistedLeft.profileResolutionTicks ?? currentState.panels.left.profileResolutionTicks,
                tickSize,
              ),
              settingsByTimeframe: clampSettingsByTimeframe(
                persistedLeft.settingsByTimeframe ?? currentState.panels.left.settingsByTimeframe,
                tickSize,
              ),
              bubbleSource: normalizeBubbleSource(
                persistedLeft.bubbleSource ?? currentState.panels.left.bubbleSource,
              ),
              bubbleSizeBy: normalizeBubbleSizeBy(
                persistedLeft.bubbleSizeBy ?? currentState.panels.left.bubbleSizeBy,
              ),
              aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(
                persistedLeft.aggregateBubbleMarketSource ?? currentState.panels.left.aggregateBubbleMarketSource,
              ),
              bubbleMinOrders: clampBubbleMinOrders(
                persistedLeft.bubbleMinOrders ?? currentState.panels.left.bubbleMinOrders,
              ),
              bubbleScaleMode: normalizeBubbleScaleMode(
                persistedLeft.bubbleScaleMode ?? currentState.panels.left.bubbleScaleMode,
              ),
              volumeBarsInputData: normalizeVolumeBarsInputData(
                persistedLeft.volumeBarsInputData ?? currentState.panels.left.volumeBarsInputData,
              ),
              volumeBarsMarketSource: normalizeVolumeBarsMarketSource(
                persistedLeft.volumeBarsMarketSource ?? currentState.panels.left.volumeBarsMarketSource,
              ),
              volumeBarsFilterMode: persistedLeft.volumeBarsFilterMode ?? currentState.panels.left.volumeBarsFilterMode,
              volumeBarsMovingAverageLength: persistedLeft.volumeBarsMovingAverageLength ?? currentState.panels.left.volumeBarsMovingAverageLength,
              volumeBarsColorMode: normalizeVolumeBarsColorMode(
                persistedLeft.volumeBarsColorMode ?? currentState.panels.left.volumeBarsColorMode,
              ),
            },
            right: {
              ...currentState.panels.right,
              ...persistedRight,
              profileResolutionTicks: clampProfileResolutionTicks(
                persistedRight.profileResolutionTicks ?? currentState.panels.right.profileResolutionTicks,
                tickSize,
              ),
              settingsByTimeframe: clampSettingsByTimeframe(
                persistedRight.settingsByTimeframe ?? currentState.panels.right.settingsByTimeframe,
                tickSize,
              ),
              bubbleSource: normalizeBubbleSource(
                persistedRight.bubbleSource ?? currentState.panels.right.bubbleSource,
              ),
              bubbleSizeBy: normalizeBubbleSizeBy(
                persistedRight.bubbleSizeBy ?? currentState.panels.right.bubbleSizeBy,
              ),
              aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(
                persistedRight.aggregateBubbleMarketSource ?? currentState.panels.right.aggregateBubbleMarketSource,
              ),
              bubbleMinOrders: clampBubbleMinOrders(
                persistedRight.bubbleMinOrders ?? currentState.panels.right.bubbleMinOrders,
              ),
              bubbleScaleMode: normalizeBubbleScaleMode(
                persistedRight.bubbleScaleMode ?? currentState.panels.right.bubbleScaleMode,
              ),
              volumeBarsInputData: normalizeVolumeBarsInputData(
                persistedRight.volumeBarsInputData ?? currentState.panels.right.volumeBarsInputData,
              ),
              volumeBarsMarketSource: normalizeVolumeBarsMarketSource(
                persistedRight.volumeBarsMarketSource ?? currentState.panels.right.volumeBarsMarketSource,
              ),
              volumeBarsFilterMode: persistedRight.volumeBarsFilterMode ?? currentState.panels.right.volumeBarsFilterMode,
              volumeBarsMovingAverageLength: persistedRight.volumeBarsMovingAverageLength ?? currentState.panels.right.volumeBarsMovingAverageLength,
              volumeBarsColorMode: normalizeVolumeBarsColorMode(
                persistedRight.volumeBarsColorMode ?? currentState.panels.right.volumeBarsColorMode,
              ),
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
            bubbleSource: state.panels.left.bubbleSource,
            bubbleSizeBy: state.panels.left.bubbleSizeBy,
            aggregateBubbleMarketSource: state.panels.left.aggregateBubbleMarketSource,
            bubbleThreshold: state.panels.left.bubbleThreshold,
            bubbleThresholdMode: state.panels.left.bubbleThresholdMode,
            bubbleMinOrders: state.panels.left.bubbleMinOrders,
            bubbleMinRadius: state.panels.left.bubbleMinRadius,
            bubbleMaxRadius: state.panels.left.bubbleMaxRadius,
            bubbleSide: state.panels.left.bubbleSide,
            bubbleScaleMode: state.panels.left.bubbleScaleMode,
            isDrawMode: state.panels.left.isDrawMode,
            customProfileRange: state.panels.left.customProfileRange,
            customProfileLocked: state.panels.left.customProfileLocked,
            drawnLines: state.panels.left.drawnLines,
            lineDrawMode: state.panels.left.lineDrawMode,
            drawingToolbarPosition: state.panels.left.drawingToolbarPosition,
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
            indicatorLabelsCollapsed: state.panels.left.indicatorLabelsCollapsed,
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
            volumeBarsEnabled: state.panels.left.volumeBarsEnabled,
            volumeBarsInputData: state.panels.left.volumeBarsInputData,
            volumeBarsMarketSource: state.panels.left.volumeBarsMarketSource,
            volumeBarsFilterMode: state.panels.left.volumeBarsFilterMode,
            volumeBarsMovingAverageLength: state.panels.left.volumeBarsMovingAverageLength,
            volumeBarsFilterMin: state.panels.left.volumeBarsFilterMin,
            volumeBarsFilterMax: state.panels.left.volumeBarsFilterMax,
            volumeBarsColorMode: state.panels.left.volumeBarsColorMode,
            volumeBarsOpacity: state.panels.left.volumeBarsOpacity,
            volumeBarsHeightPct: state.panels.left.volumeBarsHeightPct,
            volumeBarsShowValueText: state.panels.left.volumeBarsShowValueText,
            volumeBarsTextSize: state.panels.left.volumeBarsTextSize,
            volumeBarsAverageLineEnabled: state.panels.left.volumeBarsAverageLineEnabled,
            volumeBarsAverageLength: state.panels.left.volumeBarsAverageLength,
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
            historicalSessionProfileEnabled: state.panels.left.historicalSessionProfileEnabled,
            historicalSessionProfileStartHour: state.panels.left.historicalSessionProfileStartHour,
            historicalSessionProfileStartMin: state.panels.left.historicalSessionProfileStartMin,
            historicalSessionProfileEndHour: state.panels.left.historicalSessionProfileEndHour,
            historicalSessionProfileEndMin: state.panels.left.historicalSessionProfileEndMin,
            historicalSessionProfileCount: state.panels.left.historicalSessionProfileCount,
            historicalSessionProfileMinTimeframe: state.panels.left.historicalSessionProfileMinTimeframe,
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
            bubbleSource: state.panels.right.bubbleSource,
            bubbleSizeBy: state.panels.right.bubbleSizeBy,
            aggregateBubbleMarketSource: state.panels.right.aggregateBubbleMarketSource,
            bubbleThreshold: state.panels.right.bubbleThreshold,
            bubbleThresholdMode: state.panels.right.bubbleThresholdMode,
            bubbleMinOrders: state.panels.right.bubbleMinOrders,
            bubbleMinRadius: state.panels.right.bubbleMinRadius,
            bubbleMaxRadius: state.panels.right.bubbleMaxRadius,
            bubbleSide: state.panels.right.bubbleSide,
            bubbleScaleMode: state.panels.right.bubbleScaleMode,
            isDrawMode: state.panels.right.isDrawMode,
            customProfileRange: state.panels.right.customProfileRange,
            customProfileLocked: state.panels.right.customProfileLocked,
            drawnLines: state.panels.right.drawnLines,
            lineDrawMode: state.panels.right.lineDrawMode,
            drawingToolbarPosition: state.panels.right.drawingToolbarPosition,
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
            indicatorLabelsCollapsed: state.panels.right.indicatorLabelsCollapsed,
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
            volumeBarsEnabled: state.panels.right.volumeBarsEnabled,
            volumeBarsInputData: state.panels.right.volumeBarsInputData,
            volumeBarsMarketSource: state.panels.right.volumeBarsMarketSource,
            volumeBarsFilterMode: state.panels.right.volumeBarsFilterMode,
            volumeBarsMovingAverageLength: state.panels.right.volumeBarsMovingAverageLength,
            volumeBarsFilterMin: state.panels.right.volumeBarsFilterMin,
            volumeBarsFilterMax: state.panels.right.volumeBarsFilterMax,
            volumeBarsColorMode: state.panels.right.volumeBarsColorMode,
            volumeBarsOpacity: state.panels.right.volumeBarsOpacity,
            volumeBarsHeightPct: state.panels.right.volumeBarsHeightPct,
            volumeBarsShowValueText: state.panels.right.volumeBarsShowValueText,
            volumeBarsTextSize: state.panels.right.volumeBarsTextSize,
            volumeBarsAverageLineEnabled: state.panels.right.volumeBarsAverageLineEnabled,
            volumeBarsAverageLength: state.panels.right.volumeBarsAverageLength,
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
            historicalSessionProfileEnabled: state.panels.right.historicalSessionProfileEnabled,
            historicalSessionProfileStartHour: state.panels.right.historicalSessionProfileStartHour,
            historicalSessionProfileStartMin: state.panels.right.historicalSessionProfileStartMin,
            historicalSessionProfileEndHour: state.panels.right.historicalSessionProfileEndHour,
            historicalSessionProfileEndMin: state.panels.right.historicalSessionProfileEndMin,
            historicalSessionProfileCount: state.panels.right.historicalSessionProfileCount,
            historicalSessionProfileMinTimeframe: state.panels.right.historicalSessionProfileMinTimeframe,
            settingsByTimeframe: state.panels.right.settingsByTimeframe,
          },
        },
        tickSize: state.tickSize,
        sidebarCollapsed: state.sidebarCollapsed,
        settingsDropdownHeight: state.settingsDropdownHeight,
        crosshairSyncEnabled: state.crosshairSyncEnabled,
        globalTimezone: state.globalTimezone,
        globalTimeFormat: state.globalTimeFormat,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

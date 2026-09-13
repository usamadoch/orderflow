import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { FootprintMode } from '@/types/footprint';
import { getMinimumFineProfileResolutionTicks } from '@/lib/config/markets';
import {
  CHART_BEARISH_COLOR,
  CHART_BULLISH_COLOR,
  normalizeChartSemanticColor,
  DEFAULT_CANVAS_BG,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_OPACITY,
} from '@/lib/config/chartColors';
import type {
  ChartMode,
  PanelId,
  LayoutMode,
  SplitDirection,
  AbsorptionSide,
  ExhaustionSide,
  LineDrawMode,
  DrawingStrokeWidth,
  SessionId,
  CvdMode,
  CvdResetMode,
  CvdScaleMode,
  ContractType,
  DataSourceMode,
  VolumeBarsInputData,
  VolumeBarsMarketSource,
  VolumeBarsColorMode,
  VolumeBarsFilterMode,
  VolumeProfileType,
  IndicatorSettingsSection,
  IndicatorId,
  SettingsFocusSection,
  StatsIndicatorItem,
  HistoryRestoreStage,
  HistoryRestoreStatus,
  SettingsOpenRequest,
  DrawingToolbarPosition,
  SessionConfig,
  GlobalCrosshair,
  BubbleThresholdMode,
  TimeframeSettings,
  Measurement,
  DrawnLine,
  HistorySnapshot,
  PanelState,
} from '../../types/chart';

export type {
  ChartMode,
  PanelId,
  LayoutMode,
  SplitDirection,
  AbsorptionSide,
  ExhaustionSide,
  LineDrawMode,
  DrawingStrokeWidth,
  SessionId,
  CvdMode,
  CvdResetMode,
  CvdScaleMode,
  ContractType,
  DataSourceMode,
  VolumeBarsInputData,
  VolumeBarsMarketSource,
  VolumeBarsColorMode,
  VolumeBarsFilterMode,
  VolumeProfileType,
  IndicatorSettingsSection,
  IndicatorId,
  SettingsFocusSection,
  StatsIndicatorItem,
  HistoryRestoreStage,
  HistoryRestoreStatus,
  SettingsOpenRequest,
  DrawingToolbarPosition,
  SessionConfig,
  GlobalCrosshair,
  BubbleThresholdMode,
  TimeframeSettings,
  Measurement,
  DrawnLine,
  PanelState,
};

import { AggregateBubbleMarketSource, BubbleSizeBy, BubbleScaleMode, BubbleColorMode, BubbleVolumeColorMode, BubbleSide, BubbleDisplayMode, BubbleGroupingMode, BubblePriceAggrMode, BubbleTickGroupingMode } from '../../types/bubble';

export type { AggregateBubbleMarketSource, BubbleScaleMode, BubbleColorMode, BubbleVolumeColorMode, BubbleSide, BubbleSizeBy, BubbleDisplayMode, BubbleGroupingMode, BubblePriceAggrMode, BubbleTickGroupingMode };

export const MAX_AGGREGATE_BUBBLE_EVENTS = 20000;

export interface ChartState {
  panels: {
    left: PanelState;
    right: PanelState;
  };
  layoutMode: LayoutMode;
  splitDirection: SplitDirection;
  activePanel: PanelId;
  splitRatio: number;

  // Shared settings
  tickSize: number;
  sidebarCollapsed: boolean;
  focusMode: boolean;
  settingsDropdownHeight: number;
  settingsOpenRequest: SettingsOpenRequest | null;
  crosshairSyncEnabled: boolean;
  drawingsSyncEnabled: boolean;
  volumeProfileSyncEnabled: boolean;
  bracketDragConfirmEnabled: boolean;
  globalTimezone: string;
  globalTimeFormat: '12h' | '24h';

  // Global Chart Colors & Styles
  candleUpColor: string;
  candleUpOpacity: number;
  candleDownColor: string;
  candleDownOpacity: number;
  candleUpWickColor: string;
  candleUpWickOpacity: number;
  candleDownWickColor: string;
  candleDownWickOpacity: number;

  chartBackgroundType: 'solid' | 'gradient';
  chartBackgroundColor: string;
  chartBackgroundOpacity: number;
  chartBackgroundGradientTop: string;
  chartBackgroundGradientTopOpacity: number;
  chartBackgroundGradientBottom: string;
  chartBackgroundGradientBottomOpacity: number;

  showVerticalGridLines: boolean;
  verticalGridLineColor: string;
  verticalGridLineOpacity: number;
  verticalGridLineStyle: 'solid' | 'dashed' | 'dotted';

  showHorizontalGridLines: boolean;
  horizontalGridLineColor: string;
  horizontalGridLineOpacity: number;
  horizontalGridLineStyle: 'solid' | 'dashed' | 'dotted';

  crosshairColor: string;
  crosshairOpacity: number;
  crosshairThickness: number;
  crosshairStyle: 'solid' | 'dashed' | 'dotted';


  addIndicator: (panelId: PanelId, indicatorId: IndicatorId) => void;
  removeIndicator: (panelId: PanelId, indicatorId: IndicatorId) => void;
  reorderIndicators: (panelId: PanelId, activeIndicators: IndicatorId[]) => void;
  moveIndicator: (panelId: PanelId, indicatorId: IndicatorId, direction: 'up' | 'down') => void;
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
  setBubbleSizeBy: (panelId: PanelId, sizeBy: BubbleSizeBy) => void;
  setAggregateBubbleMarketSource: (panelId: PanelId, source: AggregateBubbleMarketSource) => void;
  setBubbleThreshold: (panelId: PanelId, threshold: number) => void;
  setBubbleThresholdMode: (panelId: PanelId, mode: BubbleThresholdMode) => void;
  setBubbleMinOrders: (panelId: PanelId, minOrders: number) => void;
  setBubbleFilterRender: (panelId: PanelId, val: number) => void;
  setBubbleStdDevVal: (panelId: PanelId, val: number) => void;
  setBubbleOutStdDevPerc: (panelId: PanelId, val: number) => void;
  setAutoBucketSize: (panelId: PanelId, auto: boolean) => void;
  setComputedBucketSize: (panelId: PanelId, bucketSize: number) => void;
  setBubbleSide: (panelId: PanelId, side: BubbleSide) => void;
  setBubbleScaleMode: (panelId: PanelId, mode: BubbleScaleMode) => void;
  setBubbleColorMode: (panelId: PanelId, mode: BubbleColorMode) => void;
  setBubbleVolumeColorMode: (panelId: PanelId, mode: BubbleVolumeColorMode) => void;
  setBubbleDisplayMode: (panelId: PanelId, mode: BubbleDisplayMode) => void;
  setBubbleBidColor: (panelId: PanelId, color: string) => void;
  setBubbleAskColor: (panelId: PanelId, color: string) => void;
  setBubbleLineWidth: (panelId: PanelId, width: number) => void;
  setBubbleOpacity: (panelId: PanelId, opacity: number) => void;
  setBubbleGroupingMode: (panelId: PanelId, mode: BubbleGroupingMode) => void;
  setBubblePriceAggrMode: (panelId: PanelId, mode: BubblePriceAggrMode) => void;
  setBubbleTickGroupingMode: (panelId: PanelId, mode: BubbleTickGroupingMode) => void;
  setBubbleTickCount: (panelId: PanelId, count: number) => void;
  setBubbleTimeWindowMs: (panelId: PanelId, ms: number) => void;
  setDrawMode: (panelId: PanelId, enabled: boolean) => void;
  setCustomProfileRange: (panelId: PanelId, range: PanelState['customProfileRange'], skipHistory?: boolean) => void;
  setCustomProfileLocked: (panelId: PanelId, locked: boolean) => void;
  historyPast: Record<PanelId, HistorySnapshot[]>;
  historyFuture: Record<PanelId, HistorySnapshot[]>;
  pushHistory: (panelId: PanelId, snapshot?: HistorySnapshot) => void;
  undo: (panelId: PanelId) => void;
  redo: (panelId: PanelId) => void;
  canUndo: (panelId: PanelId) => boolean;
  canRedo: (panelId: PanelId) => boolean;
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
  setProfileNodeSensitivity: (panelId: PanelId, sensitivity: number) => void;
  setProfileWidthPct: (panelId: PanelId, pct: number) => void;
  setDefaultProfileEnabled: (panelId: PanelId, enabled: boolean) => void;
  setDefaultProfilePeriod: (panelId: PanelId, period: 'visible' | 'latest' | 'composite' | 'periodic') => void;
  setProfilePeriodValue: (panelId: PanelId, value: number) => void;
  setProfilePeriodUnit: (panelId: PanelId, unit: 'minutes' | 'hours' | 'days') => void;
  setProfileResolutionTicks: (panelId: PanelId, ticks: number) => void;
  setProfileMinRowHeight: (panelId: PanelId, height: number) => void;
  setProfileOpacity: (panelId: PanelId, opacity: number) => void;
  setProfileMinRowWidth: (panelId: PanelId, width: number) => void;
  setProfileScaleMode: (panelId: PanelId, mode: 'linear' | 'sqrt') => void;
  setProfileShowPocHighlight: (panelId: PanelId, show: boolean) => void;
  setProfileShowVaFill: (panelId: PanelId, show: boolean) => void;
  setProfileShowPocLine: (panelId: PanelId, show: boolean) => void;
  setProfileShowVaLines: (panelId: PanelId, show: boolean) => void;
  setProfileType: (panelId: PanelId, type: VolumeProfileType) => void;
  setProfilePocColor: (panelId: PanelId, color: string) => void;
  setProfilePocWidth: (panelId: PanelId, width: number) => void;
  setProfileHvnColor: (panelId: PanelId, color: string) => void;
  setProfileLvnColor: (panelId: PanelId, color: string) => void;
  setProfileInputData: (panelId: PanelId, inputData: VolumeBarsInputData) => void;
  setProfileFilterMin: (panelId: PanelId, val: number | undefined) => void;
  setProfileFilterMax: (panelId: PanelId, val: number | undefined) => void;
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
  setSessionColor: (panelId: PanelId, sessionId: SessionId, color: string, opacity?: number) => void;
  setSessionOpacity: (panelId: PanelId, sessionId: SessionId, opacity: number) => void;

  setHistoricalSessionProfileEnabled: (panelId: PanelId, enabled: boolean) => void;
  setHistoricalSessionProfileSession: (panelId: PanelId, session: SessionId | 'multiple') => void;
  setHistoricalSessionProfileSessions: (panelId: PanelId, sessions: SessionId[]) => void;
  setHistoricalSessionProfileDisplayMode: (panelId: PanelId, mode: 'separate' | 'combined') => void;
  setHistoricalSessionProfileCount: (panelId: PanelId, count: number) => void;
  setHistoricalSessionProfileMinTimeframe: (panelId: PanelId, minTimeframe: string) => void;
  setHistoricalSessionProfileCustomSessions: (panelId: PanelId, customSessions: { id: string; start: string; end: string; tz: string }[]) => void;
  setMergedProfileRanges: (panelId: PanelId, mergedProfileRanges: { start: number; end: number }[]) => void;

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

  // VWAP
  setVwapSettings: (panelId: PanelId, settings: Partial<TimeframeSettings>) => void;

  // Global actions
  setLayoutMode: (mode: LayoutMode) => void;
  setSplitDirection: (direction: SplitDirection) => void;
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
  setDrawingsSyncEnabled: (enabled: boolean) => void;
  setVolumeProfileSyncEnabled: (enabled: boolean) => void;
  setBracketDragConfirmEnabled: (enabled: boolean) => void;

  setCandleUpColor: (color: string) => void;
  setCandleUpOpacity: (opacity: number) => void;
  setCandleDownColor: (color: string) => void;
  setCandleDownOpacity: (opacity: number) => void;
  setCandleUpWickColor: (color: string) => void;
  setCandleUpWickOpacity: (opacity: number) => void;
  setCandleDownWickColor: (color: string) => void;
  setCandleDownWickOpacity: (opacity: number) => void;

  setChartBackgroundType: (type: 'solid' | 'gradient') => void;
  setChartBackgroundColor: (color: string) => void;
  setChartBackgroundOpacity: (opacity: number) => void;
  setChartBackgroundGradientTop: (color: string) => void;
  setChartBackgroundGradientTopOpacity: (opacity: number) => void;
  setChartBackgroundGradientBottom: (color: string) => void;
  setChartBackgroundGradientBottomOpacity: (opacity: number) => void;

  setShowVerticalGridLines: (show: boolean) => void;
  setVerticalGridLineColor: (color: string) => void;
  setVerticalGridLineOpacity: (opacity: number) => void;
  setVerticalGridLineStyle: (style: 'solid' | 'dashed' | 'dotted') => void;

  setShowHorizontalGridLines: (show: boolean) => void;
  setHorizontalGridLineColor: (color: string) => void;
  setHorizontalGridLineOpacity: (opacity: number) => void;
  setHorizontalGridLineStyle: (style: 'solid' | 'dashed' | 'dotted') => void;

  setCrosshairColor: (color: string) => void;
  setCrosshairOpacity: (opacity: number) => void;
  setCrosshairThickness: (thickness: number) => void;
  setCrosshairStyle: (style: 'solid' | 'dashed' | 'dotted') => void;


  // Auth
  isAuthenticated: boolean;
  authenticate: (password: string) => boolean;
  logout: () => void;
}

function createDefaultPanel(id: PanelId): PanelState {
  return {
    id,
    activeIndicators: ['volumeBars', 'stats'],
    pair: 'BTCUSDT',
    timeframe: '1m',
    chartMode: 'candle',
    footprintMode: 'bid-ask',
    bucketSize: 10,
    autoBucketSize: false,
    barWidth: 16,
    scrollOffset: -80,
    contractType: 'futures',
    dataSourceMode: 'futures',
    absorptionEnabled: true,
    absorptionMinScore: 50,
    absorptionSide: 'both' as AbsorptionSide,
    absorptionShowLabels: true,
    bubblesEnabled: false,
    bubbleSizeBy: 'volume' as BubbleSizeBy,
    aggregateBubbleMarketSource: 'active',
    bubbleThreshold: 15,
    bubbleMinOrders: 100,
    bubbleThresholdMode: 'absolute',
    bubbleFilterRender: 2,
    bubbleStdDevVal: 2.0,
    bubbleOutStdDevPerc: 5,
    bubbleSide: 'both' as BubbleSide,
    bubbleScaleMode: 'sqrt' as BubbleScaleMode,
    bubbleColorMode: 'askBidSplit' as BubbleColorMode,
    bubbleVolumeColorMode: 'deltaAbsolute' as BubbleVolumeColorMode,
    bubbleDisplayMode: '2d' as BubbleDisplayMode,
    bubbleBidColor: '#4ade80',
    bubbleAskColor: '#f87171',
    bubbleLineWidth: 1,
    bubbleOpacity: 0.15,
    bubbleGroupingMode: 'automatic' as BubbleGroupingMode,
    bubblePriceAggrMode: 'extension' as BubblePriceAggrMode,
    bubbleTickGroupingMode: 'automatic' as BubbleTickGroupingMode,
    bubbleTickCount: 3,
    bubbleTimeWindowMs: 250,
    isDrawMode: false,
    customProfileRange: null,
    customProfileLocked: false,
    drawnLines: [],
    lineDrawMode: 'none',
    drawingToolbarPosition: { x: -1, y: 44 },
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
    profileNodeSensitivity: 0.5,
    profileWidthPct: 45,
    defaultProfileEnabled: false,
    defaultProfilePeriod: 'visible',
    profileResolutionTicks: 0,
    profileMinRowHeight: 1,
    profileOpacity: 0.6,
    profileMinRowWidth: 2,
    profileScaleMode: 'linear',
    profileShowPocHighlight: true,
    profileShowVaFill: true,
    profileShowPocLine: true,
    profileShowVaLines: true,
    profileType: 'volume',
    profilePocColor: '#F0B90B',
    profilePocWidth: 1,
    profileHvnColor: '#F43F5E',
    profileLvnColor: '#22D3EE',
    profileInputData: 'volume',
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
    volumeBarsEnabled: true,
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
        startHour: 5, startMin: 0,
        endHour: 11, endMin: 0,
        color: '#2962FF',
        opacity: 0.15,
      },
      london: {
        enabled: true,
        startHour: 12, startMin: 30,
        endHour: 20, endMin: 30,
        color: '#FF9800',
        opacity: 0.15,
      },
      newYork: {
        enabled: true,
        startHour: 18, startMin: 0,
        endHour: 1, endMin: 0,
        color: '#4CAF50',
        opacity: 0.15,
      },
    },
    historicalSessionProfileEnabled: false,
    historicalSessionProfileSession: 'newYork',
    historicalSessionProfileSessions: ['newYork'],
    historicalSessionProfileDisplayMode: 'separate',
    historicalSessionProfileCount: 1,
    historicalSessionProfileMinTimeframe: '15m',
    historicalSessionProfileCustomSessions: [],
    mergedProfileRanges: [],
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
    statsIndicatorEnabled: true,
    statsIndicatorCount: 2,
    statsIndicatorItems: ['volume', 'delta'],
    vwapEnabled: false,
    vwapPeriodMode: 'Session',
    vwapSessionAnchor: 'Day',
    vwapRollingDays: 7,
    vwapPriceSource: 'HLC3',
    vwapEnvelopeMode: 'Standard Deviation',
    vwapBand1Enabled: false,
    vwapBand1Value: 1.0,
    vwapBand2Enabled: false,
    vwapBand2Value: 2.0,
    vwapBand3Enabled: false,
    vwapBand3Value: 3.0,
    vwapLineColor: '#F59E0B',
    vwapBand1Color: '#34D399',
    vwapBand2Color: '#60A5FA',
    vwapBand3Color: '#F472B6',
    vwapBandFillOpacity: 0.1,
    vwapLineWidth: 2,
    vwapBandWidth: 1,
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
    ...(settings.bubbleSizeBy === undefined
      ? {}
      : { bubbleSizeBy: (settings.bubbleSizeBy === 'orders' ? 'orders' : 'volume') as BubbleSizeBy }),
    ...(settings.aggregateBubbleMarketSource === undefined
      ? {}
      : { aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(settings.aggregateBubbleMarketSource) }),
    ...(settings.bubbleMinOrders === undefined
      ? {}
      : { bubbleMinOrders: clampBubbleMinOrders(settings.bubbleMinOrders) }),
    ...(settings.bubbleScaleMode === undefined
      ? {}
      : { bubbleScaleMode: normalizeBubbleScaleMode(settings.bubbleScaleMode) }),
    ...(settings.bubbleGroupingMode === undefined
      ? {}
      : { bubbleGroupingMode: normalizeBubbleGroupingMode(settings.bubbleGroupingMode) }),
    ...(settings.bubblePriceAggrMode === undefined
      ? {}
      : { bubblePriceAggrMode: normalizeBubblePriceAggrMode(settings.bubblePriceAggrMode) }),
    ...(settings.bubbleTickGroupingMode === undefined
      ? {}
      : { bubbleTickGroupingMode: normalizeBubbleTickGroupingMode(settings.bubbleTickGroupingMode) }),
    ...(settings.bubbleTickCount === undefined
      ? {}
      : { bubbleTickCount: Math.max(1, Math.min(100, Math.round(Number(settings.bubbleTickCount) || 3))) }),
    ...(settings.bubbleTimeWindowMs === undefined
      ? {}
      : { bubbleTimeWindowMs: Math.max(50, Math.min(5000, Math.round(Number(settings.bubbleTimeWindowMs) || 250))) }),
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

function normalizeBubbleGroupingMode(mode: unknown): BubbleGroupingMode {
  return mode === 'automatic' || mode === 'time' || mode === 'price' ? mode : 'automatic';
}

function normalizeBubblePriceAggrMode(mode: unknown): BubblePriceAggrMode {
  return mode === 'extension' || mode === 'extensionRetracement' ? mode : 'extension';
}

function normalizeBubbleTickGroupingMode(mode: unknown): BubbleTickGroupingMode {
  return mode === 'automatic' || mode === 'fixed' ? mode : 'automatic';
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
  if (!Number.isFinite(value)) return 100;
  return Math.max(1, Math.min(1000, Math.round(value)));
}

function updatePanel(state: ChartState, panelId: PanelId, updates: Partial<PanelState>): Partial<ChartState> {
  const panel = state.panels[panelId];
  const newPanel = { ...panel, ...updates };

  // If any timeframe setting is updated, save it to settingsByTimeframe for the CURRENT timeframe
  const timeframeSettingsKeys: (keyof TimeframeSettings)[] = [
    'bucketSize', 'autoBucketSize', 'bubbleThreshold', 'bubbleThresholdMode', 'bubbleMinOrders',
    'bubbleSizeBy', 'aggregateBubbleMarketSource', 'bubbleFilterRender', 'bubbleStdDevVal', 'bubbleOutStdDevPerc', 'bubbleScaleMode', 'bubbleColorMode', 'bubbleVolumeColorMode', 'bubbleDisplayMode', 'bubbleBidColor', 'bubbleAskColor', 'bubbleLineWidth', 'bubbleOpacity',
    'bubbleGroupingMode', 'bubblePriceAggrMode', 'bubbleTickGroupingMode', 'bubbleTickCount', 'bubbleTimeWindowMs',
    'absorptionMinScore', 'exhaustionMinScore', 'exhaustionLookback',
    'icebergMinScore', 'icebergLookback', 'icebergShowSuspected',
    'icebergShowLabels', 'icebergShowTint', 'liquidityVacuumMinScore',
    'liquidityVacuumShowLabels', 'liquidityVacuumOpacity', 'liquidityVacuumMaxZones',
    'profileNodeSensitivity', 'profileWidthPct', 'defaultProfileEnabled', 'defaultProfilePeriod', 'profileResolutionTicks', 'profileMinRowHeight',
    'profileOpacity', 'profileMinRowWidth', 'profileScaleMode',
    'profileShowPocHighlight', 'profileShowVaFill', 'profileShowPocLine',
    'profileShowVaLines', 'profileType', 'deltaProfileWidth',
    'cvdEnabled', 'cvdPanelHeightPct', 'cvdMode', 'cvdSmoothing',
    'cvdResetMode', 'cvdPositiveColor', 'cvdNegativeColor',
    'cvdScaleMode', 'cvdFixedRange', 'cvdShowDivergence',
    'cvdDivergenceLookback', 'cvdMinimized',
    'volumeBarsEnabled', 'volumeBarsInputData', 'volumeBarsMarketSource',
    'volumeBarsFilterMode', 'volumeBarsMovingAverageLength',
    'volumeBarsFilterMin', 'volumeBarsFilterMax', 'volumeBarsColorMode',
    'volumeBarsOpacity', 'volumeBarsHeightPct', 'volumeBarsShowValueText',
    'volumeBarsTextSize', 'volumeBarsAverageLineEnabled', 'volumeBarsAverageLength',
    'vwapEnabled', 'vwapPeriodMode', 'vwapSessionAnchor', 'vwapRollingDays',
    'vwapPriceSource', 'vwapEnvelopeMode', 'vwapBand1Enabled', 'vwapBand1Value',
    'vwapBand2Enabled', 'vwapBand2Value', 'vwapBand3Enabled', 'vwapBand3Value',
    'vwapLineColor', 'vwapBand1Color', 'vwapBand2Color', 'vwapBand3Color',
    'vwapBandFillOpacity', 'vwapLineWidth', 'vwapBandWidth'
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

const tabAwareStorage: StateStorage = {
  getItem: (name) => {
    // Attempt to load from both storages
    const localStr = typeof window !== 'undefined' ? localStorage.getItem(name) : null;
    const sessionStr = typeof window !== 'undefined' ? sessionStorage.getItem(name) : null;

    if (!localStr && !sessionStr) return null;

    const localData = localStr ? JSON.parse(localStr) : {};
    const sessionData = sessionStr ? JSON.parse(sessionStr) : {};

    const mergedState = {
      ...(localData.state || {}),
      ...(sessionData.state || {})
    };

    return JSON.stringify({
      version: localData.version ?? sessionData.version,
      state: mergedState
    });
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    pendingStorageName = name;
    pendingStorageValue = value;
    if (pendingStorageTimer) clearTimeout(pendingStorageTimer);
    pendingStorageTimer = setTimeout(flushStorage, 250);
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') {
      if (pendingStorageTimer) clearTimeout(pendingStorageTimer);
      pendingStorageName = null;
      pendingStorageValue = null;
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
    }
  }
};

let pendingStorageTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStorageName: string | null = null;
let pendingStorageValue: string | null = null;

function flushStorage() {
  if (typeof window === 'undefined' || !pendingStorageName || !pendingStorageValue) return;
  const name = pendingStorageName;
  const value = pendingStorageValue;
  pendingStorageName = null;
  pendingStorageValue = null;

  try {
    const data = JSON.parse(value);
    const state = data.state || {};
    const tabKeys = ['panels', 'layoutMode', 'splitDirection', 'activePanel', 'splitRatio'];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionState: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localState: any = {};

    for (const key in state) {
      if (tabKeys.includes(key)) {
        sessionState[key] = state[key];
      } else {
        localState[key] = state[key];
      }
    }

    localStorage.setItem(name, JSON.stringify({ ...data, state: localState }));
    sessionStorage.setItem(name, JSON.stringify({ ...data, state: sessionState }));
  } catch (e) {
    console.error('Failed to flush storage', e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushStorage);
}

function createHistorySnapshot(state: ChartState, panelId: PanelId): HistorySnapshot {
  const panel = state.panels[panelId];
  return {
    panelId,
    drawnLines: (panel?.drawnLines || []).map((l) => ({ ...l })),
    customProfileRange: panel?.customProfileRange ? { ...panel.customProfileRange } : null,
  };
}

export const useChartStore = create<ChartState>()(
  persist(
    (set, get) => ({
      historyPast: { left: [], right: [] },
      historyFuture: { left: [], right: [] },
      panels: {
        left: createDefaultPanel('left'),
        right: createDefaultPanel('right'),
      },
      layoutMode: 'single',
      splitDirection: 'vertical',
      activePanel: 'left',
      splitRatio: 0.5,
      tickSize: 0.5,
      sidebarCollapsed: false,
      focusMode: false,
      settingsDropdownHeight: 500,
      settingsOpenRequest: null,
      crosshairSyncEnabled: true,
      drawingsSyncEnabled: true,
      volumeProfileSyncEnabled: false,
      bracketDragConfirmEnabled: false,
      globalTimezone: 'local',
      globalTimeFormat: '12h',
      candleUpColor: '#089981',
      candleUpOpacity: 1,
      candleDownColor: '#F23645',
      candleDownOpacity: 1,
      candleUpWickColor: '#089981',
      candleUpWickOpacity: 1,
      candleDownWickColor: '#F23645',
      candleDownWickOpacity: 1,
      chartBackgroundType: 'solid',
      chartBackgroundColor: DEFAULT_CANVAS_BG,
      chartBackgroundOpacity: 1,
      chartBackgroundGradientTop: '#131722',
      chartBackgroundGradientTopOpacity: 1,
      chartBackgroundGradientBottom: '#0A0A0A',
      chartBackgroundGradientBottomOpacity: 1,
      showVerticalGridLines: true,
      verticalGridLineColor: DEFAULT_GRID_COLOR,
      verticalGridLineOpacity: DEFAULT_GRID_OPACITY,
      verticalGridLineStyle: 'solid',
      showHorizontalGridLines: true,
      horizontalGridLineColor: DEFAULT_GRID_COLOR,
      horizontalGridLineOpacity: DEFAULT_GRID_OPACITY,
      horizontalGridLineStyle: 'solid',
      crosshairColor: '#8A8A8A',
      crosshairOpacity: 1,
      crosshairThickness: 1,
      crosshairStyle: 'dashed',
      isAuthenticated: false,

      // Per-panel actions
      addIndicator: (panelId, indicatorId) =>
        set((state) => {
          const panel = state.panels[panelId];
          const activeIndicators = Array.from(new Set([...(panel.activeIndicators || ['volumeBars', 'stats']), indicatorId]));
          const updates: Partial<PanelState> = { activeIndicators };
          
          if (indicatorId === 'bubbles') updates.bubblesEnabled = true;
          if (indicatorId === 'cvd') updates.cvdEnabled = true;
          if (indicatorId === 'volumeBars') updates.volumeBarsEnabled = true;
          if (indicatorId === 'sessions') updates.sessionsEnabled = true;
          if (indicatorId === 'historicalSessions') updates.historicalSessionProfileEnabled = true;
          if (indicatorId === 'profile') updates.defaultProfileEnabled = true;
          if (indicatorId === 'heatmap') updates.liquidityHeatmapEnabled = true;
          if (indicatorId === 'liquidityMap') updates.liquidityEnabled = true;
          if (indicatorId === 'stats') updates.statsIndicatorEnabled = true;
          if (indicatorId === 'vwap') updates.vwapEnabled = true;
          
          return updatePanel(state, panelId, updates);
        }),

      removeIndicator: (panelId, indicatorId) =>
        set((state) => {
          const panel = state.panels[panelId];
          const activeIndicators = (panel.activeIndicators || ['volumeBars', 'stats']).filter(id => id !== indicatorId);
          const updates: Partial<PanelState> = { activeIndicators };
          
          if (indicatorId === 'bubbles') updates.bubblesEnabled = false;
          if (indicatorId === 'cvd') updates.cvdEnabled = false;
          if (indicatorId === 'volumeBars') updates.volumeBarsEnabled = false;
          if (indicatorId === 'sessions') updates.sessionsEnabled = false;
          if (indicatorId === 'historicalSessions') updates.historicalSessionProfileEnabled = false;
          if (indicatorId === 'profile') updates.defaultProfileEnabled = false;
          if (indicatorId === 'heatmap') updates.liquidityHeatmapEnabled = false;
          if (indicatorId === 'liquidityMap') updates.liquidityEnabled = false;
          if (indicatorId === 'stats') updates.statsIndicatorEnabled = false;
          if (indicatorId === 'vwap') updates.vwapEnabled = false;
          
          return updatePanel(state, panelId, updates);
        }),

      reorderIndicators: (panelId, activeIndicators) =>
        set((state) => updatePanel(state, panelId, { activeIndicators })),

      moveIndicator: (panelId, indicatorId, direction) =>
        set((state) => {
          const panel = state.panels[panelId];
          const list = [...(panel.activeIndicators || ['volumeBars', 'stats'])];
          const currentIndex = list.indexOf(indicatorId);
          if (currentIndex === -1) return state;
          const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= list.length) return state;
          const [moved] = list.splice(currentIndex, 1);
          list.splice(targetIndex, 0, moved);
          return updatePanel(state, panelId, { activeIndicators: list });
        }),

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

      setBubbleSizeBy: (panelId, bubbleSizeBy) =>
        set((state) => updatePanel(state, panelId, { bubbleSizeBy: bubbleSizeBy === 'orders' ? 'orders' : 'volume' })),

      setAggregateBubbleMarketSource: (panelId, aggregateBubbleMarketSource) =>
        set((state) => updatePanel(state, panelId, { aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(aggregateBubbleMarketSource) })),

      setBubbleThreshold: (panelId, bubbleThreshold) =>
        set((state) => updatePanel(state, panelId, { bubbleThreshold: Math.max(1, bubbleThreshold) })),

      setBubbleThresholdMode: (panelId, bubbleThresholdMode) =>
        set((state) => updatePanel(state, panelId, { bubbleThresholdMode })),

      setBubbleMinOrders: (panelId, bubbleMinOrders) =>
        set((state) => updatePanel(state, panelId, { bubbleMinOrders: clampBubbleMinOrders(bubbleMinOrders) })),

      setBubbleFilterRender: (panelId, bubbleFilterRender) =>
        set((state) => updatePanel(state, panelId, { bubbleFilterRender: Math.max(0, Math.min(20, bubbleFilterRender)) })),

      setBubbleStdDevVal: (panelId, bubbleStdDevVal) =>
        set((state) => updatePanel(state, panelId, { bubbleStdDevVal: Math.max(0.5, Math.min(5, bubbleStdDevVal)) })),

      setBubbleOutStdDevPerc: (panelId, bubbleOutStdDevPerc) =>
        set((state) => updatePanel(state, panelId, { bubbleOutStdDevPerc: Math.max(0, Math.min(50, bubbleOutStdDevPerc)) })),

      setBubbleSide: (panelId, bubbleSide) =>
        set((state) => updatePanel(state, panelId, { bubbleSide })),
      setBubbleScaleMode: (panelId, bubbleScaleMode) =>
        set((state) => updatePanel(state, panelId, { bubbleScaleMode })),

      setBubbleColorMode: (panelId, bubbleColorMode) =>
        set((state) => updatePanel(state, panelId, { bubbleColorMode })),

      setBubbleVolumeColorMode: (panelId, bubbleVolumeColorMode) =>
        set((state) => updatePanel(state, panelId, { bubbleVolumeColorMode })),

      setBubbleDisplayMode: (panelId, bubbleDisplayMode) =>
        set((state) => updatePanel(state, panelId, { bubbleDisplayMode })),

      setBubbleBidColor: (panelId, bubbleBidColor) =>
        set((state) => updatePanel(state, panelId, { bubbleBidColor })),

      setBubbleAskColor: (panelId, bubbleAskColor) =>
        set((state) => updatePanel(state, panelId, { bubbleAskColor })),

      setBubbleLineWidth: (panelId, bubbleLineWidth) =>
        set((state) => updatePanel(state, panelId, { bubbleLineWidth })),

      setBubbleOpacity: (panelId, bubbleOpacity) =>
        set((state) => updatePanel(state, panelId, { bubbleOpacity })),

      setBubbleGroupingMode: (panelId, bubbleGroupingMode) =>
        set((state) => updatePanel(state, panelId, { bubbleGroupingMode })),

      setBubblePriceAggrMode: (panelId, bubblePriceAggrMode) =>
        set((state) => updatePanel(state, panelId, { bubblePriceAggrMode })),

      setBubbleTickGroupingMode: (panelId, bubbleTickGroupingMode) =>
        set((state) => updatePanel(state, panelId, { bubbleTickGroupingMode })),

      setBubbleTickCount: (panelId, bubbleTickCount) =>
        set((state) => updatePanel(state, panelId, { bubbleTickCount: Math.max(1, Math.min(100, Math.round(bubbleTickCount))) })),

      setBubbleTimeWindowMs: (panelId, bubbleTimeWindowMs) =>
        set((state) => updatePanel(state, panelId, { bubbleTimeWindowMs: Math.max(50, Math.min(5000, Math.round(bubbleTimeWindowMs))) })),

      setDrawMode: (panelId, isDrawMode) =>
        set((state) => {
          const updates: Partial<PanelState> = { isDrawMode };
          if (isDrawMode) {
            updates.lineDrawMode = 'none';
          }
          return updatePanel(state, panelId, updates);
        }),

      pushHistory: (panelId, customSnapshot) =>
        set((state) => {
          const snapshot = customSnapshot ?? createHistorySnapshot(state, panelId);
          const past = state.historyPast[panelId] || [];
          const newPast = [...past.slice(-49), snapshot];
          return {
            historyPast: {
              ...state.historyPast,
              [panelId]: newPast,
            },
            historyFuture: {
              ...state.historyFuture,
              [panelId]: [],
            },
          };
        }),

      undo: (panelId) =>
        set((state) => {
          const past = state.historyPast[panelId] || [];
          if (past.length === 0) return state;

          const previousSnapshot = past[past.length - 1];
          const newPast = past.slice(0, -1);
          const currentSnapshot = createHistorySnapshot(state, panelId);
          const future = state.historyFuture[panelId] || [];
          const newFuture = [...future.slice(-49), currentSnapshot];

          let updatedState = updatePanel(state, panelId, {
            drawnLines: previousSnapshot.drawnLines.map((l) => ({ ...l })),
            customProfileRange: previousSnapshot.customProfileRange ? { ...previousSnapshot.customProfileRange } : null,
          });

          if (state.drawingsSyncEnabled || state.volumeProfileSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            const otherUpdates: Partial<PanelState> = {};
            if (state.drawingsSyncEnabled) {
              otherUpdates.drawnLines = previousSnapshot.drawnLines.map((l) => ({ ...l }));
            }
            if (state.volumeProfileSyncEnabled) {
              otherUpdates.customProfileRange = previousSnapshot.customProfileRange ? { ...previousSnapshot.customProfileRange } : null;
            }
            updatedState = updatePanel(updatedState as ChartState, otherPanelId, otherUpdates);
          }

          return {
            ...(updatedState as ChartState),
            historyPast: {
              ...state.historyPast,
              [panelId]: newPast,
            },
            historyFuture: {
              ...state.historyFuture,
              [panelId]: newFuture,
            },
          };
        }),

      redo: (panelId) =>
        set((state) => {
          const future = state.historyFuture[panelId] || [];
          if (future.length === 0) return state;

          const nextSnapshot = future[future.length - 1];
          const newFuture = future.slice(0, -1);
          const currentSnapshot = createHistorySnapshot(state, panelId);
          const past = state.historyPast[panelId] || [];
          const newPast = [...past.slice(-49), currentSnapshot];

          let updatedState = updatePanel(state, panelId, {
            drawnLines: nextSnapshot.drawnLines.map((l) => ({ ...l })),
            customProfileRange: nextSnapshot.customProfileRange ? { ...nextSnapshot.customProfileRange } : null,
          });

          if (state.drawingsSyncEnabled || state.volumeProfileSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            const otherUpdates: Partial<PanelState> = {};
            if (state.drawingsSyncEnabled) {
              otherUpdates.drawnLines = nextSnapshot.drawnLines.map((l) => ({ ...l }));
            }
            if (state.volumeProfileSyncEnabled) {
              otherUpdates.customProfileRange = nextSnapshot.customProfileRange ? { ...nextSnapshot.customProfileRange } : null;
            }
            updatedState = updatePanel(updatedState as ChartState, otherPanelId, otherUpdates);
          }

          return {
            ...(updatedState as ChartState),
            historyPast: {
              ...state.historyPast,
              [panelId]: newPast,
            },
            historyFuture: {
              ...state.historyFuture,
              [panelId]: newFuture,
            },
          };
        }),

      canUndo: (panelId) => {
        const past = get().historyPast[panelId] || [];
        return past.length > 0;
      },

      canRedo: (panelId) => {
        const future = get().historyFuture[panelId] || [];
        return future.length > 0;
      },

      setCustomProfileRange: (panelId, customProfileRange, skipHistory) => {
        if (!skipHistory) {
          get().pushHistory(panelId);
        }
        set((state) => {
          let updatedState: ChartState = { ...state, ...updatePanel(state, panelId, { customProfileRange }) };
          if (state.volumeProfileSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            updatedState = { ...updatedState, ...updatePanel(updatedState, otherPanelId, { customProfileRange }) };
          }
          return updatedState;
        });
      },

      setCustomProfileLocked: (panelId, customProfileLocked) =>
        set((state) => {
          let updatedState: ChartState = { ...state, ...updatePanel(state, panelId, { customProfileLocked }) };
          if (state.volumeProfileSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            updatedState = { ...updatedState, ...updatePanel(updatedState, otherPanelId, { customProfileLocked }) };
          }
          return updatedState;
        }),

      addLine: (panelId, line) => {
        get().pushHistory(panelId);
        set((state) => {
          const panel = state.panels[panelId];
          let updatedState = updatePanel(state, panelId, { drawnLines: [...panel.drawnLines, line] });
          if (state.drawingsSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            const otherPanel = state.panels[otherPanelId];
            updatedState = updatePanel(updatedState as ChartState, otherPanelId, { drawnLines: [...otherPanel.drawnLines, line] });
          }
          return updatedState as ChartState;
        });
      },

      updateLine: (panelId, id, updates) =>
        set((state) => {
          const panel = state.panels[panelId];
          let updatedState = updatePanel(state, panelId, {
            drawnLines: panel.drawnLines.map((line) => line.id === id ? { ...line, ...updates } : line),
          });
          if (state.drawingsSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            const otherPanel = state.panels[otherPanelId];
            updatedState = updatePanel(updatedState as ChartState, otherPanelId, {
              drawnLines: otherPanel.drawnLines.map((line) => line.id === id ? { ...line, ...updates } : line),
            });
          }
          return updatedState as ChartState;
        }),

      removeLine: (panelId, id) => {
        get().pushHistory(panelId);
        set((state) => {
          const panel = state.panels[panelId];
          let updatedState = updatePanel(state, panelId, { drawnLines: panel.drawnLines.filter((l) => l.id !== id) });
          if (state.drawingsSyncEnabled) {
            const otherPanelId = panelId === 'left' ? 'right' : 'left';
            const otherPanel = state.panels[otherPanelId];
            updatedState = updatePanel(updatedState as ChartState, otherPanelId, { drawnLines: otherPanel.drawnLines.filter((l) => l.id !== id) });
          }
          return updatedState as ChartState;
        });
      },

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

      setProfileNodeSensitivity: (panelId, profileNodeSensitivity) =>
        set((state) => updatePanel(state, panelId, { profileNodeSensitivity: Math.max(0, Math.min(1, profileNodeSensitivity)) })),

      setProfileWidthPct: (panelId, profileWidthPct) =>
        set((state) => updatePanel(state, panelId, { profileWidthPct: Math.max(10, Math.min(100, profileWidthPct)) })),

      setDefaultProfileEnabled: (panelId, defaultProfileEnabled) =>
        set((state) => updatePanel(state, panelId, { defaultProfileEnabled })),

      setDefaultProfilePeriod: (panelId, defaultProfilePeriod) =>
        set((state) => updatePanel(state, panelId, { defaultProfilePeriod })),

      setProfilePeriodValue: (panelId, profilePeriodValue) =>
        set((state) => updatePanel(state, panelId, { profilePeriodValue })),

      setProfilePeriodUnit: (panelId, profilePeriodUnit) =>
        set((state) => updatePanel(state, panelId, { profilePeriodUnit })),

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

      setProfileType: (panelId, profileType) =>
        set((state) => updatePanel(state, panelId, { profileType })),

      setProfilePocColor: (panelId, profilePocColor) =>
        set((state) => updatePanel(state, panelId, { profilePocColor })),

      setProfilePocWidth: (panelId, profilePocWidth) =>
        set((state) => updatePanel(state, panelId, { profilePocWidth })),

      setProfileHvnColor: (panelId, profileHvnColor) =>
        set((state) => updatePanel(state, panelId, { profileHvnColor })),

      setProfileLvnColor: (panelId, profileLvnColor) =>
        set((state) => updatePanel(state, panelId, { profileLvnColor })),

      setProfileInputData: (panelId, profileInputData) =>
        set((state) => updatePanel(state, panelId, { profileInputData })),

      setProfileFilterMin: (panelId, profileFilterMin) =>
        set((state) => updatePanel(state, panelId, { profileFilterMin })),
        
      setProfileFilterMax: (panelId, profileFilterMax) =>
        set((state) => updatePanel(state, panelId, { profileFilterMax })),

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
        set((state) => {
          const panel = state.panels[panelId];
          const current: IndicatorId[] = panel.activeIndicators || ['volumeBars', 'stats'];
          const activeIndicators: IndicatorId[] = volumeBarsEnabled
            ? (current.includes('volumeBars') ? current : [...current, 'volumeBars'])
            : current;
          return updatePanel(state, panelId, { volumeBarsEnabled, activeIndicators });
        }),

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
        set((state) => {
          const panel = state.panels[panelId];
          const current: IndicatorId[] = panel.activeIndicators || ['volumeBars', 'stats'];
          const activeIndicators: IndicatorId[] = statsIndicatorEnabled
            ? (current.includes('stats') ? current : [...current, 'stats'])
            : current;
          return updatePanel(state, panelId, { statsIndicatorEnabled, activeIndicators });
        }),

      setStatsIndicatorCount: (panelId, statsIndicatorCount) =>
        set((state) => updatePanel(state, panelId, { statsIndicatorCount: Math.max(1, Math.min(4, Math.round(statsIndicatorCount))) })),

      setStatsIndicatorItems: (panelId, items) =>
        set((state) => updatePanel(state, panelId, { statsIndicatorItems: items })),

      // VWAP
      setVwapEnabled: (panelId: PanelId, vwapEnabled: boolean) =>
        set((state) => updatePanel(state, panelId, { vwapEnabled })),

      setVwapSettings: (panelId: PanelId, settings: Partial<TimeframeSettings>) =>
        set((state) => updatePanel(state, panelId, settings)),

      setSessionEnabled: (panelId: PanelId, sessionId: SessionId, enabled: boolean) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: { ...panel.sessions[sessionId], enabled }
            }
          });
        }),

      setSessionTime: (panelId: PanelId, sessionId: SessionId, field: 'startHour' | 'startMin' | 'endHour' | 'endMin', value: number) =>
        set((state) => {
          const panel = state.panels[panelId];
          const session = panel.sessions[sessionId];
          const nextSession = { ...session, [field]: value };

          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: nextSession
            }
          });
        }),

      setSessionColor: (panelId, sessionId, color, opacity) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: {
                ...panel.sessions[sessionId],
                color,
                ...(opacity !== undefined ? { opacity } : {})
              }
            }
          });
        }),

      setSessionOpacity: (panelId, sessionId, opacity) =>
        set((state) => {
          const panel = state.panels[panelId];
          return updatePanel(state, panelId, {
            sessions: {
              ...panel.sessions,
              [sessionId]: { ...panel.sessions[sessionId], opacity }
            }
          });
        }),

      setHistoricalSessionProfileEnabled: (panelId, historicalSessionProfileEnabled) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileEnabled })),

      setHistoricalSessionProfileSession: (panelId, historicalSessionProfileSession) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileSession })),

      setHistoricalSessionProfileSessions: (panelId, historicalSessionProfileSessions) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileSessions })),

      setHistoricalSessionProfileDisplayMode: (panelId, historicalSessionProfileDisplayMode) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileDisplayMode })),

      setHistoricalSessionProfileCount: (panelId, historicalSessionProfileCount) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileCount: Math.max(1, Math.min(15, historicalSessionProfileCount)) })),

      setHistoricalSessionProfileMinTimeframe: (panelId, historicalSessionProfileMinTimeframe) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileMinTimeframe })),

      setHistoricalSessionProfileCustomSessions: (panelId, historicalSessionProfileCustomSessions) =>
        set((state) => updatePanel(state, panelId, { historicalSessionProfileCustomSessions })),

      setMergedProfileRanges: (panelId, mergedProfileRanges) =>
        set((state) => updatePanel(state, panelId, { mergedProfileRanges })),



      // Global actions
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setSplitDirection: (splitDirection) => set({ splitDirection }),
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
      setDrawingsSyncEnabled: (drawingsSyncEnabled) => set({ drawingsSyncEnabled }),
      setVolumeProfileSyncEnabled: (volumeProfileSyncEnabled) => set({ volumeProfileSyncEnabled }),
      setBracketDragConfirmEnabled: (bracketDragConfirmEnabled) => set({ bracketDragConfirmEnabled }),

      setCandleUpColor: (candleUpColor) => set({ candleUpColor }),
      setCandleUpOpacity: (candleUpOpacity) => set({ candleUpOpacity }),
      setCandleDownColor: (candleDownColor) => set({ candleDownColor }),
      setCandleDownOpacity: (candleDownOpacity) => set({ candleDownOpacity }),
      setCandleUpWickColor: (candleUpWickColor) => set({ candleUpWickColor }),
      setCandleUpWickOpacity: (candleUpWickOpacity) => set({ candleUpWickOpacity }),
      setCandleDownWickColor: (candleDownWickColor) => set({ candleDownWickColor }),
      setCandleDownWickOpacity: (candleDownWickOpacity) => set({ candleDownWickOpacity }),

      setChartBackgroundType: (chartBackgroundType) => set({ chartBackgroundType }),
      setChartBackgroundColor: (chartBackgroundColor) => set({ chartBackgroundColor }),
      setChartBackgroundOpacity: (chartBackgroundOpacity) => set({ chartBackgroundOpacity }),
      setChartBackgroundGradientTop: (chartBackgroundGradientTop) => set({ chartBackgroundGradientTop }),
      setChartBackgroundGradientTopOpacity: (chartBackgroundGradientTopOpacity) => set({ chartBackgroundGradientTopOpacity }),
      setChartBackgroundGradientBottom: (chartBackgroundGradientBottom) => set({ chartBackgroundGradientBottom }),
      setChartBackgroundGradientBottomOpacity: (chartBackgroundGradientBottomOpacity) => set({ chartBackgroundGradientBottomOpacity }),

       setShowVerticalGridLines: (showVerticalGridLines) => set({ showVerticalGridLines }),
      setVerticalGridLineColor: (verticalGridLineColor) => set({ verticalGridLineColor }),
      setVerticalGridLineOpacity: (verticalGridLineOpacity) => set({ verticalGridLineOpacity }),
      setVerticalGridLineStyle: (verticalGridLineStyle) => set({ verticalGridLineStyle }),

      setShowHorizontalGridLines: (showHorizontalGridLines) => set({ showHorizontalGridLines }),
      setHorizontalGridLineColor: (horizontalGridLineColor) => set({ horizontalGridLineColor }),
      setHorizontalGridLineOpacity: (horizontalGridLineOpacity) => set({ horizontalGridLineOpacity }),
      setHorizontalGridLineStyle: (horizontalGridLineStyle) => set({ horizontalGridLineStyle }),

      setCrosshairColor: (crosshairColor) => set({ crosshairColor }),
      setCrosshairOpacity: (crosshairOpacity) => set({ crosshairOpacity }),
      setCrosshairThickness: (crosshairThickness) => set({ crosshairThickness }),
      setCrosshairStyle: (crosshairStyle) => set({ crosshairStyle }),

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
      version: 41,
      storage: createJSONStorage(() => tabAwareStorage),
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
          if (version < 39 && (x === 16 || !Number.isFinite(x))) {
            return { x: -1, y: 44 };
          }
          return {
            x: Number.isFinite(x) ? Math.round(x) : -1,
            y: Number.isFinite(y) ? Math.max(0, Math.round(y)) : 44,
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
            barWidth: version < 39 && p.barWidth === 12 ? 16 : (p.barWidth ?? 16),
            scrollOffset: version < 39 && (p.scrollOffset === 0 || !p.scrollOffset) ? -80 : (p.scrollOffset ?? -80),
            footprintMode: p.footprintMode || 'bid-ask',
            autoBucketSize: p.autoBucketSize ?? false,
            contractType: ensureContractType(p.contractType),
            dataSourceMode: ensureDataSourceMode(p.dataSourceMode),
            absorptionEnabled: p.absorptionEnabled ?? true,
            absorptionMinScore: p.absorptionMinScore ?? 50,
            absorptionSide: p.absorptionSide || 'both',
            absorptionShowLabels: p.absorptionShowLabels ?? true,
            bubblesEnabled: p.bubblesEnabled ?? false,            aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(p.aggregateBubbleMarketSource),
            bubbleThreshold: p.bubbleThreshold ?? 15,
            bubbleThresholdMode: p.bubbleThresholdMode || 'absolute',
            bubbleMinOrders: clampBubbleMinOrders(p.bubbleMinOrders ?? 100),            bubbleMaxRadius: p.bubbleMaxRadius ?? 20,            bubbleScaleMode: normalizeBubbleScaleMode(p.bubbleScaleMode),
            bubbleColorMode: p.bubbleColorMode || 'askBidSplit',
            bubbleVolumeColorMode: p.bubbleVolumeColorMode || 'deltaAbsolute',
            bubbleDisplayMode: p.bubbleDisplayMode || '2d',
            bubbleBidColor: p.bubbleBidColor || '#4ade80',
            bubbleAskColor: p.bubbleAskColor || '#f87171',
            bubbleLineWidth: p.bubbleLineWidth ?? 1,
            bubbleOpacity: p.bubbleOpacity ?? 0.15,
            bubbleGroupingMode: normalizeBubbleGroupingMode(p.bubbleGroupingMode),
            bubblePriceAggrMode: normalizeBubblePriceAggrMode(p.bubblePriceAggrMode),
            bubbleTickGroupingMode: normalizeBubbleTickGroupingMode(p.bubbleTickGroupingMode),
            bubbleTickCount: p.bubbleTickCount ?? 3,
            bubbleTimeWindowMs: p.bubbleTimeWindowMs ?? 250,
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
            profileNodeSensitivity: p.profileNodeSensitivity ?? 0.5,
            defaultProfileEnabled: p.defaultProfileEnabled ?? false,
            defaultProfilePeriod: p.defaultProfilePeriod ?? 'visible',
            profileResolutionTicks: p.profileResolutionTicks ?? 0,
            profileMinRowHeight: p.profileMinRowHeight ?? 1,
            profileOpacity: p.profileOpacity ?? 0.6,
            profileMinRowWidth: p.profileMinRowWidth ?? 2,
            profileScaleMode: p.profileScaleMode || 'linear',
            profileShowPocHighlight: p.profileShowPocHighlight ?? true,
            profileShowVaFill: p.profileShowVaFill ?? true,
            profileShowPocLine: p.profileShowPocLine ?? true,
            profileShowVaLines: p.profileShowVaLines ?? true,
            profilePocColor: p.profilePocColor ?? '#F0B90B',
            profilePocWidth: p.profilePocWidth ?? 1,
            profileHvnColor: p.profileHvnColor ?? '#F43F5E',
            profileLvnColor: p.profileLvnColor ?? '#22D3EE',
            profilePeriodValue: p.profilePeriodValue,
            profilePeriodUnit: p.profilePeriodUnit,
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
            sessions: (version < 40 || !p.sessions)
              ? {
                  tokyo: { enabled: true, startHour: 5, startMin: 0, endHour: 11, endMin: 0, color: '#2962FF', opacity: 0.15 },
                  london: { enabled: true, startHour: 12, startMin: 30, endHour: 20, endMin: 30, color: '#FF9800', opacity: 0.15 },
                  newYork: { enabled: true, startHour: 18, startMin: 0, endHour: 1, endMin: 0, color: '#4CAF50', opacity: 0.15 },
                }
              : {
                  tokyo: { enabled: true, startHour: 5, startMin: 0, endHour: 11, endMin: 0, color: '#2962FF', opacity: 0.15, ...p.sessions.tokyo },
                  london: { enabled: true, startHour: 12, startMin: 30, endHour: 20, endMin: 30, color: '#FF9800', opacity: 0.15, ...p.sessions.london },
                  newYork: { enabled: true, startHour: 18, startMin: 0, endHour: 1, endMin: 0, color: '#4CAF50', opacity: 0.15, ...p.sessions.newYork },
                },
            historicalSessionProfileEnabled: p.historicalSessionProfileEnabled ?? true,
            historicalSessionProfileSession: p.historicalSessionProfileSession ?? 'newYork',
            historicalSessionProfileSessions: p.historicalSessionProfileSessions ?? ['newYork'],
            historicalSessionProfileDisplayMode: p.historicalSessionProfileDisplayMode ?? 'separate',
            historicalSessionProfileCount: p.historicalSessionProfileCount ?? 1,
            historicalSessionProfileMinTimeframe: p.historicalSessionProfileMinTimeframe ?? '15m',
            historicalSessionProfileCustomSessions: p.historicalSessionProfileCustomSessions ?? [],
            mergedProfileRanges: p.mergedProfileRanges ?? [],
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
            statsIndicatorEnabled: p.statsIndicatorEnabled ?? true,
            statsIndicatorCount: Math.max(1, Math.min(4, p.statsIndicatorCount ?? 2)),
            statsIndicatorItems: p.statsIndicatorItems ?? ['volume', 'delta'],
            activeIndicators: Array.isArray(p.activeIndicators) ? (p.activeIndicators as IndicatorId[]) : (['volumeBars', 'stats'] as IndicatorId[]),
          };
        };
        if (persisted.panels) {
          if (persisted.panels.left) persisted.panels.left = ensurePanel(persisted.panels.left);
          if (persisted.panels.right) persisted.panels.right = ensurePanel(persisted.panels.right);
        }
        persisted.settingsDropdownHeight = Math.max(350, Math.min(900, persisted.settingsDropdownHeight ?? 500));
        delete persisted.crosshair;
        delete persisted.indicatorLabelsCollapsed;
        if (version < 38) {
          if (persisted.verticalGridLineOpacity === 1 || persisted.verticalGridLineOpacity === 0.12) {
            persisted.verticalGridLineOpacity = DEFAULT_GRID_OPACITY;
          }
          if (persisted.horizontalGridLineOpacity === 1 || persisted.horizontalGridLineOpacity === 0.12) {
            persisted.horizontalGridLineOpacity = DEFAULT_GRID_OPACITY;
          }
        }
        if (version < 40) {
          persisted.globalTimezone = persisted.globalTimezone ?? 'local';
          persisted.globalTimeFormat = persisted.globalTimeFormat ?? '12h';
        }
        if (version < 41) {
          if (persisted.panels?.left) {
            persisted.panels.left.vwapBand1Enabled = false;
            persisted.panels.left.vwapBand2Enabled = false;
            persisted.panels.left.vwapBand3Enabled = false;
          }
          if (persisted.panels?.right) {
            persisted.panels.right.vwapBand1Enabled = false;
            persisted.panels.right.vwapBand2Enabled = false;
            persisted.panels.right.vwapBand3Enabled = false;
          }
        }
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
          volumeProfileSyncEnabled: typeof persistedSettings.volumeProfileSyncEnabled === 'boolean'
            ? persistedSettings.volumeProfileSyncEnabled
            : false,
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
              bubbleSizeBy: (persistedLeft.bubbleSizeBy ?? currentState.panels.left.bubbleSizeBy) === 'orders' ? 'orders' : 'volume',
              aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(
                persistedLeft.aggregateBubbleMarketSource ?? currentState.panels.left.aggregateBubbleMarketSource,
              ),
              bubbleMinOrders: clampBubbleMinOrders(
                persistedLeft.bubbleMinOrders ?? currentState.panels.left.bubbleMinOrders,
              ),
              bubbleScaleMode: normalizeBubbleScaleMode(
                persistedLeft.bubbleScaleMode ?? currentState.panels.left.bubbleScaleMode,
              ),
              bubbleColorMode: persistedLeft.bubbleColorMode ?? currentState.panels.left.bubbleColorMode,
              bubbleVolumeColorMode: persistedLeft.bubbleVolumeColorMode ?? currentState.panels.left.bubbleVolumeColorMode,
              bubbleDisplayMode: persistedLeft.bubbleDisplayMode ?? currentState.panels.left.bubbleDisplayMode,
              bubbleBidColor: persistedLeft.bubbleBidColor ?? currentState.panels.left.bubbleBidColor,
              bubbleAskColor: persistedLeft.bubbleAskColor ?? currentState.panels.left.bubbleAskColor,
              bubbleLineWidth: persistedLeft.bubbleLineWidth ?? currentState.panels.left.bubbleLineWidth,
              bubbleOpacity: persistedLeft.bubbleOpacity ?? currentState.panels.left.bubbleOpacity,
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
              bubbleSizeBy: (persistedRight.bubbleSizeBy ?? currentState.panels.right.bubbleSizeBy) === 'orders' ? 'orders' : 'volume',
              aggregateBubbleMarketSource: normalizeAggregateBubbleMarketSource(
                persistedRight.aggregateBubbleMarketSource ?? currentState.panels.right.aggregateBubbleMarketSource,
              ),
              bubbleMinOrders: clampBubbleMinOrders(
                persistedRight.bubbleMinOrders ?? currentState.panels.right.bubbleMinOrders,
              ),
              bubbleScaleMode: normalizeBubbleScaleMode(
                persistedRight.bubbleScaleMode ?? currentState.panels.right.bubbleScaleMode,
              ),
              bubbleColorMode: persistedRight.bubbleColorMode ?? currentState.panels.right.bubbleColorMode,
              bubbleVolumeColorMode: persistedRight.bubbleVolumeColorMode ?? currentState.panels.right.bubbleVolumeColorMode,
              bubbleDisplayMode: persistedRight.bubbleDisplayMode ?? currentState.panels.right.bubbleDisplayMode,
              bubbleBidColor: persistedRight.bubbleBidColor ?? currentState.panels.right.bubbleBidColor,
              bubbleAskColor: persistedRight.bubbleAskColor ?? currentState.panels.right.bubbleAskColor,
              bubbleLineWidth: persistedRight.bubbleLineWidth ?? currentState.panels.right.bubbleLineWidth,
              bubbleOpacity: persistedRight.bubbleOpacity ?? currentState.panels.right.bubbleOpacity,
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
        splitDirection: state.splitDirection,
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
            bubbleSizeBy: state.panels.left.bubbleSizeBy === 'orders' ? 'orders' : 'volume',
            aggregateBubbleMarketSource: state.panels.left.aggregateBubbleMarketSource,
            bubbleThreshold: state.panels.left.bubbleThreshold,
            bubbleThresholdMode: state.panels.left.bubbleThresholdMode,
            bubbleMinOrders: state.panels.left.bubbleMinOrders,
            bubbleFilterRender: state.panels.left.bubbleFilterRender,
            bubbleStdDevVal: state.panels.left.bubbleStdDevVal,
            bubbleOutStdDevPerc: state.panels.left.bubbleOutStdDevPerc,
            bubbleSide: state.panels.left.bubbleSide,
            bubbleScaleMode: state.panels.left.bubbleScaleMode,
            bubbleColorMode: state.panels.left.bubbleColorMode,
            bubbleVolumeColorMode: state.panels.left.bubbleVolumeColorMode,
            bubbleDisplayMode: state.panels.left.bubbleDisplayMode,
            bubbleBidColor: state.panels.left.bubbleBidColor,
            bubbleAskColor: state.panels.left.bubbleAskColor,
            bubbleLineWidth: state.panels.left.bubbleLineWidth,
            bubbleOpacity: state.panels.left.bubbleOpacity,
            bubbleGroupingMode: state.panels.left.bubbleGroupingMode,
            bubblePriceAggrMode: state.panels.left.bubblePriceAggrMode,
            bubbleTickGroupingMode: state.panels.left.bubbleTickGroupingMode,
            bubbleTickCount: state.panels.left.bubbleTickCount,
            bubbleTimeWindowMs: state.panels.left.bubbleTimeWindowMs,
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
            profileType: state.panels.left.profileType,
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
            historicalSessionProfileSession: state.panels.left.historicalSessionProfileSession,
            historicalSessionProfileSessions: state.panels.left.historicalSessionProfileSessions,
            historicalSessionProfileDisplayMode: state.panels.left.historicalSessionProfileDisplayMode,
            historicalSessionProfileCount: state.panels.left.historicalSessionProfileCount,
            historicalSessionProfileMinTimeframe: state.panels.left.historicalSessionProfileMinTimeframe,
            statsIndicatorEnabled: state.panels.left.statsIndicatorEnabled,
            statsIndicatorCount: state.panels.left.statsIndicatorCount,
            statsIndicatorItems: state.panels.left.statsIndicatorItems,
            vwapEnabled: state.panels.left.vwapEnabled,
            vwapPeriodMode: state.panels.left.vwapPeriodMode,
            vwapSessionAnchor: state.panels.left.vwapSessionAnchor,
            vwapRollingDays: state.panels.left.vwapRollingDays,
            vwapPriceSource: state.panels.left.vwapPriceSource,
            vwapEnvelopeMode: state.panels.left.vwapEnvelopeMode,
            vwapBand1Enabled: state.panels.left.vwapBand1Enabled,
            vwapBand1Value: state.panels.left.vwapBand1Value,
            vwapBand2Enabled: state.panels.left.vwapBand2Enabled,
            vwapBand2Value: state.panels.left.vwapBand2Value,
            vwapBand3Enabled: state.panels.left.vwapBand3Enabled,
            vwapBand3Value: state.panels.left.vwapBand3Value,
            vwapLineColor: state.panels.left.vwapLineColor,
            vwapBand1Color: state.panels.left.vwapBand1Color,
            vwapBand2Color: state.panels.left.vwapBand2Color,
            vwapBand3Color: state.panels.left.vwapBand3Color,
            vwapBandFillOpacity: state.panels.left.vwapBandFillOpacity,
            vwapLineWidth: state.panels.left.vwapLineWidth,
            vwapBandWidth: state.panels.left.vwapBandWidth,
            activeIndicators: state.panels.left.activeIndicators,
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
            bubbleSizeBy: state.panels.right.bubbleSizeBy === 'orders' ? 'orders' : 'volume',
            aggregateBubbleMarketSource: state.panels.right.aggregateBubbleMarketSource,
            bubbleThreshold: state.panels.right.bubbleThreshold,
            bubbleThresholdMode: state.panels.right.bubbleThresholdMode,
            bubbleMinOrders: state.panels.right.bubbleMinOrders,
            bubbleFilterRender: state.panels.right.bubbleFilterRender,
            bubbleStdDevVal: state.panels.right.bubbleStdDevVal,
            bubbleOutStdDevPerc: state.panels.right.bubbleOutStdDevPerc,
            bubbleSide: state.panels.right.bubbleSide,
            bubbleScaleMode: state.panels.right.bubbleScaleMode,
            bubbleColorMode: state.panels.right.bubbleColorMode,
            bubbleVolumeColorMode: state.panels.right.bubbleVolumeColorMode,
            bubbleDisplayMode: state.panels.right.bubbleDisplayMode,
            bubbleBidColor: state.panels.right.bubbleBidColor,
            bubbleAskColor: state.panels.right.bubbleAskColor,
            bubbleLineWidth: state.panels.right.bubbleLineWidth,
            bubbleOpacity: state.panels.right.bubbleOpacity,
            bubbleGroupingMode: state.panels.right.bubbleGroupingMode,
            bubblePriceAggrMode: state.panels.right.bubblePriceAggrMode,
            bubbleTickGroupingMode: state.panels.right.bubbleTickGroupingMode,
            bubbleTickCount: state.panels.right.bubbleTickCount,
            bubbleTimeWindowMs: state.panels.right.bubbleTimeWindowMs,
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
            profileType: state.panels.right.profileType,
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
            historicalSessionProfileSession: state.panels.right.historicalSessionProfileSession,
            historicalSessionProfileSessions: state.panels.right.historicalSessionProfileSessions,
            historicalSessionProfileDisplayMode: state.panels.right.historicalSessionProfileDisplayMode,
            historicalSessionProfileCount: state.panels.right.historicalSessionProfileCount,
            historicalSessionProfileMinTimeframe: state.panels.right.historicalSessionProfileMinTimeframe,
            statsIndicatorEnabled: state.panels.right.statsIndicatorEnabled,
            statsIndicatorCount: state.panels.right.statsIndicatorCount,
            statsIndicatorItems: state.panels.right.statsIndicatorItems,
            vwapEnabled: state.panels.right.vwapEnabled,
            vwapPeriodMode: state.panels.right.vwapPeriodMode,
            vwapSessionAnchor: state.panels.right.vwapSessionAnchor,
            vwapRollingDays: state.panels.right.vwapRollingDays,
            vwapPriceSource: state.panels.right.vwapPriceSource,
            vwapEnvelopeMode: state.panels.right.vwapEnvelopeMode,
            vwapBand1Enabled: state.panels.right.vwapBand1Enabled,
            vwapBand1Value: state.panels.right.vwapBand1Value,
            vwapBand2Enabled: state.panels.right.vwapBand2Enabled,
            vwapBand2Value: state.panels.right.vwapBand2Value,
            vwapBand3Enabled: state.panels.right.vwapBand3Enabled,
            vwapBand3Value: state.panels.right.vwapBand3Value,
            vwapLineColor: state.panels.right.vwapLineColor,
            vwapBand1Color: state.panels.right.vwapBand1Color,
            vwapBand2Color: state.panels.right.vwapBand2Color,
            vwapBand3Color: state.panels.right.vwapBand3Color,
            vwapBandFillOpacity: state.panels.right.vwapBandFillOpacity,
            vwapLineWidth: state.panels.right.vwapLineWidth,
            vwapBandWidth: state.panels.right.vwapBandWidth,
            activeIndicators: state.panels.right.activeIndicators,
            settingsByTimeframe: state.panels.right.settingsByTimeframe,
          },
        },
        tickSize: state.tickSize,
        sidebarCollapsed: state.sidebarCollapsed,
        settingsDropdownHeight: state.settingsDropdownHeight,
        crosshairSyncEnabled: state.crosshairSyncEnabled,
        drawingsSyncEnabled: state.drawingsSyncEnabled,
        volumeProfileSyncEnabled: state.volumeProfileSyncEnabled,
        bracketDragConfirmEnabled: state.bracketDragConfirmEnabled,
        globalTimezone: state.globalTimezone,
        globalTimeFormat: state.globalTimeFormat,
        candleUpColor: state.candleUpColor,
        candleUpOpacity: state.candleUpOpacity ?? 1,
        candleDownColor: state.candleDownColor,
        candleDownOpacity: state.candleDownOpacity ?? 1,
        candleUpWickColor: state.candleUpWickColor,
        candleUpWickOpacity: state.candleUpWickOpacity ?? 1,
        candleDownWickColor: state.candleDownWickColor,
        candleDownWickOpacity: state.candleDownWickOpacity ?? 1,
        chartBackgroundType: state.chartBackgroundType,
        chartBackgroundColor: state.chartBackgroundColor,
        chartBackgroundOpacity: state.chartBackgroundOpacity ?? 1,
        chartBackgroundGradientTop: state.chartBackgroundGradientTop,
        chartBackgroundGradientTopOpacity: state.chartBackgroundGradientTopOpacity ?? 1,
        chartBackgroundGradientBottom: state.chartBackgroundGradientBottom,
        chartBackgroundGradientBottomOpacity: state.chartBackgroundGradientBottomOpacity ?? 1,
        showVerticalGridLines: state.showVerticalGridLines,
        verticalGridLineColor: state.verticalGridLineColor,
        verticalGridLineOpacity: state.verticalGridLineOpacity ?? DEFAULT_GRID_OPACITY,
        verticalGridLineStyle: state.verticalGridLineStyle ?? 'solid',
        showHorizontalGridLines: state.showHorizontalGridLines,
        horizontalGridLineColor: state.horizontalGridLineColor,
        horizontalGridLineOpacity: state.horizontalGridLineOpacity ?? DEFAULT_GRID_OPACITY,
        horizontalGridLineStyle: state.horizontalGridLineStyle ?? 'solid',
        crosshairColor: state.crosshairColor,
        crosshairOpacity: state.crosshairOpacity,
        crosshairThickness: state.crosshairThickness,
        crosshairStyle: state.crosshairStyle,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);



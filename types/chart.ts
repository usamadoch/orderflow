import { FootprintMode } from './footprint';
import { BubbleScaleMode, BubbleSide, AggregateBubbleMarketSource, BubbleSizeBy, BubbleSource, BubbleEvent } from './bubble';
import { MeasurementMetrics, FootprintMeasurementMetrics } from './measurement';
import { Candle } from './candle';
import { Trade } from './trade';
import { AbsorptionResult } from './absorption';
import { ExhaustionResult } from './exhaustion';
import { IcebergLevel } from './iceberg';
import { LiquidityVacuumZone } from './liquidityVacuum';
import { LiquidityZone } from './liquidity';
import type {
  Balance,
  BracketDragState,
  BracketOrder,
  Order,
  Position,
  TradeFill,
  TradingConnectionStatus,
  TradingMode,
  TradingModeBadge,
  TradingRiskStatusPayload,
  TradingUserStreamStatus,
  VirtualPosition,
} from './trading';
import { AggregationEngine } from '../lib/aggregation/engine';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { IcebergEngine } from '../lib/iceberg/engine';
import type { VolumeProfileSource } from './volumeProfile';

export type ChartMode = 'candle' | 'footprint';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';
export type AbsorptionSide = 'both' | 'buyer' | 'seller';
export type ExhaustionSide = 'both' | 'buyer' | 'seller';
export type LineDrawMode = 'none' | 'horizontal' | 'vertical' | 'horizontal-ray' | 'box' | 'long-position' | 'short-position' | 'position';
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
export type BubbleThresholdMode = 'absolute' | 'relative';

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

export type CustomProfileHitZone = 'move' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom';
export type DrawingHitZone = 'hover' | 'move' | 'delete' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom' | 'resize-entry' | 'resize-stop' | 'resize-target';
export type CustomProfileRange = NonNullable<PanelState['customProfileRange']>;

import type { VolumeBarsDebugSnapshot } from './debug';

export interface DrawVolumeBarsOptions {
  panelId: string;
  enabled: boolean;
  inputData: VolumeBarsInputData;
  marketSource: VolumeBarsMarketSource;
  filterMode: VolumeBarsFilterMode;
  movingAverageLength: number;
  filterMin: number;
  filterMax: number;
  colorMode: VolumeBarsColorMode;
  opacity: number;
  heightPct: number;
  showValueText: boolean;
  textSize: number;
  averageLineEnabled: boolean;
  averageLength: number;
  activeChartContractType: 'spot' | 'futures';
  activeDataSourceMode: 'spot' | 'futures' | 'both';
  onDebug?: (snapshot: VolumeBarsDebugSnapshot) => void;
}

export interface VolumeBarPoint {
  index: number;
  value: number;
  delta: number | null;
  unavailable: boolean;
  source: 'historical' | 'live';
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
  liquidityEnabled: boolean;
  liquidityBucketSize: number;
  minimumLiquidityThreshold: number;
  liquidityOpacity: number;
  liquidityRange: number;
  liquidityHistoryEnabled: boolean;
  liquidityHistoryDepth: number;
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
  refreshKey: number;
  dataVersion: number;
}

export interface TradingRuntimeStatus {
  currentMode: TradingMode;
  connectionStatus: TradingConnectionStatus;
  modeBadge: TradingModeBadge;
  lastHealthCheckAt: string | null;
  lastErrorMessage: string | null;
  balances: Balance[];
  openOrders: Order[];
  positions: Position[];
  recentTrades: TradeFill[];
  lastSnapshotAt: string | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  userStreamStatus: TradingUserStreamStatus;
  userStreamConnected: boolean;
  userStreamLastEventAt: string | null;
  userStreamReconnectCount: number;
  userStreamLastError: string | null;
  reconciliationLoading: boolean;
  lastReconciledAt: string | null;
  orderActionLoading: boolean;
  orderActionError: string | null;
  orderActionSuccess: string | null;
  modifyingOrderId: string | null;
  dragPreviewPrice: number | null;
  modifyLoading: boolean;
  modifyError: string | null;
  modifySuccess: string | null;
  riskStatus: TradingRiskStatusPayload | null;
  riskLoading: boolean;
  riskError: string | null;
  liveBlocked: boolean;
  killSwitchActive: boolean;
  riskBlockReasons: string[];
  virtualPositions: VirtualPosition[];
  bracketOrders: BracketOrder[];
  bracketDrag: BracketDragState | null;
}

export interface ChartEngineContextValue {
  engine: AggregationEngine | null;
  liquidityHistory: LiquidityHistoryManager | null;
  icebergEngine: IcebergEngine | null;
  volumeProfileEngine: VolumeProfileSource | null;
  volumeProfileRevision: number;
}

export interface IndicatorLabelConfig {
  id: IndicatorSettingsSection | 'profile';
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

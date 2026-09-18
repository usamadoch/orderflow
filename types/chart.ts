import { FootprintMode } from './footprint';
import { BubbleScaleMode, BubbleColorMode, BubbleVolumeColorMode, BubbleDisplayMode, BubbleSide, AggregateBubbleMarketSource, BubbleSizeBy, BubbleEvent, BubbleGroupingMode, BubblePriceAggrMode, BubbleTickGroupingMode } from './bubble';
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
  MarketOrderDragState,
} from './trading';
import { AggregationEngine } from '../lib/aggregation/engine';
import { LiquidityHistoryManager } from '../lib/liquidity/history';
import { IcebergEngine } from '../lib/iceberg/engine';
import type { VolumeProfileSource } from './volumeProfile';

export type ChartMode = 'candle' | 'footprint' | 'hollow' | 'side-by-side';
export type PanelId = 'left' | 'right';
export type LayoutMode = 'single' | 'dual';
export type SplitDirection = 'vertical' | 'horizontal';
export type AbsorptionSide = 'both' | 'buyer' | 'seller';
export type ExhaustionSide = 'both' | 'buyer' | 'seller';
export type LineDrawMode = 'none' | 'horizontal' | 'vertical' | 'horizontal-ray' | 'box' | 'long-position' | 'short-position' | 'position' | 'buy' | 'sell';
export type DrawingStrokeWidth = 1 | 2 | 3 | 4;
export type SessionId = 'tokyo' | 'london' | 'newYork' | string;
export type CvdMode = 'candles' | 'bars' | 'line' | 'histogram';
export type CvdResetMode = 'none' | 'daily' | 'session';
export type CvdScaleMode = 'auto' | 'fixed';
export type ContractType = 'spot' | 'futures';
export type DataSourceMode = 'spot' | 'futures' | 'both';
export type VolumeBarsInputData = 'volume' | 'orders' | 'aggregateTrades';
export type VolumeBarsMarketSource = 'active' | 'spot' | 'futures' | 'both';
export type VolumeBarsColorMode = 'fixed' | 'priceDirection' | 'delta' | 'volumeSlope';
export type VolumeBarsFilterMode = 'absolute' | 'relative';
export type VolumeProfileType = 'volume' | 'delta' | 'deltaVolume' | 'bidAsk';
export type IndicatorSettingsSection = 'sessions' | 'historicalSessions' | 'cvd' | 'bubbles' | 'volumeBars' | 'heatmap' | 'liquidityMap' | 'stats' | 'vwap';
export type SettingsFocusSection = IndicatorSettingsSection | 'profiles';
export type IndicatorId = 'bubbles' | 'cvd' | 'volumeBars' | 'sessions' | 'historicalSessions' | 'profile' | 'heatmap' | 'liquidityMap' | 'stats' | 'vwap';
export type StatsIndicatorItem = 'volume' | 'delta' | 'cvd';

export type VwapPeriodMode = 'Session' | 'Rolling';
export type VwapSessionAnchor = 'Day' | 'Week' | 'Month';
export type VwapPriceSource = 'HLC3' | 'HL2' | 'OHLC4' | 'Close';
export type VwapEnvelopeMode = 'Standard Deviation' | 'Percentage';
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
  opacity?: number; // 0–1, defaults to 0.15 if not specified
}

export interface GlobalCrosshair {
  activePanel: PanelId | null;
  time: number | null;
  price: number | null;
}

export interface TimeframeSettings {
  bucketSize: number;
  autoBucketSize: boolean;

  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  bubbleMinOrders: number;
  bubbleFilterRender: number;
  bubbleStdDevVal: number;
  bubbleOutStdDevPerc: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode: BubbleScaleMode;
  bubbleColorMode: BubbleColorMode;
  bubbleVolumeColorMode: BubbleVolumeColorMode;
  bubbleDisplayMode: BubbleDisplayMode;
  bubbleBidColor: string;
  bubbleAskColor: string;
  bubbleLineWidth: number;
  bubbleOpacity: number;
  bubbleGroupingMode: BubbleGroupingMode;
  bubblePriceAggrMode: BubblePriceAggrMode;
  bubbleTickGroupingMode: BubbleTickGroupingMode;
  bubbleTickCount: number;
  bubbleTimeWindowMs: number;
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
  profileNodeSensitivity: number;
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  defaultProfilePeriod: 'visible' | 'latest' | 'composite';
  profileResolutionTicks: number;
  profileMinRowHeight: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileType: VolumeProfileType;
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
  // VWAP
  vwapEnabled: boolean;
  vwapPeriodMode: VwapPeriodMode;
  vwapSessionAnchor: VwapSessionAnchor;
  vwapRollingDays: number;
  vwapPriceSource: VwapPriceSource;
  vwapEnvelopeMode: VwapEnvelopeMode;
  vwapBand1Enabled: boolean;
  vwapBand1Value: number;
  vwapBand2Enabled: boolean;
  vwapBand2Value: number;
  vwapBand3Enabled: boolean;
  vwapBand3Value: number;
  vwapLineColor: string;
  vwapBand1Color: string;
  vwapBand2Color: string;
  vwapBand3Color: string;
  vwapBandFillOpacity: number;
  vwapLineWidth: number;
  vwapBandWidth: number;
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
  panelTop?: number;
  panelHeight?: number;
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
  opacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  showFill?: boolean;
  profitColor?: string;
  profitOpacity?: number;
  stopColor?: string;
  stopOpacity?: number;
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

export interface HistorySnapshot {
  panelId: PanelId;
  drawnLines: DrawnLine[];
  customProfileRange: PanelState['customProfileRange'];
}

export interface TimeframeInputState {
  isOpen: boolean;
  buffer: string;
  panelId: PanelId;
}

export interface PanelState {
  id: PanelId;
  activeIndicators?: IndicatorId[];
  pair: string;
  timeframe: string;
  chartMode: ChartMode;
  mt5CompareShowBinance?: boolean;
  showPositionPnl?: boolean;
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

  bubbleSizeBy: BubbleSizeBy;
  aggregateBubbleMarketSource: AggregateBubbleMarketSource;
  bubbleThreshold: number;
  bubbleThresholdMode: BubbleThresholdMode;
  bubbleMinOrders: number;
  bubbleFilterRender: number;
  bubbleStdDevVal: number;
  bubbleOutStdDevPerc: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode: BubbleScaleMode;
  bubbleColorMode: BubbleColorMode;
  bubbleVolumeColorMode: BubbleVolumeColorMode;
  bubbleDisplayMode: BubbleDisplayMode;
  bubbleBidColor: string;
  bubbleAskColor: string;
  bubbleLineWidth: number;
  bubbleOpacity: number;
  bubbleGroupingMode: BubbleGroupingMode;
  bubblePriceAggrMode: BubblePriceAggrMode;
  bubbleTickGroupingMode: BubbleTickGroupingMode;
  bubbleTickCount: number;
  bubbleTimeWindowMs: number;
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
  profileNodeSensitivity: number;
  profileWidthPct: number;
  defaultProfileEnabled: boolean;
  defaultProfilePeriod: 'visible' | 'latest' | 'composite' | 'periodic';
  profilePeriodValue?: number;
  profilePeriodUnit?: 'minutes' | 'hours' | 'days';
  profileResolutionTicks: number;
  profileMinRowHeight: number;
  profileOpacity: number;
  profileMinRowWidth: number;
  profileScaleMode: 'linear' | 'sqrt';
  profileShowPocHighlight: boolean;
  profileShowVaFill: boolean;
  profileShowPocLine: boolean;
  profileShowVaLines: boolean;
  profileType: VolumeProfileType;
  profilePocColor: string;
  profilePocWidth: number;
  profileHvnColor: string;
  profileLvnColor: string;
  profileInputData: VolumeBarsInputData;
  profileFilterMin?: number;
  profileFilterMax?: number;
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
  // VWAP
  vwapEnabled: boolean;
  vwapPeriodMode: VwapPeriodMode;
  vwapSessionAnchor: VwapSessionAnchor;
  vwapRollingDays: number;
  vwapPriceSource: VwapPriceSource;
  vwapEnvelopeMode: VwapEnvelopeMode;
  vwapBand1Enabled: boolean;
  vwapBand1Value: number;
  vwapBand2Enabled: boolean;
  vwapBand2Value: number;
  vwapBand3Enabled: boolean;
  vwapBand3Value: number;
  vwapLineColor: string;
  vwapBand1Color: string;
  vwapBand2Color: string;
  vwapBand3Color: string;
  vwapBandFillOpacity: number;
  vwapLineWidth: number;
  vwapBandWidth: number;
  // Session Visualization
  sessionsEnabled: boolean;
  sessions: Record<string, SessionConfig>;
  // Historical Session Volume Profile
  historicalSessionProfileEnabled: boolean;
  historicalSessionProfileSession: SessionId | 'multiple';
  historicalSessionProfileSessions: SessionId[];
  historicalSessionProfileCustomSessions: { id: string; start: string; end: string; tz: string }[];
  historicalSessionProfileDisplayMode: 'separate' | 'combined';
  historicalSessionProfileCount: number;
  historicalSessionProfileMinTimeframe: string;
  mergedProfileRanges: { start: number; end: number }[];

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
  // Order Book Liquidity Heatmap Panel
  heatmapPanelEnabled: boolean;
  heatmapPriceBucketSize: number;
  heatmapSampleIntervalMs: number;
  heatmapRetentionMinutes: number;
  heatmapClampPercentile: number;
  heatmapPanelWidth: number;
  heatmapShowTrades: boolean;
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
  selectedDrawingId: string | null;
  icebergLevels: IcebergLevel[];
  liquidityVacuumZones: LiquidityVacuumZone[];
  liquidityZones: LiquidityZone[];
  measureToolActive: boolean;
  activeMeasurement: Measurement | null;
  refreshKey: number;
  dataVersion: number;
  mt5Candles: Candle[];
  mt5Bid: number | null;
  mt5Ask: number | null;
  orderbookResyncCount: number;
  viewportPrice: { priceMin: number; priceMax: number; priceCenter: number; priceRange: number } | null;
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
  marketOrderDrag: MarketOrderDragState | null;
  pendingMarketOrderId: string | null;
  mt5Connected: boolean;
  mt5AccountName: string;
  mt5Pnl: number;
  mt5BridgeStatus: 'connected' | 'disconnected' | 'connecting' | 'paused';
}

export interface ChartEngineContextValue {
  engine: AggregationEngine | null;
  liquidityHistory: LiquidityHistoryManager | null;
  icebergEngine: IcebergEngine | null;
  volumeProfileEngine: VolumeProfileSource | null;
  volumeProfileRevision: number;
  heatmapWorkerClient?: import('../lib/worker/heatmapWorkerClient').HeatmapWorkerClient | null;
}

export interface IndicatorLabelConfig {
  id: IndicatorSettingsSection | 'profile';
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { BarChart2, Layers, Zap, X } from 'lucide-react';
import { useChartStore, PanelId, BubbleScaleMode, BubbleSide, BubbleSizeBy, BubbleSource, ExhaustionSide, AbsorptionSide, SessionId, CvdMode, CvdResetMode, CvdScaleMode, IndicatorSettingsSection, SettingsFocusSection, VolumeBarsColorMode, VolumeBarsInputData, VolumeBarsFilterMode, StatsIndicatorItem } from '../../lib/store/chart';
import { getMinimumFineProfileResolutionTicks } from '../../lib/config/markets';
import { BubblesDocsModal } from './BubblesDocsModal';

const SETTINGS_WIDTH = 544;
const SETTINGS_MIN_HEIGHT = 350;
const SETTINGS_DEFAULT_HEIGHT = 500;
const VIEWPORT_MARGIN = 16;
const INDICATOR_DIALOG_WIDTH = 440;

function getViewportMaxHeight(top: number) {
  if (typeof window === 'undefined') {
    return SETTINGS_DEFAULT_HEIGHT;
  }

  return Math.max(
    SETTINGS_MIN_HEIGHT,
    window.innerHeight - top - VIEWPORT_MARGIN
  );
}

function clampSettingsHeight(nextHeight: number, top: number) {
  return Math.max(SETTINGS_MIN_HEIGHT, Math.min(nextHeight, getViewportMaxHeight(top)));
}

interface ChartSettingsDropdownProps {
  panelId: PanelId;
  initialAnchor?: { x: number; y: number } | null;
  focusSection?: SettingsFocusSection | null;
  focusRequestId?: number;
  indicatorSection?: IndicatorSettingsSection | null;
  indicatorTitle?: string;
  onClose: () => void;
}

function clampSettingsPosition(nextPosition: { x: number; y: number }, height: number) {
  if (typeof window === 'undefined') return nextPosition;

  const maxX = Math.max(VIEWPORT_MARGIN / 2, window.innerWidth - SETTINGS_WIDTH - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN / 2, window.innerHeight - height - VIEWPORT_MARGIN);

  return {
    x: Math.max(VIEWPORT_MARGIN / 2, Math.min(nextPosition.x, maxX)),
    y: Math.max(VIEWPORT_MARGIN / 2, Math.min(nextPosition.y, maxY)),
  };
}

function getInitialSettingsPosition(initialAnchor: { x: number; y: number } | null | undefined, height: number) {
  if (typeof window === 'undefined') {
    return { x: -1, y: 48 };
  }

  if (initialAnchor) {
    return clampSettingsPosition({
      x: initialAnchor.x - SETTINGS_WIDTH,
      y: initialAnchor.y,
    }, height);
  }

  return clampSettingsPosition({
    x: window.innerWidth - SETTINGS_WIDTH - VIEWPORT_MARGIN,
    y: 48,
  }, height);
}

export function ChartSettingsDropdown({
  panelId,
  initialAnchor,
  focusSection,
  focusRequestId = 0,
  indicatorSection = null,
  indicatorTitle,
  onClose,
}: ChartSettingsDropdownProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const settingsDropdownHeight = useChartStore(s => s.settingsDropdownHeight);
  const setSettingsDropdownHeight = useChartStore(s => s.setSettingsDropdownHeight);
  const tickSize = useChartStore(s => s.tickSize);
  const setTickSize = useChartStore(s => s.setTickSize);
  const setFootprintMode = useChartStore(s => s.setFootprintMode);
  const setBucketSize = useChartStore(s => s.setBucketSize);
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setBubbleSource = useChartStore(s => s.setBubbleSource);
  const setBubbleSizeBy = useChartStore(s => s.setBubbleSizeBy);
  const setBubbleThreshold = useChartStore(s => s.setBubbleThreshold);
  const setBubbleThresholdMode = useChartStore(s => s.setBubbleThresholdMode);
  const setBubbleMinOrders = useChartStore(s => s.setBubbleMinOrders);
  const setBubbleMinRadius = useChartStore(s => s.setBubbleMinRadius);
  const setBubbleMaxRadius = useChartStore(s => s.setBubbleMaxRadius);
  const setBubbleSide = useChartStore(s => s.setBubbleSide);
  const setBubbleScaleMode = useChartStore(s => s.setBubbleScaleMode);
  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setExhaustionMinScore = useChartStore(s => s.setExhaustionMinScore);
  const setExhaustionSide = useChartStore(s => s.setExhaustionSide);
  const setExhaustionLookback = useChartStore(s => s.setExhaustionLookback);
  const setExhaustionShowProvisional = useChartStore(s => s.setExhaustionShowProvisional);
  const setIcebergEnabled = useChartStore(s => s.setIcebergEnabled);
  const setIcebergMinScore = useChartStore(s => s.setIcebergMinScore);
  const setIcebergLookback = useChartStore(s => s.setIcebergLookback);
  const setIcebergShowSuspected = useChartStore(s => s.setIcebergShowSuspected);
  const setIcebergShowLabels = useChartStore(s => s.setIcebergShowLabels);
  const setIcebergShowTint = useChartStore(s => s.setIcebergShowTint);
  const setLiquidityVacuumEnabled = useChartStore(s => s.setLiquidityVacuumEnabled);
  const setLiquidityVacuumMinScore = useChartStore(s => s.setLiquidityVacuumMinScore);
  const setLiquidityVacuumShowLabels = useChartStore(s => s.setLiquidityVacuumShowLabels);
  const setLiquidityVacuumOpacity = useChartStore(s => s.setLiquidityVacuumOpacity);
  const setLiquidityVacuumMaxZones = useChartStore(s => s.setLiquidityVacuumMaxZones);
  const setAbsorptionEnabled = useChartStore(s => s.setAbsorptionEnabled);
  const setAbsorptionMinScore = useChartStore(s => s.setAbsorptionMinScore);
  const setAbsorptionSide = useChartStore(s => s.setAbsorptionSide);
  const setProfileWidthPct = useChartStore(s => s.setProfileWidthPct);
  const setDefaultProfileEnabled = useChartStore(s => s.setDefaultProfileEnabled);
  const setProfileResolutionTicks = useChartStore(s => s.setProfileResolutionTicks);
  const setProfileMinRowHeight = useChartStore(s => s.setProfileMinRowHeight);
  const setProfileOpacity = useChartStore(s => s.setProfileOpacity);
  const setProfileMinRowWidth = useChartStore(s => s.setProfileMinRowWidth);
  const setProfileScaleMode = useChartStore(s => s.setProfileScaleMode);
  const setProfileShowPocHighlight = useChartStore(s => s.setProfileShowPocHighlight);
  const setProfileShowVaFill = useChartStore(s => s.setProfileShowVaFill);
  const setProfileShowPocLine = useChartStore(s => s.setProfileShowPocLine);
  const setProfileShowVaLines = useChartStore(s => s.setProfileShowVaLines);
  const setProfileShowDelta = useChartStore(s => s.setProfileShowDelta);
  const setDeltaProfileWidth = useChartStore(s => s.setDeltaProfileWidth);
  const setCvdEnabled = useChartStore(s => s.setCvdEnabled);
  const setCvdPanelHeightPct = useChartStore(s => s.setCvdPanelHeightPct);
  const setCvdMode = useChartStore(s => s.setCvdMode);
  const setCvdSmoothing = useChartStore(s => s.setCvdSmoothing);
  const setCvdResetMode = useChartStore(s => s.setCvdResetMode);
  const setCvdPositiveColor = useChartStore(s => s.setCvdPositiveColor);
  const setCvdNegativeColor = useChartStore(s => s.setCvdNegativeColor);
  const setCvdScaleMode = useChartStore(s => s.setCvdScaleMode);
  const setCvdFixedRange = useChartStore(s => s.setCvdFixedRange);
  const setCvdShowDivergence = useChartStore(s => s.setCvdShowDivergence);
  const setCvdDivergenceLookback = useChartStore(s => s.setCvdDivergenceLookback);
  const setCvdMinimized = useChartStore(s => s.setCvdMinimized);
  const setVolumeBarsEnabled = useChartStore(s => s.setVolumeBarsEnabled);
  const setVolumeBarsInputData = useChartStore(s => s.setVolumeBarsInputData);
  const setVolumeBarsFilterMode = useChartStore(s => s.setVolumeBarsFilterMode);
  const setVolumeBarsMovingAverageLength = useChartStore(s => s.setVolumeBarsMovingAverageLength);
  const setVolumeBarsFilterMin = useChartStore(s => s.setVolumeBarsFilterMin);
  const setVolumeBarsFilterMax = useChartStore(s => s.setVolumeBarsFilterMax);
  const setVolumeBarsColorMode = useChartStore(s => s.setVolumeBarsColorMode);
  const setVolumeBarsOpacity = useChartStore(s => s.setVolumeBarsOpacity);
  const setVolumeBarsHeightPct = useChartStore(s => s.setVolumeBarsHeightPct);
  const setVolumeBarsShowValueText = useChartStore(s => s.setVolumeBarsShowValueText);
  const setVolumeBarsTextSize = useChartStore(s => s.setVolumeBarsTextSize);
  const setVolumeBarsAverageLineEnabled = useChartStore(s => s.setVolumeBarsAverageLineEnabled);
  const setVolumeBarsAverageLength = useChartStore(s => s.setVolumeBarsAverageLength);
  const setAutoBucketSize = useChartStore(s => s.setAutoBucketSize);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setSessionEnabled = useChartStore(s => s.setSessionEnabled);
  const setSessionTime = useChartStore(s => s.setSessionTime);
  const setSessionColor = useChartStore(s => s.setSessionColor);
  const crosshairSyncEnabled = useChartStore(s => s.crosshairSyncEnabled);
  const setCrosshairSyncEnabled = useChartStore(s => s.setCrosshairSyncEnabled);
  const drawingsSyncEnabled = useChartStore(s => s.drawingsSyncEnabled);
  const setDrawingsSyncEnabled = useChartStore(s => s.setDrawingsSyncEnabled);
  const setLiquidityEnabled = useChartStore(s => s.setLiquidityEnabled);
  const setLiquidityBucketSize = useChartStore(s => s.setLiquidityBucketSize);
  const setMinimumLiquidityThreshold = useChartStore(s => s.setMinimumLiquidityThreshold);
  const setLiquidityOpacity = useChartStore(s => s.setLiquidityOpacity);
  const setLiquidityRange = useChartStore(s => s.setLiquidityRange);
  const setLiquidityHeatmapEnabled = useChartStore(s => s.setLiquidityHeatmapEnabled);
  const setLiquidityHeatmapOpacity = useChartStore(s => s.setLiquidityHeatmapOpacity);

  const setLiquidityHeatmapAgeFade = useChartStore(s => s.setLiquidityHeatmapAgeFade);
  const setLiquidityHeatmapWidth = useChartStore(s => s.setLiquidityHeatmapWidth);
  const setLiquidityHeatmapShowPulled = useChartStore(s => s.setLiquidityHeatmapShowPulled);
  const setLiquidityHeatmapShowConsumed = useChartStore(s => s.setLiquidityHeatmapShowConsumed);
  const setLiquidityHeatmapShowPersistence = useChartStore(s => s.setLiquidityHeatmapShowPersistence);
  const setLiquidityHistoryDepth = useChartStore(s => s.setLiquidityHistoryDepth);
  const setLiquidityHeatmapShowCurrentLabel = useChartStore(s => s.setLiquidityHeatmapShowCurrentLabel);
  const setLiquidityHeatmapProfileSync = useChartStore(s => s.setLiquidityHeatmapProfileSync);
  const setStatsIndicatorEnabled = useChartStore(s => s.setStatsIndicatorEnabled);
  const setStatsIndicatorItems = useChartStore(s => s.setStatsIndicatorItems);
  const setGlobalTimezone = useChartStore(s => s.setGlobalTimezone);
  const setGlobalTimeFormat = useChartStore(s => s.setGlobalTimeFormat);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);

  const setHistoricalSessionProfileEnabled = useChartStore(s => s.setHistoricalSessionProfileEnabled);
  const setHistoricalSessionProfileTime = useChartStore(s => s.setHistoricalSessionProfileTime);
  const setHistoricalSessionProfileCount = useChartStore(s => s.setHistoricalSessionProfileCount);

  const [localThreshold, setLocalThreshold] = useState(String(panel.bubbleThreshold));
  const [showBubblesDocs, setShowBubblesDocs] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'profiles' | 'signals'>('chart');
  const minManualProfileResolutionTicks = getMinimumFineProfileResolutionTicks(tickSize);
  const effectiveProfileRowSize = tickSize > 0 ? panel.profileResolutionTicks * tickSize : 0;
  const maxProfileResolutionTicks = Math.max(40, minManualProfileResolutionTicks);
  const profileRowSizeLabel = panel.profileResolutionTicks === 0
    ? 'AUTO'
    : `${panel.profileResolutionTicks}t / ${effectiveProfileRowSize.toFixed(2)}`;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionsSectionRef = useRef<HTMLDivElement>(null);
  const cvdSectionRef = useRef<HTMLDivElement>(null);
  const bubblesSectionRef = useRef<HTMLDivElement>(null);
  const volumeBarsSectionRef = useRef<HTMLDivElement>(null);
  const volumeProfileSectionRef = useRef<HTMLDivElement>(null);
  const hsvpSectionRef = useRef<HTMLDivElement>(null);
  const heatmapSectionRef = useRef<HTMLDivElement>(null);
  const liquidityMapSectionRef = useRef<HTMLDivElement>(null);
  const statsSectionRef = useRef<HTMLDivElement>(null);
  const indicatorDialogTitles: Record<IndicatorSettingsSection, string> = {
    sessions: 'Sessions',
    historicalSessions: 'Historical Sessions',
    cvd: 'CVD',
    bubbles: 'Volume Bubbles',
    volumeBars: 'Volume',
    heatmap: 'Heatmap',
    liquidityMap: 'Liquidity Map',
    stats: 'Stats Indicator',
  };

  // --- Draggable Logic ---
  const [position, setPosition] = useState(() => getInitialSettingsPosition(initialAnchor, settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT));
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [height, setHeight] = useState(settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ mouseY: 0, height });

  // Initialize position once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && position.x === -1) {
      setPosition(getInitialSettingsPosition(initialAnchor, height));
    }
  }, [height, initialAnchor, position.x]);

  useEffect(() => {
    setHeight(settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT);
  }, [settingsDropdownHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!focusSection || focusRequestId <= 0) return;

    if (focusSection === 'profiles') {
      setActiveTab('profiles');
    }
  }, [focusRequestId, focusSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setHeight((currentHeight) => {
        const nextHeight = clampSettingsHeight(currentHeight, position.y);
        if (nextHeight !== currentHeight) {
          setSettingsDropdownHeight(nextHeight);
        }
        return nextHeight;
      });

      setPosition((currentPosition) => {
        const nextHeight = clampSettingsHeight(height, currentPosition.y);
        return clampSettingsPosition(currentPosition, nextHeight);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height, position.y, setSettingsDropdownHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header, not buttons/inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('select')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        setPosition(clampSettingsPosition({ x: newX, y: newY }, height));
        return;
      }

      if (isResizing) {
        const nextHeight = clampSettingsHeight(resizeStart.height + (e.clientY - resizeStart.mouseY), position.y);
        setHeight(nextHeight);
        return;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (isResizing) {
        setSettingsDropdownHeight(height);
      }
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, height, isDragging, isResizing, position.y, resizeStart, setSettingsDropdownHeight]);
  // --- End Draggable Logic ---

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ mouseY: e.clientY, height });
  };

  // Sync local when store changes
  useEffect(() => {
    setLocalThreshold(String(panel.bubbleThreshold));
  }, [panel.bubbleThreshold]);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalThreshold(raw);
    const val = Number(raw);
    if (!isNaN(val) && val >= 1) {
      setBubbleThreshold(panelId, val);
    }
  };

  const handleProfileResolutionChange = (value: number) => {
    setProfileResolutionTicks(
      panelId,
      value <= 0 ? 0 : Math.max(minManualProfileResolutionTicks, value)
    );
  };

  const bubbleSides: { label: string; value: BubbleSide }[] = [
    { label: 'Buy', value: 'buy' },
    { label: 'Sell', value: 'sell' },
    { label: 'Both', value: 'both' },
  ];
  const bubbleSources: { label: string; shortLabel: string; value: BubbleSource }[] = [
    { label: 'Footprint Cells', shortLabel: 'Footprint', value: 'footprintCells' },
    { label: 'Aggregate Trades', shortLabel: 'Agg Trades', value: 'aggregateTrades' },
  ];
  const bubbleSizeModes: { label: string; value: BubbleSizeBy }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Orders', value: 'orders' },
  ];
  const bubbleScaleModes: { label: string; value: BubbleScaleMode; title: string }[] = [
    { label: 'Linear', value: 'linear', title: 'Direct value proportion' },
    { label: 'SQRT', value: 'sqrt', title: 'Compresses outliers while preserving relative size' },
    { label: 'Log', value: 'log', title: 'Strongest compression for very uneven values' },
  ];
  const isAggregateBubbleSource = panel.bubbleSource === 'aggregateTrades';
  const showOrderBubbleControls = isAggregateBubbleSource && panel.bubbleSizeBy === 'orders';
  const cvdModes: { label: string; value: CvdMode }[] = [
    { label: 'Candles', value: 'candles' },
    { label: 'Bars', value: 'bars' },
    { label: 'Line', value: 'line' },
    { label: 'Hist', value: 'histogram' },
  ];
  const cvdResetModes: { label: string; value: CvdResetMode }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Session', value: 'session' },
    { label: 'None', value: 'none' },
  ];
  const cvdScaleModes: { label: string; value: CvdScaleMode }[] = [
    { label: 'Auto', value: 'auto' },
    { label: 'Fixed', value: 'fixed' },
  ];
  const volumeBarsInputOptions: { label: string; value: VolumeBarsInputData }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Orders', value: 'orders' },
    { label: 'Agg Trades', value: 'aggregateTrades' },
  ];
  const volumeBarsColorModes: { label: string; value: VolumeBarsColorMode }[] = [
    { label: 'Fixed', value: 'fixed' },
    { label: 'Direction', value: 'priceDirection' },
    { label: 'Delta', value: 'delta' },
    { label: 'Slope', value: 'volumeSlope' },
  ];

  const tabs = [
    { id: 'chart', label: 'Chart', icon: BarChart2 },
    { id: 'profiles', label: 'Profiles', icon: Layers },
    { id: 'signals', label: 'Signals', icon: Zap },
  ] as const;
  const signalToggles = [
    {
      id: 'absorption',
      label: 'Absorption',
      enabled: panel.absorptionEnabled,
      onToggle: () => setAbsorptionEnabled(panelId, !panel.absorptionEnabled),
      enabledClass: 'bg-[#089981]/10 border-[#089981]/60 text-[#089981]',
    },
    {
      id: 'exhaustion',
      label: 'Exhaustion',
      enabled: panel.exhaustionEnabled,
      onToggle: () => setExhaustionEnabled(panelId, !panel.exhaustionEnabled),
      enabledClass: 'bg-[#F0B90B]/10 border-[#F0B90B]/60 text-[#F0B90B]',
    },
    {
      id: 'iceberg',
      label: 'Iceberg',
      enabled: panel.icebergEnabled,
      onToggle: () => setIcebergEnabled(panelId, !panel.icebergEnabled),
      enabledClass: 'bg-[#089981]/10 border-[#089981]/60 text-[#089981]',
    },
    {
      id: 'liquidity-vacuum',
      label: 'Liquidity Vacuum',
      enabled: panel.liquidityVacuumEnabled,
      onToggle: () => setLiquidityVacuumEnabled(panelId, !panel.liquidityVacuumEnabled),
      enabledClass: 'bg-[#3D7EFF]/10 border-[#3D7EFF]/60 text-[#3D7EFF]',
    },
  ] as const;

  const renderSessionsSettings = () => (
    <div ref={sessionsSectionRef} className="scroll-mt-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Sessions</div>
        <button
          onClick={() => setSessionsEnabled(panelId, !panel.sessionsEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.sessionsEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.sessionsEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      <div className="space-y-6 pt-2">
        {(['tokyo', 'london', 'newYork'] as SessionId[]).map((sid) => {
          const session = panel.sessions[sid];
          const label = sid.toUpperCase().replace('YORK', ' YORK');
          return (
            <div key={sid} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
                <span className="text-[9px] font-bold font-mono tracking-tighter" style={{ color: session.color }}>
                  {label}
                </span>
                <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSessionEnabled(panelId, sid, !session.enabled)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 ${session.enabled
                    ? 'bg-accent/5 border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">Enabled</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${session.enabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                </button>

                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1F1F1F] bg-[#1F1F1F]">
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Color</span>
                  <input
                    type="color"
                    value={session.color}
                    onChange={(e) => setSessionColor(panelId, sid, e.target.value)}
                    className="w-4 h-4 bg-transparent border-none cursor-pointer outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
                  <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Start Time</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={session.startHour}
                      onChange={(e) => setSessionTime(panelId, sid, 'startHour', Number(e.target.value))}
                      className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                      min="0" max="23" step="1"
                    />
                    <span className="text-text-dim/40">:</span>
                    <select
                      value={session.startMin}
                      onChange={(e) => setSessionTime(panelId, sid, 'startMin', Number(e.target.value))}
                      className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                    >
                      <option value="0">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
                  <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">End Time</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={session.endHour}
                      onChange={(e) => setSessionTime(panelId, sid, 'endHour', Number(e.target.value))}
                      className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                      min="0" max="23" step="1"
                    />
                    <span className="text-text-dim/40">:</span>
                    <select
                      value={session.endMin}
                      onChange={(e) => setSessionTime(panelId, sid, 'endMin', Number(e.target.value))}
                      className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                    >
                      <option value="0">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCvdSettings = () => (
    <div ref={cvdSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">CVD</div>
        <button
          onClick={() => setCvdEnabled(panelId, !panel.cvdEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.cvdEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'}`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.cvdEnabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {panel.cvdEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-4 gap-1.5">
            {cvdModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setCvdMode(panelId, mode.value)}
                className={`py-2 rounded-lg border text-[9px] font-black uppercase transition-all duration-200 ${panel.cvdMode === mode.value
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCvdMinimized(panelId, !panel.cvdMinimized)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.cvdMinimized
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Compact Mode</span>
            <span className="text-[9px] font-black uppercase tracking-wider">{panel.cvdMinimized ? 'Minimized' : 'Expanded'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Reset</label>
              <select
                value={panel.cvdResetMode}
                onChange={(e) => setCvdResetMode(panelId, e.target.value as CvdResetMode)}
                className="bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1.5 text-[11px] font-bold text-main focus:border-accent focus:outline-none"
              >
                {cvdResetModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale</label>
              <div className="flex gap-1">
                {cvdScaleModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setCvdScaleMode(panelId, mode.value)}
                    className={`flex-1 py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.cvdScaleMode === mode.value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Height</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdPanelHeightPct}%</span>
            </div>
            <input
              type="range"
              value={panel.cvdPanelHeightPct}
              onChange={(e) => setCvdPanelHeightPct(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="12" max="45" step="1"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Smoothing</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdSmoothing <= 1 ? 'OFF' : `${panel.cvdSmoothing}`}</span>
            </div>
            <input
              type="range"
              value={panel.cvdSmoothing}
              onChange={(e) => setCvdSmoothing(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="1" max="50" step="1"
            />
          </div>

          {panel.cvdScaleMode === 'fixed' && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Fixed Range</label>
              <input
                type="number"
                value={panel.cvdFixedRange}
                onChange={(e) => setCvdFixedRange(panelId, Number(e.target.value) || 1)}
                className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1.5 text-[11px] font-mono font-bold text-main focus:border-accent focus:outline-none"
                min="1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Positive</span>
              <input
                type="color"
                value={panel.cvdPositiveColor}
                onChange={(e) => setCvdPositiveColor(panelId, e.target.value)}
                className="w-8 h-6 bg-transparent border-0 p-0 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Negative</span>
              <input
                type="color"
                value={panel.cvdNegativeColor}
                onChange={(e) => setCvdNegativeColor(panelId, e.target.value)}
                className="w-8 h-6 bg-transparent border-0 p-0 cursor-pointer"
              />
            </label>
          </div>

          <button
            onClick={() => setCvdShowDivergence(panelId, !panel.cvdShowDivergence)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.cvdShowDivergence
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Divergence Markers</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.cvdShowDivergence ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          {panel.cvdShowDivergence && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Divergence Lookback</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdDivergenceLookback}</span>
              </div>
              <input
                type="range"
                value={panel.cvdDivergenceLookback}
                onChange={(e) => setCvdDivergenceLookback(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="3" max="30" step="1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderVolumeBarsSettings = () => (
    <div ref={volumeBarsSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume</div>
        <button
          onClick={() => setVolumeBarsEnabled(panelId, !panel.volumeBarsEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.volumeBarsEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.volumeBarsEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.volumeBarsEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Input Data</label>
              <span className="text-[11px] font-mono font-bold text-accent">
                {volumeBarsInputOptions.find((option) => option.value === panel.volumeBarsInputData)?.label ?? 'Volume'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {volumeBarsInputOptions.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVolumeBarsInputData(panelId, value)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsInputData === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Filter Mode</label>
              <span className="text-[11px] font-mono font-bold text-accent">
                {panel.volumeBarsFilterMode === 'relative' ? 'Relative' : 'Absolute'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {['absolute', 'relative'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setVolumeBarsFilterMode(panelId, mode as VolumeBarsFilterMode)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsFilterMode === mode
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {panel.volumeBarsFilterMode === 'relative' && (
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">MA Length</label>
              <input
                type="number"
                value={panel.volumeBarsMovingAverageLength}
                onChange={(e) => setVolumeBarsMovingAverageLength(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="1"
                step="1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min {panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}</label>
              <input
                type="number"
                value={panel.volumeBarsFilterMin}
                onChange={(e) => setVolumeBarsFilterMin(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0"
                step={panel.volumeBarsFilterMode === 'relative' ? '0.1' : '1'}
              />
            </div>

            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Max {panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}</label>
              <input
                type="number"
                value={panel.volumeBarsFilterMax}
                onChange={(e) => setVolumeBarsFilterMax(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0"
                step={panel.volumeBarsFilterMode === 'relative' ? '0.1' : '1'}
              />
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Color Mode</label>
            <div className="grid grid-cols-4 gap-1">
              {volumeBarsColorModes.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVolumeBarsColorMode(panelId, value)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsColorMode === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
                <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.volumeBarsOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsOpacity * 100}
                onChange={(e) => setVolumeBarsOpacity(panelId, Number(e.target.value) / 100)}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="10"
                max="100"
                step="5"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Height</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsHeightPct}%</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsHeightPct}
                onChange={(e) => setVolumeBarsHeightPct(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="8"
                max="35"
                step="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setVolumeBarsShowValueText(panelId, !panel.volumeBarsShowValueText)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.volumeBarsShowValueText
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Show Values</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.volumeBarsShowValueText ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>

            <button
              onClick={() => setVolumeBarsAverageLineEnabled(panelId, !panel.volumeBarsAverageLineEnabled)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.volumeBarsAverageLineEnabled
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Average Line</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.volumeBarsAverageLineEnabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Text Size</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsTextSize}px</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsTextSize}
                onChange={(e) => setVolumeBarsTextSize(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="8"
                max="16"
                step="1"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Average Len</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsAverageLength}</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsAverageLength}
                onChange={(e) => setVolumeBarsAverageLength(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1"
                max="200"
                step="1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderBubbleSettings = () => (
    <div ref={bubblesSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Bubbles</div>
          <button onClick={() => setShowBubblesDocs(true)} className="text-[10px] font-bold text-accent hover:underline">DOCS</button>
        </div>
        <button
          onClick={() => setBubblesEnabled(panelId, !panel.bubblesEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.bubblesEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.bubblesEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.bubblesEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bubble Source</label>
              <span className="text-[11px] font-mono font-bold text-accent">
                {bubbleSources.find((source) => source.value === panel.bubbleSource)?.label ?? 'Footprint Cells'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {bubbleSources.map(({ label, shortLabel, value }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setBubbleSource(panelId, value)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${
                    panel.bubbleSource === value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
                >
                  {shortLabel}
                </button>
              ))}
            </div>
          </div>

          {isAggregateBubbleSource && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Size By</label>
                <div className="grid grid-cols-2 gap-1">
                  {bubbleSizeModes.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBubbleSizeBy(panelId, value)}
                      className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${
                        panel.bubbleSizeBy === value
                          ? 'bg-[#1F1F1F] border-accent text-accent'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showOrderBubbleControls && (
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Volume</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBubbleThresholdMode(panelId, panel.bubbleThresholdMode === 'absolute' ? 'relative' : 'absolute')}
                  className="px-2 py-1 bg-[#1F1F1F] border border-[#1F1F1F] rounded text-[10px] font-black text-text-dim hover:text-main transition-colors uppercase"
                >
                  {panel.bubbleThresholdMode === 'absolute' ? 'Fixed (BTC)' : 'Adaptive (x Avg)'}
                </button>
                <input
                  type="number"
                  value={localThreshold}
                  onChange={handleThresholdChange}
                  step={panel.bubbleThresholdMode === 'relative' ? "0.5" : "1"}
                  className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="0.1"
                />
              </div>
            </div>
          )}

          {showOrderBubbleControls && (
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Orders</label>
                <input
                  type="number"
                  value={panel.bubbleMinOrders}
                  onChange={(e) => setBubbleMinOrders(panelId, Number(e.target.value))}
                  className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="1"
                  max="1000"
                  step="1"
                />
              </div>
              <input
                type="range"
                value={panel.bubbleMinOrders}
                onChange={(e) => setBubbleMinOrders(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1"
                max="1000"
                step="1"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
            <div className="flex gap-1">
              {bubbleSides.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setBubbleSide(panelId, value)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.bubbleSide === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale Mode</label>
              <div className="flex gap-1 w-36">
                {bubbleScaleModes.map(({ label, value, title }) => (
                  <button
                    key={value}
                    type="button"
                    title={title}
                    onClick={() => setBubbleScaleMode(panelId, value)}
                    className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.bubbleScaleMode === value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Radius</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.bubbleMinRadius}px</span>
              </div>
              <input
                type="range"
                value={panel.bubbleMinRadius}
                onChange={(e) => setBubbleMinRadius(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1"
                max={Math.max(1, Math.min(20, panel.bubbleMaxRadius - 1))}
                step="1"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Max Radius</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.bubbleMaxRadius}px</span>
              </div>
              <input
                type="range"
                value={panel.bubbleMaxRadius}
                onChange={(e) => setBubbleMaxRadius(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min={Math.max(5, panel.bubbleMinRadius + 1)}
                max="60"
                step="1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderVolumeProfileSettings = () => (
    <div ref={volumeProfileSectionRef} className="scroll-mt-5 space-y-4">
      <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume Profile</div>

      <div className="space-y-3">
        <button
          onClick={() => setDefaultProfileEnabled(panelId, !panel.defaultProfileEnabled)}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.defaultProfileEnabled
            ? 'bg-accent/5 border-accent text-accent'
            : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">Default Profile</span>
          <div className={`w-1.5 h-1.5 rounded-full ${panel.defaultProfileEnabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
        </button>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scaling</label>
            <div className="flex gap-1 w-24">
              {(['linear', 'sqrt'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setProfileScaleMode(panelId, m)}
                  title={m === 'linear' ? 'True proportions - best for shape reading' : 'Amplifies low volume - best for activity presence'}
                  className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.profileScaleMode === m
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Row Size</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {profileRowSizeLabel}
            </span>
          </div>
          <input
            type="range"
            value={panel.profileResolutionTicks}
            onChange={(e) => handleProfileResolutionChange(Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0"
            max={maxProfileResolutionTicks}
            step="1"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Width</label>
            <span className="text-[12px] font-mono font-bold text-accent">{panel.profileWidthPct}%</span>
          </div>
          <input
            type="range"
            value={panel.profileWidthPct}
            onChange={(e) => setProfileWidthPct(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="10" max="100" step="5"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
            <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.profileOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            value={panel.profileOpacity * 100}
            onChange={(e) => setProfileOpacity(panelId, Number(e.target.value) / 100)}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="10" max="100" step="5"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Row Width</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {panel.profileMinRowWidth === 0 ? 'OFF' : `${panel.profileMinRowWidth}px`}
            </span>
          </div>
          <input
            type="range"
            value={panel.profileMinRowWidth}
            onChange={(e) => setProfileMinRowWidth(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0" max="8" step="1"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Row Height</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {panel.profileMinRowHeight === 0 ? 'OFF' : `${panel.profileMinRowHeight}px`}
            </span>
          </div>
          <input
            type="range"
            value={panel.profileMinRowHeight}
            onChange={(e) => setProfileMinRowHeight(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0" max="4" step="0.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setProfileShowPocHighlight(panelId, !panel.profileShowPocHighlight)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocHighlight
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">POC Highlight</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocHighlight ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowVaFill(panelId, !panel.profileShowVaFill)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaFill
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">VA Area Fill</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaFill ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowPocLine(panelId, !panel.profileShowPocLine)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocLine
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">POC Line</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocLine ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowVaLines(panelId, !panel.profileShowVaLines)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaLines
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">VA Lines</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaLines ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowDelta(panelId, !panel.profileShowDelta)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowDelta
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Show Delta</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowDelta ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>
        </div>

        {panel.profileShowDelta && (
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Delta Width</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.deltaProfileWidth}px</span>
            </div>
            <input
              type="range"
              value={panel.deltaProfileWidth}
              onChange={(e) => setDeltaProfileWidth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="40" max="160" step="5"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoricalSessionProfileSettings = () => (
    <div ref={hsvpSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Historical Session Volume Profile</div>
        <button
          onClick={() => setHistoricalSessionProfileEnabled(panelId, !panel.historicalSessionProfileEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.historicalSessionProfileEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'}`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.historicalSessionProfileEnabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {panel.historicalSessionProfileEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
              <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Start Time</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={panel.historicalSessionProfileStartHour}
                  onChange={(e) => {
                    let val = Number(e.target.value);
                    if (val < 0) val = 23;
                    if (val > 23) val = 0;
                    setHistoricalSessionProfileTime(panelId, 'startHour', val);
                  }}
                  className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                  min="0" max="23" step="1"
                />
                <span className="text-text-dim/40">:</span>
                <select
                  value={panel.historicalSessionProfileStartMin}
                  onChange={(e) => setHistoricalSessionProfileTime(panelId, 'startMin', Number(e.target.value))}
                  className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                >
                  <option value="0">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
              <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">End Time</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={panel.historicalSessionProfileEndHour}
                  onChange={(e) => {
                    let val = Number(e.target.value);
                    if (val < 0) val = 23;
                    if (val > 23) val = 0;
                    setHistoricalSessionProfileTime(panelId, 'endHour', val);
                  }}
                  className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                  min="0" max="23" step="1"
                />
                <span className="text-text-dim/40">:</span>
                <select
                  value={panel.historicalSessionProfileEndMin}
                  onChange={(e) => setHistoricalSessionProfileTime(panelId, 'endMin', Number(e.target.value))}
                  className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                >
                  <option value="0">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sessions to Display</label>
            <select
              value={panel.historicalSessionProfileCount}
              onChange={(e) => setHistoricalSessionProfileCount(panelId, Number(e.target.value))}
              className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 8, 10, 12, 15].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );

  const renderLiquidityMapSettings = () => (
    <div ref={liquidityMapSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Liquidity Map</div>
        <button
          onClick={() => setLiquidityEnabled(panelId, !panel.liquidityEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.liquidityEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.liquidityEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.liquidityEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityOpacity * 100}
              onChange={(e) => setLiquidityOpacity(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="10" max="100" step="5"
            />
          </div>

          <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={panel.liquidityBucketSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 10) setLiquidityBucketSize(panelId, val);
                }}
                className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="10" max="500" step="10"
              />
              <span className="text-[9px] text-text-dim font-black uppercase">$</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={panel.minimumLiquidityThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 0.5) setMinimumLiquidityThreshold(panelId, val);
                }}
                className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0.5" max="100" step="0.5"
              />
              <span className="text-[9px] text-text-dim font-black uppercase">BTC</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Range</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityRange}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityRange}
              onChange={(e) => setLiquidityRange(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="5" max="20" step="1"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderHeatmapSettings = () => (
    <div ref={heatmapSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Historical Heatmap</div>
        <button
          onClick={() => setLiquidityHeatmapEnabled(panelId, !panel.liquidityHeatmapEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.liquidityHeatmapEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.liquidityHeatmapEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.liquidityHeatmapEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Base Opacity</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityHeatmapOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapOpacity * 100}
              onChange={(e) => setLiquidityHeatmapOpacity(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="10" max="100" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Age Fade Factor</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityHeatmapAgeFade * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapAgeFade * 100}
              onChange={(e) => setLiquidityHeatmapAgeFade(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="0" max="100" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Strip Width</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityHeatmapWidth}px</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapWidth}
              onChange={(e) => setLiquidityHeatmapWidth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="30" max="120" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">History Depth</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityHistoryDepth} candles</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHistoryDepth}
              onChange={(e) => setLiquidityHistoryDepth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="50" max="500" step="50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              ['Show Pulled', panel.liquidityHeatmapShowPulled, () => setLiquidityHeatmapShowPulled(panelId, !panel.liquidityHeatmapShowPulled)],
              ['Show Consumed', panel.liquidityHeatmapShowConsumed, () => setLiquidityHeatmapShowConsumed(panelId, !panel.liquidityHeatmapShowConsumed)],
              ['Show CURRENT', panel.liquidityHeatmapShowCurrentLabel, () => setLiquidityHeatmapShowCurrentLabel(panelId, !panel.liquidityHeatmapShowCurrentLabel)],
              ['Profile Sync', panel.liquidityHeatmapProfileSync, () => setLiquidityHeatmapProfileSync(panelId, !panel.liquidityHeatmapProfileSync)],
            ].map(([label, enabled, onClick]) => (
              <button
                key={label as string}
                onClick={onClick as () => void}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${enabled
                  ? 'bg-accent/5 border-accent text-accent'
                  : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">{label as string}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>
            ))}

            <button
              onClick={() => setLiquidityHeatmapShowPersistence(panelId, !panel.liquidityHeatmapShowPersistence)}
              className={`col-span-2 flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.liquidityHeatmapShowPersistence
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Show Persistence Bars</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.liquidityHeatmapShowPersistence ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const statsOptions: { label: string; value: StatsIndicatorItem }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Delta', value: 'delta' },
    { label: 'CVD', value: 'cvd' },
  ];

  const renderStatsSettings = () => (
    <div ref={statsSectionRef} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Stats Indicator</div>
        <button
          onClick={() => setStatsIndicatorEnabled(panelId, !panel.statsIndicatorEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.statsIndicatorEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.statsIndicatorEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.statsIndicatorEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">


          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Select Stats</label>
            <div className="grid grid-cols-2 gap-2">
              {statsOptions.map((opt) => {
                const isSelected = panel.statsIndicatorItems.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (isSelected) {
                        setStatsIndicatorItems(panelId, panel.statsIndicatorItems.filter(i => i !== opt.value));
                      } else {
                        setStatsIndicatorItems(panelId, [...panel.statsIndicatorItems, opt.value]);
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${isSelected
                      ? 'bg-accent/5 border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">{opt.label}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-text-dim/60 italic px-1 pt-1">
              Stats will be displayed in the order they are selected.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderIndicatorSettingsContent = (section: IndicatorSettingsSection) => {
    switch (section) {
      case 'sessions':
        return renderSessionsSettings();
      case 'historicalSessions':
        return renderHistoricalSessionProfileSettings();
      case 'cvd':
        return renderCvdSettings();
      case 'bubbles':
        return renderBubbleSettings();
      case 'volumeBars':
        return renderVolumeBarsSettings();
      case 'heatmap':
        return renderHeatmapSettings();
      case 'liquidityMap':
        return renderLiquidityMapSettings();
      case 'stats':
        return renderStatsSettings();
      default:
        return null;
    }
  };

  if (indicatorSection) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 px-3 py-6"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="popup-contrast flex max-h-[min(720px,calc(100vh-48px))] w-full flex-col overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#1F1F1F] shadow-2xl"
          style={{ maxWidth: INDICATOR_DIALOG_WIDTH }}
        >
          <div className="flex items-center justify-between border-b border-[#1F1F1F] bg-[#1F1F1F]/50 p-4">
            <div className="flex flex-col">
              <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">
                {indicatorTitle ?? indicatorDialogTitles[indicatorSection]}
              </h3>
              <span className="text-[9px] font-bold text-text-dim/60 uppercase tracking-tighter">{panelId} Panel</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-dim transition-colors hover:text-main"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto p-5 custom-scrollbar">
            {renderIndicatorSettingsContent(indicatorSection)}
          </div>
        </div>
        {showBubblesDocs && <BubblesDocsModal onClose={() => setShowBubblesDocs(false)} />}
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={`popup-contrast pointer-events-auto fixed z-[1000] flex w-[544px] flex-col overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#1F1F1F] shadow-2xl transition-shadow duration-200 ${isDragging ? 'shadow-accent/20 ring-1 ring-accent/20' : ''}`}
      style={{ 
        left: position.x === -1 ? 'auto' : position.x,
        top: position.y,
        right: position.x === -1 ? '16px' : 'auto',
        height,
        minHeight: SETTINGS_MIN_HEIGHT,
        maxHeight: getViewportMaxHeight(position.y),
        userSelect: isDragging ? 'none' : 'auto'
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {/* Header / Drag Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={`p-4 border-b border-[#1F1F1F] flex items-center justify-between bg-[#1F1F1F]/50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">Settings</h3>
            <span className="text-[9px] font-bold text-text-dim/60 uppercase tracking-tighter">{panelId} Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center text-text-dim/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-main transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-32 bg-[#1F1F1F]/50 border-r border-[#1F1F1F] flex flex-col p-1.5 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${activeTab === tab.id
                ? 'bg-accent/10 text-accent shadow-[inset_0_0_10px_rgba(61,126,255,0.05)]'
                : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
                }`}
            >
              <tab.icon size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-40'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="flex flex-col gap-8">
            {/* Tab: Chart */}
            {activeTab === 'chart' && (
              <>
                {/* Bucket Size */}
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Aggregation</div>
                  <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                    <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Tick Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={tickSize}
                        onChange={(e) => setTickSize(parseFloat(e.target.value) || 0.5)}
                        className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                      />
                      <span className="text-[9px] text-text-dim font-black uppercase">Price</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                    <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAutoBucketSize(panelId, !panel.autoBucketSize)}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.autoBucketSize
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        Auto
                      </button>
                      <input
                        type="number"
                        value={panel.bucketSize}
                        disabled={panel.autoBucketSize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) setBucketSize(panelId, val);
                        }}
                        className={`w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold transition-all text-main ${panel.autoBucketSize ? 'opacity-50 cursor-not-allowed' : 'focus:border-accent focus:outline-none'}`}
                        min="1"
                      />
                      <span className="text-[9px] text-text-dim font-black uppercase">Ticks</span>
                    </div>
                  </div>
                </div>

                {/* Global Time */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Global Time</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
                      <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Timezone</label>
                      <select
                        value={globalTimezone}
                        onChange={(e) => setGlobalTimezone(e.target.value)}
                        className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
                      >
                        <option value="local">Local (PC)</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">New York</option>
                        <option value="Europe/London">London</option>
                        <option value="America/Chicago">Chicago</option>
                        <option value="America/Los_Angeles">Los Angeles</option>
                        <option value="Asia/Karachi">Pakistan</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
                      <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Time Format</label>
                      <select
                        value={globalTimeFormat}
                        onChange={(e) => setGlobalTimeFormat(e.target.value as '12h' | '24h')}
                        className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
                      >
                        <option value="24h">24-hour</option>
                        <option value="12h">12-hour (AM/PM)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Synchronized Crosshair & Drawings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Interaction</div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                    <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sync Crosshairs</label>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
                        {crosshairSyncEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => setCrosshairSyncEnabled(!crosshairSyncEnabled)}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${crosshairSyncEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                          }`}
                      >
                        <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${crosshairSyncEnabled ? 'left-5' : 'left-1'
                          }`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                    <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sync Drawings</label>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
                        {drawingsSyncEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => setDrawingsSyncEnabled(!drawingsSyncEnabled)}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${drawingsSyncEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                          }`}
                      >
                        <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${drawingsSyncEnabled ? 'left-5' : 'left-1'
                          }`} />
                      </button>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* Tab: Profiles */}
            {activeTab === 'profiles' && (
              <>
                {/* Footprint Settings */}
                {panel.chartMode === 'footprint' && (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Footprint Configuration</div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setFootprintMode(panelId, 'bid-ask')}
                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all duration-200 ${panel.footprintMode === 'bid-ask'
                          ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(8,153,129,0.1)]'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <div className="text-[11px] font-black">BID / ASK</div>
                        <div className="text-[9px] opacity-50 font-medium">Side-by-side</div>
                      </button>
                      <button
                        onClick={() => setFootprintMode(panelId, 'delta')}
                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all duration-200 ${panel.footprintMode === 'delta'
                          ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(8,153,129,0.1)]'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <div className="text-[11px] font-black">DELTA</div>
                        <div className="text-[9px] opacity-50 font-medium">Net volume</div>
                      </button>
                      <button
                        onClick={() => setFootprintMode(panelId, 'delta-volume')}
                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all duration-200 ${panel.footprintMode === 'delta-volume'
                          ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(8,153,129,0.1)]'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <div className="text-[11px] font-black">DELTA + VOL</div>
                        <div className="text-[9px] opacity-50 font-medium">Left / Right</div>
                      </button>
                    </div>
                  </div>
                )}

                {renderVolumeProfileSettings()}
                {renderHistoricalSessionProfileSettings()}
              </>
            )}

            {/* Tab: Signals */}
            {activeTab === 'signals' && (
              <>
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Signal Toggles</div>
                  <div className="grid grid-cols-1 gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                    {signalToggles.map((signal) => (
                      <button
                        key={signal.id}
                        onClick={signal.onToggle}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-200 ${
                          signal.enabled
                            ? signal.enabledClass
                            : 'border-[#1F1F1F] bg-[#1F1F1F] text-text-dim hover:border-[#333] hover:text-main'
                        }`}
                      >
                        <span>{signal.label}</span>
                        <div
                          className={`relative h-4 w-8 rounded-full transition-colors duration-200 ${
                            signal.enabled ? 'bg-current/25' : 'bg-[#1F1F1F]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 h-2 w-2 rounded-full bg-current transition-all duration-200 ${
                              signal.enabled ? 'left-5' : 'left-1'
                            }`}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Absorption Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Absorption Signals</div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.absorptionEnabled ? 'border-[#089981]/60 text-[#089981]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
                      {panel.absorptionEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {panel.absorptionEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                          <span className="text-[12px] font-mono font-bold text-[#089981]">{panel.absorptionMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.absorptionMinScore}
                          onChange={(e) => setAbsorptionMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#089981]"
                          min="30" max="90" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
                        <div className="flex gap-1">
                          {(['buyer', 'seller', 'both'] as AbsorptionSide[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setAbsorptionSide(panelId, s)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.absorptionSide === s
                                ? 'bg-[#1F1F1F] border-[#089981] text-[#089981]'
                                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exhaustion Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Exhaustion Signals</div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.exhaustionEnabled ? 'border-[#F0B90B]/60 text-[#F0B90B]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
                      {panel.exhaustionEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {panel.exhaustionEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                          <span className="text-[12px] font-mono font-bold text-[#F0B90B]">{panel.exhaustionMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.exhaustionMinScore}
                          onChange={(e) => setExhaustionMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#F0B90B]"
                          min="30" max="90" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
                        <div className="flex gap-1">
                          {(['buyer', 'seller', 'both'] as ExhaustionSide[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setExhaustionSide(panelId, s)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.exhaustionSide === s
                                ? 'bg-[#1F1F1F] border-[#F0B90B] text-[#F0B90B]'
                                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Lookback window</label>
                          <span className="text-[12px] font-mono font-bold text-accent">{panel.exhaustionLookback} Candles</span>
                        </div>
                        <input
                          type="range"
                          value={panel.exhaustionLookback}
                          onChange={(e) => setExhaustionLookback(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                          min="3" max="8" step="1"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Show on live candle</label>
                        <button
                          onClick={() => setExhaustionShowProvisional(panelId, !panel.exhaustionShowProvisional)}
                          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.exhaustionShowProvisional ? 'bg-[#3D7EFF]' : 'bg-[#1F1F1F]'
                            }`}
                        >
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.exhaustionShowProvisional ? 'left-5' : 'left-1'
                            }`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Iceberg Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Iceberg Detection</div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.icebergEnabled ? 'border-[#089981]/60 text-[#089981]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
                      {panel.icebergEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {panel.icebergEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Minimum score</label>
                          <span className="text-[12px] font-mono font-bold text-[#089981]">{panel.icebergMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.icebergMinScore}
                          onChange={(e) => setIcebergMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#089981]"
                          min="30" max="80" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Lookback window</label>
                          <span className="text-[12px] font-mono font-bold text-accent">{panel.icebergLookback} Candles</span>
                        </div>
                        <input
                          type="range"
                          value={panel.icebergLookback}
                          onChange={(e) => setIcebergLookback(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                          min="5" max="20" step="1"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {[
                          ['Show suspected', panel.icebergShowSuspected, () => setIcebergShowSuspected(panelId, !panel.icebergShowSuspected)],
                          ['Show labels', panel.icebergShowLabels, () => setIcebergShowLabels(panelId, !panel.icebergShowLabels)],
                          ['Show background tint', panel.icebergShowTint, () => setIcebergShowTint(panelId, !panel.icebergShowTint)],
                        ].map(([label, enabled, onClick]) => (
                          <button
                            key={label as string}
                            onClick={onClick as () => void}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${enabled
                              ? 'bg-[#089981]/5 border-[#089981] text-[#089981]'
                              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                              }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">{label as string}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-[#089981] shadow-[0_0_8px_rgba(8,153,129,0.5)]' : 'bg-[#1F1F1F]'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Liquidity Vacuum Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Liquidity Vacuum</div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.liquidityVacuumEnabled ? 'border-[#3D7EFF]/60 text-[#3D7EFF]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
                      {panel.liquidityVacuumEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {panel.liquidityVacuumEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Minimum score</label>
                          <span className="text-[12px] font-mono font-bold text-[#3D7EFF]">{panel.liquidityVacuumMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.liquidityVacuumMinScore}
                          onChange={(e) => setLiquidityVacuumMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#3D7EFF]"
                          min="30" max="90" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Zone opacity</label>
                          <span className="text-[12px] font-mono font-bold text-[#3D7EFF]">{Math.round(panel.liquidityVacuumOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          value={panel.liquidityVacuumOpacity * 100}
                          onChange={(e) => setLiquidityVacuumOpacity(panelId, Number(e.target.value) / 100)}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#3D7EFF]"
                          min="5" max="50" step="1"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Max zones</label>
                          <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityVacuumMaxZones}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.liquidityVacuumMaxZones}
                          onChange={(e) => setLiquidityVacuumMaxZones(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                          min="1" max="20" step="1"
                        />
                      </div>

                      <button
                        onClick={() => setLiquidityVacuumShowLabels(panelId, !panel.liquidityVacuumShowLabels)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.liquidityVacuumShowLabels
                          ? 'bg-[#3D7EFF]/5 border-[#3D7EFF] text-[#3D7EFF]'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">Show labels</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.liquidityVacuumShowLabels ? 'bg-[#3D7EFF] shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[#1F1F1F] bg-[#1F1F1F]/50">
        <div className="text-[9px] text-text-dim/40 text-center font-medium uppercase tracking-widest">
          Global Settings • {panelId} Panel
        </div>
      </div>
      <div
        onMouseDown={handleResizeMouseDown}
        className="h-3 shrink-0 cursor-row-resize bg-[#1F1F1F]/60 border-t border-[#1F1F1F] flex items-center justify-center"
        title="Resize settings panel"
      >
        <div className="w-16 h-1 rounded-full bg-[#1F1F1F] opacity-50" />
      </div>
      {showBubblesDocs && <BubblesDocsModal onClose={() => setShowBubblesDocs(false)} />}
    </div>
  );
}

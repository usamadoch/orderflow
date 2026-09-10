'use client';

import React from 'react';
import { Maximize2, Minimize2, Settings, TrendingUp, RefreshCw } from 'lucide-react';
import { FigButton, FigSegmentedControl, FigTooltip } from './fig';
import { useChartStore, PanelId, type SettingsOpenRequest } from '../../lib/store/chart';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';
import { ChartSettingsDropdown } from './ChartSettingsDropdown';
import { ChartLayoutDropdown } from './ChartLayoutDropdown';
import { PairSelector } from './PairSelector';
import { ChartModeSelector } from './ChartModeSelector';
import { deleteSharedCandleCache } from '../../lib/feeds/candleCache';
import { deleteSharedFootprintCache } from '../../lib/aggregation/footprintCache';
import { deleteSharedVolumeProfileCache } from '../../lib/volumeProfile/profileCache';
import { getFineProfileBaseBucketSize } from '../../lib/config/markets';
import { IndicatorsModal } from './IndicatorsModal';
import { Activity } from 'lucide-react';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

export function PanelToolbar({ panelId }: PanelToolbarProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const tickSize = useChartStore(s => s.tickSize);
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);
  const setMeasureToolActive = useChartRuntimeStore(s => s.setMeasureToolActive);
  const focusMode = useChartStore(s => s.focusMode);
  const setFocusMode = useChartStore(s => s.setFocusMode);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const settingsOpenRequest = useChartStore(s => s.settingsOpenRequest);
  const triggerPanelRefresh = useChartRuntimeStore(s => s.triggerPanelRefresh);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settingsAnchor, setSettingsAnchor] = React.useState<{ x: number; y: number } | null>(null);
  const [settingsFocusRequest, setSettingsFocusRequest] = React.useState<SettingsOpenRequest | null>(null);
  const [showIndicatorsModal, setShowIndicatorsModal] = React.useState(false);
  const settingsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = React.useRef<HTMLElement | null>(null);

  const selectPositionTool = React.useCallback(() => {
    setActivePanel(panelId);
    setMeasureToolActive(panelId, false);
    setLineDrawMode(panelId, panel.lineDrawMode === 'position' ? 'none' : 'position');
  }, [panel.lineDrawMode, panelId, setActivePanel, setLineDrawMode, setMeasureToolActive]);

  const selectTradeTool = React.useCallback((mode: 'buy' | 'sell') => {
    setActivePanel(panelId);
    setMeasureToolActive(panelId, false);
    setLineDrawMode(panelId, panel.lineDrawMode === mode ? 'none' : mode);
  }, [panel.lineDrawMode, panelId, setActivePanel, setLineDrawMode, setMeasureToolActive]);

  const getSettingsAnchor = React.useCallback(() => {
    const rect = settingsButtonRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: rect.right,
      y: rect.bottom + 6,
    };
  }, []);

  const openSettings = React.useCallback((focusRequest: SettingsOpenRequest | null = null) => {
    setActivePanel(panelId);
    setSettingsAnchor(getSettingsAnchor());
    setSettingsFocusRequest(focusRequest);
    setShowSettings(true);
  }, [getSettingsAnchor, panelId, setActivePanel]);

  React.useEffect(() => {
    if (!showSettings) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (settingsContainerRef.current && !settingsContainerRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showSettings]);

  React.useEffect(() => {
    if (settingsOpenRequest?.panelId !== panelId) return;
    openSettings(settingsOpenRequest);
  }, [openSettings, panelId, settingsOpenRequest]);

  return (
    <div className="font-sans h-8 bg-[#0F0F0F] border-b border-[#1F1F1F] flex items-center px-3 gap-2 shrink-0 overflow-visible">
      <PairSelector panelId={panelId} />

      {/* Timeframe Selector */}
      <FigTooltip text="Timeframe">
        <FigSegmentedControl
          value={panel.timeframe}
          onChange={(tf: string) => setTimeframe(panelId, tf)}
          options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
          aria-label="Timeframe"
        />
      </FigTooltip>

      {/* Mode Toggle */}
      <ChartModeSelector panelId={panelId} />

      {/* Indicators Button */}
      <div className="relative flex items-center h-full">
        <FigTooltip text={!showIndicatorsModal ? 'Indicators' : ''}>
          <FigButton
            id={`panel-indicators-trigger-${panelId}`}
            variant="ghost"
            size="small"
            selected={showIndicatorsModal}
            onClick={() => setShowIndicatorsModal(!showIndicatorsModal)}
            aria-label="Indicators"
            className="gap-1.5 cursor-pointer"
          >
            <Activity size={13} strokeWidth={2.5} />
            Indicators
          </FigButton>
        </FigTooltip>
        <IndicatorsModal
          open={showIndicatorsModal}
          anchor={`#panel-indicators-trigger-${panelId}`}
          panelId={panelId}
          onClose={() => setShowIndicatorsModal(false)}
        />
      </div>

      <div className="flex gap-0.5 bg-[#0F0F0F] p-0.5 rounded-md border border-[#1F1F1F]">
        <FigTooltip text="Position Tool (Drag Up for Short, Down for Long)">
          <FigButton
            size="compact"
            variant="ghost"
            selected={panel.lineDrawMode === 'position'}
            onClick={() => selectPositionTool()}
            className={`gap-1 px-1.5 py-0.5 text-[10px] font-black tracking-tight cursor-pointer ${
              panel.lineDrawMode === 'position'
                ? 'bg-[#3D7EFF] text-white shadow-sm shadow-[#3D7EFF]/20'
                : 'text-text-dim hover:text-main'
            }`}
            aria-label="Position Tool"
          >
            <TrendingUp size={11} strokeWidth={2.5} />
            Position
          </FigButton>
        </FigTooltip>
        <FigTooltip text="Buy Market Order (Click chart to set Stop Loss)">
          <FigButton
            size="compact"
            variant="ghost"
            selected={panel.lineDrawMode === 'buy'}
            onClick={() => selectTradeTool('buy')}
            className={`gap-1 px-2 py-0.5 text-[10px] font-black tracking-tight cursor-pointer ${
              panel.lineDrawMode === 'buy'
                ? 'bg-[#089981] text-white shadow-sm shadow-[#089981]/25'
                : 'text-[#089981] hover:text-white hover:bg-[#089981]/20'
            }`}
            aria-label="Buy Market Order"
          >
            BUY
          </FigButton>
        </FigTooltip>
        <FigTooltip text="Sell Market Order (Click chart to set Stop Loss)">
          <FigButton
            size="compact"
            variant="ghost"
            selected={panel.lineDrawMode === 'sell'}
            onClick={() => selectTradeTool('sell')}
            className={`gap-1 px-2 py-0.5 text-[10px] font-black tracking-tight cursor-pointer ${
              panel.lineDrawMode === 'sell'
                ? 'bg-[#F23645] text-white shadow-sm shadow-[#F23645]/25'
                : 'text-[#F23645] hover:text-white hover:bg-[#F23645]/20'
            }`}
            aria-label="Sell Market Order"
          >
            SELL
          </FigButton>
        </FigTooltip>
      </div>

      <div className="ml-auto flex items-center gap-1 border-l border-[#1F1F1F] pl-3 h-5">
        <ChartLayoutDropdown panelId={panelId} />

        <FigTooltip text={`${panelId === 'left' ? 'Left' : 'Right'} panel refresh`}>
          <FigButton
            variant="ghost"
            icon
            className="cursor-pointer"
            onClick={() => {
              deleteSharedCandleCache({
                symbol: panel.pair,
                contractType: panel.contractType,
                timeframe: panel.timeframe,
              });
              deleteSharedFootprintCache({
                symbol: panel.pair,
                contractType: panel.contractType,
                dataSourceMode: 'trades',
              });
              deleteSharedFootprintCache({
                symbol: panel.pair,
                contractType: panel.contractType,
                dataSourceMode: 'aggregateTrades',
              });
              deleteSharedVolumeProfileCache({
                symbol: panel.pair,
                contractType: panel.contractType,
                dataSourceMode: 'trades',
                baseBucketSize: getFineProfileBaseBucketSize(tickSize),
              });
              triggerPanelRefresh(panelId);
            }}
            aria-label={`Refresh ${panelId} panel`}
          >
            <RefreshCw size={11} strokeWidth={2.5} />
          </FigButton>
        </FigTooltip>

        <div ref={settingsContainerRef} className="relative">
          <FigTooltip text={!showSettings ? `${panelId === 'left' ? 'Left' : 'Right'} panel settings` : ''}>
            <FigButton
              ref={settingsButtonRef}
              variant="ghost"
              icon
              selected={showSettings}
              onClick={() => (showSettings ? setShowSettings(false) : openSettings())}
              aria-label={`${panelId === 'left' ? 'Left' : 'Right'} panel settings`}
              className="cursor-pointer"
            >
              <Settings size={12} strokeWidth={2.5} />
            </FigButton>
          </FigTooltip>

          {showSettings && (
            <ChartSettingsDropdown
              panelId={panelId}
              initialAnchor={settingsAnchor}
              focusSection={settingsFocusRequest?.section ?? null}
              focusRequestId={settingsFocusRequest?.requestId ?? 0}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>

        <FigTooltip text={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>
          <FigButton
            variant="ghost"
            icon
            onClick={() => setFocusMode(!focusMode)}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            className="cursor-pointer"
          >
            {focusMode ? <Minimize2 size={11} strokeWidth={2.5} /> : <Maximize2 size={11} strokeWidth={2.5} />}
          </FigButton>
        </FigTooltip>
      </div>

    </div>
  );
}

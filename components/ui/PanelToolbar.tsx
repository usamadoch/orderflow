'use client';

import React from 'react';
import { Maximize2, Minimize2, Settings, TrendingUp, RefreshCw } from 'lucide-react';
import { useChartStore, PanelId, type SettingsOpenRequest } from '../../lib/store/chart';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';
import { ChartSettingsDropdown } from './ChartSettingsDropdown';
import { PairSelector } from './PairSelector';
import { deleteSharedCandleCache } from '../../lib/feeds/candleCache';
import { deleteSharedFootprintCache } from '../../lib/aggregation/footprintCache';
import { deleteSharedVolumeProfileCache } from '../../lib/volumeProfile/profileCache';
import { getFineProfileBaseBucketSize } from '../../lib/config/markets';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

export function PanelToolbar({ panelId }: PanelToolbarProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const tickSize = useChartStore(s => s.tickSize);
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setChartMode = useChartStore(s => s.setChartMode);
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
  const settingsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = React.useRef<HTMLButtonElement | null>(null);

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
      <div className="flex gap-0.5 bg-[#0F0F0F] p-0.5 rounded-md border border-[#1F1F1F]">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(panelId, tf)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all duration-200 ${panel.timeframe === tf
              ? 'bg-[#1F1F1F] text-accent border border-[#252525] shadow-sm'
              : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
              }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-0.5 bg-[#0F0F0F] p-0.5 rounded-md border border-[#1F1F1F]">
        <button
          onClick={() => panel.chartMode !== 'candle' && setChartMode(panelId, 'candle')}
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-200 ${panel.chartMode === 'candle'
            ? 'bg-accent text-white shadow-sm shadow-accent/20'
            : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
            }`}
        >
          C
        </button>
        <button
          onClick={() => panel.chartMode !== 'footprint' && setChartMode(panelId, 'footprint')}
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-200 ${panel.chartMode === 'footprint'
            ? 'bg-accent text-white shadow-sm shadow-accent/20'
            : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
            }`}
        >
          F
        </button>
      </div>

      <div className="flex gap-0.5 bg-[#0F0F0F] p-0.5 rounded-md border border-[#1F1F1F]">
        <button
          type="button"
          onClick={() => selectPositionTool()}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight transition-all duration-200 ${
            panel.lineDrawMode === 'position'
              ? 'bg-[#3D7EFF] text-white shadow-sm shadow-[#3D7EFF]/20'
              : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
          }`}
          title="Position Tool (Drag Up for Short, Down for Long)"
          aria-pressed={panel.lineDrawMode === 'position'}
          aria-label="Position Tool"
        >
          <TrendingUp size={11} strokeWidth={2.5} />
          Position
        </button>
        <button
          type="button"
          onClick={() => selectTradeTool('buy')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-tight transition-all duration-200 ${
            panel.lineDrawMode === 'buy'
              ? 'bg-[#089981] text-white shadow-sm shadow-[#089981]/25'
              : 'text-[#089981] hover:text-white hover:bg-[#089981]/20'
          }`}
          title="Buy Market Order (Click chart to set Stop Loss)"
          aria-pressed={panel.lineDrawMode === 'buy'}
          aria-label="Buy Market Order"
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => selectTradeTool('sell')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-tight transition-all duration-200 ${
            panel.lineDrawMode === 'sell'
              ? 'bg-[#F23645] text-white shadow-sm shadow-[#F23645]/25'
              : 'text-[#F23645] hover:text-white hover:bg-[#F23645]/20'
          }`}
          title="Sell Market Order (Click chart to set Stop Loss)"
          aria-pressed={panel.lineDrawMode === 'sell'}
          aria-label="Sell Market Order"
        >
          SELL
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1 border-l border-[#1F1F1F] pl-3 h-5">
        <button
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
          className="h-6 w-6 flex items-center justify-center rounded border border-[#1F1F1F] bg-[#0F0F0F] text-[#787B86] transition-all duration-200 hover:border-accent/60 hover:text-[#E8E8E8]"
          title={`${panelId === 'left' ? 'Left' : 'Right'} panel refresh`}
          aria-label={`Refresh ${panelId} panel`}
        >
          <RefreshCw size={11} strokeWidth={2.5} />
        </button>

        <div ref={settingsContainerRef} className="relative">
          <button
            ref={settingsButtonRef}
            onClick={() => (showSettings ? setShowSettings(false) : openSettings())}
            className={`h-6 w-6 flex items-center justify-center rounded border transition-all duration-200 ${
              showSettings
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-[#1F1F1F] bg-[#0F0F0F] text-[#787B86] hover:border-accent/60 hover:text-[#E8E8E8]'
            }`}
            title={`${panelId === 'left' ? 'Left' : 'Right'} panel settings`}
            aria-label={`${panelId === 'left' ? 'Left' : 'Right'} panel settings`}
          >
            <Settings size={12} strokeWidth={2.5} />
          </button>

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

        <button
          onClick={() => setFocusMode(!focusMode)}
          className="h-6 w-6 flex items-center justify-center rounded border border-[#1F1F1F] bg-[#0F0F0F] text-[#787B86] transition-all duration-200 hover:border-accent/60 hover:text-[#E8E8E8]"
          title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          {focusMode ? <Minimize2 size={11} strokeWidth={2.5} /> : <Maximize2 size={11} strokeWidth={2.5} />}
        </button>
      </div>

    </div>
  );
}

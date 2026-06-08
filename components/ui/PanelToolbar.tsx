'use client';

import React from 'react';
import { Maximize2, Minimize2, Settings, TrendingDown, TrendingUp } from 'lucide-react';
import { useChartStore, PanelId, type SettingsOpenRequest } from '../../lib/store/chart';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';
import { ChartSettingsDropdown } from './ChartSettingsDropdown';
import { PairSelector } from './PairSelector';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

export function PanelToolbar({ panelId }: PanelToolbarProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);
  const setMeasureToolActive = useChartRuntimeStore(s => s.setMeasureToolActive);
  const focusMode = useChartStore(s => s.focusMode);
  const setFocusMode = useChartStore(s => s.setFocusMode);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const settingsOpenRequest = useChartStore(s => s.settingsOpenRequest);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settingsAnchor, setSettingsAnchor] = React.useState<{ x: number; y: number } | null>(null);
  const [settingsFocusRequest, setSettingsFocusRequest] = React.useState<SettingsOpenRequest | null>(null);
  const settingsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const selectPositionTool = React.useCallback((mode: 'long-position' | 'short-position') => {
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
          onClick={() => selectPositionTool('long-position')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight transition-all duration-200 ${
            panel.lineDrawMode === 'long-position'
              ? 'bg-[#089981] text-white shadow-sm shadow-[#089981]/20'
              : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
          }`}
          title="Long Position"
          aria-pressed={panel.lineDrawMode === 'long-position'}
          aria-label="Long Position"
        >
          <TrendingUp size={11} strokeWidth={2.5} />
          Long
        </button>
        <button
          type="button"
          onClick={() => selectPositionTool('short-position')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight transition-all duration-200 ${
            panel.lineDrawMode === 'short-position'
              ? 'bg-[#F23645] text-white shadow-sm shadow-[#F23645]/20'
              : 'text-text-dim hover:text-main hover:bg-[#1F1F1F]'
          }`}
          title="Short Position"
          aria-pressed={panel.lineDrawMode === 'short-position'}
          aria-label="Short Position"
        >
          <TrendingDown size={11} strokeWidth={2.5} />
          Short
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1 border-l border-[#1F1F1F] pl-3 h-5">
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

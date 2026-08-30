'use client';

import React from 'react';
import { ChevronDown, CandlestickChart, Activity, Circle, Check } from 'lucide-react';
import { useChartStore, PanelId } from '../../lib/store/chart';
import type { ChartMode } from '../../types/chart';

const CHART_MODE_OPTIONS: Array<{ label: string; value: ChartMode; desc: string; icon: React.ReactNode }> = [
  { label: 'Candlestick', value: 'candle', desc: 'Standard OHLC candlesticks', icon: <CandlestickChart size={14} strokeWidth={2.5} /> },
  { label: 'Hollow', value: 'hollow', desc: 'Hollow directional candles', icon: <Circle size={14} strokeWidth={2.5} /> },
  { label: 'Footprint', value: 'footprint', desc: 'Orderflow volume clusters', icon: <Activity size={14} strokeWidth={2.5} /> },
];

export function ChartModeSelector({ panelId = 'left' }: { panelId?: PanelId }) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentOption = CHART_MODE_OPTIONS.find(o => o.value === panel.chartMode) || CHART_MODE_OPTIONS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setActivePanel(panelId);
          setIsOpen(open => !open);
        }}
        className={`h-6 min-w-[100px] flex items-center justify-between gap-1.5 rounded-md border px-2 text-[11px] font-bold tracking-tight transition-all duration-150 ${
          isOpen
            ? 'border-accent bg-accent/10 text-accent shadow-sm shadow-accent/10'
            : 'border-[#1F1F1F] bg-[#0F0F0F] text-[#E8E8E8] hover:border-accent/60 hover:text-white'
        }`}
        title="Chart Mode"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          {currentOption.icon}
          <span>{currentOption.label}</span>
        </div>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-8 left-0 z-50 w-64 rounded-xl border border-[#262626] bg-[#121212] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="mb-2 px-2 pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#787B86]">
            Chart Mode
          </div>
          <div className="flex max-h-[400px] flex-col gap-0.5 overflow-y-auto custom-scrollbar">
            {CHART_MODE_OPTIONS.map(option => {
              const isActive = panel.chartMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isActive}
                  onClick={() => {
                    if (!isActive) {
                      setChartMode(panelId, option.value);
                    }
                    setIsOpen(false);
                  }}
                  className={`group flex items-center justify-between rounded-lg px-2 py-2 text-left transition-colors ${
                    isActive 
                      ? 'cursor-default bg-transparent opacity-50'
                      : 'hover:bg-[#1F1F1F] active:bg-[#262626]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-[12px] font-bold ${isActive ? 'text-[#787B86]' : 'text-[#E8E8E8]'}`}>
                      {option.label}
                    </span>
                    <span className="text-[10px] text-[#787B86]">{option.desc}</span>
                  </div>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isActive ? 'text-[#089981]' : 'text-[#787B86] group-hover:bg-[#262626] group-hover:text-accent'}`}>
                    {isActive ? <Check size={14} strokeWidth={2.5} /> : option.icon}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

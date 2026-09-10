'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FigButton, FigPopup, FigTooltip } from './fig';
import { useChartStore, PanelId } from '../../lib/store/chart';
import type { ChartMode } from '../../types/chart';

export function CandlestickIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <line x1="4.5" y1="2" x2="4.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="4" width="3" height="7" rx="0.5" fill="currentColor" />
      <line x1="11.5" y1="1" x2="11.5" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="10" y="6" width="3" height="7" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function HollowCandlestickIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <line x1="4.5" y1="2" x2="4.5" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4.5" y1="11" x2="4.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="4" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="11.5" y1="1" x2="11.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11.5" y1="13" x2="11.5" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="10" y="6" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function FootprintIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <rect x="2" y="3" width="5.5" height="3" rx="0.5" fill="currentColor" opacity="0.8" />
      <rect x="8.5" y="3" width="5.5" height="3" rx="0.5" fill="currentColor" />
      <rect x="2" y="6.5" width="5.5" height="3" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="6.5" width="5.5" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="2" y="10" width="5.5" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="8.5" y="10" width="5.5" height="3" rx="0.5" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export const CHART_MODE_OPTIONS: {
  value: ChartMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'candle',
    label: 'Candlestick',
    icon: <CandlestickIcon size={15} className="text-white" />,
  },
  {
    value: 'hollow',
    label: 'Hollow Candlestick',
    icon: <HollowCandlestickIcon size={15} className="text-white" />,
  },
  {
    value: 'footprint',
    label: 'Footprint',
    icon: <FootprintIcon size={15} className="text-white" />,
  },
];

export function ChartModeSelector({
  panelId = 'left',
  position = 'bottom left',
}: {
  panelId?: PanelId;
  position?: 'bottom left' | 'bottom right' | 'bottom center';
}) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = CHART_MODE_OPTIONS.find(o => o.value === panel.chartMode) || CHART_MODE_OPTIONS[0];
  const triggerId = `chart-mode-selector-trigger-${panelId}`;

  return (
    <div className="relative">
      <FigTooltip text={!isOpen ? 'Chart Mode' : ''}>
        <FigButton
          id={triggerId}
          variant="ghost"
          size="small"
          selected={isOpen}
          onClick={() => {
            setActivePanel(panelId);
            setIsOpen(open => !open);
          }}
          className="h-6 gap-1.5 px-2 text-[11px] font-bold tracking-tight cursor-pointer"
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
        </FigButton>
      </FigTooltip>

      <FigPopup
        open={isOpen}
        anchor={`#${triggerId}`}
        position={position}
        offset="0 4"
        mode="dropdown"
        onClose={() => setIsOpen(false)}
        className="z-50 w-56 rounded-xl border border-[#282828] bg-[#181818] p-2.5 shadow-2xl select-none"
      >
        <div className="flex flex-col gap-1 p-1">
          {CHART_MODE_OPTIONS.map(option => {
            const isActive = panel.chartMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    setChartMode(panelId, option.value);
                  }
                  setIsOpen(false);
                }}
                className={`flex items-center justify-start w-full px-3 py-2.5 min-h-[38px] rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer border ${isActive
                  ? 'border-[#383838] bg-[#2A2A2A] text-white shadow-sm'
                  : 'border-transparent text-[#CCCCCC] hover:bg-white/10 hover:text-white'
                  }`}
                aria-pressed={isActive}
                aria-label={option.label}
              >
                <span className={`mr-3 flex items-center shrink-0 ${isActive ? 'text-white' : 'text-[#909090]'}`}>
                  {option.icon}
                </span>
                <span className="text-left select-none">{option.label}</span>
              </button>
            );
          })}
        </div>
      </FigPopup>
    </div>
  );
}

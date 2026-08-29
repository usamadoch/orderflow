'use client';

import React from 'react';
import { useChartStore, PanelId, IndicatorId } from '@/lib/store/chart';
import { Plus, Check } from 'lucide-react';

interface IndicatorsModalProps {
  panelId: PanelId;
  onClose: () => void;
}

const AVAILABLE_INDICATORS: { id: IndicatorId; label: string; desc: string }[] = [
  { id: 'bubbles', label: 'Bubbles', desc: 'Volume bubbles overlaid on price' },
  { id: 'cvd', label: 'CVD', desc: 'Cumulative Volume Delta panel' },
  { id: 'volumeBars', label: 'Volume', desc: 'Volume histogram' },
  { id: 'sessions', label: 'Sessions', desc: 'Trading session backgrounds' },
  { id: 'historicalSessions', label: 'HSVP', desc: 'Historical Session Volume Profile' },
  { id: 'profile', label: 'VOP', desc: 'Visible Range Volume Profile' },
  { id: 'heatmap', label: 'Heatmap', desc: 'Orderbook liquidity heatmap' },
  { id: 'liquidityMap', label: 'Liquidity', desc: 'Orderbook liquidity map' },
  { id: 'stats', label: 'Stats', desc: 'Candle statistics grid' },
];

export function IndicatorsModal({ panelId, onClose }: IndicatorsModalProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const addIndicator = useChartStore(s => s.addIndicator);
  
  const effectiveActiveIndicators = Array.from(new Set([
    ...(panel.activeIndicators || ['volumeBars', 'stats']),
    ...(panel.bubblesEnabled ? ['bubbles'] : []),
    ...(panel.cvdEnabled ? ['cvd'] : []),
    ...(panel.volumeBarsEnabled ? ['volumeBars'] : []),
    ...(panel.sessionsEnabled ? ['sessions'] : []),
    ...(panel.historicalSessionProfileEnabled ? ['historicalSessions'] : []),
    ...(panel.defaultProfileEnabled ? ['profile'] : []),
    ...(panel.liquidityHeatmapEnabled ? ['heatmap'] : []),
    ...(panel.liquidityEnabled ? ['liquidityMap'] : []),
    ...(panel.statsIndicatorEnabled ? ['stats'] : []),
  ]));

  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={modalRef}
      className="absolute top-10 right-0 z-50 w-64 rounded-xl border border-[#262626] bg-[#121212] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="mb-2 px-2 pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#787B86]">
        Indicators
      </div>
      <div className="flex max-h-[400px] flex-col gap-0.5 overflow-y-auto">
        {AVAILABLE_INDICATORS.map((ind) => {
          const isActive = effectiveActiveIndicators.includes(ind.id as string);
          
          return (
            <button
              key={ind.id}
              onClick={() => {
                if (!isActive) {
                  addIndicator(panelId, ind.id);
                  onClose();
                }
              }}
              disabled={isActive}
              className={`flex items-center justify-between rounded-lg px-2 py-2 text-left transition-colors ${
                isActive 
                  ? 'cursor-default bg-transparent opacity-50'
                  : 'hover:bg-[#1F1F1F] active:bg-[#262626]'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-[12px] font-bold ${isActive ? 'text-[#787B86]' : 'text-[#E8E8E8]'}`}>
                  {ind.label}
                </span>
                <span className="text-[10px] text-[#787B86]">{ind.desc}</span>
              </div>
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isActive ? 'text-[#089981]' : 'text-[#787B86] group-hover:bg-[#262626] group-hover:text-accent'}`}>
                {isActive ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

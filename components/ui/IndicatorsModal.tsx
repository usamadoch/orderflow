'use client';

import React from 'react';
import { useChartStore, PanelId, IndicatorId } from '@/lib/store/chart';
import { FigPopup } from './fig';

interface IndicatorsModalProps {
  open?: boolean;
  anchor?: string | HTMLElement | null;
  panelId: PanelId;
  position?: 'bottom left' | 'bottom right' | 'bottom center';
  onClose: () => void;
}

const AVAILABLE_INDICATORS: { id: IndicatorId; label: string }[] = [
  { id: 'bubbles', label: 'Bubbles' },
  { id: 'cvd', label: 'CVD' },
  { id: 'volumeBars', label: 'Volume' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'historicalSessions', label: 'HSVP' },
  { id: 'profile', label: 'VOP' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'liquidityMap', label: 'Liquidity' },
  { id: 'stats', label: 'Stats' },
  { id: 'vwap', label: 'VWAP' },
];

export function IndicatorsModal({
  open = true,
  anchor,
  panelId,
  position = 'bottom left',
  onClose
}: IndicatorsModalProps) {
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
    ...(panel.vwapEnabled ? ['vwap'] : []),
  ]));

  return (
    <FigPopup
      open={open}
      anchor={anchor}
      position={position}
      offset="0 4"
      mode="dropdown"
      onClose={onClose}
      className="z-50 w-56 rounded-xl border border-[#282828] bg-[#181818] p-2.5 shadow-2xl select-none"
    >
      <div className="flex max-h-[390px] flex-col gap-1 overflow-y-auto custom-scrollbar p-1 pr-0.5">
        {AVAILABLE_INDICATORS.map((ind) => {
          const isActive = effectiveActiveIndicators.includes(ind.id as string);

          return (
            <button
              key={ind.id}
              type="button"
              onClick={() => {
                if (!isActive) {
                  addIndicator(panelId, ind.id);
                }
                onClose();
              }}
              className={`flex items-center justify-start w-full px-3 py-2.5 min-h-[38px] rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer border ${isActive
                  ? 'border-[#383838] bg-[#2A2A2A] text-white shadow-sm'
                  : 'border-transparent text-[#CCCCCC] hover:bg-white/10 hover:text-white'
                }`}
              aria-pressed={isActive}
              aria-label={ind.label}
            >
              <span className="text-left select-none">{ind.label}</span>
            </button>
          );
        })}
      </div>
    </FigPopup>
  );
}

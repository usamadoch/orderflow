'use client';

import { forwardRef } from 'react';
import { FigSwitch } from '../fig';
import { useChartStore, PanelId, StatsIndicatorItem } from '../../../lib/store/chart';

interface StatsSettingsProps {
  panelId: PanelId;
}

export const StatsSettings = forwardRef<HTMLDivElement, StatsSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setStatsIndicatorEnabled = useChartStore(s => s.setStatsIndicatorEnabled);
  const setStatsIndicatorItems = useChartStore(s => s.setStatsIndicatorItems);

  const statsOptions: { label: string; value: StatsIndicatorItem }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Delta', value: 'delta' },
    { label: 'CVD', value: 'cvd' },
  ];

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Stats Indicator</div>
        <FigSwitch
          checked={panel.statsIndicatorEnabled}
          onChange={(checked) => setStatsIndicatorEnabled(panelId, checked)}
          aria-label="Toggle Stats Indicator"
        />
      </div>

      {panel.statsIndicatorEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Select Stats</label>
            <div className="flex flex-col gap-2">
              {statsOptions.map((opt) => {
                const isSelected = panel.statsIndicatorItems.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414] hover:border-[#383838] transition-colors"
                  >
                    <span className="text-[11px] font-bold text-main">{opt.label}</span>
                    <FigSwitch
                      checked={isSelected}
                      onChange={(checked) => {
                        if (!checked) {
                          setStatsIndicatorItems(panelId, panel.statsIndicatorItems.filter(i => i !== opt.value));
                        } else {
                          setStatsIndicatorItems(panelId, [...panel.statsIndicatorItems, opt.value]);
                        }
                      }}
                      aria-label={`Toggle ${opt.label}`}
                    />
                  </div>
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
});
StatsSettings.displayName = 'StatsSettings';

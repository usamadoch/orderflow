import { forwardRef } from 'react';
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
});
StatsSettings.displayName = 'StatsSettings';

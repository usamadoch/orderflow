import { forwardRef } from 'react';
import { useChartStore, PanelId } from '../../../lib/store/chart';

interface FootprintSettingsProps {
  panelId: PanelId;
}

export const FootprintSettings = forwardRef<HTMLDivElement, FootprintSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setFootprintMode = useChartStore(s => s.setFootprintMode);

  if (panel.chartMode !== 'footprint') {
    return null;
  }

  return (
    <div ref={ref} className="space-y-4">
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
  );
});
FootprintSettings.displayName = 'FootprintSettings';

'use client';

import { forwardRef } from 'react';
import { FigSegmentedControl } from '../fig';
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

      <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Footprint Mode</label>
        <FigSegmentedControl
          full
          value={panel.footprintMode}
          onChange={(val) => setFootprintMode(panelId, val as 'bid-ask' | 'delta' | 'delta-volume')}
          options={[
            { value: 'bid-ask', label: 'Bid / Ask' },
            { value: 'delta', label: 'Delta' },
            { value: 'delta-volume', label: 'Delta + Vol' },
          ]}
        />
      </div>
    </div>
  );
});
FootprintSettings.displayName = 'FootprintSettings';

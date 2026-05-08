'use client';

import { useChartStore, PanelId } from '../../lib/store/chart';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

export function TimeframeSelector({ panelId = 'left' }: { panelId?: PanelId }) {
  const activeTimeframe = useChartStore(s => s.panels[panelId].timeframe);
  const setTimeframe = useChartStore(s => s.setTimeframe);

  return (
    <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(panelId, tf)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-200 ${activeTimeframe === tf
              ? 'bg-surface text-accent border border-border shadow-sm'
              : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

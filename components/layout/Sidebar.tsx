'use client';

import { Activity, BarChart3, Gauge, Settings } from 'lucide-react';
import { useChartStore } from '../../lib/store/chart';

export function Sidebar() {
  const activePanel = useChartStore(s => s.activePanel);
  const layoutMode = useChartStore(s => s.layoutMode);
  const panel = useChartStore(s => s.panels[s.activePanel]);

  const tools = [
    { icon: BarChart3, label: `${panel.pair} ${panel.timeframe}` },
    { icon: Activity, label: panel.chartMode === 'footprint' ? 'Footprint mode' : 'Candle mode' },
    { icon: Gauge, label: `Bucket ${panel.bucketSize} ticks` },
    { icon: Settings, label: 'Settings in top toolbar' },
  ];

  return (
    <aside className="font-sans flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface py-3 shadow-lg z-10">
      {layoutMode === 'dual' && (
        <div
          className="mb-3 flex h-6 w-6 items-center justify-center rounded border border-accent/30 bg-accent/10 text-[10px] font-black text-accent"
          title={`${activePanel === 'left' ? 'Left' : 'Right'} panel active`}
        >
          {activePanel === 'left' ? 'L' : 'R'}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center gap-2">
        {tools.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="group relative flex h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-background hover:text-accent"
            title={label}
          >
            <Icon size={17} strokeWidth={2.4} />
            <div className="pointer-events-none absolute left-10 z-50 hidden whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-[10px] font-bold text-main shadow-xl group-hover:block">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-black text-accent" title="OrderFlow">
        OF
      </div>
    </aside>
  );
}

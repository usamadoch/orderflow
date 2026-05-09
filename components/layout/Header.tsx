'use client';

import { useChartStore } from '../../lib/store/chart';
import { ConnectionStatus } from '../ui/ConnectionStatus';

export function Header() {
  const layoutMode = useChartStore(s => s.layoutMode);
  const setLayoutMode = useChartStore(s => s.setLayoutMode);
  const activePanelId = useChartStore(s => s.activePanel);
  const activePanel = useChartStore(s => s.panels[activePanelId]);
  const setFootprintMode = useChartStore(s => s.setFootprintMode);

  return (
    <header className="font-sans h-10 border-b border-border bg-surface flex items-center px-4 justify-between shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-6">
        <h1 className="font-extrabold text-base text-accent tracking-tighter flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          OrderFlow
        </h1>
        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Layout Toggle */}
        <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setLayoutMode('single')}
            className={`px-2 py-1 rounded-md transition-all duration-200 ${
              layoutMode === 'single'
                ? 'bg-surface text-accent border border-border shadow-sm'
                : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
            title="Single panel"
          >
            {/* Single rectangle icon */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0.5" y="0.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
          <button
            onClick={() => setLayoutMode('dual')}
            className={`px-2 py-1 rounded-md transition-all duration-200 ${
              layoutMode === 'dual'
                ? 'bg-surface text-accent border border-border shadow-sm'
                : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
            title="Dual panel"
          >
            {/* Two rectangles side by side icon */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0.5" y="0.5" width="6" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
              <rect x="7.5" y="0.5" width="6" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
        </div>

        {/* Footprint Mode Toggle — Tied to Active Panel */}
        {activePanel.chartMode === 'footprint' && (
          <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border ml-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <button
              onClick={() => setFootprintMode(activePanelId, 'bid-ask')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all duration-200 ${
                activePanel.footprintMode === 'bid-ask'
                  ? 'bg-surface text-accent border border-border shadow-sm'
                  : 'text-text-dim hover:text-main hover:bg-surface'
              }`}
            >
              Bid/Ask
            </button>
            <button
              onClick={() => setFootprintMode(activePanelId, 'delta')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all duration-200 ${
                activePanel.footprintMode === 'delta'
                  ? 'bg-surface text-accent border border-border shadow-sm'
                  : 'text-text-dim hover:text-main hover:bg-surface'
              }`}
            >
              Delta
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
      </div>
    </header>
  );
}

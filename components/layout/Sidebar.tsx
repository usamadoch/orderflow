'use client';

import { useChartStore } from '../../lib/store/chart';
import { ChevronLeft, ChevronRight, Settings, BarChart2, Zap, Database } from 'lucide-react';

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, tickSize, setTickSize } = useChartStore();

  return (
    <aside
      className={`border-r border-border bg-surface flex flex-col shrink-0 transition-all duration-300 ease-in-out z-10 shadow-lg ${sidebarCollapsed ? 'w-12' : 'w-52'
        }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border h-10">
        {!sidebarCollapsed && (
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-text-muted">Terminal</span>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-1 rounded-md hover:bg-background transition-colors text-text-dim hover:text-accent ${sidebarCollapsed ? 'mx-auto' : ''}`}
        >
          {sidebarCollapsed ? <ChevronRight size={16} strokeWidth={3} /> : <ChevronLeft size={16} strokeWidth={3} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-6">
        {/* Section: Settings */}
        <div className="px-3">
          {!sidebarCollapsed ? (
            <h2 className="text-text-muted text-[10px] uppercase font-extrabold tracking-widest mb-4 flex items-center gap-2">
              <Settings size={12} strokeWidth={3} />
              Data Settings
            </h2>
          ) : (
            <div className="flex justify-center mb-4 text-text-dim">
              <Settings size={18} strokeWidth={2.5} />
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              {!sidebarCollapsed ? (
                <>
                  <label className="text-[11px] font-bold text-text-dim flex justify-between items-center px-1">
                    Tick Size
                    <span className="text-[10px] font-mono text-accent/70 bg-accent/10 px-1 rounded">AUTO</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tickSize}
                    onChange={(e) => setTickSize(parseFloat(e.target.value) || 0.5)}
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs font-semibold focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all"
                  />
                </>
              ) : (
                <div className="group relative flex justify-center cursor-help">
                  <Database size={18} className="text-text-dim group-hover:text-accent transition-colors" />
                  <div className="absolute left-10 bg-surface border border-border px-2 py-1 rounded shadow-xl text-[10px] font-bold invisible group-hover:visible whitespace-nowrap z-50">
                    Tick: {tickSize}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="p-3 border-t border-border bg-background/50">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-[10px] font-black text-accent">OF</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-main leading-none">v0.1.0</span>
              <span className="text-[9px] font-bold text-text-muted leading-none">Standard License</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-[10px] font-black text-accent">OF</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

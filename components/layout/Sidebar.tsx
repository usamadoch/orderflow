'use client';

import { useChartStore } from '../../lib/store/chart';
import { ChevronLeft, ChevronRight, Settings, Database, Activity, Zap } from 'lucide-react';

export function Sidebar() {
  const sidebarCollapsed = useChartStore(s => s.sidebarCollapsed);
  const setSidebarCollapsed = useChartStore(s => s.setSidebarCollapsed);
  const tickSize = useChartStore(s => s.tickSize);
  const setTickSize = useChartStore(s => s.setTickSize);
  const activePanel = useChartStore(s => s.activePanel);
  const layoutMode = useChartStore(s => s.layoutMode);
  const panel = useChartStore(s => s.panels[s.activePanel]);
  
  // Absorption Stats
  const absSignals = Array.from(panel.absorptionMap.values()).filter(r => r.score >= panel.absorptionMinScore);
  const buyerAbs = absSignals.filter(r => r.direction === 'buyer').length;
  const sellerAbs = absSignals.filter(r => r.direction === 'seller').length;

  // Exhaustion Stats
  const exhSignals = Array.from(panel.exhaustionMap.values()).filter(r => r.score >= panel.exhaustionMinScore);
  const buyerExh = exhSignals.filter(r => r.direction === 'buyer').length;
  const sellerExh = exhSignals.filter(r => r.direction === 'seller').length;
  const lastExh = exhSignals.length > 0 ? exhSignals.sort((a, b) => b.candleTime - a.candleTime)[0] : null;
  const lastExhTimeStr = lastExh ? new Date(lastExh.candleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  // Iceberg Stats
  const icebergLevels = panel.icebergLevels.filter(level => level.score >= panel.icebergMinScore);
  const activeIcebergs = icebergLevels.filter(level => level.isActive).length;
  const confirmedIcebergs = icebergLevels.filter(level => level.rank === 'confirmed').length;
  const probableIcebergs = icebergLevels.filter(level => level.rank === 'probable').length;
  const lastIceberg = icebergLevels.length > 0 ? [...icebergLevels].sort((a, b) => b.detectedAt - a.detectedAt)[0] : null;
  const lastIcebergTimeStr = lastIceberg ? new Date(lastIceberg.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  // Liquidity Vacuum Stats
  const vacuumZones = panel.liquidityVacuumZones.filter(zone => zone.score >= panel.liquidityVacuumMinScore);
  const activeVacuums = vacuumZones.filter(zone => zone.isActive).length;
  const strongVacuums = vacuumZones.filter(zone => zone.rank === 'strong').length;
  const revisitedVacuums = vacuumZones.filter(zone => zone.revisited).length;
  const lastVacuum = vacuumZones.length > 0 ? [...vacuumZones].sort((a, b) => b.detectedAt - a.detectedAt)[0] : null;
  const lastVacuumTimeStr = lastVacuum ? new Date(lastVacuum.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  return (
    <aside
      className={`font-sans border-r border-border bg-surface flex flex-col shrink-0 transition-all duration-300 ease-in-out z-10 shadow-lg ${sidebarCollapsed ? 'w-12' : 'w-52'
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
        {/* Active Panel Indicator */}
        {layoutMode === 'dual' && (
          <div className="px-3">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded ${
                  activePanel === 'left' 
                    ? 'bg-accent/20 text-accent' 
                    : 'bg-accent/20 text-accent'
                }`}>
                  {activePanel === 'left' ? 'LEFT' : 'RIGHT'}
                </span>
                <span className="text-[10px] font-bold text-text-dim">
                  {panel.pair} · {panel.timeframe}
                </span>
              </div>
            ) : (
              <div className="flex justify-center mb-2">
                <span className="text-[9px] font-black text-accent">
                  {activePanel === 'left' ? 'L' : 'R'}
                </span>
              </div>
            )}
          </div>
        )}

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

        {/* Section: Signals Statistics */}
        <div className="px-3 flex flex-col gap-6">
          {/* Absorption Stats */}
          <div>
            {!sidebarCollapsed ? (
              <h2 className="text-text-muted text-[10px] uppercase font-extrabold tracking-widest mb-3 flex items-center gap-2">
                <Zap size={12} strokeWidth={3} className="text-[#26A69A]" />
                Absorption
              </h2>
            ) : (
              <div className="flex justify-center mb-3 text-[#26A69A]">
                <Zap size={18} strokeWidth={2.5} />
              </div>
            )}
            
            {!sidebarCollapsed && (
              <div className="flex flex-col gap-2 px-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Buyer signals</span>
                  <span className="font-mono font-bold text-[#EF5350]">{buyerAbs}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Seller signals</span>
                  <span className="font-mono font-bold text-[#26A69A]">{sellerAbs}</span>
                </div>
              </div>
            )}
          </div>

          {/* Exhaustion Stats */}
          <div>
            {!sidebarCollapsed ? (
              <h2 className="text-text-muted text-[10px] uppercase font-extrabold tracking-widest mb-3 flex items-center gap-2">
                <Activity size={12} strokeWidth={3} className="text-[#F0B90B]" />
                Exhaustion
              </h2>
            ) : (
              <div className="flex justify-center mb-3 text-[#F0B90B]">
                <Activity size={18} strokeWidth={2.5} />
              </div>
            )}
            
            {!sidebarCollapsed && (
              <div className="flex flex-col gap-2 px-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Buyer signals</span>
                  <span className="font-mono font-bold text-[#F0B90B]">{buyerExh}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Seller signals</span>
                  <span className="font-mono font-bold text-[#B39DDB]">{sellerExh}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1 pt-2 border-t border-border/50">
                  <span className="text-text-muted text-[9px] font-black uppercase">Last Signal</span>
                  <div className="flex gap-1.5 items-center">
                    <span className="font-mono font-bold text-main">{lastExhTimeStr}</span>
                    <span className={`text-[9px] font-black uppercase ${
                      lastExh?.rank === 'extreme' ? 'text-[#F0B90B]' : 'text-text-dim'
                    }`}>{lastExh?.rank || 'NONE'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Iceberg Stats */}
          <div>
            {!sidebarCollapsed ? (
              <h2 className="text-text-muted text-[10px] uppercase font-extrabold tracking-widest mb-3 flex items-center gap-2">
                <Activity size={12} strokeWidth={3} className="text-[#26A69A]" />
                Iceberg
              </h2>
            ) : (
              <div className="flex justify-center mb-3 text-[#26A69A]">
                <Activity size={18} strokeWidth={2.5} />
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="flex flex-col gap-2 px-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Active levels</span>
                  <span className="font-mono font-bold text-[#26A69A]">{activeIcebergs}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Confirmed</span>
                  <span className="font-mono font-bold text-[#26A69A]">{confirmedIcebergs}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Probable</span>
                  <span className="font-mono font-bold text-[#EF5350]">{probableIcebergs}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1 pt-2 border-t border-border/50">
                  <span className="text-text-muted text-[9px] font-black uppercase">Last Detected</span>
                  <span className="font-mono font-bold text-main">{lastIcebergTimeStr}</span>
                </div>
              </div>
            )}
          </div>

          {/* Liquidity Vacuum Stats */}
          <div>
            {!sidebarCollapsed ? (
              <h2 className="text-text-muted text-[10px] uppercase font-extrabold tracking-widest mb-3 flex items-center gap-2">
                <Zap size={12} strokeWidth={3} className="text-[#3D7EFF]" />
                Vacuum
              </h2>
            ) : (
              <div className="flex justify-center mb-3 text-[#3D7EFF]">
                <Zap size={18} strokeWidth={2.5} />
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="flex flex-col gap-2 px-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Active zones</span>
                  <span className="font-mono font-bold text-[#3D7EFF]">{activeVacuums}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Strong</span>
                  <span className="font-mono font-bold text-[#3D7EFF]">{strongVacuums}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-dim font-bold">Revisited</span>
                  <span className="font-mono font-bold text-[#F0B90B]">{revisitedVacuums}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1 pt-2 border-t border-border/50">
                  <span className="text-text-muted text-[9px] font-black uppercase">Last Zone</span>
                  <span className="font-mono font-bold text-main">{lastVacuumTimeStr}</span>
                </div>
              </div>
            )}
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
              <span className="text-[10px] font-bold text-main leading-none">v0.2.0</span>
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

'use client';

import { useState, useEffect, useRef } from 'react';
import { BarChart2, Layers, Zap, X, Clock } from 'lucide-react';
import { useChartStore, PanelId, BubbleSide, ExhaustionSide, AbsorptionSide, SessionId } from '../../lib/store/chart';

interface ChartSettingsDropdownProps {
  panelId: PanelId;
  onClose: () => void;
}

export function ChartSettingsDropdown({ panelId, onClose }: ChartSettingsDropdownProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setFootprintMode = useChartStore(s => s.setFootprintMode);
  const setBucketSize = useChartStore(s => s.setBucketSize);
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setBubbleThreshold = useChartStore(s => s.setBubbleThreshold);
  const setBubbleThresholdMode = useChartStore(s => s.setBubbleThresholdMode);
  const setBubbleSide = useChartStore(s => s.setBubbleSide);
  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setExhaustionMinScore = useChartStore(s => s.setExhaustionMinScore);
  const setExhaustionSide = useChartStore(s => s.setExhaustionSide);
  const setExhaustionLookback = useChartStore(s => s.setExhaustionLookback);
  const setExhaustionShowProvisional = useChartStore(s => s.setExhaustionShowProvisional);
  const setAbsorptionEnabled = useChartStore(s => s.setAbsorptionEnabled);
  const setAbsorptionMinScore = useChartStore(s => s.setAbsorptionMinScore);
  const setAbsorptionSide = useChartStore(s => s.setAbsorptionSide);
  const setProfileWidthPct = useChartStore(s => s.setProfileWidthPct);
  const setProfileOpacity = useChartStore(s => s.setProfileOpacity);
  const setProfileMinRowWidth = useChartStore(s => s.setProfileMinRowWidth);
  const setProfileScaleMode = useChartStore(s => s.setProfileScaleMode);
  const setProfileShowPocHighlight = useChartStore(s => s.setProfileShowPocHighlight);
  const setProfileShowVaFill = useChartStore(s => s.setProfileShowVaFill);
  const setProfileShowPocLine = useChartStore(s => s.setProfileShowPocLine);
  const setProfileShowVaLines = useChartStore(s => s.setProfileShowVaLines);
  const setProfileShowDelta = useChartStore(s => s.setProfileShowDelta);
  const setDeltaProfileWidth = useChartStore(s => s.setDeltaProfileWidth);
  const setAutoBucketSize = useChartStore(s => s.setAutoBucketSize);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setSessionEnabled = useChartStore(s => s.setSessionEnabled);
  const setSessionTime = useChartStore(s => s.setSessionTime);
  const setSessionColor = useChartStore(s => s.setSessionColor);

  const [localThreshold, setLocalThreshold] = useState(String(panel.bubbleThreshold));
  const [activeTab, setActiveTab] = useState<'chart' | 'profiles' | 'signals' | 'sessions'>('chart');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Draggable Logic ---
  const [position, setPosition] = useState({ x: -1, y: 48 }); // -1 means initial center/right
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize position once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && position.x === -1) {
      const width = 440; // New width
      setPosition({ x: window.innerWidth - width - 16, y: 48 });
    }
  }, [position.x]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header, not buttons/inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      // Clamp to screen bounds
      const width = 440;
      const height = dropdownRef.current?.offsetHeight || 600;
      
      newX = Math.max(8, Math.min(newX, window.innerWidth - width - 8));
      newY = Math.max(8, Math.min(newY, window.innerHeight - height - 8));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);
  // --- End Draggable Logic ---

  // Sync local when store changes
  useEffect(() => {
    setLocalThreshold(String(panel.bubbleThreshold));
  }, [panel.bubbleThreshold]);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalThreshold(raw);
    const val = Number(raw);
    if (!isNaN(val) && val >= 1) {
      setBubbleThreshold(panelId, val);
    }
  };

  const bubbleSides: { label: string; value: BubbleSide }[] = [
    { label: 'Buy', value: 'buy' },
    { label: 'Sell', value: 'sell' },
    { label: 'Both', value: 'both' },
  ];

  const tabs = [
    { id: 'chart', label: 'Chart', icon: BarChart2 },
    { id: 'profiles', label: 'Profiles', icon: Layers },
    { id: 'signals', label: 'Signals', icon: Zap },
    { id: 'sessions', label: 'Sessions', icon: Clock },
  ] as const;

  return (
    <div
      ref={dropdownRef}
      className={`fixed w-[440px] bg-[#0D0D0D]/95 backdrop-blur-xl border border-[#1F1F1F] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden transition-shadow duration-200 ${isDragging ? 'shadow-accent/20 ring-1 ring-accent/20' : ''}`}
      style={{ 
        left: position.x === -1 ? 'auto' : position.x,
        top: position.y,
        right: position.x === -1 ? '16px' : 'auto',
        maxHeight: 'calc(100vh - 32px)',
        userSelect: isDragging ? 'none' : 'auto'
      }}
    >
      {/* Header / Drag Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={`p-4 border-b border-[#1F1F1F] flex items-center justify-between bg-[#080808]/50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">Settings</h3>
            <span className="text-[9px] font-bold text-text-dim/60 uppercase tracking-tighter">{panelId} Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center text-text-dim/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-main transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-32 bg-[#080808]/50 border-r border-[#1F1F1F] flex flex-col p-1.5 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${activeTab === tab.id
                ? 'bg-accent/10 text-accent shadow-[inset_0_0_10px_rgba(61,126,255,0.05)]'
                : 'text-text-dim hover:text-main hover:bg-[#151515]'
                }`}
            >
              <tab.icon size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-40'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="flex flex-col gap-8">
            {/* Tab: Chart */}
            {activeTab === 'chart' && (
              <>
                {/* Bucket Size */}
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Aggregation</div>
                  <div className="flex items-center justify-between bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                    <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAutoBucketSize(panelId, !panel.autoBucketSize)}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.autoBucketSize
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-[#0D0D0D] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        Auto
                      </button>
                      <input
                        type="number"
                        value={panel.bucketSize}
                        disabled={panel.autoBucketSize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) setBucketSize(panelId, val);
                        }}
                        className={`w-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold transition-all text-main ${panel.autoBucketSize ? 'opacity-50 cursor-not-allowed' : 'focus:border-accent focus:outline-none'}`}
                        min="1"
                      />
                      <span className="text-[9px] text-text-dim font-black uppercase">Ticks</span>
                    </div>
                  </div>
                </div>

                {/* Volume Bubble Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume Bubbles</div>
                    <button
                      onClick={() => setBubblesEnabled(panelId, !panel.bubblesEnabled)}
                      className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.bubblesEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                        }`}
                    >
                      <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.bubblesEnabled ? 'left-5' : 'left-1'
                        }`} />
                    </button>
                  </div>

                  {panel.bubblesEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center justify-between bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Volume</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBubbleThresholdMode(panelId, panel.bubbleThresholdMode === 'absolute' ? 'relative' : 'absolute')}
                            className="px-2 py-1 bg-[#1A1A1A] border border-[#1F1F1F] rounded text-[10px] font-black text-text-dim hover:text-main transition-colors uppercase"
                          >
                            {panel.bubbleThresholdMode === 'absolute' ? 'Fixed (BTC)' : 'Adaptive (x Avg)'}
                          </button>
                          <input
                            type="number"
                            value={localThreshold}
                            onChange={handleThresholdChange}
                            step={panel.bubbleThresholdMode === 'relative' ? "0.5" : "1"}
                            className="w-20 bg-[#0D0D0D] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                            min="0.1"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
                        <div className="flex gap-1">
                          {bubbleSides.map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => setBubbleSide(panelId, value)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.bubbleSide === value
                                ? 'bg-[#1A1A1A] border-accent text-accent'
                                : 'bg-[#0D0D0D] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tab: Sessions */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Session Visualization</div>
                  <button
                    onClick={() => setSessionsEnabled(panelId, !panel.sessionsEnabled)}
                    className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.sessionsEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                      }`}
                  >
                    <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.sessionsEnabled ? 'left-5' : 'left-1'
                      }`} />
                  </button>
                </div>

                <div className="space-y-6 pt-2">
                  {(['tokyo', 'london', 'newYork'] as SessionId[]).map((sid) => {
                    const session = panel.sessions[sid];
                    const label = sid.toUpperCase().replace('YORK', ' YORK');
                    return (
                      <div key={sid} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
                          <span className="text-[9px] font-bold font-mono tracking-tighter" style={{ color: session.color }}>
                            {label}
                          </span>
                          <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSessionEnabled(panelId, sid, !session.enabled)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 ${session.enabled
                              ? 'bg-accent/5 border-accent text-accent'
                              : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                              }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">Enabled</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${session.enabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                          </button>

                          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1F1F1F] bg-[#080808]">
                            <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Color</span>
                            <input
                              type="color"
                              value={session.color}
                              onChange={(e) => setSessionColor(panelId, sid, e.target.value)}
                              className="w-4 h-4 bg-transparent border-none cursor-pointer outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1.5 bg-[#080808] p-2 rounded-lg border border-[#1F1F1F]">
                            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Start Time (UTC)</label>
                            <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={session.startHour}
                                  onChange={(e) => setSessionTime(panelId, sid, 'startHour', Number(e.target.value))}
                                  className="w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                                  min="0" max="23" step="1"
                                />
                              <span className="text-text-dim/40">:</span>
                              <select
                                value={session.startMin}
                                onChange={(e) => setSessionTime(panelId, sid, 'startMin', Number(e.target.value))}
                                className="w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                              >
                                <option value="0">00</option>
                                <option value="30">30</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 bg-[#080808] p-2 rounded-lg border border-[#1F1F1F]">
                            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">End Time (UTC)</label>
                            <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={session.endHour}
                                  onChange={(e) => setSessionTime(panelId, sid, 'endHour', Number(e.target.value))}
                                  className="w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main"
                                  min="0" max="23" step="1"
                                />
                              <span className="text-text-dim/40">:</span>
                              <select
                                value={session.endMin}
                                onChange={(e) => setSessionTime(panelId, sid, 'endMin', Number(e.target.value))}
                                className="w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main appearance-none cursor-pointer"
                              >
                                <option value="0">00</option>
                                <option value="30">30</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab: Profiles */}
            {activeTab === 'profiles' && (
              <>
                {/* Footprint Settings */}
                {panel.chartMode === 'footprint' && (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Footprint Configuration</div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFootprintMode(panelId, 'bid-ask')}
                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all duration-200 ${panel.footprintMode === 'bid-ask'
                          ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(38,166,154,0.1)]'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <div className="text-[11px] font-black">BID / ASK</div>
                        <div className="text-[9px] opacity-50 font-medium">Side-by-side</div>
                      </button>
                      <button
                        onClick={() => setFootprintMode(panelId, 'delta')}
                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all duration-200 ${panel.footprintMode === 'delta'
                          ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(38,166,154,0.1)]'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <div className="text-[11px] font-black">DELTA</div>
                        <div className="text-[9px] opacity-50 font-medium">Net volume</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Volume Profile Settings */}
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume Profile</div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scaling</label>
                        <div className="flex gap-1 w-24">
                          {(['linear', 'sqrt'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => setProfileScaleMode(panelId, m)}
                              className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.profileScaleMode === m
                                ? 'bg-[#1A1A1A] border-accent text-accent'
                                : 'bg-[#0D0D0D] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Width</label>
                        <span className="text-[12px] font-mono font-bold text-accent">{panel.profileWidthPct}%</span>
                      </div>
                      <input
                        type="range"
                        value={panel.profileWidthPct}
                        onChange={(e) => setProfileWidthPct(panelId, Number(e.target.value))}
                        className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent"
                        min="10" max="100" step="5"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
                        <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.profileOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        value={panel.profileOpacity * 100}
                        onChange={(e) => setProfileOpacity(panelId, Number(e.target.value) / 100)}
                        className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent"
                        min="10" max="100" step="5"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Row Width</label>
                        <span className="text-[12px] font-mono font-bold text-accent">
                          {panel.profileMinRowWidth === 0 ? 'OFF' : `${panel.profileMinRowWidth}px`}
                        </span>
                      </div>
                      <input
                        type="range"
                        value={panel.profileMinRowWidth}
                        onChange={(e) => setProfileMinRowWidth(panelId, Number(e.target.value))}
                        className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent"
                        min="0" max="8" step="1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => setProfileShowPocHighlight(panelId, !panel.profileShowPocHighlight)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocHighlight
                          ? 'bg-accent/5 border-accent text-accent'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">POC Highlight</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocHighlight ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>

                      <button
                        onClick={() => setProfileShowVaFill(panelId, !panel.profileShowVaFill)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaFill
                          ? 'bg-accent/5 border-accent text-accent'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">VA Area Fill</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaFill ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>

                      <button
                        onClick={() => setProfileShowPocLine(panelId, !panel.profileShowPocLine)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocLine
                          ? 'bg-accent/5 border-accent text-accent'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">POC Line</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocLine ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>

                      <button
                        onClick={() => setProfileShowVaLines(panelId, !panel.profileShowVaLines)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaLines
                          ? 'bg-accent/5 border-accent text-accent'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">VA Lines</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaLines ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>

                      <button
                        onClick={() => setProfileShowDelta(panelId, !panel.profileShowDelta)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowDelta
                          ? 'bg-accent/5 border-accent text-accent'
                          : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">Show Delta</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowDelta ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                      </button>
                    </div>

                    {panel.profileShowDelta && (
                      <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Delta Width</label>
                          <span className="text-[12px] font-mono font-bold text-accent">{panel.deltaProfileWidth}px</span>
                        </div>
                        <input
                          type="range"
                          value={panel.deltaProfileWidth}
                          onChange={(e) => setDeltaProfileWidth(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent"
                          min="40" max="160" step="5"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab: Signals */}
            {activeTab === 'signals' && (
              <>
                {/* Absorption Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Absorption Signals</div>
                    <button
                      onClick={() => setAbsorptionEnabled(panelId, !panel.absorptionEnabled)}
                      className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.absorptionEnabled ? 'bg-[#26A69A]' : 'bg-[#1F1F1F]'
                        }`}
                    >
                      <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.absorptionEnabled ? 'left-5' : 'left-1'
                        }`} />
                    </button>
                  </div>

                  {panel.absorptionEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                          <span className="text-[12px] font-mono font-bold text-[#26A69A]">{panel.absorptionMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.absorptionMinScore}
                          onChange={(e) => setAbsorptionMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-[#26A69A]"
                          min="30" max="90" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-2 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
                        <div className="flex gap-1">
                          {(['buyer', 'seller', 'both'] as AbsorptionSide[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setAbsorptionSide(panelId, s)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.absorptionSide === s
                                ? 'bg-[#1A1A1A] border-[#26A69A] text-[#26A69A]'
                                : 'bg-[#0D0D0D] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exhaustion Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Exhaustion Signals</div>
                    <button
                      onClick={() => setExhaustionEnabled(panelId, !panel.exhaustionEnabled)}
                      className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.exhaustionEnabled ? 'bg-[#F0B90B]' : 'bg-[#1F1F1F]'
                        }`}
                    >
                      <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.exhaustionEnabled ? 'left-5' : 'left-1'
                        }`} />
                    </button>
                  </div>

                  {panel.exhaustionEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                          <span className="text-[12px] font-mono font-bold text-[#F0B90B]">{panel.exhaustionMinScore}</span>
                        </div>
                        <input
                          type="range"
                          value={panel.exhaustionMinScore}
                          onChange={(e) => setExhaustionMinScore(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-[#F0B90B]"
                          min="30" max="90" step="5"
                        />
                      </div>

                      <div className="flex flex-col gap-2 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
                        <div className="flex gap-1">
                          {(['buyer', 'seller', 'both'] as ExhaustionSide[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setExhaustionSide(panelId, s)}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.exhaustionSide === s
                                ? 'bg-[#1A1A1A] border-[#F0B90B] text-[#F0B90B]'
                                : 'bg-[#0D0D0D] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                                }`}
                            >
                              {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Lookback window</label>
                          <span className="text-[12px] font-mono font-bold text-accent">{panel.exhaustionLookback} Candles</span>
                        </div>
                        <input
                          type="range"
                          value={panel.exhaustionLookback}
                          onChange={(e) => setExhaustionLookback(panelId, Number(e.target.value))}
                          className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent"
                          min="3" max="8" step="1"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
                        <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Show on live candle</label>
                        <button
                          onClick={() => setExhaustionShowProvisional(panelId, !panel.exhaustionShowProvisional)}
                          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.exhaustionShowProvisional ? 'bg-[#3D7EFF]' : 'bg-[#1F1F1F]'
                            }`}
                        >
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.exhaustionShowProvisional ? 'left-5' : 'left-1'
                            }`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[#1F1F1F] bg-[#080808]/50">
        <div className="text-[9px] text-text-dim/40 text-center font-medium uppercase tracking-widest">
          Global Settings • {panelId} Panel
        </div>
      </div>
    </div>
  );
}

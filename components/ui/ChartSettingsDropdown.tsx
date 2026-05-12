'use client';

import { useState, useEffect, useRef } from 'react';
import { useChartStore, PanelId, BubbleSide, ExhaustionSide } from '../../lib/store/chart';

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
  const setBubbleSide = useChartStore(s => s.setBubbleSide);
  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setExhaustionMinScore = useChartStore(s => s.setExhaustionMinScore);
  const setExhaustionSide = useChartStore(s => s.setExhaustionSide);
  const setExhaustionLookback = useChartStore(s => s.setExhaustionLookback);
  const setExhaustionShowProvisional = useChartStore(s => s.setExhaustionShowProvisional);
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

  const [localThreshold, setLocalThreshold] = useState(String(panel.bubbleThreshold));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync local when store changes
  useEffect(() => {
    setLocalThreshold(String(panel.bubbleThreshold));
  }, [panel.bubbleThreshold]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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

  return (
    <div
      ref={dropdownRef}
      className="absolute top-12 right-4 w-72 bg-[#0D0D0D]/95 backdrop-blur-xl border border-[#1F1F1F] rounded-xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">Chart Settings</h3>
          <span className="text-[10px] font-bold text-text-dim px-2 py-0.5 bg-[#1A1A1A] rounded uppercase">{panelId} Panel</span>
        </div>

        {/* Footprint Settings */}
        {panel.chartMode === 'footprint' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Footprint Configuration</div>

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

            <div className="flex items-center justify-between bg-[#080808] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={panel.bucketSize}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val > 0) setBucketSize(panelId, val);
                  }}
                  className="w-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main"
                  min="1"
                />
                <span className="text-[9px] text-text-dim font-black uppercase">Ticks</span>
              </div>
            </div>
          </div>
        )}

        {/* Volume Bubble Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Volume Bubbles</div>
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
                <input
                  type="number"
                  value={localThreshold}
                  onChange={handleThresholdChange}
                  className="w-20 bg-[#0D0D0D] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="1"
                />
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
          {/* Exhaustion Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Exhaustion Signals</div>
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
        </div>

        {/* Volume Profile Settings */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Volume Profile</div>

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
                  ? 'bg-accent/5 border-accent/20 text-accent'
                  : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">POC Highlight</span>
                <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocHighlight ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>

              <button
                onClick={() => setProfileShowVaFill(panelId, !panel.profileShowVaFill)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaFill
                  ? 'bg-accent/5 border-accent/20 text-accent'
                  : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">VA Area Fill</span>
                <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaFill ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>

              <button
                onClick={() => setProfileShowPocLine(panelId, !panel.profileShowPocLine)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocLine
                  ? 'bg-accent/5 border-accent/20 text-accent'
                  : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">POC Line</span>
                <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocLine ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>

              <button
                onClick={() => setProfileShowVaLines(panelId, !panel.profileShowVaLines)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaLines
                  ? 'bg-accent/5 border-accent/20 text-accent'
                  : 'bg-[#080808] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">VA Lines</span>
                <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaLines ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>

              <button
                onClick={() => setProfileShowDelta(panelId, !panel.profileShowDelta)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowDelta
                  ? 'bg-accent/5 border-accent/20 text-accent'
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

          {/* Footer info */}
          <div className="pt-2 border-t border-[#1F1F1F]">
            <div className="text-[9px] text-text-dim/50 text-center font-medium">Settings apply to the currently focused panel</div>
          </div>
        </div>
      </div>
    </div>
  );
}

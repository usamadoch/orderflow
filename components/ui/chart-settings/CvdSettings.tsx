import { forwardRef } from 'react';
import { useChartStore, PanelId, CvdMode, CvdResetMode, CvdScaleMode } from '../../../lib/store/chart';

interface CvdSettingsProps {
  panelId: PanelId;
}

export const CvdSettings = forwardRef<HTMLDivElement, CvdSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setCvdEnabled = useChartStore(s => s.setCvdEnabled);
  const setCvdMode = useChartStore(s => s.setCvdMode);
  const setCvdResetMode = useChartStore(s => s.setCvdResetMode);
  const setCvdScaleMode = useChartStore(s => s.setCvdScaleMode);
  const setCvdPanelHeightPct = useChartStore(s => s.setCvdPanelHeightPct);
  const setCvdSmoothing = useChartStore(s => s.setCvdSmoothing);
  const setCvdFixedRange = useChartStore(s => s.setCvdFixedRange);
  const setCvdPositiveColor = useChartStore(s => s.setCvdPositiveColor);
  const setCvdNegativeColor = useChartStore(s => s.setCvdNegativeColor);
  const setCvdShowDivergence = useChartStore(s => s.setCvdShowDivergence);
  const setCvdDivergenceLookback = useChartStore(s => s.setCvdDivergenceLookback);
  const setCvdMinimized = useChartStore(s => s.setCvdMinimized);

  const cvdModes: { label: string; value: CvdMode }[] = [
    { label: 'Candles', value: 'candles' },
    { label: 'Bars', value: 'bars' },
    { label: 'Line', value: 'line' },
    { label: 'Hist', value: 'histogram' },
  ];
  const cvdResetModes: { label: string; value: CvdResetMode }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Session', value: 'session' },
    { label: 'None', value: 'none' },
  ];
  const cvdScaleModes: { label: string; value: CvdScaleMode }[] = [
    { label: 'Auto', value: 'auto' },
    { label: 'Fixed', value: 'fixed' },
  ];

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">CVD</div>
        <button
          onClick={() => setCvdEnabled(panelId, !panel.cvdEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.cvdEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'}`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.cvdEnabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {panel.cvdEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-4 gap-1.5">
            {cvdModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setCvdMode(panelId, mode.value)}
                className={`py-2 rounded-lg border text-[9px] font-black uppercase transition-all duration-200 ${panel.cvdMode === mode.value
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCvdMinimized(panelId, !panel.cvdMinimized)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.cvdMinimized
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Compact Mode</span>
            <span className="text-[9px] font-black uppercase tracking-wider">{panel.cvdMinimized ? 'Minimized' : 'Expanded'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Reset</label>
              <select
                value={panel.cvdResetMode}
                onChange={(e) => setCvdResetMode(panelId, e.target.value as CvdResetMode)}
                className="bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1.5 text-[11px] font-bold text-main focus:border-accent focus:outline-none"
              >
                {cvdResetModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale</label>
              <div className="flex gap-1">
                {cvdScaleModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setCvdScaleMode(panelId, mode.value)}
                    className={`flex-1 py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.cvdScaleMode === mode.value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Height</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdPanelHeightPct}%</span>
            </div>
            <input
              type="range"
              value={panel.cvdPanelHeightPct}
              onChange={(e) => setCvdPanelHeightPct(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="12" max="45" step="1"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Smoothing</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdSmoothing <= 1 ? 'OFF' : `${panel.cvdSmoothing}`}</span>
            </div>
            <input
              type="range"
              value={panel.cvdSmoothing}
              onChange={(e) => setCvdSmoothing(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="1" max="50" step="1"
            />
          </div>

          {panel.cvdScaleMode === 'fixed' && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Fixed Range</label>
              <input
                type="number"
                value={panel.cvdFixedRange}
                onChange={(e) => setCvdFixedRange(panelId, Number(e.target.value) || 1)}
                className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1.5 text-[11px] font-mono font-bold text-main focus:border-accent focus:outline-none"
                min="1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Positive</span>
              <input
                type="color"
                value={panel.cvdPositiveColor}
                onChange={(e) => setCvdPositiveColor(panelId, e.target.value)}
                className="w-8 h-6 bg-transparent border-0 p-0 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Negative</span>
              <input
                type="color"
                value={panel.cvdNegativeColor}
                onChange={(e) => setCvdNegativeColor(panelId, e.target.value)}
                className="w-8 h-6 bg-transparent border-0 p-0 cursor-pointer"
              />
            </label>
          </div>

          <button
            onClick={() => setCvdShowDivergence(panelId, !panel.cvdShowDivergence)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.cvdShowDivergence
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Divergence Markers</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.cvdShowDivergence ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          {panel.cvdShowDivergence && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Divergence Lookback</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.cvdDivergenceLookback}</span>
              </div>
              <input
                type="range"
                value={panel.cvdDivergenceLookback}
                onChange={(e) => setCvdDivergenceLookback(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="3" max="30" step="1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
CvdSettings.displayName = 'CvdSettings';

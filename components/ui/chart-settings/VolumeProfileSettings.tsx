import { forwardRef } from 'react';
import { useChartStore, PanelId } from '../../../lib/store/chart';

interface VolumeProfileSettingsProps {
  panelId: PanelId;
}

export const VolumeProfileSettings = forwardRef<HTMLDivElement, VolumeProfileSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setDefaultProfileEnabled = useChartStore(s => s.setDefaultProfileEnabled);
  const setProfileScaleMode = useChartStore(s => s.setProfileScaleMode);
  const setProfileResolutionTicks = useChartStore(s => s.setProfileResolutionTicks);
  const setProfileWidthPct = useChartStore(s => s.setProfileWidthPct);
  const setProfileOpacity = useChartStore(s => s.setProfileOpacity);
  const setProfileMinRowWidth = useChartStore(s => s.setProfileMinRowWidth);
  const setProfileMinRowHeight = useChartStore(s => s.setProfileMinRowHeight);
  const setProfileShowPocHighlight = useChartStore(s => s.setProfileShowPocHighlight);
  const setProfileShowVaFill = useChartStore(s => s.setProfileShowVaFill);
  const setProfileShowPocLine = useChartStore(s => s.setProfileShowPocLine);
  const setProfileShowVaLines = useChartStore(s => s.setProfileShowVaLines);
  const setProfileShowDelta = useChartStore(s => s.setProfileShowDelta);
  const setDeltaProfileWidth = useChartStore(s => s.setDeltaProfileWidth);
  
  const tickSize = useChartStore(s => s.tickSize);

  const handleProfileResolutionChange = (val: number) => {
    setProfileResolutionTicks(panelId, val);
  };

  const maxProfileResolutionTicks = 100;
  let profileRowSizeLabel = 'Auto';
  if (panel.profileResolutionTicks > 0) {
    if (tickSize > 0) {
      profileRowSizeLabel = `${panel.profileResolutionTicks} Ticks (${(panel.profileResolutionTicks * tickSize).toFixed(Math.max(0, -Math.floor(Math.log10(tickSize))))})`;
    } else {
      profileRowSizeLabel = `${panel.profileResolutionTicks} Ticks`;
    }
  }

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume Profile</div>

      <div className="space-y-3">
        <button
          onClick={() => setDefaultProfileEnabled(panelId, !panel.defaultProfileEnabled)}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.defaultProfileEnabled
            ? 'bg-accent/5 border-accent text-accent'
            : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">Default Profile</span>
          <div className={`w-1.5 h-1.5 rounded-full ${panel.defaultProfileEnabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
        </button>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scaling</label>
            <div className="flex gap-1 w-24">
              {(['linear', 'sqrt'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setProfileScaleMode(panelId, m)}
                  title={m === 'linear' ? 'True proportions - best for shape reading' : 'Amplifies low volume - best for activity presence'}
                  className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.profileScaleMode === m
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Row Size</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {profileRowSizeLabel}
            </span>
          </div>
          <input
            type="range"
            value={panel.profileResolutionTicks}
            onChange={(e) => handleProfileResolutionChange(Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0"
            max={maxProfileResolutionTicks}
            step="1"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Width</label>
            <span className="text-[12px] font-mono font-bold text-accent">{panel.profileWidthPct}%</span>
          </div>
          <input
            type="range"
            value={panel.profileWidthPct}
            onChange={(e) => setProfileWidthPct(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="10" max="100" step="5"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
            <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.profileOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            value={panel.profileOpacity * 100}
            onChange={(e) => setProfileOpacity(panelId, Number(e.target.value) / 100)}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="10" max="100" step="5"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
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
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0" max="8" step="1"
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Row Height</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {panel.profileMinRowHeight === 0 ? 'OFF' : `${panel.profileMinRowHeight}px`}
            </span>
          </div>
          <input
            type="range"
            value={panel.profileMinRowHeight}
            onChange={(e) => setProfileMinRowHeight(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0" max="4" step="0.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setProfileShowPocHighlight(panelId, !panel.profileShowPocHighlight)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocHighlight
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">POC Highlight</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocHighlight ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowVaFill(panelId, !panel.profileShowVaFill)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaFill
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">VA Area Fill</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaFill ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowPocLine(panelId, !panel.profileShowPocLine)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowPocLine
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">POC Line</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowPocLine ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowVaLines(panelId, !panel.profileShowVaLines)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowVaLines
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">VA Lines</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowVaLines ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>

          <button
            onClick={() => setProfileShowDelta(panelId, !panel.profileShowDelta)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.profileShowDelta
              ? 'bg-accent/5 border-accent text-accent'
              : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Show Delta</span>
            <div className={`w-1.5 h-1.5 rounded-full ${panel.profileShowDelta ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
          </button>
        </div>

        {panel.profileShowDelta && (
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Delta Width</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.deltaProfileWidth}px</span>
            </div>
            <input
              type="range"
              value={panel.deltaProfileWidth}
              onChange={(e) => setDeltaProfileWidth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="40" max="160" step="5"
            />
          </div>
        )}
      </div>
    </div>
  );
});
VolumeProfileSettings.displayName = 'VolumeProfileSettings';

import { forwardRef } from 'react';
import { useChartStore, PanelId } from '../../../lib/store/chart';
import type { VolumeProfileType, VolumeBarsInputData } from '../../../types/chart';

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
  const setProfileType = useChartStore(s => s.setProfileType);
  const setDeltaProfileWidth = useChartStore(s => s.setDeltaProfileWidth);
  const setProfileNodeSensitivity = useChartStore(s => s.setProfileNodeSensitivity);
  const setProfileInputData = useChartStore(s => s.setProfileInputData);
  const setProfileFilterMin = useChartStore(s => s.setProfileFilterMin);
  const setProfileFilterMax = useChartStore(s => s.setProfileFilterMax);
  const setProfilePocColor = useChartStore(s => s.setProfilePocColor);
  const setProfilePocWidth = useChartStore(s => s.setProfilePocWidth);
  const setProfileHvnColor = useChartStore(s => s.setProfileHvnColor);
  const setProfileLvnColor = useChartStore(s => s.setProfileLvnColor);
  const setDefaultProfilePeriod = useChartStore(s => s.setDefaultProfilePeriod);
  const setProfilePeriodValue = useChartStore(s => s.setProfilePeriodValue);
  const setProfilePeriodUnit = useChartStore(s => s.setProfilePeriodUnit);
  
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

        {panel.defaultProfileEnabled && (
          <div className="flex justify-between items-center bg-[#1F1F1F] p-2 rounded-lg border border-[#333]">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-wide">Period</label>
            <div className="flex gap-1">
              {[
                { id: 'visible', label: 'Visible' },
                { id: 'latest', label: 'Latest' },
                { id: 'composite', label: 'Composite' },
                { id: 'periodic', label: 'Periodic' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDefaultProfilePeriod(panelId, t.id as 'visible' | 'latest' | 'composite' | 'periodic')}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all duration-200 border ${
                    panel.defaultProfilePeriod === t.id
                      ? 'bg-[#2A2A2A] border-accent text-accent'
                      : 'bg-transparent border-transparent text-text-dim hover:text-text-main'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {panel.defaultProfileEnabled && panel.defaultProfilePeriod === 'periodic' && (
          <div className="flex gap-2 items-center bg-[#1F1F1F] p-2 rounded-lg border border-[#333]">
            <input
              type="number"
              min="1"
              value={panel.profilePeriodValue || 4}
              onChange={(e) => setProfilePeriodValue(panelId, parseInt(e.target.value) || 1)}
              className="w-16 bg-[#181818] border border-[#444] rounded px-2 py-1 text-[11px] text-main font-bold outline-none"
            />
            <select
              value={panel.profilePeriodUnit || 'hours'}
              onChange={(e) => setProfilePeriodUnit(panelId, e.target.value as 'minutes' | 'hours' | 'days')}
              className="flex-1 bg-[#181818] border border-[#444] rounded px-2 py-1 text-[11px] text-main font-bold outline-none appearance-none cursor-pointer"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Input Data</label>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {[
              { id: 'volume', label: 'Volume' },
              { id: 'orders', label: 'Order Count' },
              { id: 'aggregateTrades', label: 'Agg Trades' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setProfileInputData(panelId, t.id as VolumeBarsInputData)}
                className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all duration-200 border ${
                  panel.profileInputData === t.id
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Profile Type</label>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'volume', label: 'Volume' },
              { id: 'bidAsk', label: 'Ask/Bid Split' },
              { id: 'delta', label: 'Delta' },
              { id: 'deltaVolume', label: 'Delta + Volume' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setProfileType(panelId, t.id as VolumeProfileType)}
                className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all duration-200 border ${
                  panel.profileType === t.id
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Threshold Filter</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={panel.profileFilterMin ?? ''}
              onChange={(e) => setProfileFilterMin(panelId, e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Min"
              className="flex-1 bg-black border border-[#333] rounded px-2 py-1.5 text-xs text-text-dim focus:outline-none focus:border-accent text-center font-mono placeholder:text-[#333]"
            />
            <span className="text-text-dim/50 font-bold">-</span>
            <input
              type="number"
              value={panel.profileFilterMax ?? ''}
              onChange={(e) => setProfileFilterMax(panelId, e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Max"
              className="flex-1 bg-black border border-[#333] rounded px-2 py-1.5 text-xs text-text-dim focus:outline-none focus:border-accent text-center font-mono placeholder:text-[#333]"
            />
          </div>
        </div>

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

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Node Sensitivity</label>
            <span className="text-[12px] font-mono font-bold text-accent">
              {Math.round(panel.profileNodeSensitivity * 100)}%
            </span>
          </div>
          <input
            type="range"
            value={panel.profileNodeSensitivity}
            onChange={(e) => setProfileNodeSensitivity(panelId, Number(e.target.value))}
            className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
            min="0" max="1" step="0.05"
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
        </div>

        {(panel.profileType === 'delta' || panel.profileType === 'deltaVolume') && (
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
        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Cosmetics</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-dim/80 uppercase">POC Color</label>
              <input
                type="color"
                value={panel.profilePocColor || '#F0B90B'}
                onChange={(e) => setProfilePocColor(panelId, e.target.value)}
                className="w-full h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-dim/80 uppercase">HVN Color</label>
              <input
                type="color"
                value={panel.profileHvnColor || '#F43F5E'}
                onChange={(e) => setProfileHvnColor(panelId, e.target.value)}
                className="w-full h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-dim/80 uppercase">LVN Color</label>
              <input
                type="color"
                value={panel.profileLvnColor || '#22D3EE'}
                onChange={(e) => setProfileLvnColor(panelId, e.target.value)}
                className="w-full h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-dim/80 uppercase">POC Width</label>
              <select
                value={panel.profilePocWidth || 1}
                onChange={(e) => setProfilePocWidth(panelId, parseInt(e.target.value))}
                className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1 text-[11px] text-main font-bold appearance-none cursor-pointer"
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={4}>4px</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
VolumeProfileSettings.displayName = 'VolumeProfileSettings';

import { forwardRef } from 'react';
import { useChartStore, PanelId, VolumeBarsInputData, VolumeBarsFilterMode, VolumeBarsColorMode } from '../../../lib/store/chart';

interface VolumeBarsSettingsProps {
  panelId: PanelId;
}

export const VolumeBarsSettings = forwardRef<HTMLDivElement, VolumeBarsSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setVolumeBarsEnabled = useChartStore(s => s.setVolumeBarsEnabled);
  const setVolumeBarsInputData = useChartStore(s => s.setVolumeBarsInputData);
  const setVolumeBarsFilterMode = useChartStore(s => s.setVolumeBarsFilterMode);
  const setVolumeBarsMovingAverageLength = useChartStore(s => s.setVolumeBarsMovingAverageLength);
  const setVolumeBarsFilterMin = useChartStore(s => s.setVolumeBarsFilterMin);
  const setVolumeBarsFilterMax = useChartStore(s => s.setVolumeBarsFilterMax);
  const setVolumeBarsColorMode = useChartStore(s => s.setVolumeBarsColorMode);
  const setVolumeBarsOpacity = useChartStore(s => s.setVolumeBarsOpacity);
  const setVolumeBarsHeightPct = useChartStore(s => s.setVolumeBarsHeightPct);
  const setVolumeBarsShowValueText = useChartStore(s => s.setVolumeBarsShowValueText);
  const setVolumeBarsTextSize = useChartStore(s => s.setVolumeBarsTextSize);
  const setVolumeBarsAverageLineEnabled = useChartStore(s => s.setVolumeBarsAverageLineEnabled);
  const setVolumeBarsAverageLength = useChartStore(s => s.setVolumeBarsAverageLength);

  const volumeBarsInputOptions: { label: string; value: VolumeBarsInputData }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Orders', value: 'orders' },
    { label: 'Agg Trades', value: 'aggregateTrades' },
  ];
  const volumeBarsColorModes: { label: string; value: VolumeBarsColorMode }[] = [
    { label: 'Fixed', value: 'fixed' },
    { label: 'Direction', value: 'priceDirection' },
    { label: 'Delta', value: 'delta' },
    { label: 'Slope', value: 'volumeSlope' },
  ];

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Volume</div>
        <button
          onClick={() => setVolumeBarsEnabled(panelId, !panel.volumeBarsEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.volumeBarsEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.volumeBarsEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.volumeBarsEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Input Data</label>
              <span className="text-[11px] font-mono font-bold text-accent">
                {volumeBarsInputOptions.find((option) => option.value === panel.volumeBarsInputData)?.label ?? 'Volume'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {volumeBarsInputOptions.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVolumeBarsInputData(panelId, value)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsInputData === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Filter Mode</label>
              <span className="text-[11px] font-mono font-bold text-accent">
                {panel.volumeBarsFilterMode === 'relative' ? 'Relative' : 'Absolute'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {['absolute', 'relative'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setVolumeBarsFilterMode(panelId, mode as VolumeBarsFilterMode)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsFilterMode === mode
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {panel.volumeBarsFilterMode === 'relative' && (
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">MA Length</label>
              <input
                type="number"
                value={panel.volumeBarsMovingAverageLength}
                onChange={(e) => setVolumeBarsMovingAverageLength(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="1"
                step="1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min {panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}</label>
              <input
                type="number"
                value={panel.volumeBarsFilterMin}
                onChange={(e) => setVolumeBarsFilterMin(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0"
                step={panel.volumeBarsFilterMode === 'relative' ? '0.1' : '1'}
              />
            </div>

            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Max {panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}</label>
              <input
                type="number"
                value={panel.volumeBarsFilterMax}
                onChange={(e) => setVolumeBarsFilterMax(panelId, Number(e.target.value))}
                className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0"
                step={panel.volumeBarsFilterMode === 'relative' ? '0.1' : '1'}
              />
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Color Mode</label>
            <div className="grid grid-cols-4 gap-1">
              {volumeBarsColorModes.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVolumeBarsColorMode(panelId, value)}
                  className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.volumeBarsColorMode === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
                <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.volumeBarsOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsOpacity * 100}
                onChange={(e) => setVolumeBarsOpacity(panelId, Number(e.target.value) / 100)}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="10"
                max="100"
                step="5"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Height</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsHeightPct}%</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsHeightPct}
                onChange={(e) => setVolumeBarsHeightPct(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="8"
                max="35"
                step="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setVolumeBarsShowValueText(panelId, !panel.volumeBarsShowValueText)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.volumeBarsShowValueText
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Show Values</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.volumeBarsShowValueText ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>

            <button
              onClick={() => setVolumeBarsAverageLineEnabled(panelId, !panel.volumeBarsAverageLineEnabled)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.volumeBarsAverageLineEnabled
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Average Line</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.volumeBarsAverageLineEnabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Text Size</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsTextSize}px</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsTextSize}
                onChange={(e) => setVolumeBarsTextSize(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="8"
                max="16"
                step="1"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Average Len</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.volumeBarsAverageLength}</span>
              </div>
              <input
                type="range"
                value={panel.volumeBarsAverageLength}
                onChange={(e) => setVolumeBarsAverageLength(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1"
                max="200"
                step="1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
VolumeBarsSettings.displayName = 'VolumeBarsSettings';

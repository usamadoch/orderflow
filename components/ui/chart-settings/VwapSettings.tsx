import { forwardRef } from 'react';
import { useChartStore, PanelId } from '../../../lib/store/chart';

interface VwapSettingsProps {
  panelId: PanelId;
}

export const VwapSettings = forwardRef<HTMLDivElement, VwapSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore((s) => s.panels[panelId]);
  const setVwapSettings = useChartStore((s) => s.setVwapSettings);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const addIndicator = useChartStore((s) => s.addIndicator);

  const toggleVwap = () => {
    if (panel.vwapEnabled) {
      removeIndicator(panelId, 'vwap');
    } else {
      addIndicator(panelId, 'vwap');
    }
  };

  if (!setVwapSettings) return null; // Safe guard for testing before store updates propagate

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">VWAP</div>
        <button
          onClick={toggleVwap}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
            panel.vwapEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
          }`}
        >
          <div
            className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${
              panel.vwapEnabled ? 'left-5' : 'left-1'
            }`}
          />
        </button>
      </div>

      {panel.vwapEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Mode</label>
              <div className="grid grid-cols-2 gap-1 bg-[#0F0F0F] p-1 rounded-md">
                {(['Session', 'Rolling'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVwapSettings(panelId, { vwapPeriodMode: mode })}
                    className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                      panel.vwapPeriodMode === mode
                        ? 'bg-[#2A2A2A] text-accent'
                        : 'text-text-dim hover:text-[#E8E8E8]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">
                {panel.vwapPeriodMode === 'Session' ? 'Anchor' : 'Lookback'}
              </label>
              {panel.vwapPeriodMode === 'Session' ? (
                <div className="grid grid-cols-3 gap-1 bg-[#0F0F0F] p-1 rounded-md">
                  {(['Day', 'Week', 'Month'] as const).map((anchor) => (
                    <button
                      key={anchor}
                      onClick={() => setVwapSettings(panelId, { vwapSessionAnchor: anchor })}
                      className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                        panel.vwapSessionAnchor === anchor
                          ? 'bg-[#2A2A2A] text-accent'
                          : 'text-text-dim hover:text-[#E8E8E8]'
                      }`}
                    >
                      {anchor.charAt(0)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={panel.vwapRollingDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 1 && val <= 30) {
                        setVwapSettings(panelId, { vwapRollingDays: val });
                      }
                    }}
                    className="w-16 bg-[#0F0F0F] text-[#E8E8E8] text-[11px] font-bold px-2 py-1.5 rounded border border-[#2A2A2A] focus:outline-none focus:border-accent text-center"
                  />
                  <span className="text-[11px] text-text-dim">Days</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Envelope Mode</label>
            <div className="grid grid-cols-2 gap-1 bg-[#0F0F0F] p-1 rounded-md">
              {(['Standard Deviation', 'Percentage'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVwapSettings(panelId, { vwapEnvelopeMode: mode })}
                  className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                    panel.vwapEnvelopeMode === mode
                      ? 'bg-[#2A2A2A] text-accent'
                      : 'text-text-dim hover:text-[#E8E8E8]'
                  }`}
                >
                  {mode === 'Standard Deviation' ? 'Std Dev' : 'Percentage'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bands</label>
            <div className="space-y-2">
              {/* Band 1 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVwapSettings(panelId, { vwapBand1Enabled: !panel.vwapBand1Enabled })}
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                    panel.vwapBand1Enabled
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-[#333] text-transparent hover:border-accent/50'
                  }`}
                >
                  <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current" aria-hidden="true">
                    <path d="M11.667 3.5L5.25 9.917L2.333 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
                <span className="text-[11px] font-bold text-text-dim w-12">Band 1</span>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={panel.vwapBand1Value}
                  onChange={(e) => setVwapSettings(panelId, { vwapBand1Value: parseFloat(e.target.value) || 1 })}
                  className="w-16 bg-[#0F0F0F] text-[#E8E8E8] text-[11px] font-bold px-2 py-1 rounded border border-[#2A2A2A] focus:outline-none focus:border-accent text-center"
                />
              </div>

              {/* Band 2 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVwapSettings(panelId, { vwapBand2Enabled: !panel.vwapBand2Enabled })}
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                    panel.vwapBand2Enabled
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-[#333] text-transparent hover:border-accent/50'
                  }`}
                >
                  <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current" aria-hidden="true">
                    <path d="M11.667 3.5L5.25 9.917L2.333 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
                <span className="text-[11px] font-bold text-text-dim w-12">Band 2</span>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={panel.vwapBand2Value}
                  onChange={(e) => setVwapSettings(panelId, { vwapBand2Value: parseFloat(e.target.value) || 2 })}
                  className="w-16 bg-[#0F0F0F] text-[#E8E8E8] text-[11px] font-bold px-2 py-1 rounded border border-[#2A2A2A] focus:outline-none focus:border-accent text-center"
                />
              </div>

              {/* Band 3 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVwapSettings(panelId, { vwapBand3Enabled: !panel.vwapBand3Enabled })}
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                    panel.vwapBand3Enabled
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-[#333] text-transparent hover:border-accent/50'
                  }`}
                >
                  <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current" aria-hidden="true">
                    <path d="M11.667 3.5L5.25 9.917L2.333 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
                <span className="text-[11px] font-bold text-text-dim w-12">Band 3</span>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={panel.vwapBand3Value}
                  onChange={(e) => setVwapSettings(panelId, { vwapBand3Value: parseFloat(e.target.value) || 3 })}
                  className="w-16 bg-[#0F0F0F] text-[#E8E8E8] text-[11px] font-bold px-2 py-1 rounded border border-[#2A2A2A] focus:outline-none focus:border-accent text-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
VwapSettings.displayName = 'VwapSettings';

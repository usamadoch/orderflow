'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, FigSelect, PropskitSlider, PropskitNumber } from '../fig';
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
        <FigSwitch
          checked={panel.vwapEnabled}
          onChange={() => toggleVwap()}
          aria-label="Toggle VWAP"
        />
      </div>

      {panel.vwapEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Mode</label>
              <FigSegmentedControl
                full
                value={panel.vwapPeriodMode}
                onChange={(mode: string) => setVwapSettings(panelId, { vwapPeriodMode: mode as 'Session' | 'Rolling' })}
                options={[
                  { value: 'Session', label: 'Session' },
                  { value: 'Rolling', label: 'Rolling' },
                ]}
                title="Period Mode"
                aria-label="Period Mode"
              />
            </div>

            <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">
                {panel.vwapPeriodMode === 'Session' ? 'Anchor' : 'Lookback'}
              </label>
              {panel.vwapPeriodMode === 'Session' ? (
                <FigSelect
                  className="w-full"
                  value={panel.vwapSessionAnchor}
                  onChange={(anchor: string) => setVwapSettings(panelId, { vwapSessionAnchor: anchor as 'Day' | 'Week' | 'Month' })}
                  options={[
                    { value: 'Day', label: 'Day' },
                    { value: 'Week', label: 'Week' },
                    { value: 'Month', label: 'Month' },
                  ]}
                  label="Anchor"
                />
              ) : (
                <PropskitSlider
                  label="Days"
                  value={panel.vwapRollingDays}
                  min={1}
                  max={30}
                  step={1}
                  units="d"
                  onChange={(val: number) => setVwapSettings(panelId, { vwapRollingDays: val })}
                />
              )}
            </div>
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Envelope Mode</label>
            <FigSelect
              className="w-full"
              value={panel.vwapEnvelopeMode}
              onChange={(mode: string) => setVwapSettings(panelId, { vwapEnvelopeMode: mode as 'Standard Deviation' | 'Percentage' })}
              options={[
                { value: 'Standard Deviation', label: 'Standard Deviation' },
                { value: 'Percentage', label: 'Percentage' },
              ]}
              label="Envelope Mode"
            />
          </div>

          <div className="space-y-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bands</label>
            <div className="space-y-2.5">
              {/* Band 1 */}
              <div className="flex items-center justify-between gap-3 p-2 bg-[#0F0F0F] rounded-md border border-[#2A2A2A]">
                <div className="flex items-center gap-2.5">
                  <FigSwitch
                    checked={panel.vwapBand1Enabled}
                    onChange={(chk: boolean) => setVwapSettings(panelId, { vwapBand1Enabled: chk })}
                    aria-label="Enable Band 1"
                  />
                  <span className="text-[11px] font-bold text-text-dim">Band 1</span>
                </div>
                <div className="w-44">
                  <PropskitNumber
                    label="Multiplier"
                    value={panel.vwapBand1Value}
                    min={0.1}
                    max={10}
                    step={0.1}
                    precision={1}
                    disabled={!panel.vwapBand1Enabled}
                    onChange={(val: number) => setVwapSettings(panelId, { vwapBand1Value: val })}
                  />
                </div>
              </div>

              {/* Band 2 */}
              <div className="flex items-center justify-between gap-3 p-2 bg-[#0F0F0F] rounded-md border border-[#2A2A2A]">
                <div className="flex items-center gap-2.5">
                  <FigSwitch
                    checked={panel.vwapBand2Enabled}
                    onChange={(chk: boolean) => setVwapSettings(panelId, { vwapBand2Enabled: chk })}
                    aria-label="Enable Band 2"
                  />
                  <span className="text-[11px] font-bold text-text-dim">Band 2</span>
                </div>
                <div className="w-44">
                  <PropskitNumber
                    label="Multiplier"
                    value={panel.vwapBand2Value}
                    min={0.1}
                    max={10}
                    step={0.1}
                    precision={1}
                    disabled={!panel.vwapBand2Enabled}
                    onChange={(val: number) => setVwapSettings(panelId, { vwapBand2Value: val })}
                  />
                </div>
              </div>

              {/* Band 3 */}
              <div className="flex items-center justify-between gap-3 p-2 bg-[#0F0F0F] rounded-md border border-[#2A2A2A]">
                <div className="flex items-center gap-2.5">
                  <FigSwitch
                    checked={panel.vwapBand3Enabled}
                    onChange={(chk: boolean) => setVwapSettings(panelId, { vwapBand3Enabled: chk })}
                    aria-label="Enable Band 3"
                  />
                  <span className="text-[11px] font-bold text-text-dim">Band 3</span>
                </div>
                <div className="w-44">
                  <PropskitNumber
                    label="Multiplier"
                    value={panel.vwapBand3Value}
                    min={0.1}
                    max={10}
                    step={0.1}
                    precision={1}
                    disabled={!panel.vwapBand3Enabled}
                    onChange={(val: number) => setVwapSettings(panelId, { vwapBand3Value: val })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
VwapSettings.displayName = 'VwapSettings';

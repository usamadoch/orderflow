'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, PropskitSlider, PropskitNumber } from '../fig';
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
        <FigSwitch
          checked={panel.cvdEnabled}
          onChange={(checked) => setCvdEnabled(panelId, checked)}
          aria-label="Toggle CVD"
        />
      </div>

      {panel.cvdEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">CVD Mode</label>
            <FigSegmentedControl
              full
              value={panel.cvdMode}
              onChange={(val) => setCvdMode(panelId, val as CvdMode)}
              options={cvdModes.map(m => ({ label: m.label, value: m.value }))}
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[11px] font-bold text-main">Compact Mode</span>
            <FigSwitch
              checked={panel.cvdMinimized}
              onChange={(checked) => setCvdMinimized(panelId, checked)}
              aria-label="Toggle Compact Mode"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Reset</label>
              <FigSegmentedControl
                full
                value={panel.cvdResetMode}
                onChange={(val) => setCvdResetMode(panelId, val as CvdResetMode)}
                options={cvdResetModes.map(m => ({ label: m.label, value: m.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale</label>
              <FigSegmentedControl
                full
                value={panel.cvdScaleMode}
                onChange={(val) => setCvdScaleMode(panelId, val as CvdScaleMode)}
                options={cvdScaleModes.map(m => ({ label: m.label, value: m.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Height"
              value={panel.cvdPanelHeightPct}
              min={12}
              max={45}
              step={1}
              units="%"
              onChange={(val) => setCvdPanelHeightPct(panelId, val)}
              onInput={(val) => setCvdPanelHeightPct(panelId, val)}
            />

            <PropskitSlider
              label="Smoothing"
              value={panel.cvdSmoothing}
              min={1}
              max={50}
              step={1}
              onChange={(val) => setCvdSmoothing(panelId, val)}
              onInput={(val) => setCvdSmoothing(panelId, val)}
            />
          </div>

          {panel.cvdScaleMode === 'fixed' && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitNumber
                label="Fixed Range"
                value={panel.cvdFixedRange}
                min={1}
                step={1}
                onChange={(val) => setCvdFixedRange(panelId, val || 1)}
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

          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[11px] font-bold text-main">Divergence Markers</span>
            <FigSwitch
              checked={panel.cvdShowDivergence}
              onChange={(checked) => setCvdShowDivergence(panelId, checked)}
              aria-label="Toggle Divergence Markers"
            />
          </div>

          {panel.cvdShowDivergence && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Divergence Lookback"
                value={panel.cvdDivergenceLookback}
                min={3}
                max={30}
                step={1}
                onChange={(val) => setCvdDivergenceLookback(panelId, val)}
                onInput={(val) => setCvdDivergenceLookback(panelId, val)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
CvdSettings.displayName = 'CvdSettings';

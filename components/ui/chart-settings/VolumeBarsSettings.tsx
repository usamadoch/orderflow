'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, PropskitSlider, PropskitNumber } from '../fig';
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
        <FigSwitch
          checked={panel.volumeBarsEnabled}
          onChange={(checked) => setVolumeBarsEnabled(panelId, checked)}
          aria-label="Toggle Volume"
        />
      </div>

      {panel.volumeBarsEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Input Data</label>
            <FigSegmentedControl
              full
              value={panel.volumeBarsInputData}
              onChange={(val) => setVolumeBarsInputData(panelId, val as VolumeBarsInputData)}
              options={volumeBarsInputOptions.map(({ label, value }) => ({ label, value }))}
            />
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Filter Mode</label>
            <FigSegmentedControl
              full
              value={panel.volumeBarsFilterMode}
              onChange={(val) => setVolumeBarsFilterMode(panelId, val as VolumeBarsFilterMode)}
              options={[
                { label: 'Absolute', value: 'absolute' },
                { label: 'Relative', value: 'relative' },
              ]}
            />
          </div>

          {panel.volumeBarsFilterMode === 'relative' && (
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitNumber
                label="MA Length"
                value={panel.volumeBarsMovingAverageLength}
                min={1}
                step={1}
                onChange={(val) => setVolumeBarsMovingAverageLength(panelId, val)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitNumber
                label={`Min ${panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}`}
                value={panel.volumeBarsFilterMin}
                min={0}
                step={panel.volumeBarsFilterMode === 'relative' ? 0.1 : 1}
                onChange={(val) => setVolumeBarsFilterMin(panelId, val)}
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitNumber
                label={`Max ${panel.volumeBarsFilterMode === 'relative' ? '(x)' : ''}`}
                value={panel.volumeBarsFilterMax}
                min={0}
                step={panel.volumeBarsFilterMode === 'relative' ? 0.1 : 1}
                onChange={(val) => setVolumeBarsFilterMax(panelId, val)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Color Mode</label>
            <FigSegmentedControl
              full
              value={panel.volumeBarsColorMode}
              onChange={(val) => setVolumeBarsColorMode(panelId, val as VolumeBarsColorMode)}
              options={volumeBarsColorModes.map(({ label, value }) => ({ label, value }))}
            />
          </div>

          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Opacity"
              value={Math.round(panel.volumeBarsOpacity * 100)}
              min={10}
              max={100}
              step={5}
              units="%"
              onChange={(val) => setVolumeBarsOpacity(panelId, val / 100)}
              onInput={(val) => setVolumeBarsOpacity(panelId, val / 100)}
            />

            <PropskitSlider
              label="Height"
              value={panel.volumeBarsHeightPct}
              min={8}
              max={35}
              step={1}
              units="%"
              onChange={(val) => setVolumeBarsHeightPct(panelId, val)}
              onInput={(val) => setVolumeBarsHeightPct(panelId, val)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <span className="text-[11px] font-bold text-main">Show Values</span>
              <FigSwitch
                checked={panel.volumeBarsShowValueText}
                onChange={(checked) => setVolumeBarsShowValueText(panelId, checked)}
                aria-label="Toggle Show Values"
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <span className="text-[11px] font-bold text-main">Average Line</span>
              <FigSwitch
                checked={panel.volumeBarsAverageLineEnabled}
                onChange={(checked) => setVolumeBarsAverageLineEnabled(panelId, checked)}
                aria-label="Toggle Average Line"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Text Size"
              value={panel.volumeBarsTextSize}
              min={8}
              max={16}
              step={1}
              units="px"
              onChange={(val) => setVolumeBarsTextSize(panelId, val)}
              onInput={(val) => setVolumeBarsTextSize(panelId, val)}
            />

            <PropskitSlider
              label="Average Len"
              value={panel.volumeBarsAverageLength}
              min={1}
              max={200}
              step={1}
              onChange={(val) => setVolumeBarsAverageLength(panelId, val)}
              onInput={(val) => setVolumeBarsAverageLength(panelId, val)}
            />
          </div>
        </div>
      )}
    </div>
  );
});
VolumeBarsSettings.displayName = 'VolumeBarsSettings';

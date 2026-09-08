'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, PropskitSlider, PropskitNumber, FigSelect } from '../fig';
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
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#1F1F1F] bg-[#1F1F1F]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Default Profile</span>
          <FigSwitch
            checked={panel.defaultProfileEnabled}
            onChange={(checked) => setDefaultProfileEnabled(panelId, checked)}
            aria-label="Toggle Default Profile"
          />
        </div>

        {panel.defaultProfileEnabled && (
          <div className="flex justify-between items-center bg-[#1F1F1F] p-2 rounded-lg border border-[#333]">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-wide">Period</label>
            <FigSegmentedControl
              value={panel.defaultProfilePeriod}
              onChange={(val) => setDefaultProfilePeriod(panelId, val as 'visible' | 'latest' | 'composite' | 'periodic')}
              options={[
                { value: 'visible', label: 'Visible' },
                { value: 'latest', label: 'Latest' },
                { value: 'composite', label: 'Composite' },
                { value: 'periodic', label: 'Periodic' },
              ]}
            />
          </div>
        )}

        {panel.defaultProfileEnabled && panel.defaultProfilePeriod === 'periodic' && (
          <div className="flex gap-2 items-center bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
            <PropskitNumber
              value={panel.profilePeriodValue || 4}
              min={1}
              step={1}
              onChange={(val) => setProfilePeriodValue(panelId, val || 1)}
              className="w-20"
            />
            <FigSelect
              value={panel.profilePeriodUnit || 'hours'}
              onChange={(val) => setProfilePeriodUnit(panelId, val as 'minutes' | 'hours' | 'days')}
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
              ]}
              className="flex-1"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Input Data</label>
          <FigSegmentedControl
            full
            value={panel.profileInputData}
            onChange={(val) => setProfileInputData(panelId, val as VolumeBarsInputData)}
            options={[
              { value: 'volume', label: 'Volume' },
              { value: 'orders', label: 'Order Count' },
              { value: 'aggregateTrades', label: 'Agg Trades' },
            ]}
          />

          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Profile Type</label>
          <FigSegmentedControl
            full
            value={panel.profileType}
            onChange={(val) => setProfileType(panelId, val as VolumeProfileType)}
            options={[
              { value: 'volume', label: 'Volume' },
              { value: 'bidAsk', label: 'Ask/Bid' },
              { value: 'delta', label: 'Delta' },
              { value: 'deltaVolume', label: 'Delta+Vol' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Threshold Filter</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <PropskitNumber
                label="Min"
                value={panel.profileFilterMin ?? 0}
                min={0}
                step={1}
                onChange={(val) => setProfileFilterMin(panelId, val > 0 ? val : undefined)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <PropskitNumber
                label="Max"
                value={panel.profileFilterMax ?? 0}
                min={0}
                step={1}
                onChange={(val) => setProfileFilterMax(panelId, val > 0 ? val : undefined)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scaling</label>
            <FigSegmentedControl
              value={panel.profileScaleMode}
              onChange={(val) => setProfileScaleMode(panelId, val as 'linear' | 'sqrt')}
              options={[
                { value: 'linear', label: 'Linear', title: 'True proportions - best for shape reading' },
                { value: 'sqrt', label: 'SQRT', title: 'Amplifies low volume - best for activity presence' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <PropskitSlider
            label="Row Size"
            value={panel.profileResolutionTicks}
            min={0}
            max={maxProfileResolutionTicks}
            step={1}
            title={`Resolution: ${profileRowSizeLabel}`}
            onChange={handleProfileResolutionChange}
            onInput={handleProfileResolutionChange}
          />

          <PropskitSlider
            label="Width"
            value={panel.profileWidthPct}
            min={10}
            max={100}
            step={5}
            units="%"
            onChange={(val: number) => setProfileWidthPct(panelId, val)}
            onInput={(val: number) => setProfileWidthPct(panelId, val)}
          />

          <PropskitSlider
            label="Opacity"
            value={Math.round(panel.profileOpacity * 100)}
            min={10}
            max={100}
            step={5}
            units="%"
            onChange={(val: number) => setProfileOpacity(panelId, val / 100)}
            onInput={(val: number) => setProfileOpacity(panelId, val / 100)}
          />

          <PropskitSlider
            label="Min Row Width"
            value={panel.profileMinRowWidth}
            min={0}
            max={8}
            step={1}
            units="px"
            onChange={(val: number) => setProfileMinRowWidth(panelId, val)}
            onInput={(val: number) => setProfileMinRowWidth(panelId, val)}
          />

          <PropskitSlider
            label="Min Row Height"
            value={panel.profileMinRowHeight}
            min={0}
            max={4}
            step={0.5}
            units="px"
            onChange={(val: number) => setProfileMinRowHeight(panelId, val)}
            onInput={(val: number) => setProfileMinRowHeight(panelId, val)}
          />

          <PropskitSlider
            label="Node Sensitivity"
            value={Math.round(panel.profileNodeSensitivity * 100)}
            min={0}
            max={100}
            step={5}
            units="%"
            onChange={(val: number) => setProfileNodeSensitivity(panelId, val / 100)}
            onInput={(val: number) => setProfileNodeSensitivity(panelId, val / 100)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">POC Highlight</span>
            <FigSwitch
              checked={panel.profileShowPocHighlight}
              onChange={(checked) => setProfileShowPocHighlight(panelId, checked)}
              aria-label="Toggle POC Highlight"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">VA Area Fill</span>
            <FigSwitch
              checked={panel.profileShowVaFill}
              onChange={(checked) => setProfileShowVaFill(panelId, checked)}
              aria-label="Toggle VA Area Fill"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">POC Line</span>
            <FigSwitch
              checked={panel.profileShowPocLine}
              onChange={(checked) => setProfileShowPocLine(panelId, checked)}
              aria-label="Toggle POC Line"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">VA Lines</span>
            <FigSwitch
              checked={panel.profileShowVaLines}
              onChange={(checked) => setProfileShowVaLines(panelId, checked)}
              aria-label="Toggle VA Lines"
            />
          </div>
        </div>

        {(panel.profileType === 'delta' || panel.profileType === 'deltaVolume') && (
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Delta Width"
              value={panel.deltaProfileWidth}
              min={40}
              max={160}
              step={5}
              units="px"
              onChange={(val: number) => setDeltaProfileWidth(panelId, val)}
              onInput={(val: number) => setDeltaProfileWidth(panelId, val)}
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
              <FigSegmentedControl
                full
                value={String(panel.profilePocWidth || 1)}
                onChange={(val) => setProfilePocWidth(panelId, parseInt(val) || 1)}
                options={[
                  { value: '1', label: '1px' },
                  { value: '2', label: '2px' },
                  { value: '3', label: '3px' },
                  { value: '4', label: '4px' },
                ]}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
VolumeProfileSettings.displayName = 'VolumeProfileSettings';

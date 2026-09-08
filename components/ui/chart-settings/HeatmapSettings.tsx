'use client';

import { forwardRef } from 'react';
import { FigSwitch, PropskitSlider } from '../fig';
import { useChartStore, PanelId } from '../../../lib/store/chart';

interface HeatmapSettingsProps {
  panelId: PanelId;
}

export const HeatmapSettings = forwardRef<HTMLDivElement, HeatmapSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setLiquidityHeatmapEnabled = useChartStore(s => s.setLiquidityHeatmapEnabled);
  const setLiquidityHeatmapOpacity = useChartStore(s => s.setLiquidityHeatmapOpacity);
  const setLiquidityHeatmapAgeFade = useChartStore(s => s.setLiquidityHeatmapAgeFade);
  const setLiquidityHeatmapWidth = useChartStore(s => s.setLiquidityHeatmapWidth);
  const setLiquidityHistoryDepth = useChartStore(s => s.setLiquidityHistoryDepth);
  const setLiquidityHeatmapShowPulled = useChartStore(s => s.setLiquidityHeatmapShowPulled);
  const setLiquidityHeatmapShowConsumed = useChartStore(s => s.setLiquidityHeatmapShowConsumed);
  const setLiquidityHeatmapShowCurrentLabel = useChartStore(s => s.setLiquidityHeatmapShowCurrentLabel);
  const setLiquidityHeatmapProfileSync = useChartStore(s => s.setLiquidityHeatmapProfileSync);
  const setLiquidityHeatmapShowPersistence = useChartStore(s => s.setLiquidityHeatmapShowPersistence);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Historical Heatmap</div>
        <FigSwitch
          checked={panel.liquidityHeatmapEnabled}
          onChange={(checked) => setLiquidityHeatmapEnabled(panelId, checked)}
          aria-label="Toggle Historical Heatmap"
        />
      </div>

      {panel.liquidityHeatmapEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Base Opacity"
              value={Math.round(panel.liquidityHeatmapOpacity * 100)}
              min={10}
              max={100}
              step={5}
              units="%"
              onChange={(val) => setLiquidityHeatmapOpacity(panelId, val / 100)}
              onInput={(val) => setLiquidityHeatmapOpacity(panelId, val / 100)}
            />

            <PropskitSlider
              label="Age Fade Factor"
              value={Math.round(panel.liquidityHeatmapAgeFade * 100)}
              min={0}
              max={100}
              step={5}
              units="%"
              onChange={(val) => setLiquidityHeatmapAgeFade(panelId, val / 100)}
              onInput={(val) => setLiquidityHeatmapAgeFade(panelId, val / 100)}
            />

            <PropskitSlider
              label="Strip Width"
              value={panel.liquidityHeatmapWidth}
              min={30}
              max={120}
              step={5}
              units="px"
              onChange={(val) => setLiquidityHeatmapWidth(panelId, val)}
              onInput={(val) => setLiquidityHeatmapWidth(panelId, val)}
            />

            <PropskitSlider
              label="History Depth"
              value={panel.liquidityHistoryDepth}
              min={50}
              max={500}
              step={50}
              units=" bars"
              onChange={(val) => setLiquidityHistoryDepth(panelId, val)}
              onInput={(val) => setLiquidityHistoryDepth(panelId, val)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              { label: 'Show Pulled', checked: panel.liquidityHeatmapShowPulled, toggle: () => setLiquidityHeatmapShowPulled(panelId, !panel.liquidityHeatmapShowPulled) },
              { label: 'Show Consumed', checked: panel.liquidityHeatmapShowConsumed, toggle: () => setLiquidityHeatmapShowConsumed(panelId, !panel.liquidityHeatmapShowConsumed) },
              { label: 'Show CURRENT', checked: panel.liquidityHeatmapShowCurrentLabel, toggle: () => setLiquidityHeatmapShowCurrentLabel(panelId, !panel.liquidityHeatmapShowCurrentLabel) },
              { label: 'Profile Sync', checked: panel.liquidityHeatmapProfileSync, toggle: () => setLiquidityHeatmapProfileSync(panelId, !panel.liquidityHeatmapProfileSync) },
            ].map(({ label, checked, toggle }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">{label}</span>
                <FigSwitch
                  checked={checked}
                  onChange={toggle}
                  aria-label={`Toggle ${label}`}
                />
              </div>
            ))}

            <div className="col-span-2 flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Show Persistence Bars</span>
              <FigSwitch
                checked={panel.liquidityHeatmapShowPersistence}
                onChange={() => setLiquidityHeatmapShowPersistence(panelId, !panel.liquidityHeatmapShowPersistence)}
                aria-label="Toggle Show Persistence Bars"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
HeatmapSettings.displayName = 'HeatmapSettings';

'use client';

import { forwardRef } from 'react';
import { FigSwitch, PropskitSlider, PropskitNumber } from '../fig';
import { useChartStore, PanelId } from '../../../lib/store/chart';

interface LiquidityMapSettingsProps {
  panelId: PanelId;
}

export const LiquidityMapSettings = forwardRef<HTMLDivElement, LiquidityMapSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setLiquidityEnabled = useChartStore(s => s.setLiquidityEnabled);
  const setLiquidityOpacity = useChartStore(s => s.setLiquidityOpacity);
  const setLiquidityBucketSize = useChartStore(s => s.setLiquidityBucketSize);
  const setMinimumLiquidityThreshold = useChartStore(s => s.setMinimumLiquidityThreshold);
  const setLiquidityRange = useChartStore(s => s.setLiquidityRange);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Liquidity Map</div>
        <FigSwitch
          checked={panel.liquidityEnabled}
          onChange={(checked) => setLiquidityEnabled(panelId, checked)}
          aria-label="Toggle Liquidity Map"
        />
      </div>

      {panel.liquidityEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Opacity"
              value={Math.round(panel.liquidityOpacity * 100)}
              min={10}
              max={100}
              step={5}
              units="%"
              onChange={(val) => setLiquidityOpacity(panelId, val / 100)}
              onInput={(val) => setLiquidityOpacity(panelId, val / 100)}
            />

            <PropskitNumber
              label="Bucket Size"
              value={panel.liquidityBucketSize}
              min={10}
              max={500}
              step={10}
              units="$"
              onChange={(val) => val >= 10 && setLiquidityBucketSize(panelId, val)}
            />

            <PropskitNumber
              label="Min Size"
              value={panel.minimumLiquidityThreshold}
              min={0.5}
              max={100}
              step={0.5}
              precision={1}
              units="BTC"
              onChange={(val) => val >= 0.5 && setMinimumLiquidityThreshold(panelId, val)}
            />

            <PropskitSlider
              label="Range"
              value={panel.liquidityRange}
              min={5}
              max={20}
              step={1}
              units="%"
              onChange={(val) => setLiquidityRange(panelId, val)}
              onInput={(val) => setLiquidityRange(panelId, val)}
            />
          </div>
        </div>
      )}
    </div>
  );
});
LiquidityMapSettings.displayName = 'LiquidityMapSettings';

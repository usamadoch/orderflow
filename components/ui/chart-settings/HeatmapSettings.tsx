'use client';

import { forwardRef } from 'react';
import { FigSwitch, PropskitSlider, PropskitNumber } from '../fig';
import { useChartStore, PanelId } from '../../../lib/store/chart';
import { useChartRuntimeStore } from '../../../lib/store/chartRuntime';

interface HeatmapSettingsProps {
  panelId: PanelId;
}

export const HeatmapSettings = forwardRef<HTMLDivElement, HeatmapSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const resyncCount = useChartRuntimeStore(s => s.panels[panelId]?.orderbookResyncCount ?? 0);

  // Heatmap Panel Actions
  const setHeatmapPanelEnabled = useChartStore(s => s.setHeatmapPanelEnabled);
  const setHeatmapPriceBucketSize = useChartStore(s => s.setHeatmapPriceBucketSize);
  const setHeatmapSampleIntervalMs = useChartStore(s => s.setHeatmapSampleIntervalMs);
  const setHeatmapRetentionMinutes = useChartStore(s => s.setHeatmapRetentionMinutes);
  const setHeatmapClampPercentile = useChartStore(s => s.setHeatmapClampPercentile);
  const setHeatmapPanelWidth = useChartStore(s => s.setHeatmapPanelWidth);
  const setHeatmapShowTrades = useChartStore(s => s.setHeatmapShowTrades);

  // Legacy strip actions
  const setLiquidityHeatmapEnabled = useChartStore(s => s.setLiquidityHeatmapEnabled);
  const setLiquidityHeatmapOpacity = useChartStore(s => s.setLiquidityHeatmapOpacity);
  const setLiquidityHeatmapWidth = useChartStore(s => s.setLiquidityHeatmapWidth);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-6">
      {/* 1. Main Order Book Heatmap Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Liquidity Heatmap Panel</div>
            <div className="text-[11px] text-text-dim/70">Bookmap-style horizontal rolling depth ladder</div>
          </div>
          <FigSwitch
            checked={panel.heatmapPanelEnabled}
            onChange={(checked) => setHeatmapPanelEnabled(panelId, checked)}
            aria-label="Toggle Liquidity Heatmap Panel"
          />
        </div>

        {panel.heatmapPanelEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitNumber
                label="Price Bucket Size ($)"
                value={panel.heatmapPriceBucketSize}
                min={0.1}
                max={500}
                step={1}
                precision={1}
                onChange={(val) => setHeatmapPriceBucketSize(panelId, val)}
              />

              <PropskitSlider
                label="Sample Interval"
                value={panel.heatmapSampleIntervalMs}
                min={100}
                max={1000}
                step={50}
                units="ms"
                onChange={(val) => setHeatmapSampleIntervalMs(panelId, val)}
                onInput={(val) => setHeatmapSampleIntervalMs(panelId, val)}
              />

              <PropskitSlider
                label="Retention Window"
                value={panel.heatmapRetentionMinutes}
                min={15}
                max={480}
                step={15}
                units=" min"
                onChange={(val) => setHeatmapRetentionMinutes(panelId, val)}
                onInput={(val) => setHeatmapRetentionMinutes(panelId, val)}
              />

              <PropskitSlider
                label="Color Clamp Percentile"
                value={panel.heatmapClampPercentile}
                min={50}
                max={99}
                step={1}
                units="th %"
                onChange={(val) => setHeatmapClampPercentile(panelId, val)}
                onInput={(val) => setHeatmapClampPercentile(panelId, val)}
              />

              <PropskitSlider
                label="Panel Width"
                value={panel.heatmapPanelWidth}
                min={160}
                max={600}
                step={20}
                units="px"
                onChange={(val) => setHeatmapPanelWidth(panelId, val)}
                onInput={(val) => setHeatmapPanelWidth(panelId, val)}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Executed Trades Overlay</span>
                <p className="text-[10px] text-text-dim/60">Draws executed trade ticks on top of the heatmap</p>
              </div>
              <FigSwitch
                checked={panel.heatmapShowTrades}
                onChange={(checked) => setHeatmapShowTrades(panelId, checked)}
                aria-label="Toggle Trade Overlay"
              />
            </div>

            {/* Dev Resync Diagnostics Info */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414] font-mono text-[10px]">
              <span className="text-text-dim">Orderbook Sequence Resyncs</span>
              <span className={resyncCount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                {resyncCount} {resyncCount === 0 ? '(Synchronized)' : '(Recovered)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Legacy Chart Strip Overlay (Optional) */}
      <div className="pt-2 border-t border-[#262626] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Right-Edge Strip Overlay</div>
            <div className="text-[11px] text-text-dim/70">1D vertical liquidity summary strip on candlestick canvas</div>
          </div>
          <FigSwitch
            checked={panel.liquidityHeatmapEnabled}
            onChange={(checked) => setLiquidityHeatmapEnabled(panelId, checked)}
            aria-label="Toggle Strip Overlay"
          />
        </div>

        {panel.liquidityHeatmapEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Strip Opacity"
                value={Math.round(panel.liquidityHeatmapOpacity * 100)}
                min={10}
                max={100}
                step={5}
                units="%"
                onChange={(val) => setLiquidityHeatmapOpacity(panelId, val / 100)}
                onInput={(val) => setLiquidityHeatmapOpacity(panelId, val / 100)}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
HeatmapSettings.displayName = 'HeatmapSettings';

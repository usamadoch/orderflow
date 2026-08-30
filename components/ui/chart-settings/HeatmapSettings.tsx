import { forwardRef } from 'react';
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
        <button
          onClick={() => setLiquidityHeatmapEnabled(panelId, !panel.liquidityHeatmapEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.liquidityHeatmapEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.liquidityHeatmapEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.liquidityHeatmapEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Base Opacity</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityHeatmapOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapOpacity * 100}
              onChange={(e) => setLiquidityHeatmapOpacity(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="10" max="100" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Age Fade Factor</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityHeatmapAgeFade * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapAgeFade * 100}
              onChange={(e) => setLiquidityHeatmapAgeFade(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="0" max="100" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Strip Width</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityHeatmapWidth}px</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHeatmapWidth}
              onChange={(e) => setLiquidityHeatmapWidth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="30" max="120" step="5"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">History Depth</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityHistoryDepth} candles</span>
            </div>
            <input
              type="range"
              value={panel.liquidityHistoryDepth}
              onChange={(e) => setLiquidityHistoryDepth(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="50" max="500" step="50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              ['Show Pulled', panel.liquidityHeatmapShowPulled, () => setLiquidityHeatmapShowPulled(panelId, !panel.liquidityHeatmapShowPulled)],
              ['Show Consumed', panel.liquidityHeatmapShowConsumed, () => setLiquidityHeatmapShowConsumed(panelId, !panel.liquidityHeatmapShowConsumed)],
              ['Show CURRENT', panel.liquidityHeatmapShowCurrentLabel, () => setLiquidityHeatmapShowCurrentLabel(panelId, !panel.liquidityHeatmapShowCurrentLabel)],
              ['Profile Sync', panel.liquidityHeatmapProfileSync, () => setLiquidityHeatmapProfileSync(panelId, !panel.liquidityHeatmapProfileSync)],
            ].map(([label, enabled, onClick]) => (
              <button
                key={label as string}
                onClick={onClick as () => void}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${enabled
                  ? 'bg-accent/5 border-accent text-accent'
                  : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                  }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">{label as string}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
              </button>
            ))}

            <button
              onClick={() => setLiquidityHeatmapShowPersistence(panelId, !panel.liquidityHeatmapShowPersistence)}
              className={`col-span-2 flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${panel.liquidityHeatmapShowPersistence
                ? 'bg-accent/5 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Show Persistence Bars</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.liquidityHeatmapShowPersistence ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
HeatmapSettings.displayName = 'HeatmapSettings';

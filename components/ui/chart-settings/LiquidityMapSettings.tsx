import { forwardRef } from 'react';
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
        <button
          onClick={() => setLiquidityEnabled(panelId, !panel.liquidityEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.liquidityEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.liquidityEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.liquidityEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
              <span className="text-[12px] font-mono font-bold text-accent">{Math.round(panel.liquidityOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityOpacity * 100}
              onChange={(e) => setLiquidityOpacity(panelId, Number(e.target.value) / 100)}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="10" max="100" step="5"
            />
          </div>

          <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={panel.liquidityBucketSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 10) setLiquidityBucketSize(panelId, val);
                }}
                className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="10" max="500" step="10"
              />
              <span className="text-[9px] text-text-dim font-black uppercase">$</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={panel.minimumLiquidityThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 0.5) setMinimumLiquidityThreshold(panelId, val);
                }}
                className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                min="0.5" max="100" step="0.5"
              />
              <span className="text-[9px] text-text-dim font-black uppercase">BTC</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Range</label>
              <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityRange}%</span>
            </div>
            <input
              type="range"
              value={panel.liquidityRange}
              onChange={(e) => setLiquidityRange(panelId, Number(e.target.value))}
              className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
              min="5" max="20" step="1"
            />
          </div>
        </div>
      )}
    </div>
  );
});
LiquidityMapSettings.displayName = 'LiquidityMapSettings';

'use client';

import { useChartStore, PanelId } from '../../lib/store/chart';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

export function PanelToolbar({ panelId }: PanelToolbarProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setPair = useChartStore(s => s.setPair);
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setBucketSize = useChartStore(s => s.setBucketSize);
  const setFootprintMode = useChartStore(s => s.setFootprintMode);

  return (
    <div className="h-8 bg-[#0D0D0D] border-b border-[#1F1F1F] flex items-center px-3 gap-3 shrink-0">
      {/* Pair Selector */}
      <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A]">
        {PAIRS.map((p) => (
          <button
            key={p}
            onClick={() => setPair(panelId, p)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight transition-all duration-150 ${
              panel.pair === p
                ? 'bg-accent text-white shadow-sm shadow-accent/20'
                : 'text-text-dim hover:text-main hover:bg-[#151515]'
            }`}
          >
            {p.replace('USDT', '')}
            <span className="opacity-40 ml-0.5 text-[9px]">/U</span>
          </button>
        ))}
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A]">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(panelId, tf)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all duration-150 ${
              panel.timeframe === tf
                ? 'bg-[#1A1A1A] text-accent border border-[#252525] shadow-sm'
                : 'text-text-dim hover:text-main hover:bg-[#151515]'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A]">
        <button
          onClick={() => panel.chartMode !== 'candle' && setChartMode(panelId, 'candle')}
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-150 ${
            panel.chartMode === 'candle'
              ? 'bg-accent text-white shadow-sm shadow-accent/20'
              : 'text-text-dim hover:text-main hover:bg-[#151515]'
          }`}
        >
          C
        </button>
        <button
          onClick={() => panel.chartMode !== 'footprint' && setChartMode(panelId, 'footprint')}
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-150 ${
            panel.chartMode === 'footprint'
              ? 'bg-accent text-white shadow-sm shadow-accent/20'
              : 'text-text-dim hover:text-main hover:bg-[#151515]'
          }`}
        >
          F
        </button>
      </div>

      {/* Footprint Options — visible in footprint mode only */}
      {panel.chartMode === 'footprint' && (
        <>
          <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A] ml-1">
            <button
              onClick={() => setFootprintMode(panelId, 'bid-ask')}
              className={`px-2 py-0.5 text-[9px] font-black rounded tracking-wider transition-all duration-150 ${
                panel.footprintMode === 'bid-ask'
                  ? 'bg-accent text-white shadow-sm shadow-accent/20'
                  : 'text-text-dim hover:text-main hover:bg-[#151515]'
              }`}
            >
              B/A
            </button>
            <button
              onClick={() => setFootprintMode(panelId, 'delta')}
              className={`px-2 py-0.5 text-[9px] font-black rounded tracking-wider transition-all duration-150 ${
                panel.footprintMode === 'delta'
                  ? 'bg-accent text-white shadow-sm shadow-accent/20'
                  : 'text-text-dim hover:text-main hover:bg-[#151515]'
              }`}
            >
              Δ
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-text-dim border-l border-[#1A1A1A] pl-3 h-5">
            <label className="uppercase font-black tracking-[0.08em]">Bucket</label>
            <input
              type="number"
              value={panel.bucketSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) setBucketSize(panelId, val);
              }}
              className="w-12 bg-[#080808] border border-[#1A1A1A] rounded px-1 py-0 text-right text-[11px] font-bold focus:border-accent focus:outline-none transition-all text-main"
              step="1"
              min="1"
            />
          </div>
        </>
      )}
    </div>
  );
}

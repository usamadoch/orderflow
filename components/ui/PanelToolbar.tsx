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
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);


  return (
    <div className="font-sans h-8 bg-[#0D0D0D] border-b border-[#1F1F1F] flex items-center px-3 gap-3 shrink-0">
      {/* Pair Selector */}
      <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A]">
        {PAIRS.map((p) => (
          <button
            key={p}
            onClick={() => setPair(panelId, p)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight transition-all duration-150 ${panel.pair === p
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
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all duration-200 ${panel.timeframe === tf
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
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-200 ${panel.chartMode === 'candle'
            ? 'bg-accent text-white shadow-sm shadow-accent/20'
            : 'text-text-dim hover:text-main hover:bg-[#151515]'
            }`}
        >
          C
        </button>
        <button
          onClick={() => panel.chartMode !== 'footprint' && setChartMode(panelId, 'footprint')}
          className={`px-2 py-0.5 text-[10px] font-black rounded tracking-wider transition-all duration-200 ${panel.chartMode === 'footprint'
            ? 'bg-accent text-white shadow-sm shadow-accent/20'
            : 'text-text-dim hover:text-main hover:bg-[#151515]'
            }`}
        >
          F
        </button>
      </div>

      {/* Custom Profile Toggle */}
      <div className="flex items-center gap-2 border-l border-[#1A1A1A] pl-3 h-5">
        <button
          onClick={() => useChartStore.getState().setDrawMode(panelId, !panel.isDrawMode)}
          className={`h-5 px-2 flex items-center justify-center rounded text-[9px] font-black tracking-widest transition-all duration-200 ${panel.isDrawMode
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle profile draw mode"
        >
          PROFILE
        </button>
      </div>

      {/* Line Drawing Controls */}
      <div className="flex items-center gap-1 border-l border-[#1A1A1A] pl-3 h-5">
        <button
          onClick={() => setLineDrawMode(panelId, panel.lineDrawMode === 'horizontal' ? 'none' : 'horizontal')}
          className={`h-5 w-6 flex items-center justify-center rounded text-[12px] font-bold transition-all duration-200 ${panel.lineDrawMode === 'horizontal'
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Horizontal Line"
        >
          —
        </button>
        <button
          onClick={() => setLineDrawMode(panelId, panel.lineDrawMode === 'vertical' ? 'none' : 'vertical')}
          className={`h-5 w-6 flex items-center justify-center rounded text-[12px] font-bold transition-all duration-200 ${panel.lineDrawMode === 'vertical'
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Vertical Line"
        >
          |
        </button>
      </div>

      {/* Measurement Tool */}
      <div className="flex items-center gap-1 border-l border-[#1A1A1A] pl-3 h-5">
        <button
          onClick={() => useChartStore.getState().setMeasureToolActive(panelId, !panel.measureToolActive)}
          className={`h-5 px-2 flex items-center justify-center rounded text-[10px] font-black tracking-widest transition-all duration-200 ${panel.measureToolActive
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Measurement Tool (M)"
        >
          ⟷
        </button>
      </div>

      {/* Sessions Quick Toggle */}
      <div className="flex items-center gap-1 border-l border-[#1A1A1A] pl-3 h-5">
        <button
          onClick={() => useChartStore.getState().setSessionsEnabled(panelId, !panel.sessionsEnabled)}
          className={`h-5 w-6 flex items-center justify-center rounded text-[11px] font-black transition-all duration-200 ${panel.sessionsEnabled
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle Sessions (S)"
        >
          S
        </button>
      </div>

    </div>
  );
}

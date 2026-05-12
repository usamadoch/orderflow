'use client';

import { useChartStore, PanelId, AbsorptionSide, ExhaustionSide } from '../../lib/store/chart';

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

  const setAbsorptionEnabled = useChartStore(s => s.setAbsorptionEnabled);
  const setAbsorptionMinScore = useChartStore(s => s.setAbsorptionMinScore);
  const setAbsorptionSide = useChartStore(s => s.setAbsorptionSide);

  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setExhaustionMinScore = useChartStore(s => s.setExhaustionMinScore);
  const setExhaustionSide = useChartStore(s => s.setExhaustionSide);

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

      {/* Signals Section */}
      <div className="flex items-center gap-2 border-l border-[#1A1A1A] pl-3 h-5 ml-auto">
        <div className={`text-[9px] font-black tracking-[0.2em] transition-colors duration-200 ${!panel.absorptionEnabled && !panel.exhaustionEnabled ? 'text-[#333]' : 'text-text-dim'
          }`}>
          SIGNALS
        </div>

        {/* Absorption Controls */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={() => setAbsorptionEnabled(panelId, !panel.absorptionEnabled)}
            className={`h-5 px-1.5 flex items-center justify-center rounded text-[9px] font-black transition-all duration-200 ${panel.absorptionEnabled
                ? 'bg-[#1F1F1F] border border-[#26A69A] text-[#E8E8E8]'
                : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
              }`}
            title="Toggle Absorption"
          >
            ABS
          </button>

          {panel.absorptionEnabled && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#4A4A4A] font-bold">MIN</span>
                <input
                  type="number"
                  value={panel.absorptionMinScore}
                  onChange={(e) => setAbsorptionMinScore(panelId, Number(e.target.value))}
                  className="w-[40px] bg-[#080808] border border-[#1A1A1A] rounded px-1 h-5 text-[11px] font-mono text-[#E8E8E8] focus:outline-none focus:border-[#26A69A]"
                  min="30" max="90" step="5"
                />
              </div>
              <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded border border-[#1A1A1A]">
                {(['buyer', 'seller', 'both'] as AbsorptionSide[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setAbsorptionSide(panelId, s)}
                    className={`px-1 rounded text-[9px] font-bold transition-all ${panel.absorptionSide === s ? 'bg-[#3D7EFF] text-white' : 'text-[#4A4A4A] hover:text-[#777]'
                      }`}
                  >
                    {s === 'buyer' ? 'B' : s === 'seller' ? 'S' : 'B+S'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thin Divider */}
        <div className="w-[1px] h-3 bg-[#1A1A1A]" />

        {/* Exhaustion Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExhaustionEnabled(panelId, !panel.exhaustionEnabled)}
            className={`h-5 px-1.5 flex items-center justify-center rounded text-[9px] font-black transition-all duration-200 ${panel.exhaustionEnabled
                ? 'bg-[#1F1F1F] border border-[#F0B90B] text-[#E8E8E8]'
                : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
              }`}
            title="Toggle Exhaustion"
          >
            EX
          </button>

          {panel.exhaustionEnabled && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#4A4A4A] font-bold">MIN</span>
                <input
                  type="number"
                  value={panel.exhaustionMinScore}
                  onChange={(e) => setExhaustionMinScore(panelId, Number(e.target.value))}
                  className="w-[40px] bg-[#080808] border border-[#1A1A1A] rounded px-1 h-5 text-[11px] font-mono text-[#E8E8E8] focus:outline-none focus:border-[#F0B90B]"
                  min="30" max="90" step="5"
                />
              </div>
              <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded border border-[#1A1A1A]">
                {(['buyer', 'seller', 'both'] as ExhaustionSide[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setExhaustionSide(panelId, s)}
                    className={`px-1 rounded text-[9px] font-bold transition-all ${panel.exhaustionSide === s ? 'bg-[#3D7EFF] text-white' : 'text-[#4A4A4A] hover:text-[#777]'
                      }`}
                  >
                    {s === 'buyer' ? 'B' : s === 'seller' ? 'S' : 'B+S'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

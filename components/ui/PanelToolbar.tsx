'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, MoveRight, Ruler, Settings2, Square } from 'lucide-react';
import { useChartStore, PanelId, LineDrawMode } from '../../lib/store/chart';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

export function PanelToolbar({ panelId }: PanelToolbarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const panel = useChartStore(s => s.panels[panelId]);
  const setPair = useChartStore(s => s.setPair);
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);
  const setAbsorptionEnabled = useChartStore(s => s.setAbsorptionEnabled);
  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setIcebergEnabled = useChartStore(s => s.setIcebergEnabled);

  useEffect(() => {
    if (!toolsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [toolsOpen]);

  const setDrawingLineMode = (mode: LineDrawMode) => {
    setLineDrawMode(panelId, panel.lineDrawMode === mode ? 'none' : mode);
    setToolsOpen(false);
  };

  const toggleProfile = () => {
    useChartStore.getState().setDrawMode(panelId, !panel.isDrawMode);
    setToolsOpen(false);
  };

  const toggleMeasure = () => {
    useChartStore.getState().setMeasureToolActive(panelId, !panel.measureToolActive);
    setToolsOpen(false);
  };

  const activeToolLabel = panel.isDrawMode
    ? 'PROFILE'
    : panel.measureToolActive
      ? 'MEASURE'
      : panel.lineDrawMode === 'horizontal'
        ? 'H LINE'
        : panel.lineDrawMode === 'vertical'
          ? 'V LINE'
          : panel.lineDrawMode === 'horizontal-ray'
            ? 'RAY'
            : panel.lineDrawMode === 'box'
              ? 'BOX'
              : 'TOOLS';

  const toolButtonClass = (active: boolean) =>
    `h-7 w-full px-2 flex items-center gap-2 rounded text-[10px] font-black tracking-wide transition-all duration-150 ${
      active
        ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
        : 'border border-transparent text-[#787B86] hover:text-[#E8E8E8] hover:bg-[#151515]'
    }`;

  return (
    <div className="font-sans h-8 bg-[#0D0D0D] border-b border-[#1F1F1F] flex items-center px-3 gap-2 shrink-0 overflow-visible">
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

      {/* Drawing Tools */}
      <div ref={toolsRef} className="relative flex items-center border-l border-[#1A1A1A] pl-3 h-5">
        <button
          onClick={() => setToolsOpen((open) => !open)}
          className={`h-6 px-2 flex items-center gap-1.5 rounded text-[9px] font-black tracking-widest transition-all duration-200 ${
            panel.isDrawMode || panel.measureToolActive || panel.lineDrawMode !== 'none'
              ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
              : 'bg-[#080808] border border-[#1A1A1A] text-[#787B86] hover:text-[#E8E8E8]'
          }`}
          title="Drawing tools"
        >
          <Settings2 size={13} strokeWidth={2.3} />
          <span className="max-w-[56px] truncate">{activeToolLabel}</span>
          <ChevronDown size={12} strokeWidth={2.4} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
        </button>

        {toolsOpen && (
          <div className="absolute left-3 top-7 z-30 w-44 rounded-md border border-[#262626] bg-[#0D0D0D]/95 p-1.5 shadow-2xl backdrop-blur">
            <button onClick={toggleProfile} className={toolButtonClass(panel.isDrawMode)} title="Custom Profile">
              <Square size={13} strokeWidth={2.2} />
              <span>Profile</span>
            </button>
            <button onClick={() => setDrawingLineMode('horizontal')} className={toolButtonClass(panel.lineDrawMode === 'horizontal')} title="Horizontal Line">
              <Minus size={14} strokeWidth={2.6} />
              <span>Horizontal</span>
            </button>
            <button onClick={() => setDrawingLineMode('vertical')} className={toolButtonClass(panel.lineDrawMode === 'vertical')} title="Vertical Line">
              <span className="w-[14px] text-center text-[14px] leading-none">|</span>
              <span>Vertical</span>
            </button>
            <button onClick={() => setDrawingLineMode('horizontal-ray')} className={toolButtonClass(panel.lineDrawMode === 'horizontal-ray')} title="Horizontal Ray">
              <MoveRight size={14} strokeWidth={2.4} />
              <span>Right Ray</span>
            </button>
            <button onClick={() => setDrawingLineMode('box')} className={toolButtonClass(panel.lineDrawMode === 'box')} title="Box">
              <Square size={13} strokeWidth={2.2} />
              <span>Box</span>
            </button>
            <button onClick={toggleMeasure} className={toolButtonClass(panel.measureToolActive)} title="Measurement Tool (M)">
              <Ruler size={13} strokeWidth={2.3} />
              <span>Measure</span>
            </button>
          </div>
        )}
      </div>

      {/* Signal Toggles */}
      <div className="flex items-center gap-1 border-l border-[#1A1A1A] pl-3 h-5">
        <span className={`text-[9px] font-black tracking-widest ${panel.absorptionEnabled || panel.exhaustionEnabled || panel.icebergEnabled ? 'text-text-dim' : 'text-[#333]'}`}>
          SIGNALS
        </span>
        <button
          onClick={() => setAbsorptionEnabled(panelId, !panel.absorptionEnabled)}
          className={`h-5 px-2 flex items-center justify-center rounded text-[9px] font-black transition-all duration-200 ${panel.absorptionEnabled
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle Absorption"
        >
          ABS
        </button>
        <button
          onClick={() => setExhaustionEnabled(panelId, !panel.exhaustionEnabled)}
          className={`h-5 px-2 flex items-center justify-center rounded text-[9px] font-black transition-all duration-200 ${panel.exhaustionEnabled
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle Exhaustion"
        >
          EX
        </button>
        <button
          onClick={() => setIcebergEnabled(panelId, !panel.icebergEnabled)}
          className={`h-5 px-2 flex items-center justify-center rounded text-[9px] font-black transition-all duration-200 ${panel.icebergEnabled
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle Iceberg (K)"
        >
          ICE
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
        <button
          onClick={() => useChartStore.getState().setLiquidityEnabled(panelId, !panel.liquidityEnabled)}
          className={`h-5 w-6 flex items-center justify-center rounded text-[11px] font-black transition-all duration-200 ${panel.liquidityEnabled
            ? 'bg-[#1F1F1F] border border-[#3D7EFF] text-[#E8E8E8]'
            : 'bg-transparent text-[#4A4A4A] hover:text-[#777]'
            }`}
          title="Toggle Liquidity Map (Q)"
        >
          Q
        </button>
      </div>

    </div>
  );
}

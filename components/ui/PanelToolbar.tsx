'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChartStore, PanelId, BubbleSide } from '../../lib/store/chart';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

interface PanelToolbarProps {
  panelId: PanelId;
}

function BubbleControls({ panelId }: { panelId: PanelId }) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setBubbleThreshold = useChartStore(s => s.setBubbleThreshold);
  const setBubbleSide = useChartStore(s => s.setBubbleSide);

  const [localThreshold, setLocalThreshold] = useState(String(panel.bubbleThreshold));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local when store changes externally
  useEffect(() => {
    setLocalThreshold(String(panel.bubbleThreshold));
  }, [panel.bubbleThreshold]);

  const handleThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalThreshold(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const val = Number(raw);
      if (!isNaN(val) && val >= 1) setBubbleThreshold(panelId, val);
    }, 300);
  }, [panelId, setBubbleThreshold]);

  const sides: { label: string; value: BubbleSide }[] = [
    { label: 'B', value: 'buy' },
    { label: 'S', value: 'sell' },
    { label: 'B+S', value: 'both' },
  ];

  return (
    <div className="flex items-center gap-2 border-l border-[#1A1A1A] pl-3 h-5">
      {/* Toggle */}
      <button
        onClick={() => setBubblesEnabled(panelId, !panel.bubblesEnabled)}
        title="Toggle volume bubbles"
        className={`w-5 h-5 flex items-center justify-center rounded transition-all duration-150 ${
          panel.bubblesEnabled
            ? 'bg-[#1F1F1F] text-[#26A69A]'
            : 'text-[#4A4A4A] hover:text-[#777]'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="4.5" fill={panel.bubblesEnabled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {panel.bubblesEnabled && (
        <>
          {/* Threshold */}
          <div className="flex items-center gap-1 text-[10px] text-text-dim">
            <label className="font-black tracking-[0.06em]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>VOL ≥</label>
            <input
              type="number"
              value={localThreshold}
              onChange={handleThresholdChange}
              className="w-[65px] bg-[#080808] border border-[#1A1A1A] rounded px-1 py-0 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
              min="1"
            />
          </div>

          {/* Side Selector */}
          <div className="flex gap-0.5 bg-[#080808] p-0.5 rounded-md border border-[#1A1A1A]">
            {sides.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setBubbleSide(panelId, value)}
                className={`px-1.5 py-0.5 text-[9px] font-black rounded tracking-wider transition-all duration-150 ${
                  panel.bubbleSide === value
                    ? 'bg-[#3D7EFF] text-white shadow-sm'
                    : 'text-text-dim hover:text-main hover:bg-[#151515]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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

      {/* Bubble Controls */}
      <BubbleControls panelId={panelId} />
    </div>
  );
}

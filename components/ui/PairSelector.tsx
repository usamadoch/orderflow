'use client';

import { useChartStore, PanelId } from '../../lib/store/chart';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];

export function PairSelector({ panelId = 'left' }: { panelId?: PanelId }) {
  const activePair = useChartStore(s => s.panels[panelId].pair);
  const setPair = useChartStore(s => s.setPair);

  return (
    <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border">
      {PAIRS.map((p) => (
        <button
          key={p}
          onClick={() => setPair(panelId, p)}
          className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-tight transition-all duration-200 ${activePair === p
            ? 'bg-accent text-white shadow-lg shadow-accent/20'
            : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
        >
          {p.replace('USDT', '')}
          <span className="opacity-40 ml-0.5">/USDT</span>
        </button>
      ))}
    </div>
  );
}

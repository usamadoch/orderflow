'use client';

import { useChartStore } from '../../lib/store/chart';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];

export function PairSelector() {
  const { pair: activePair, setPair } = useChartStore();

  return (
    <div className="flex gap-1">
      {PAIRS.map((p) => (
        <button
          key={p}
          onClick={() => setPair(p)}
          className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
            activePair === p 
              ? 'bg-[#3D7EFF] text-white border border-[#3D7EFF]' 
              : 'bg-background text-text-muted border border-border hover:border-text-muted'
          }`}
        >
          {p.replace('USDT', '/USDT')}
        </button>
      ))}
    </div>
  );
}

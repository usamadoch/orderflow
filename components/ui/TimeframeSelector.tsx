'use client';

import { useChartStore } from '../../lib/store/chart';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

export function TimeframeSelector() {
  const { timeframe: activeTimeframe, setTimeframe } = useChartStore();

  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
            activeTimeframe === tf 
              ? 'bg-background text-white border border-[#3D7EFF]' 
              : 'bg-background text-text-muted border border-border hover:border-text-muted'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useChartStore } from '../../lib/store/chart';

export function ModeSelector() {
  const chartMode = useChartStore((state) => state.chartMode);
  const toggleMode = useChartStore((state) => state.toggleMode);

  return (
    <button
      onClick={toggleMode}
      className="bg-surface border border-border rounded px-3 py-1 text-xs font-medium text-text-dim hover:text-main hover:border-text-dim transition-colors"
    >
      Mode: {chartMode === 'candle' ? 'Candles' : 'Footprint'}
    </button>
  );
}

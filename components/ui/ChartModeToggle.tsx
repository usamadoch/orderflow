'use client';

import { useChartStore } from '../../lib/store/chart';

export function ChartModeToggle() {
  const chartMode = useChartStore((state) => state.chartMode);
  const toggleMode = useChartStore((state) => state.toggleMode);

  return (
    <div className="flex items-center gap-1 bg-[#1A1A1A] p-0.5 rounded border border-border">
      <button
        onClick={() => chartMode !== 'candle' && toggleMode()}
        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
          chartMode === 'candle'
            ? 'bg-[#3D7EFF] text-white'
            : 'bg-transparent text-[#4A4A4A] hover:text-text-dim'
        } font-mono`}
      >
        CANDLE
      </button>
      <button
        onClick={() => chartMode !== 'footprint' && toggleMode()}
        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
          chartMode === 'footprint'
            ? 'bg-[#3D7EFF] text-white'
            : 'bg-transparent text-[#4A4A4A] hover:text-text-dim'
        } font-mono`}
      >
        FOOTPRINT
      </button>
    </div>
  );
}

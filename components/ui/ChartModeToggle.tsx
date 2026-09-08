'use client';

import { useChartStore, PanelId } from '../../lib/store/chart';
import { FigButton } from './fig';

export function ChartModeToggle({ panelId = 'left' }: { panelId?: PanelId }) {
  const chartMode = useChartStore(s => s.panels[panelId].chartMode);
  const setChartMode = useChartStore(s => s.setChartMode);

  return (
    <div className="flex items-center gap-1 bg-background/50 p-0.5 rounded-lg border border-border">
      <FigButton
        size="small"
        variant="ghost"
        selected={chartMode === 'candle'}
        onClick={() => chartMode !== 'candle' && setChartMode(panelId, 'candle')}
        className={`px-3 py-1 text-[10px] font-black rounded-md tracking-wider ${
          chartMode === 'candle'
            ? 'bg-accent text-white shadow-lg shadow-accent/20'
            : 'text-text-dim hover:text-main'
        }`}
        title="Candles"
        aria-label="Candles"
      >
        CANDLES
      </FigButton>
      <FigButton
        size="small"
        variant="ghost"
        selected={chartMode === 'footprint'}
        onClick={() => chartMode !== 'footprint' && setChartMode(panelId, 'footprint')}
        className={`px-3 py-1 text-[10px] font-black rounded-md tracking-wider ${
          chartMode === 'footprint'
            ? 'bg-accent text-white shadow-lg shadow-accent/20'
            : 'text-text-dim hover:text-main'
        }`}
        title="Footprint"
        aria-label="Footprint"
      >
        FOOTPRINT
      </FigButton>
    </div>
  );
}

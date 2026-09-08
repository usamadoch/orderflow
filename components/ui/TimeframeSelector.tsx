'use client';

import { useChartStore, PanelId } from '../../lib/store/chart';
import { FigSegmentedControl } from './fig';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

export function TimeframeSelector({ panelId = 'left' }: { panelId?: PanelId }) {
  const activeTimeframe = useChartStore(s => s.panels[panelId].timeframe);
  const setTimeframe = useChartStore(s => s.setTimeframe);

  return (
    <FigSegmentedControl
      value={activeTimeframe}
      onChange={(tf: string) => setTimeframe(panelId, tf)}
      options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
      title="Timeframe Selector"
      aria-label="Timeframe Selector"
    />
  );
}

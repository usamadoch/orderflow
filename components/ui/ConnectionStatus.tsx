'use client';

import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '../../lib/config/chartColors';
import { useChartStore } from '../../lib/store/chart';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';

export function ConnectionStatus() {
  const leftConnected = useChartRuntimeStore(s => s.panels.left.connected);
  const rightConnected = useChartRuntimeStore(s => s.panels.right.connected);
  const layoutMode = useChartStore(s => s.layoutMode);

  // Combined status: LIVE if any panel is connected
  const connected = layoutMode === 'single' 
    ? leftConnected 
    : leftConnected || rightConnected;
  const statusColor = connected ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span 
        className="w-1.5 h-1.5 rounded-full"
        style={{ 
          backgroundColor: statusColor,
          boxShadow: `0 0 8px ${statusColor}`
        }}
      ></span>
      <span className={connected ? 'text-text-muted' : ''} style={connected ? undefined : { color: CHART_BEARISH_COLOR }}>
        {connected ? 'LIVE' : 'DISCONNECTED'}
      </span>
    </div>
  );
}

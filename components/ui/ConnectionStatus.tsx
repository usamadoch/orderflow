'use client';

import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '../../lib/config/chartColors';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';

export function ConnectionStatus() {
  const mt5Connected = useChartRuntimeStore(s => s.tradingStatus.mt5Connected);
  
  const statusColor = mt5Connected ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR;

  return (
    <div className="flex items-center gap-2 text-xs font-mono group" title={mt5Connected ? "MetaTrader 5 Connected" : "MetaTrader 5 Disconnected"}>
      <span 
        className={`w-2 h-2 rounded-full transition-all duration-300 ${mt5Connected ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: statusColor,
          boxShadow: `0 0 8px ${statusColor}`
        }}
      ></span>
      <span className={mt5Connected ? 'text-text-muted transition-colors group-hover:text-main' : ''} style={mt5Connected ? undefined : { color: CHART_BEARISH_COLOR }}>
        {mt5Connected ? 'MT5 LIVE' : 'MT5 DISCONNECTED'}
      </span>
    </div>
  );
}

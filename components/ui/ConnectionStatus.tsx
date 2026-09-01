'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '../../lib/config/chartColors';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';

export function ConnectionStatus() {
  const mt5Connected = useChartRuntimeStore(s => s.tradingStatus.mt5Connected);
  const mt5BridgeStatus = useChartRuntimeStore(s => s.tradingStatus.mt5BridgeStatus);
  const setMT5BridgeStatus = useChartRuntimeStore(s => s.setMT5BridgeStatus);
  const syncMT5Bridge = useChartRuntimeStore(s => s.syncMT5Bridge);
  const [manualLoading, setManualLoading] = useState(false);

  const isConnecting = mt5BridgeStatus === 'connecting' || manualLoading;
  const statusColor = mt5Connected
    ? CHART_BULLISH_COLOR
    : isConnecting
    ? '#eab308'
    : CHART_BEARISH_COLOR;

  const handleManualConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setManualLoading(true);
    setMT5BridgeStatus('connecting');
    try {
      const ok = await syncMT5Bridge();
      if (!ok) {
        setMT5BridgeStatus('paused');
      }
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs font-mono select-none" title={mt5Connected ? "MetaTrader 5 Connected (http://localhost:3001)" : "MetaTrader 5 Disconnected"}>
      <div className="flex items-center gap-1.5">
        <span 
          className={`w-2 h-2 rounded-full transition-all duration-300 ${mt5Connected ? 'animate-pulse' : isConnecting ? 'animate-ping' : ''}`}
          style={{ 
            backgroundColor: statusColor,
            boxShadow: `0 0 8px ${statusColor}`
          }}
        />
        <span 
          className="text-xs transition-colors"
          style={mt5Connected ? undefined : { color: statusColor }}
        >
          {mt5Connected ? 'MT5 LIVE' : isConnecting ? 'CONNECTING...' : 'MT5 OFFLINE'}
        </span>
      </div>

      {!mt5Connected && (
        <button
          onClick={handleManualConnect}
          disabled={isConnecting}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-hover/50 hover:bg-surface-hover hover:border-accent/40 text-text-dim hover:text-accent transition-all duration-150 active:scale-95 disabled:opacity-50"
          title="Connect to local MT5 Bridge (http://localhost:3001)"
        >
          <RefreshCw size={10} className={isConnecting ? 'animate-spin text-accent' : ''} />
          <span>Connect</span>
        </button>
      )}
    </div>
  );
}

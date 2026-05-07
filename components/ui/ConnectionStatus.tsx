'use client';

import { useChartStore } from '../../lib/store/chart';

export function ConnectionStatus() {
  const connected = useChartStore((state) => state.connected);

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span 
        className="w-1.5 h-1.5 rounded-full"
        style={{ 
          backgroundColor: connected ? '#26A69A' : '#EF5350',
          boxShadow: `0 0 8px ${connected ? '#26A69A' : '#EF5350'}`
        }}
      ></span>
      <span className={connected ? 'text-text-muted' : 'text-[#EF5350]'}>
        {connected ? 'LIVE' : 'DISCONNECTED'}
      </span>
    </div>
  );
}

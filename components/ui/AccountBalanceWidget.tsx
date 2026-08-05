'use client';

import React from 'react';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';

function formatBalance(value: number) {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export function AccountBalanceWidget() {
  const balances = useChartRuntimeStore(s => s.tradingStatus.balances);
  
  // Find USDT for primary display, fallback to first non-zero
  const primaryAsset = balances.find(b => b.asset === 'USDT' && b.total > 0) || balances.find(b => b.total > 0);

  if (!primaryAsset) {
    return (
      <div className="flex flex-col items-end justify-center px-3 py-1 bg-[#1F1F1F] rounded-md border border-border">
         <div className="flex items-center gap-1.5">
           <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Balance</span>
           <span className="text-[12px] font-black text-[#E8E8E8]">--</span>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end justify-center px-3 py-1 bg-[#1F1F1F] rounded-md border border-border group relative cursor-default">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">{primaryAsset.asset} Avail</span>
        <span className="text-[12px] font-black text-[#E8E8E8]">{formatBalance(primaryAsset.free)}</span>
      </div>
      
      {/* Tooltip for total/locked */}
      <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-[#1A1A1A] border border-[#333333] rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 flex flex-col gap-1">
        <div className="flex justify-between items-center pb-1 border-b border-[#333333]">
          <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider">{primaryAsset.asset} Details</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-text-dim">Total Balance</span>
          <span className="text-[11px] font-bold text-[#E8E8E8]">{formatBalance(primaryAsset.total)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-dim">Locked in Orders</span>
          <span className="text-[11px] font-bold text-[#FF9BA4]">{formatBalance(primaryAsset.locked)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-dim">Available</span>
          <span className="text-[11px] font-bold text-[#8FE3CF]">{formatBalance(primaryAsset.free)}</span>
        </div>
      </div>
    </div>
  );
}

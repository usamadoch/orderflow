'use client';

import React from 'react';
import { ExhaustionResult } from '@/types/exhaustion';
import { useChartStore } from '@/lib/store/chart';

interface ExhaustionTooltipProps {
  result: ExhaustionResult;
  x: number;
  y: number;
}

export const ExhaustionTooltip: React.FC<ExhaustionTooltipProps> = ({ result, x, y }) => {
  const isAuthenticated = useChartStore(s => s.isAuthenticated);
  const isBuyer = result.direction === 'buyer';
  const color = isBuyer ? '#F0B90B' : '#B39DDB';
  
  const rankLevels = {
    weak: 1,
    moderate: 2,
    strong: 3,
    extreme: 4
  };
  const filledCount = rankLevels[result.rank];
  const diamonds = '◈'.repeat(filledCount) + '◇'.repeat(4 - filledCount);

  return (
    <div 
      className="absolute pointer-events-none z-50 p-3 bg-[#141414]/95 backdrop-blur-md border border-[#1F1F1F] rounded-[6px] shadow-2xl flex flex-col gap-2 w-[220px]"
      style={{ 
        left: x + 15, 
        top: isBuyer ? y + 20 : y - 100, // Positioned below for buyer, above for seller
        fontFamily: '"JetBrains Mono", monospace'
      }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color }}>
        {isBuyer ? 'BUYER EXHAUSTION' : 'SELLER EXHAUSTION'}
      </div>

      <div className="relative">
        <div className={`flex items-center justify-between transition-all duration-300 ${!isAuthenticated ? 'blur-md select-none opacity-40' : ''}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold text-[#E8E8E8]">Score: {result.score}</span>
          </div>
          <span className="text-[12px] tracking-widest text-white/80">{diamonds}</span>
        </div>
        {!isAuthenticated && (
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-[8px] text-accent/80 font-black uppercase tracking-[0.2em]">Restricted</span>
          </div>
        )}
      </div>

      <div className="h-[1px] bg-[#1F1F1F] w-full my-0.5" />

      <div className="flex flex-col gap-1.5 relative">
        <div className={`flex flex-col gap-1.5 transition-all duration-300 ${!isAuthenticated ? 'blur-sm select-none opacity-30' : ''}`}>
          {result.reasons.map((reason, i) => (
            <div key={i} className="flex gap-2 text-[11px] leading-tight">
              <span style={{ color: '#3D7EFF' }}>✓</span>
              <span style={{ color: '#8A8A8A' }}>{reason}</span>
            </div>
          ))}
        </div>
        {!isAuthenticated && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-500/60 font-semibold uppercase tracking-widest">Locked</span>
          </div>
        )}
      </div>
    </div>
  );
};

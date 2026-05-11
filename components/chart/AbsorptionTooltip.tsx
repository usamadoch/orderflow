'use client';

import React from 'react';
import { AbsorptionResult } from '@/types/absorption';

interface AbsorptionTooltipProps {
  result: AbsorptionResult;
  x: number;
  y: number;
}

export const AbsorptionTooltip: React.FC<AbsorptionTooltipProps> = ({ result, x, y }) => {
  const isSeller = result.direction === 'seller';
  const color = isSeller ? '#26A69A' : '#EF5350';
  
  // Rank dots
  const dots = [];
  const dotCount = result.rank === 'extreme' ? 3 : result.rank === 'strong' ? 2 : 1;
  for (let i = 0; i < 3; i++) {
    dots.push(
      <div 
        key={i} 
        className="w-1.5 h-1.5 rounded-full" 
        style={{ backgroundColor: i < dotCount ? color : '#333' }}
      />
    );
  }

  return (
    <div 
      className="absolute pointer-events-none z-50 p-3 bg-[#141414] border border-[#1F1F1F] rounded-md shadow-xl flex flex-col gap-2 min-w-[200px]"
      style={{ 
        left: x + 15, 
        top: y - 40,
        fontFamily: '"JetBrains Mono", monospace'
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {isSeller ? 'Seller Absorption' : 'Buyer Absorption'}
        </span>
        <div className="flex gap-1">
          {dots}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white">{result.score}</span>
        <span className="text-[10px] text-gray-500 uppercase">Score</span>
      </div>

      <div className="h-[1px] bg-[#1F1F1F] w-full" />

      <div className="flex flex-col gap-1.5">
        {result.reasons.map((reason, i) => (
          <div key={i} className="flex gap-2 text-[10px] leading-tight">
            <span style={{ color }}>✓</span>
            <span className="text-gray-300">{reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

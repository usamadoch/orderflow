'use client';

import React from 'react';
import { AuctionShiftResult, AuctionShiftState } from '@/types/auctionShift';

interface AuctionShiftTooltipProps {
  result: AuctionShiftResult;
  x: number;
  y: number;
}

const COLORS: Record<AuctionShiftState, string> = {
  balanced: '#787B86',
  initiative_buying: '#26A69A',
  initiative_selling: '#EF5350',
  absorption_reversal: '#3D7EFF',
  exhaustion_transition: '#F0B90B',
};

const TITLES: Record<AuctionShiftState, string> = {
  balanced: 'Balanced Auction',
  initiative_buying: 'Initiative Buying',
  initiative_selling: 'Initiative Selling',
  absorption_reversal: 'Absorption Reversal',
  exhaustion_transition: 'Exhaustion Transition',
};

export const AuctionShiftTooltip: React.FC<AuctionShiftTooltipProps> = ({ result, x, y }) => {
  const color = COLORS[result.state];
  const top = y < 120 ? y + 20 : y - 132;

  return (
    <div
      className="absolute pointer-events-none z-50 p-3 bg-[#141414]/95 backdrop-blur-md border border-[#1F1F1F] rounded-[6px] shadow-2xl flex flex-col gap-2 w-[250px]"
      style={{
        left: x + 14,
        top,
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color }}>
          {TITLES[result.state]}
        </span>
        <span className="text-[10px] font-bold text-[#E8E8E8]">{result.confidence}</span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-dim">
        <span>{result.transition ? 'Transition' : 'Context'}</span>
        <span className="uppercase">{result.provisional ? 'Developing' : result.direction}</span>
      </div>

      <div className="h-[1px] bg-[#1F1F1F] w-full my-0.5" />

      <div className="flex flex-col gap-1.5">
        {result.reasons.map((reason, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-tight">
            <span style={{ color }}>+</span>
            <span style={{ color: '#A8A8A8' }}>{reason}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-[#1F1F1F]">
        <span className="text-text-dim">Balance</span>
        <span className="text-[#E8E8E8]">{result.signals.balance}</span>
        <span className="text-text-dim">Initiative</span>
        <span className="text-[#E8E8E8]">{result.signals.initiative}</span>
        <span className="text-text-dim">Abs/Exh</span>
        <span className="text-[#E8E8E8]">{result.signals.absorption}/{result.signals.exhaustion}</span>
      </div>
    </div>
  );
};

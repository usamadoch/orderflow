'use client';

import React from 'react';
import { IcebergLevel } from '@/types/iceberg';
import { formatDelta, formatPrice, formatVol } from '@/lib/utils/format';

interface IcebergTooltipProps {
  level: IcebergLevel;
  x: number;
  y: number;
}

const COLORS = {
  bid_defense: '#26A69A',
  ask_defense: '#EF5350',
};

const RANK_LEVELS = {
  suspected: 1,
  probable: 2,
  confirmed: 3,
};

export const IcebergTooltip: React.FC<IcebergTooltipProps> = ({ level, x, y }) => {
  const color = COLORS[level.side];
  const filledCount = RANK_LEVELS[level.rank];
  const diamonds = '#'.repeat(filledCount) + '-'.repeat(3 - filledCount);
  const title = level.side === 'bid_defense' ? 'BID DEFENSE - ICEBERG' : 'ASK DEFENSE - ICEBERG';
  const top = y < 150 ? y + 18 : y - 150;

  return (
    <div
      className="absolute pointer-events-none z-50 p-3 bg-[#141414]/95 backdrop-blur-md border border-[#1F1F1F] rounded-[6px] shadow-2xl flex flex-col gap-2 w-[240px]"
      style={{
        left: x + 14,
        top,
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color }}>
        {title}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#E8E8E8]">Score: {level.score}</span>
        <span className="text-[12px] tracking-widest text-white/80">{diamonds}</span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-dim">
        <span className="text-[#CFCFCF]">${formatPrice(level.price)}</span>
        <span>{level.candleCount} candles</span>
      </div>

      <div className="h-[1px] bg-[#1F1F1F] w-full my-0.5" />

      <div className="flex flex-col gap-1.5">
        {level.reasons.map((reason, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-tight">
            <span style={{ color }}>+</span>
            <span style={{ color: '#8A8A8A' }}>{reason}</span>
          </div>
        ))}
      </div>

      <div className="h-[1px] bg-[#1F1F1F] w-full my-0.5" />

      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px]">
        <span className="text-text-dim">Total volume</span>
        <span className="text-[#E8E8E8] font-bold">{formatVol(level.totalVolume, 'BTC')}</span>
        <span className="text-text-dim">Avg per candle</span>
        <span className="text-[#E8E8E8] font-bold">{formatVol(level.avgVolumePerCandle, 'BTC')}</span>
        <span className="text-text-dim">Cumulative Delta</span>
        <span className="text-[#E8E8E8] font-bold">{formatDelta(level.cumulativeDelta)}</span>
      </div>
    </div>
  );
};

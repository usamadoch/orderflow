'use client';

import React, { useMemo } from 'react';
import { Measurement } from '@/lib/store/chart';
import { formatPrice, formatVol, formatDelta } from '@/lib/utils/format';

interface MeasurementPanelProps {
  measurement: Measurement | null;
  canvasRect: DOMRect | null;
}

export function MeasurementPanel({ measurement, canvasRect }: MeasurementPanelProps) {
  if (!measurement || measurement.live || !measurement.metrics || !canvasRect) return null;

  const { startX, endX, startY, endY, metrics, footprintMetrics } = measurement;
  
  // Calculate rectangle dimensions
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  // Tiny rectangle behavior — do not render panel
  if (w < 20 || h < 20) return null;

  // Default position: top-right corner of the rectangle
  let panelLeft = canvasRect.left + endX + 8;
  let panelTop = canvasRect.top + Math.min(startY, endY) - 4;

  // Clipping logic
  const panelWidth = 160;
  if (panelLeft + panelWidth > window.innerWidth) {
    // Flip to left side
    panelLeft = canvasRect.left + Math.min(startX, endX) - panelWidth - 8;
  }

  if (panelTop < canvasRect.top) {
    // Move down below the rectangle
    panelTop = canvasRect.top + Math.max(startY, endY) + 8;
  }

  const priceColor = metrics.priceDiff > 0.0001 ? '#26A69A' : metrics.priceDiff < -0.0001 ? '#EF5350' : '#8A8A8A';
  const deltaColor = footprintMetrics && footprintMetrics.totalDelta > 0.0001 ? '#26A69A' : footprintMetrics && footprintMetrics.totalDelta < -0.0001 ? '#EF5350' : '#8A8A8A';
  const ratioColor = footprintMetrics && footprintMetrics.buySellRatio > 1.0001 ? '#26A69A' : footprintMetrics && footprintMetrics.buySellRatio < 0.9999 ? '#EF5350' : '#8A8A8A';

  return (
    <div 
      className="fixed z-[100] bg-[#141414] border border-[#1F1F1F] rounded shadow-xl p-2 w-[160px] pointer-events-none"
      style={{
        left: `${panelLeft}px`,
        top: `${panelTop}px`,
        fontFamily: '"JetBrains Mono", monospace'
      }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center h-[18px]">
          <span className="text-[9px] text-[#4A4A4A] uppercase">Price</span>
          <span className="text-[12px]" style={{ color: priceColor }}>
            {metrics.priceDiff >= 0 ? '+' : ''}{formatPrice(metrics.priceDiff)}
          </span>
        </div>
        <div className="flex justify-between items-center h-[18px]">
          <span className="text-[9px] text-[#4A4A4A] uppercase">%</span>
          <span className="text-[12px]" style={{ color: priceColor }}>
            {metrics.pricePercent >= 0 ? '+' : ''}{metrics.pricePercent.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between items-center h-[18px]">
          <span className="text-[9px] text-[#4A4A4A] uppercase">Candles</span>
          <span className="text-[12px] text-[#E8E8E8]">{metrics.candleCount}</span>
        </div>
        <div className="flex justify-between items-center h-[18px]">
          <span className="text-[9px] text-[#4A4A4A] uppercase">Time</span>
          <span className="text-[12px] text-[#E8E8E8]">{metrics.elapsedLabel}</span>
        </div>
        <div className="flex justify-between items-center h-[18px]">
          <span className="text-[9px] text-[#4A4A4A] uppercase">Ticks</span>
          <span className="text-[12px] text-[#8A8A8A]">{Math.round(metrics.ticks).toLocaleString()}</span>
        </div>

        {footprintMetrics && (
          <>
            <div className="border-top border-[#1F1F1F] my-1" style={{ borderTopWidth: '1px' }} />
            <div className="flex justify-between items-center h-[18px]">
              <span className="text-[9px] text-[#4A4A4A] uppercase">Vol</span>
              <span className="text-[12px] text-[#E8E8E8]">
                {formatVol(footprintMetrics.totalVolume)}{footprintMetrics.isPartial ? '*' : ''}
              </span>
            </div>
            <div className="flex justify-between items-center h-[18px]">
              <span className="text-[9px] text-[#4A4A4A] uppercase">Delta</span>
              <span className="text-[12px]" style={{ color: deltaColor }}>
                {formatDelta(footprintMetrics.totalDelta)}
              </span>
            </div>
            <div className="flex justify-between items-center h-[18px]">
              <span className="text-[9px] text-[#4A4A4A] uppercase">Buy Vol</span>
              <span className="text-[12px] text-[#26A69A]">{formatVol(footprintMetrics.totalBuyVol)}</span>
            </div>
            <div className="flex justify-between items-center h-[18px]">
              <span className="text-[9px] text-[#4A4A4A] uppercase">Sell Vol</span>
              <span className="text-[12px] text-[#EF5350]">{formatVol(footprintMetrics.totalSellVol)}</span>
            </div>
            <div className="flex justify-between items-center h-[18px]">
              <span className="text-[9px] text-[#4A4A4A] uppercase">B/S</span>
              <span className="text-[12px]" style={{ color: ratioColor }}>{footprintMetrics.buySellRatio.toFixed(2)}</span>
            </div>
            {footprintMetrics.isPartial && (
              <div className="text-[8px] text-[#4A4A4A] text-right mt-1">* partial data</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

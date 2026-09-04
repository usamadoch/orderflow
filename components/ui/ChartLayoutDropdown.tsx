'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useChartStore } from '../../lib/store/chart';

export function SingleChartIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function VerticalSplitIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10" y1="1" x2="10" y2="15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function HorizontalSplitIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <line x1="1" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ChartLayoutDropdown() {
  const layoutMode = useChartStore((s) => s.layoutMode);
  const splitDirection = useChartStore((s) => s.splitDirection);
  const setLayoutMode = useChartStore((s) => s.setLayoutMode);
  const setSplitDirection = useChartStore((s) => s.setSplitDirection);
  const crosshairSyncEnabled = useChartStore((s) => s.crosshairSyncEnabled);
  const setCrosshairSyncEnabled = useChartStore((s) => s.setCrosshairSyncEnabled);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isSingle = layoutMode === 'single';
  const isDualVertical = layoutMode === 'dual' && splitDirection === 'vertical';
  const isDualHorizontal = layoutMode === 'dual' && splitDirection === 'horizontal';

  return (
    <div className={`relative ${isOpen ? 'z-50' : ''}`} ref={dropdownRef}>
      {/* Header Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-7 px-2 flex items-center gap-1.5 rounded-md border text-xs font-bold transition-all duration-150 ${
          isOpen
            ? 'border-accent/50 bg-accent/10 text-accent shadow-sm shadow-accent/10'
            : 'border-border bg-background/50 text-text-dim hover:text-main hover:bg-[#1F1F1F]'
        }`}
        title="Select chart layout"
        aria-expanded={isOpen}
      >
        <span className="flex items-center">
          {isSingle && <SingleChartIcon size={16} />}
          {isDualVertical && <VerticalSplitIcon size={16} />}
          {isDualHorizontal && <HorizontalSplitIcon size={16} />}
        </span>
        <ChevronDown
          size={11}
          strokeWidth={2.5}
          className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-accent' : 'text-text-dim'}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-52 rounded-xl border border-[#262626] bg-[#141414] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-xl select-none">
          {/* Layout Mode Options */}
          <div className="space-y-2">
            {/* Row 1: Single Chart */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-bold text-text-dim/40 w-3 text-right">1</span>
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('single');
                  setIsOpen(false);
                }}
                className={`w-9 h-8 flex items-center justify-center rounded-lg border transition-all duration-150 ${
                  isSingle
                    ? 'border-accent bg-accent/15 text-accent shadow-sm shadow-accent/20'
                    : 'border-[#262626] bg-[#1A1A1A] text-text-dim hover:border-[#404040] hover:text-main hover:bg-[#222]'
                }`}
                title="Single chart"
              >
                <SingleChartIcon size={20} />
              </button>
            </div>

            {/* Row 2: Two Charts (Vertical & Horizontal Split) */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-bold text-text-dim/40 w-3 text-right">2</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode('dual');
                    setSplitDirection('vertical');
                    setIsOpen(false);
                  }}
                  className={`w-9 h-8 flex items-center justify-center rounded-lg border transition-all duration-150 ${
                    isDualVertical
                      ? 'border-accent bg-accent/15 text-accent shadow-sm shadow-accent/20'
                      : 'border-[#262626] bg-[#1A1A1A] text-text-dim hover:border-[#404040] hover:text-main hover:bg-[#222]'
                  }`}
                  title="Two charts — Vertical split (side by side)"
                >
                  <VerticalSplitIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode('dual');
                    setSplitDirection('horizontal');
                    setIsOpen(false);
                  }}
                  className={`w-9 h-8 flex items-center justify-center rounded-lg border transition-all duration-150 ${
                    isDualHorizontal
                      ? 'border-accent bg-accent/15 text-accent shadow-sm shadow-accent/20'
                      : 'border-[#262626] bg-[#1A1A1A] text-text-dim hover:border-[#404040] hover:text-main hover:bg-[#222]'
                  }`}
                  title="Two charts — Horizontal split (top and bottom)"
                >
                  <HorizontalSplitIcon size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-[#262626] my-2.5" />

          {/* Sync In Layout Section */}
          <div>
            <div className="text-[10px] font-black text-[#787B86] uppercase tracking-[0.18em] px-1 mb-1.5">
              Sync In Layout
            </div>
            <div
              onClick={() => setCrosshairSyncEnabled(!crosshairSyncEnabled)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#1F1F1F] cursor-pointer transition-colors group"
              title="Synchronize crosshair position across charts in multi-chart layout"
            >
              <span className="text-[11px] font-bold text-[#CCCCCC] group-hover:text-white transition-colors">
                Crosshair
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={crosshairSyncEnabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setCrosshairSyncEnabled(!crosshairSyncEnabled);
                }}
                className={`relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0 ${
                  crosshairSyncEnabled ? 'bg-accent' : 'bg-[#262626]'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${
                    crosshairSyncEnabled ? 'left-3.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

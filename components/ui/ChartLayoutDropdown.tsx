'use client';

import React, { useState } from 'react';
import { FigSwitch, FigButton, FigPopup, FigTooltip } from './fig';
import { useChartStore, type PanelId } from '../../lib/store/chart';

export function SingleChartIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function VerticalSplitIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="1" x2="10" y2="15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function HorizontalSplitIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  const height = Math.round(size * 0.78);
  return (
    <svg width={size} height={height} viewBox="0 0 20 16" fill="none" className={className}>
      <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChartLayoutDropdown({ panelId }: { panelId?: PanelId } = {}) {
  const layoutMode = useChartStore((s) => s.layoutMode);
  const splitDirection = useChartStore((s) => s.splitDirection);
  const setLayoutMode = useChartStore((s) => s.setLayoutMode);
  const setSplitDirection = useChartStore((s) => s.setSplitDirection);
  const crosshairSyncEnabled = useChartStore((s) => s.crosshairSyncEnabled);
  const setCrosshairSyncEnabled = useChartStore((s) => s.setCrosshairSyncEnabled);
  const drawingsSyncEnabled = useChartStore((s) => s.drawingsSyncEnabled);
  const setDrawingsSyncEnabled = useChartStore((s) => s.setDrawingsSyncEnabled);
  const volumeProfileSyncEnabled = useChartStore((s) => s.volumeProfileSyncEnabled);
  const setVolumeProfileSyncEnabled = useChartStore((s) => s.setVolumeProfileSyncEnabled);

  const [isOpen, setIsOpen] = useState(false);

  const isSingle = layoutMode === 'single';
  const isDualVertical = layoutMode === 'dual' && splitDirection === 'vertical';
  const isDualHorizontal = layoutMode === 'dual' && splitDirection === 'horizontal';

  const triggerId = panelId ? `chart-layout-dropdown-trigger-${panelId}` : 'chart-layout-dropdown-trigger';

  const getLayoutButtonClass = (active: boolean) =>
    `flex h-10 w-12 items-center justify-center p-2 rounded-lg transition-colors m-0 border cursor-pointer ${active
      ? 'border-[#3D7EFF] bg-[#262626] text-white shadow-sm shadow-[#3D7EFF]/20'
      : 'border-transparent text-[#909090] hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="relative">
      {/* Trigger Button with FigUI3 Tooltip (Chevron removed per user request) */}
      <FigTooltip text={!isOpen ? 'Select chart layout' : ''}>
        <FigButton
          id={triggerId}
          variant="ghost"
          icon
          selected={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="Select chart layout"
          className="cursor-pointer"
        >
          <span className="flex items-center">
            {isSingle && <SingleChartIcon size={14} />}
            {isDualVertical && <VerticalSplitIcon size={14} />}
            {isDualHorizontal && <HorizontalSplitIcon size={14} />}
          </span>
        </FigButton>
      </FigTooltip>

      {/* Dropdown Menu */}
      <FigPopup
        open={isOpen}
        anchor={`#${triggerId}`}
        position="bottom right"
        offset="0 4"
        mode="dropdown"
        onClose={() => setIsOpen(false)}
        className="z-50 w-64 rounded-xl border border-[#282828] bg-[#181818] p-3.5 shadow-2xl select-none"
      >
        <div className='p-1'>


          {/* Layout Mode Options */}
          <div className="space-y-2.5">
            {/* Row 1: Single Chart */}
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-mono font-bold text-text-dim/50 w-4 text-right">1</span>
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('single');
                  setIsOpen(false);
                }}
                className={getLayoutButtonClass(isSingle)}
                aria-label="Single chart"
                aria-pressed={isSingle}
              >
                <SingleChartIcon size={22} />
              </button>
            </div>

            {/* Row 2: Two Charts (Vertical & Horizontal Split) */}
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-mono font-bold text-text-dim/50 w-4 text-right">2</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode('dual');
                    setSplitDirection('vertical');
                    setIsOpen(false);
                  }}
                  className={getLayoutButtonClass(isDualVertical)}
                  aria-label="Two charts — Vertical split"
                  aria-pressed={isDualVertical}
                >
                  <VerticalSplitIcon size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode('dual');
                    setSplitDirection('horizontal');
                    setIsOpen(false);
                  }}
                  className={getLayoutButtonClass(isDualHorizontal)}
                  aria-label="Two charts — Horizontal split"
                  aria-pressed={isDualHorizontal}
                >
                  <HorizontalSplitIcon size={22} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="h-[1px] bg-[#282828] my-3" />

        <div className='p-1'>
          {/* Sync In Layout Section */}
          <div>
            <div className="text-[10px] font-black text-[#787B86] uppercase tracking-[0.18em] px-1 mb-2">
              Sync In Layout
            </div>
            <div
              onClick={() => setCrosshairSyncEnabled(!crosshairSyncEnabled)}
              className="flex items-center justify-between px-3 py-2.5 min-h-[38px] rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
            >
              <span className="text-[12px] font-bold text-[#CCCCCC] group-hover:text-white transition-colors">
                Crosshair
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <FigSwitch
                  checked={crosshairSyncEnabled}
                  onChange={(checked) => setCrosshairSyncEnabled(checked)}
                  aria-label="Synchronize crosshair"
                />
              </div>
            </div>
            <div
              onClick={() => setDrawingsSyncEnabled(!drawingsSyncEnabled)}
              className="flex items-center justify-between px-3 py-2.5 min-h-[38px] rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
            >
              <span className="text-[12px] font-bold text-[#CCCCCC] group-hover:text-white transition-colors">
                Drawings
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <FigSwitch
                  checked={drawingsSyncEnabled}
                  onChange={(checked) => setDrawingsSyncEnabled(checked)}
                  aria-label="Synchronize drawings"
                />
              </div>
            </div>
            <div
              onClick={() => setVolumeProfileSyncEnabled(!volumeProfileSyncEnabled)}
              className="flex items-center justify-between px-3 py-2.5 min-h-[38px] rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
            >
              <span className="text-[12px] font-bold text-[#CCCCCC] group-hover:text-white transition-colors whitespace-nowrap">
                Sync Volume Profile
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <FigSwitch
                  checked={volumeProfileSyncEnabled}
                  onChange={(checked) => setVolumeProfileSyncEnabled(checked)}
                  aria-label="Synchronize volume profile"
                />
              </div>
            </div>
          </div>
        </div>
      </FigPopup>
    </div>
  );
}

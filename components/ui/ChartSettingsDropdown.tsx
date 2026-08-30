'use client';

import { useState, useEffect, useRef } from 'react';
import { BarChart2, Layers, Zap, X } from 'lucide-react';
import { useChartStore, PanelId, IndicatorSettingsSection, SettingsFocusSection } from '../../lib/store/chart';
import { BubblesDocsModal } from './BubblesDocsModal';

import {
  GeneralChartSettings,
  FootprintSettings,
  VolumeProfileSettings,
  HistoricalSessionProfileSettings,
  SessionsSettings,
  CvdSettings,
  VolumeBarsSettings,
  BubbleSettings,
  LiquidityMapSettings,
  HeatmapSettings,
  StatsSettings,
  SignalSettings,
} from './chart-settings';

const SETTINGS_WIDTH = 544;
const SETTINGS_MIN_HEIGHT = 350;
const SETTINGS_DEFAULT_HEIGHT = 500;
const VIEWPORT_MARGIN = 16;
const INDICATOR_DIALOG_WIDTH = 440;

function getViewportMaxHeight(top: number) {
  if (typeof window === 'undefined') {
    return SETTINGS_DEFAULT_HEIGHT;
  }

  return Math.max(
    SETTINGS_MIN_HEIGHT,
    window.innerHeight - top - VIEWPORT_MARGIN
  );
}

function clampSettingsHeight(nextHeight: number, top: number) {
  return Math.max(SETTINGS_MIN_HEIGHT, Math.min(nextHeight, getViewportMaxHeight(top)));
}

interface ChartSettingsDropdownProps {
  panelId: PanelId;
  initialAnchor?: { x: number; y: number } | null;
  focusSection?: SettingsFocusSection | null;
  focusRequestId?: number;
  indicatorSection?: IndicatorSettingsSection | null;
  indicatorTitle?: string;
  onClose: () => void;
}

function clampSettingsPosition(nextPosition: { x: number; y: number }, height: number) {
  if (typeof window === 'undefined') return nextPosition;

  const maxX = Math.max(VIEWPORT_MARGIN / 2, window.innerWidth - SETTINGS_WIDTH - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN / 2, window.innerHeight - height - VIEWPORT_MARGIN);

  return {
    x: Math.max(VIEWPORT_MARGIN / 2, Math.min(nextPosition.x, maxX)),
    y: Math.max(VIEWPORT_MARGIN / 2, Math.min(nextPosition.y, maxY)),
  };
}

function getInitialSettingsPosition(initialAnchor: { x: number; y: number } | null | undefined, height: number) {
  if (typeof window === 'undefined') {
    return { x: -1, y: 48 };
  }

  if (initialAnchor) {
    return clampSettingsPosition({
      x: initialAnchor.x - SETTINGS_WIDTH,
      y: initialAnchor.y,
    }, height);
  }

  return clampSettingsPosition({
    x: window.innerWidth - SETTINGS_WIDTH - VIEWPORT_MARGIN,
    y: 48,
  }, height);
}

export function ChartSettingsDropdown({
  panelId,
  initialAnchor,
  focusSection,
  focusRequestId = 0,
  indicatorSection = null,
  indicatorTitle,
  onClose,
}: ChartSettingsDropdownProps) {
  const settingsDropdownHeight = useChartStore(s => s.settingsDropdownHeight);
  const setSettingsDropdownHeight = useChartStore(s => s.setSettingsDropdownHeight);

  const [showBubblesDocs, setShowBubblesDocs] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'profiles' | 'signals'>('chart');
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const indicatorDialogTitles: Record<IndicatorSettingsSection, string> = {
    sessions: 'Sessions',
    historicalSessions: 'Historical Sessions',
    cvd: 'CVD',
    bubbles: 'Volume Bubbles',
    volumeBars: 'Volume',
    heatmap: 'Heatmap',
    liquidityMap: 'Liquidity Map',
    stats: 'Stats Indicator',
  };

  // --- Draggable Logic ---
  const [position, setPosition] = useState(() => getInitialSettingsPosition(initialAnchor, settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT));
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [height, setHeight] = useState(settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ mouseY: 0, height });

  // Initialize position once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && position.x === -1) {
      setPosition(getInitialSettingsPosition(initialAnchor, height));
    }
  }, [height, initialAnchor, position.x]);

  useEffect(() => {
    setHeight(settingsDropdownHeight || SETTINGS_DEFAULT_HEIGHT);
  }, [settingsDropdownHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!focusSection || focusRequestId <= 0) return;

    if (focusSection === 'profiles') {
      setActiveTab('profiles');
    }
  }, [focusRequestId, focusSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setHeight((currentHeight) => {
        const nextHeight = clampSettingsHeight(currentHeight, position.y);
        if (nextHeight !== currentHeight) {
          setSettingsDropdownHeight(nextHeight);
        }
        return nextHeight;
      });

      setPosition((currentPosition) => {
        const nextHeight = clampSettingsHeight(height, currentPosition.y);
        return clampSettingsPosition(currentPosition, nextHeight);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height, position.y, setSettingsDropdownHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header, not buttons/inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('select')) return;
    
    const rect = dropdownRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (position.x === -1 ? window.innerWidth - SETTINGS_WIDTH - VIEWPORT_MARGIN : position.x);
    const currentY = rect ? rect.top : position.y;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - currentX,
      y: e.clientY - currentY
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        setPosition(clampSettingsPosition({ x: newX, y: newY }, height));
        return;
      }

      if (isResizing) {
        const nextHeight = clampSettingsHeight(resizeStart.height + (e.clientY - resizeStart.mouseY), position.y);
        setHeight(nextHeight);
        return;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (isResizing) {
        setSettingsDropdownHeight(height);
      }
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, height, isDragging, isResizing, position.y, resizeStart, setSettingsDropdownHeight]);
  // --- End Draggable Logic ---

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ mouseY: e.clientY, height });
  };

  const tabs = [
    { id: 'chart', label: 'Chart', icon: BarChart2 },
    { id: 'profiles', label: 'Profiles', icon: Layers },
    { id: 'signals', label: 'Signals', icon: Zap },
  ] as const;

  const renderIndicatorSettingsContent = (section: IndicatorSettingsSection) => {
    switch (section) {
      case 'sessions':
        return <SessionsSettings panelId={panelId} />;
      case 'historicalSessions':
        return <HistoricalSessionProfileSettings panelId={panelId} />;
      case 'cvd':
        return <CvdSettings panelId={panelId} />;
      case 'bubbles':
        return <BubbleSettings panelId={panelId} onShowDocs={() => setShowBubblesDocs(true)} />;
      case 'volumeBars':
        return <VolumeBarsSettings panelId={panelId} />;
      case 'heatmap':
        return <HeatmapSettings panelId={panelId} />;
      case 'liquidityMap':
        return <LiquidityMapSettings panelId={panelId} />;
      case 'stats':
        return <StatsSettings panelId={panelId} />;
      default:
        return null;
    }
  };

  if (indicatorSection) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 px-3 py-6"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="popup-contrast flex max-h-[min(720px,calc(100vh-48px))] w-full flex-col overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#1F1F1F] shadow-2xl"
          style={{ maxWidth: INDICATOR_DIALOG_WIDTH }}
        >
          <div className="flex items-center justify-between border-b border-[#1F1F1F] bg-[#1F1F1F]/50 p-4">
            <div className="flex flex-col">
              <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">
                {indicatorTitle ?? indicatorDialogTitles[indicatorSection]}
              </h3>
              <span className="text-[9px] font-bold text-text-dim/60 uppercase tracking-tighter">{panelId} Panel</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-dim transition-colors hover:text-main"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto p-5 custom-scrollbar">
            {renderIndicatorSettingsContent(indicatorSection)}
          </div>
        </div>
        {showBubblesDocs && <BubblesDocsModal onClose={() => setShowBubblesDocs(false)} />}
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={`popup-contrast pointer-events-auto fixed z-[1000] flex w-[544px] flex-col overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#1F1F1F] shadow-2xl transition-shadow duration-200 ${isDragging ? 'shadow-accent/20 ring-1 ring-accent/20' : ''}`}
      style={{ 
        left: position.x === -1 ? 'auto' : position.x,
        top: position.y,
        right: position.x === -1 ? '16px' : 'auto',
        height,
        minHeight: SETTINGS_MIN_HEIGHT,
        maxHeight: getViewportMaxHeight(position.y),
        userSelect: isDragging ? 'none' : 'auto'
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {/* Header / Drag Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={`p-4 border-b border-[#1F1F1F] flex items-center justify-between bg-[#1F1F1F]/50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">Settings</h3>
            <span className="text-[9px] font-bold text-text-dim/60 uppercase tracking-tighter">{panelId} Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center text-text-dim/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-main transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-32 bg-[#1F1F1F]/50 border-r border-[#1F1F1F] flex flex-col p-1.5 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-active={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-tab-btn flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? 'text-accent shadow-[inset_0_0_10px_rgba(61,126,255,0.05)]'
                    : 'text-text-dim hover:text-main'
                }`}
              >
                <tab.icon size={14} className={isActive ? 'opacity-100' : 'opacity-40'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="flex flex-col gap-8">
            {/* Tab: Chart */}
            {activeTab === 'chart' && (
              <GeneralChartSettings panelId={panelId} />
            )}

            {/* Tab: Profiles */}
            {activeTab === 'profiles' && (
              <>
                <FootprintSettings panelId={panelId} />
                <VolumeProfileSettings panelId={panelId} />
                <HistoricalSessionProfileSettings panelId={panelId} />
              </>
            )}

            {/* Tab: Signals */}
            {activeTab === 'signals' && (
              <SignalSettings panelId={panelId} />
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[#1F1F1F] bg-[#1F1F1F]/50">
        <div className="text-[9px] text-text-dim/40 text-center font-medium uppercase tracking-widest">
          Global Settings • {panelId} Panel
        </div>
      </div>
      <div
        onMouseDown={handleResizeMouseDown}
        className="h-3 shrink-0 cursor-row-resize bg-[#1F1F1F]/60 border-t border-[#1F1F1F] flex items-center justify-center"
        title="Resize settings panel"
      >
        <div className="w-16 h-1 rounded-full bg-[#1F1F1F] opacity-50" />
      </div>
      {showBubblesDocs && <BubblesDocsModal onClose={() => setShowBubblesDocs(false)} />}
    </div>
  );
}

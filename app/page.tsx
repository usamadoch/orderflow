'use client';

import { useRef, useCallback } from 'react';
import { PanelFeedProvider } from '../components/FeedProvider';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { ChartPanel } from '../components/chart/ChartPanel';
import { useChartStore } from '../lib/store/chart';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function Home() {
  const layoutMode = useChartStore(s => s.layoutMode);
  const splitRatio = useChartStore(s => s.splitRatio);
  const setSplitRatio = useChartStore(s => s.setSplitRatio);
  useKeyboardShortcuts();

  const containerRef = useRef<HTMLElement>(null);
  const isDragging = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setSplitRatio]);

  const leftPercent = layoutMode === 'dual' ? `${splitRatio * 100}%` : '100%';
  const rightPercent = layoutMode === 'dual' ? `${(1 - splitRatio) * 100}%` : '0%';

  return (
    <div className="flex flex-col h-screen overflow-hidden text-main bg-background font-sans selection:bg-accent/30">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main ref={containerRef} className="flex-1 relative flex bg-[#080808]">
          {/* Left Panel — always visible */}
          <div style={{ width: leftPercent }} className="h-full flex shrink-0">
            <PanelFeedProvider panelId="left">
              <ChartPanel panelId="left" />
            </PanelFeedProvider>
          </div>

          {/* Draggable Divider */}
          {layoutMode === 'dual' && (
            <div
              className="w-[5px] shrink-0 relative cursor-col-resize group z-10"
              onMouseDown={onDividerMouseDown}
            >
              {/* Visible thin line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#1F1F1F] group-hover:bg-accent/50 transition-colors duration-150" />
              {/* Wider hit area on hover glow */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-transparent group-hover:bg-accent/10 transition-colors duration-150 rounded-full" />
            </div>
          )}

          {/* Right Panel — only in dual mode */}
          {layoutMode === 'dual' && (
            <div style={{ width: rightPercent }} className="h-full flex shrink-0">
              <PanelFeedProvider panelId="right">
                <ChartPanel panelId="right" />
              </PanelFeedProvider>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

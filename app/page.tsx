'use client';

import { useRef, useCallback } from 'react';
import { PanelFeedProvider } from '../components/FeedProvider';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { ChartPanel } from '../components/chart/ChartPanel';
import { OrdersPanel } from '../components/ui/OrdersPanel';
import { DebugPanel } from '../components/debug/DebugPanel';
import { useChartStore } from '../lib/store/chart';
import { useChartRuntimeStore } from '../lib/store/chartRuntime';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useTradingSync } from '../hooks/useTradingSync';

export default function Home() {
  const layoutMode = useChartStore(s => s.layoutMode);
  const splitDirection = useChartStore(s => s.splitDirection);
  const splitRatio = useChartStore(s => s.splitRatio);
  const focusMode = useChartStore(s => s.focusMode);
  const setSplitRatio = useChartStore(s => s.setSplitRatio);
  const leftRefreshKey = useChartRuntimeStore(s => s.panels.left.refreshKey);
  const rightRefreshKey = useChartRuntimeStore(s => s.panels.right.refreshKey);
  useKeyboardShortcuts();
  useTradingSync();

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const isDual = layoutMode === 'dual';
  const isHorizontal = isDual && splitDirection === 'horizontal';

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const isHorizontalSplit = splitDirection === 'horizontal';
    document.body.style.cursor = isHorizontalSplit ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = isHorizontalSplit
        ? (ev.clientY - rect.top) / rect.height
        : (ev.clientX - rect.left) / rect.width;
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
  }, [setSplitRatio, splitDirection]);

  const panel1Style: React.CSSProperties = !isDual
    ? { width: '100%', height: '100%' }
    : isHorizontal
    ? { width: '100%', height: `calc(${splitRatio * 100}% - 2.5px)` }
    : { width: `calc(${splitRatio * 100}% - 2.5px)`, height: '100%' };

  const panel2Style: React.CSSProperties = isHorizontal
    ? { width: '100%', flex: 1 }
    : { flex: 1, height: '100%' };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-main bg-background font-sans selection:bg-accent/30">
      {!focusMode && <Header />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar hidden by request; code kept intact for reuse */}
        {false && !focusMode && <Sidebar />}

        <main className="flex-1 relative flex flex-col bg-background min-w-0 p-0 py-0">
          <div
            ref={splitContainerRef}
            className={`flex-1 relative flex min-h-0 min-w-0 ${isHorizontal ? 'flex-col' : 'flex-row'}`}
          >
            {/* Panel 1 (Left / Top) — always visible */}
            <div style={panel1Style} className="flex min-w-0 min-h-0 overflow-hidden">
              <PanelFeedProvider panelId="left" key={`left-refresh-${leftRefreshKey}`}>
                <ChartPanel panelId="left" />
              </PanelFeedProvider>
            </div>

            {/* Draggable Divider */}
            {isDual && (
              <div
                className={
                  isHorizontal
                    ? 'h-[5px] w-full shrink-0 relative cursor-row-resize group z-10'
                    : 'w-[5px] h-full shrink-0 relative cursor-col-resize group z-10'
                }
                onMouseDown={onDividerMouseDown}
              >
                {/* Visible thin line */}
                <div
                  className={
                    isHorizontal
                      ? 'absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-border group-hover:bg-accent/50 transition-colors duration-150'
                      : 'absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-border group-hover:bg-accent/50 transition-colors duration-150'
                  }
                />
                {/* Wider hit area on hover glow */}
                <div
                  className={
                    isHorizontal
                      ? 'absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-transparent group-hover:bg-accent/10 transition-colors duration-150 rounded-full'
                      : 'absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-transparent group-hover:bg-accent/10 transition-colors duration-150 rounded-full'
                  }
                />
              </div>
            )}

            {/* Panel 2 (Right / Bottom) — only in dual mode */}
            {isDual && (
              <div style={panel2Style} className="flex min-w-0 min-h-0 overflow-hidden">
                <PanelFeedProvider panelId="right" key={`right-refresh-${rightRefreshKey}`}>
                  <ChartPanel panelId="right" />
                </PanelFeedProvider>
              </div>
            )}
          </div>
          
          {!focusMode && process.env.NEXT_PUBLIC_DISABLE_TRADING !== 'true' && <OrdersPanel />}
        </main>
      </div>

      <DebugPanel />
    </div>
  );
}

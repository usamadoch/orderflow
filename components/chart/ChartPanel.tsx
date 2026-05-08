'use client';

import React from 'react';
import { useChartStore, PanelId } from '@/lib/store/chart';
import { useChartEngine } from '../ChartEngineContext';
import { ChartCanvas } from './ChartCanvas';
import { PanelToolbar } from '../ui/PanelToolbar';
// import { PanelToolbar } from '../ui/PanelToolbar';

interface ChartPanelProps {
  panelId: PanelId;
}

export function ChartPanel({ panelId }: ChartPanelProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const setBarWidth = useChartStore(s => s.setBarWidth);
  const setScrollOffset = useChartStore(s => s.setScrollOffset);
  const engine = useChartEngine();

  return (
    <div
      className="flex flex-col h-full w-full"
      onMouseEnter={() => setActivePanel(panelId)}
    >
      <PanelToolbar panelId={panelId} />
      <div className="flex-1 relative">
        <ChartCanvas
          panelId={panelId}
          candles={panel.candles}
          chartMode={panel.chartMode}
          footprintMode={panel.footprintMode}
          bucketSize={panel.bucketSize}
          barWidth={panel.barWidth}
          scrollOffset={panel.scrollOffset}
          timeframe={panel.timeframe}
          footprintTrigger={panel.footprintTrigger}
          isLoadingHistory={panel.isLoadingHistory}
          engine={engine}
          onBarWidthChange={(v) => setBarWidth(panelId, v)}
          onScrollOffsetChange={(v) => setScrollOffset(panelId, v)}
        />
      </div>
    </div>
  );
}

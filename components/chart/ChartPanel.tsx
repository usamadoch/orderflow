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
          absorptionEnabled={panel.absorptionEnabled}
          absorptionMinScore={panel.absorptionMinScore}
          absorptionSide={panel.absorptionSide}
          absorptionShowLabels={panel.absorptionShowLabels}
          absorptionMap={panel.absorptionMap}
          bubblesEnabled={panel.bubblesEnabled}
          bubbleThreshold={panel.bubbleThreshold}
          bubbleThresholdMode={panel.bubbleThresholdMode}
          bubbleMinRadius={panel.bubbleMinRadius}
          bubbleMaxRadius={panel.bubbleMaxRadius}
          bubbleSide={panel.bubbleSide}
          isDrawMode={panel.isDrawMode}
          customProfileRange={panel.customProfileRange}
          customProfileLocked={panel.customProfileLocked}
          isProfileSelected={panel.isProfileSelected}
          drawnLines={panel.drawnLines}
          lineDrawMode={panel.lineDrawMode}
          exhaustionEnabled={panel.exhaustionEnabled}
          exhaustionMinScore={panel.exhaustionMinScore}
          exhaustionSide={panel.exhaustionSide}
          exhaustionShowProvisional={panel.exhaustionShowProvisional}
          exhaustionMap={panel.exhaustionMap}
          icebergEnabled={panel.icebergEnabled}
          icebergMinScore={panel.icebergMinScore}
          icebergLookback={panel.icebergLookback}
          icebergShowSuspected={panel.icebergShowSuspected}
          icebergShowLabels={panel.icebergShowLabels}
          icebergShowTint={panel.icebergShowTint}
          icebergLevels={panel.icebergLevels}
          profileWidthPct={panel.profileWidthPct}
          profileOpacity={panel.profileOpacity}
          profileMinRowWidth={panel.profileMinRowWidth}
          profileScaleMode={panel.profileScaleMode}
          profileShowPocHighlight={panel.profileShowPocHighlight}
          profileShowVaFill={panel.profileShowVaFill}
          profileShowPocLine={panel.profileShowPocLine}
          profileShowVaLines={panel.profileShowVaLines}
          profileShowDelta={panel.profileShowDelta}
          deltaProfileWidth={panel.deltaProfileWidth}
          measureToolActive={panel.measureToolActive}
          activeMeasurement={panel.activeMeasurement}
          sessionsEnabled={panel.sessionsEnabled}
          sessions={panel.sessions}
          onBarWidthChange={(v) => setBarWidth(panelId, v)}
          onScrollOffsetChange={(v) => setScrollOffset(panelId, v)}
        />
      </div>
    </div>
  );
}

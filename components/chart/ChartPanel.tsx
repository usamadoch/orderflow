'use client';

import React from 'react';
import { useChartStore, PanelId } from '@/lib/store/chart';
import { useChartEngine, useLiquidityHistory, useVolumeProfileEngine } from '../ChartEngineContext';
import { ChartCanvas } from './ChartCanvas';
import { CvdPanel } from './CvdPanel';
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
  const setCvdPanelHeightPct = useChartStore(s => s.setCvdPanelHeightPct);
  const tickSize = useChartStore(s => s.tickSize);
  const engine = useChartEngine();
  const liquidityHistory = useLiquidityHistory();
  const { volumeProfileEngine, volumeProfileRevision } = useVolumeProfileEngine();
  const chartProfileWidth = (panel.defaultProfileEnabled ? 120 : 0) + (panel.liquidityHeatmapEnabled ? panel.liquidityHeatmapWidth : 0);
  const chartAreaRef = React.useRef<HTMLDivElement>(null);

  const startCvdResize = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = chartAreaRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;

      const panelHeightPct = ((rect.bottom - moveEvent.clientY) / rect.height) * 100;
      setCvdPanelHeightPct(panelId, panelHeightPct);
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelId, setCvdPanelHeightPct]);

  return (
    <div
      className="flex flex-col h-full w-full"
      onMouseEnter={() => setActivePanel(panelId)}
    >
      <PanelToolbar panelId={panelId} />
      <div ref={chartAreaRef} className="flex-1 relative min-h-0 flex flex-col">
        <div
          className="relative min-h-0"
          style={{ height: panel.cvdEnabled ? `${100 - panel.cvdPanelHeightPct}%` : '100%' }}
        >
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
            volumeProfileEngine={volumeProfileEngine}
            volumeProfileRevision={volumeProfileRevision}
            tickSize={tickSize}
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
            liquidityVacuumEnabled={panel.liquidityVacuumEnabled}
            liquidityVacuumMinScore={panel.liquidityVacuumMinScore}
            liquidityVacuumShowLabels={panel.liquidityVacuumShowLabels}
            liquidityVacuumOpacity={panel.liquidityVacuumOpacity}
            liquidityVacuumZones={panel.liquidityVacuumZones}
            profileWidthPct={panel.profileWidthPct}
            defaultProfileEnabled={panel.defaultProfileEnabled}
            profileResolutionTicks={panel.profileResolutionTicks}
            profileMinRowHeight={panel.profileMinRowHeight}
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
            liquidityZones={panel.liquidityZones}
            liquidityEnabled={panel.liquidityEnabled}
            liquidityOpacity={panel.liquidityOpacity}
            liquidityBucketSize={panel.liquidityBucketSize}
            liquidityHistory={liquidityHistory}
            liquidityHeatmapEnabled={panel.liquidityHeatmapEnabled}
            liquidityHeatmapOpacity={panel.liquidityHeatmapOpacity}
            liquidityHeatmapAgeFade={panel.liquidityHeatmapAgeFade}
            liquidityHeatmapWidth={panel.liquidityHeatmapWidth}
            liquidityHeatmapShowPulled={panel.liquidityHeatmapShowPulled}
            liquidityHeatmapShowConsumed={panel.liquidityHeatmapShowConsumed}
            liquidityHeatmapShowPersistence={panel.liquidityHeatmapShowPersistence}
            liquidityHeatmapShowCurrentLabel={panel.liquidityHeatmapShowCurrentLabel}
            liquidityHeatmapProfileSync={panel.liquidityHeatmapProfileSync}
            showTimeAxis={!panel.cvdEnabled}
            onBarWidthChange={(v) => setBarWidth(panelId, v)}
            onScrollOffsetChange={(v) => setScrollOffset(panelId, v)}
          />
        </div>
        {panel.cvdEnabled && (
          <div
            className="relative min-h-[88px] border-t border-[#1F1F1F]"
            style={{ height: `${panel.cvdPanelHeightPct}%` }}
          >
            <div
              onMouseDown={startCvdResize}
              className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-20 group"
              title="Resize CVD panel"
            >
              <div className="absolute left-0 right-0 top-1/2 h-px bg-transparent group-hover:bg-accent/60 transition-colors" />
            </div>
            <CvdPanel
              panelId={panelId}
              candles={panel.candles}
              engine={engine}
              barWidth={panel.barWidth}
              scrollOffset={panel.scrollOffset}
              footprintTrigger={panel.footprintTrigger}
              volumeProfileRevision={volumeProfileRevision}
              profileWidth={chartProfileWidth}
              sessions={panel.sessions}
              cvdMode={panel.cvdMode}
              cvdSmoothing={panel.cvdSmoothing}
              cvdResetMode={panel.cvdResetMode}
              cvdPositiveColor={panel.cvdPositiveColor}
              cvdNegativeColor={panel.cvdNegativeColor}
              cvdScaleMode={panel.cvdScaleMode}
              cvdFixedRange={panel.cvdFixedRange}
              cvdShowDivergence={panel.cvdShowDivergence}
            />
          </div>
        )}
      </div>
    </div>
  );
}

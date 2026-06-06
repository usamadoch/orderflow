'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { useChartStore, PanelId } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { buildCvdSeries } from '@/lib/utils/delta';
import { useChartEngine, useLiquidityHistory, useVolumeProfileEngine } from '../ChartEngineContext';
import { ChartCanvas } from './ChartCanvas';
import { CvdPanel } from './CvdPanel';
import { formatCvdValue } from './drawCvd';
import { PanelToolbar } from '../ui/PanelToolbar';
import { DrawingFavoritesToolbar } from '../ui/DrawingFavoritesToolbar';
import { IndicatorLabels } from './IndicatorLabels';

interface ChartPanelProps {
  panelId: PanelId;
}

function formatCount(value: number) {
  return value.toLocaleString('en-US');
}

export function ChartPanel({ panelId }: ChartPanelProps) {
  const panelSettings = useChartStore(s => s.panels[panelId]);
  const panelRuntime = useChartRuntimeStore(s => s.panels[panelId]);
  const panel = { ...panelSettings, ...panelRuntime };
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const setBarWidth = useChartStore(s => s.setBarWidth);
  const setScrollOffset = useChartStore(s => s.setScrollOffset);
  const setCvdPanelHeightPct = useChartStore(s => s.setCvdPanelHeightPct);
  const setCvdMinimized = useChartStore(s => s.setCvdMinimized);
  const setHistoryRestoreStatus = useChartRuntimeStore(s => s.setHistoryRestoreStatus);
  const tickSize = useChartStore(s => s.tickSize);
  const engine = useChartEngine();
  const liquidityHistory = useLiquidityHistory();
  const { volumeProfileEngine, volumeProfileRevision } = useVolumeProfileEngine();
  const chartProfileWidth = (panel.defaultProfileEnabled ? 120 : 0) + (panel.liquidityHeatmapEnabled ? panel.liquidityHeatmapWidth : 0);
  const chartAreaRef = React.useRef<HTMLDivElement>(null);
  const isCvdExpanded = panel.cvdEnabled && !panel.cvdMinimized;
  const isCvdCompact = panel.cvdEnabled && panel.cvdMinimized;
  const compactCvdPoints = isCvdCompact
    ? buildCvdSeries(panel.candles, engine, {
      resetMode: panel.cvdResetMode,
      smoothing: panel.cvdSmoothing,
      sessions: panel.sessions,
    })
    : [];
  const latestCvdValue = compactCvdPoints[compactCvdPoints.length - 1]?.close ?? 0;
  const restoreStatus = panel.historyRestoreStatus;
  const showRestoreStatus = restoreStatus !== null && (
    panel.isLoadingHistory
    || restoreStatus.stage === 'volumeProfile'
    || restoreStatus.stage === 'complete'
    || restoreStatus.stage === 'error'
  );
  const restoreStatusTone = restoreStatus?.stage === 'error'
    ? 'border-red-500/40 bg-red-950/80 text-red-100'
    : restoreStatus?.stage === 'complete'
      ? 'border-emerald-500/30 bg-[#071311]/90 text-emerald-100'
      : 'border-accent/30 bg-[#0B1014]/90 text-main';
  const restoreDetails = restoreStatus ? [
    restoreStatus.liveConnected ? 'Live feed connected' : 'Live feed connecting',
    restoreStatus.candleCount > 0 ? `${formatCount(restoreStatus.candleCount)} candles` : null,
    restoreStatus.footprintRowCount > 0 ? `${formatCount(restoreStatus.footprintRowCount)} footprint rows` : null,
    restoreStatus.profileRowCount > 0 ? `${formatCount(restoreStatus.profileRowCount)} profile rows` : null,
  ].filter((detail): detail is string => Boolean(detail)) : [];

  React.useEffect(() => {
    if (restoreStatus?.stage !== 'complete') return;

    const timeout = window.setTimeout(() => {
      const currentStatus = useChartRuntimeStore.getState().panels[panelId].historyRestoreStatus;
      if (currentStatus?.updatedAt === restoreStatus.updatedAt && currentStatus.stage === 'complete') {
        setHistoryRestoreStatus(panelId, null);
      }
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [panelId, restoreStatus?.stage, restoreStatus?.updatedAt, setHistoryRestoreStatus]);

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
      data-chart-panel-id={panelId}
      className="relative flex flex-col h-full w-full overflow-hidden"
      onMouseEnter={() => setActivePanel(panelId)}
    >
      <PanelToolbar panelId={panelId} />
      <DrawingFavoritesToolbar panelId={panelId} />
      <div ref={chartAreaRef} className="flex-1 relative min-h-0 flex flex-col">
        <div
          className={`relative min-h-0 ${isCvdCompact ? 'flex-1' : ''}`}
          style={{ height: isCvdExpanded ? `${100 - panel.cvdPanelHeightPct}%` : panel.cvdEnabled ? undefined : '100%' }}
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
            bubbleSource={panel.bubbleSource}
            bubbleSizeBy={panel.bubbleSizeBy}
            aggregateBubbleMarketSource={panel.aggregateBubbleMarketSource}
            bubbleThreshold={panel.bubbleThreshold}
            bubbleThresholdMode={panel.bubbleThresholdMode}
            bubbleMinOrders={panel.bubbleMinOrders}
            bubbleMinRadius={panel.bubbleMinRadius}
            bubbleMaxRadius={panel.bubbleMaxRadius}
            bubbleSide={panel.bubbleSide}
            bubbleScaleMode={panel.bubbleScaleMode}
            aggregateBubbleEvents={panel.aggregateBubbleEvents}
            activeChartContractType={panel.contractType}
            activeDataSourceMode={panel.dataSourceMode}
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
            showTimeAxis={!panel.cvdEnabled || panel.cvdMinimized}
            onBarWidthChange={(v) => setBarWidth(panelId, v)}
            onScrollOffsetChange={(v) => setScrollOffset(panelId, v)}
          />
          <IndicatorLabels panelId={panelId} />
          {showRestoreStatus && restoreStatus && (
            <div
              className={`absolute right-3 top-3 z-40 max-w-[min(360px,calc(100%-24px))] rounded-md border px-3 py-2 shadow-lg backdrop-blur ${restoreStatusTone}`}
              title={restoreStatus.message}
            >
              <div className="flex items-center gap-2 min-w-0">
                {restoreStatus.stage === 'error' ? (
                  <AlertTriangle size={14} strokeWidth={2.4} className="shrink-0 text-red-300" />
                ) : restoreStatus.stage === 'complete' ? (
                  <CheckCircle2 size={14} strokeWidth={2.4} className="shrink-0 text-emerald-300" />
                ) : (
                  <Loader2 size={14} strokeWidth={2.4} className="shrink-0 animate-spin text-accent" />
                )}
                <span className="truncate text-[11px] font-bold">{restoreStatus.message}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setHistoryRestoreStatus(panelId, null);
                  }}
                  className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/10 text-text-dim transition-colors hover:border-white/25 hover:text-main"
                  title="Hide restore status"
                  aria-label="Hide restore status"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
              {restoreDetails.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-medium text-text-dim">
                  {restoreDetails.map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {isCvdCompact && (
            <button
              onClick={() => setCvdMinimized(panelId, false)}
              className="absolute left-0 right-0 bottom-6 z-30 h-7 border-y border-[#1F1F1F] bg-[#0D0D0D]/95 hover:bg-[#121212] transition-colors flex items-center justify-between px-3 group"
              title="Maximize CVD panel"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-[0.18em] text-text-dim">CVD</span>
                <span
                  className="text-[11px] font-mono font-bold"
                  style={{ color: latestCvdValue >= 0 ? panel.cvdPositiveColor : panel.cvdNegativeColor }}
                >
                  {formatCvdValue(latestCvdValue)}
                </span>
              </div>
              <div className="h-5 w-5 rounded border border-[#262626] text-[#787B86] group-hover:border-accent/60 group-hover:text-[#E8E8E8] transition-colors flex items-center justify-center">
                <Maximize2 size={11} strokeWidth={2.5} />
              </div>
            </button>
          )}
        </div>
        {isCvdExpanded && (
          <div
            className="relative min-h-[88px] border-t border-[#1F1F1F]"
            style={{ height: `${panel.cvdPanelHeightPct}%` }}
          >
            <button
              onClick={() => setCvdMinimized(panelId, true)}
              className="absolute top-2 right-[92px] z-30 h-6 w-6 rounded border border-[#262626] bg-[#0D0D0D]/80 text-[#787B86] hover:border-accent/60 hover:text-[#E8E8E8] transition-colors flex items-center justify-center"
              title="Minimize CVD panel"
            >
              <Minimize2 size={12} strokeWidth={2.4} />
            </button>
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
              cvdDivergenceLookback={panel.cvdDivergenceLookback}
            />
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { FigButton } from '../ui/fig';

// 2. Internal packages & stores
import { useChartStore, PanelId } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { buildCvdSeries } from '@/lib/utils/delta';
import { chartColorToRgba, DEFAULT_GRID_COLOR, DEFAULT_GRID_OPACITY } from '@/lib/config/chartColors';

// 3. Relative component & utility imports
import { DrawingFavoritesToolbar } from '../ui/DrawingFavoritesToolbar';
import { OrderTicket } from '../ui/OrderTicket';
import { PanelToolbar } from '../ui/PanelToolbar';
import { useChartEngine, useLiquidityHistory, useVolumeProfileEngine } from '../ChartEngineContext';
import { ChartCanvas } from './ChartCanvas';
import { CvdPanel } from './CvdPanel';
import { formatCvdValue } from './drawCvd';
import { IndicatorLabels } from './IndicatorLabels';

function onRenderCallback(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
  startTime: number
) {
  if (actualDuration >= 10 && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markBuf = (window as any).__markBuf;
    if (markBuf) {
      markBuf.push({
        type: 'mark',
        label: `ReactRender(${phase})`,
        startTime,
        duration: actualDuration,
        wallTime: new Date((performance.timeOrigin || 0) + startTime).toISOString().split('T')[1].replace('Z', '')
      });
      if (markBuf.length > 200) markBuf.shift();
    }
  }
}

interface ChartPanelProps {
  panelId: PanelId;
}

export function ChartPanel({ panelId }: ChartPanelProps) {
  const panelSettings = useChartStore(s => s.panels[panelId]);
  const historyRestoreStatus = useChartRuntimeStore(s => s.panels[panelId].historyRestoreStatus);
  const isLoadingHistory = useChartRuntimeStore(s => s.panels[panelId].isLoadingHistory);
  const connected = useChartRuntimeStore(s => s.panels[panelId].connected);
  const panel = React.useMemo(() => ({
    ...panelSettings,
    historyRestoreStatus,
    isLoadingHistory,
    connected,
  }), [panelSettings, historyRestoreStatus, isLoadingHistory, connected]);

  const setActivePanel = useChartStore(s => s.setActivePanel);
  const setBarWidth = useChartStore(s => s.setBarWidth);
  const setScrollOffset = useChartStore(s => s.setScrollOffset);
  const setCvdPanelHeightPct = useChartStore(s => s.setCvdPanelHeightPct);
  const setCvdMinimized = useChartStore(s => s.setCvdMinimized);
  const setHistoryRestoreStatus = useChartRuntimeStore(s => s.setHistoryRestoreStatus);
  const tickSize = useChartStore(s => s.tickSize);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);
  const horizontalGridLineColor = useChartStore(s => s.horizontalGridLineColor);
  const horizontalGridLineOpacity = useChartStore(s => s.horizontalGridLineOpacity);
  const engine = useChartEngine();
  const liquidityHistory = useLiquidityHistory();
  const { volumeProfileEngine, volumeProfileRevision } = useVolumeProfileEngine();
  
  const chartProfileWidth = (panel.defaultProfileEnabled ? 120 : 0) + (panel.liquidityHeatmapEnabled ? panel.liquidityHeatmapWidth : 0);
  const chartAreaRef = React.useRef<HTMLDivElement>(null);
  
  const isCvdExpanded = panel.cvdEnabled && !panel.cvdMinimized;
  const isCvdCompact = panel.cvdEnabled && panel.cvdMinimized;
  
  // Create a minimal wrapper component to calculate and render the compact CVD point
  const CompactCvdPoint = React.useMemo(() => {
    return function CompactCvdDisplay() {
      const [latestValue, setLatestValue] = React.useState(0);
      
      React.useEffect(() => {
        if (!isCvdCompact) return;
        
        let mounted = true;
        
        const update = () => {
          if (!mounted) return;
          const storeState = useChartRuntimeStore.getState();
          const candles = storeState.panels[panelId].candles;
          
          if (candles && candles.length > 0) {
            const points = buildCvdSeries(candles, engine, {
              resetMode: panel.cvdResetMode,
              smoothing: panel.cvdSmoothing,
              sessions: panel.sessions,
              timezone: globalTimezone,
            });
            setLatestValue(points[points.length - 1]?.close ?? 0);
          }
        };
        
        // Initial update
        update();
        
        // Subscribe to changes
        const unsub = useChartRuntimeStore.subscribe(
          state => state.panels[panelId].dataVersion,
          update
        );
        
        return () => {
          mounted = false;
          unsub();
        };
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [panel.cvdResetMode, panel.cvdSmoothing, panel.sessions, panel.cvdPositiveColor, panel.cvdNegativeColor, globalTimezone]);

      return (
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: latestValue >= 0 ? panel.cvdPositiveColor : panel.cvdNegativeColor }}
        >
          {formatCvdValue(latestValue)}
        </span>
      );
    };
  }, [panelId, engine, isCvdCompact, panel.cvdResetMode, panel.cvdSmoothing, panel.sessions, panel.cvdPositiveColor, panel.cvdNegativeColor, globalTimezone]);


  const restoreStatus = panel.historyRestoreStatus;
  const isPanelLoading = panel.isLoadingHistory || (
    restoreStatus !== null
    && restoreStatus.stage !== 'idle'
    && restoreStatus.stage !== 'complete'
    && restoreStatus.stage !== 'error'
  );
  
  const flowSource = panel.dataSourceMode;
  const volumeFlowSource = flowSource === panel.contractType ? 'active' : flowSource;
  const panelSymbol = panel.pair.toUpperCase();

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
      className="relative flex flex-col h-full w-full overflow-hidden bg-background"
      onMouseEnter={() => setActivePanel(panelId)}
    >
      <PanelToolbar panelId={panelId} />
      <DrawingFavoritesToolbar panelId={panelId} />
      <div ref={chartAreaRef} className="flex-1 relative min-h-0 flex flex-col bg-background">
        <div
          className={`relative min-h-0 ${isCvdCompact ? 'flex-1' : ''}`}
          style={{ height: isCvdExpanded ? `${100 - panel.cvdPanelHeightPct}%` : panel.cvdEnabled ? '100%' : '100%' }}
        >
          <React.Profiler id="ChartCanvas" onRender={onRenderCallback}>
            <ChartCanvas
              panelId={panelId}
              chartMode={panel.chartMode}
              footprintMode={panel.footprintMode}
              bucketSize={panel.bucketSize}
              barWidth={panel.barWidth}
              scrollOffset={panel.scrollOffset}
              timeframe={panel.timeframe}
              isLoadingHistory={panel.isLoadingHistory}
              engine={engine}
              volumeProfileEngine={volumeProfileEngine}
              volumeProfileRevision={volumeProfileRevision}
              tickSize={tickSize}
              absorptionEnabled={panel.absorptionEnabled}
              absorptionMinScore={panel.absorptionMinScore}
              absorptionSide={panel.absorptionSide}
              absorptionShowLabels={panel.absorptionShowLabels}
              bubblesEnabled={panel.bubblesEnabled}
              bubbleFilterRender={panel.bubbleFilterRender}
              bubbleStdDevVal={panel.bubbleStdDevVal}
              bubbleOutStdDevPerc={panel.bubbleOutStdDevPerc}
              bubbleSizeBy={panel.bubbleSizeBy}
              aggregateBubbleMarketSource={flowSource}
              bubbleThreshold={panel.bubbleThreshold}
              bubbleThresholdMode={panel.bubbleThresholdMode}
              bubbleMinOrders={panel.bubbleMinOrders}
              bubbleSide={panel.bubbleSide}
              bubbleScaleMode={panel.bubbleScaleMode}
              bubbleColorMode={panel.bubbleColorMode}
              bubbleVolumeColorMode={panel.bubbleVolumeColorMode}
              bubbleDisplayMode={panel.bubbleDisplayMode}
              bubbleBidColor={panel.bubbleBidColor}
              bubbleAskColor={panel.bubbleAskColor}
              bubbleLineWidth={panel.bubbleLineWidth}
              bubbleOpacity={panel.bubbleOpacity}
              bubbleGroupingMode={panel.bubbleGroupingMode}
              bubblePriceAggrMode={panel.bubblePriceAggrMode}
              bubbleTickGroupingMode={panel.bubbleTickGroupingMode}
              bubbleTickCount={panel.bubbleTickCount}
              bubbleTimeWindowMs={panel.bubbleTimeWindowMs}
              activeChartContractType={panel.contractType}
              activeDataSourceMode={panel.dataSourceMode}
              tradingSymbol={panelSymbol}
              tradingContractType={panel.contractType}
              activeIndicators={panel.activeIndicators}
              volumeBarsEnabled={panel.volumeBarsEnabled}
              volumeBarsInputData={panel.volumeBarsInputData}
              volumeBarsMarketSource={volumeFlowSource}
              volumeBarsFilterMode={panel.volumeBarsFilterMode}
              volumeBarsMovingAverageLength={panel.volumeBarsMovingAverageLength}
              volumeBarsFilterMin={panel.volumeBarsFilterMin}
              volumeBarsFilterMax={panel.volumeBarsFilterMax}
              volumeBarsColorMode={panel.volumeBarsColorMode}
              volumeBarsOpacity={panel.volumeBarsOpacity}
              volumeBarsHeightPct={panel.volumeBarsHeightPct}
              volumeBarsShowValueText={panel.volumeBarsShowValueText}
              volumeBarsTextSize={panel.volumeBarsTextSize}
              volumeBarsAverageLineEnabled={panel.volumeBarsAverageLineEnabled}
              volumeBarsAverageLength={panel.volumeBarsAverageLength}
              isDrawMode={panel.isDrawMode}
              customProfileRange={panel.customProfileRange}
              customProfileLocked={panel.customProfileLocked}
              drawnLines={panel.drawnLines}
              lineDrawMode={panel.lineDrawMode}
              exhaustionEnabled={panel.exhaustionEnabled}
              exhaustionMinScore={panel.exhaustionMinScore}
              exhaustionSide={panel.exhaustionSide}
              exhaustionShowProvisional={panel.exhaustionShowProvisional}
              icebergEnabled={panel.icebergEnabled}
              icebergMinScore={panel.icebergMinScore}
              icebergLookback={panel.icebergLookback}
              icebergShowSuspected={panel.icebergShowSuspected}
              icebergShowLabels={panel.icebergShowLabels}
              icebergShowTint={panel.icebergShowTint}
              liquidityVacuumEnabled={panel.liquidityVacuumEnabled}
              liquidityVacuumMinScore={panel.liquidityVacuumMinScore}
              liquidityVacuumShowLabels={panel.liquidityVacuumShowLabels}
              liquidityVacuumOpacity={panel.liquidityVacuumOpacity}
              profileWidthPct={panel.profileWidthPct}
              defaultProfileEnabled={panel.defaultProfileEnabled}
              defaultProfilePeriod={panel.defaultProfilePeriod}
              profileResolutionTicks={panel.profileResolutionTicks}
              profileMinRowHeight={panel.profileMinRowHeight}
              profileOpacity={panel.profileOpacity}
              profileMinRowWidth={panel.profileMinRowWidth}
              profileScaleMode={panel.profileScaleMode}
              profileShowPocHighlight={panel.profileShowPocHighlight}
              profileShowVaFill={panel.profileShowVaFill}
              profileShowPocLine={panel.profileShowPocLine}
              profileShowVaLines={panel.profileShowVaLines}
              profileType={panel.profileType}
              profileInputData={panel.profileInputData}
              profilePocColor={panel.profilePocColor}
              profileHvnColor={panel.profileHvnColor}
              profileLvnColor={panel.profileLvnColor}
              profilePocWidth={panel.profilePocWidth}
              profileFilterMin={panel.profileFilterMin}
              profileFilterMax={panel.profileFilterMax}
              historicalSessionProfileEnabled={panel.historicalSessionProfileEnabled}
              profileNodeSensitivity={panel.profileNodeSensitivity}
              deltaProfileWidth={panel.deltaProfileWidth}
              sessionsEnabled={panel.sessionsEnabled}
              sessions={panel.sessions}
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
              statsIndicatorEnabled={panel.statsIndicatorEnabled}
              statsIndicatorItems={panel.statsIndicatorItems}
              globalTimezone={globalTimezone}
              globalTimeFormat={globalTimeFormat}
              showTimeAxis={!panel.cvdEnabled || panel.cvdMinimized}
              onBarWidthChange={(v) => setBarWidth(panelId, v)}
              onScrollOffsetChange={(v) => setScrollOffset(panelId, v)}
            />
          </React.Profiler>
          <IndicatorLabels panelId={panelId} isLoading={isPanelLoading} />
          {process.env.NEXT_PUBLIC_DISABLE_TRADING !== 'true' && <OrderTicket panelId={panelId} />}
          {isCvdCompact && (
            <FigButton
              variant="ghost"
              size="compact"
              onClick={() => setCvdMinimized(panelId, false)}
              className="absolute left-0 right-0 bottom-6 z-30 h-7 rounded-none border-y border-[#1F1F1F] bg-[#1F1F1F]/95 hover:bg-[#1F1F1F] transition-colors flex items-center justify-between px-3 group"
              title="Maximize CVD panel"
              aria-label="Maximize CVD panel"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-[0.18em] text-text-dim">CVD</span>
                <CompactCvdPoint />
              </div>
              <div className="h-5 w-5 rounded border border-[#262626] text-[#787B86] group-hover:border-accent/60 group-hover:text-[#E8E8E8] transition-colors flex items-center justify-center">
                <Maximize2 size={11} strokeWidth={2.5} />
              </div>
            </FigButton>
          )}
        </div>
        {isCvdExpanded && (
          <div
            className="relative min-h-[88px] border-t"
            style={{
              height: `${panel.cvdPanelHeightPct}%`,
              borderTopColor: chartColorToRgba(horizontalGridLineColor || DEFAULT_GRID_COLOR, horizontalGridLineOpacity ?? DEFAULT_GRID_OPACITY),
            }}
          >
            <FigButton
              variant="ghost"
              icon
              onClick={() => setCvdMinimized(panelId, true)}
              className="absolute top-2 right-[92px] z-30"
              title="Minimize CVD panel"
              aria-label="Minimize CVD panel"
            >
              <Minimize2 size={12} strokeWidth={2.4} />
            </FigButton>
            <div
              onMouseDown={startCvdResize}
              className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-20 group"
              title="Resize CVD panel"
            >
              <div className="absolute left-0 right-0 top-1/2 h-px bg-transparent group-hover:bg-accent/60 transition-colors" />
            </div>
            <CvdPanel
              panelId={panelId}
              engine={engine}
              barWidth={panel.barWidth}
              scrollOffset={panel.scrollOffset}
              volumeProfileRevision={volumeProfileRevision}
              profileWidth={chartProfileWidth}
              sessions={panel.sessions}
              globalTimezone={globalTimezone}
              globalTimeFormat={globalTimeFormat}
              cvdMode={panel.cvdMode}
              cvdSmoothing={panel.cvdSmoothing}
              cvdResetMode={panel.cvdResetMode}
              cvdPositiveColor={panel.cvdPositiveColor}
              cvdNegativeColor={panel.cvdNegativeColor}
              cvdScaleMode={panel.cvdScaleMode}
              cvdFixedRange={panel.cvdFixedRange}
              cvdShowDivergence={panel.cvdShowDivergence}
              cvdDivergenceLookback={panel.cvdDivergenceLookback}
              drawnLines={panel.drawnLines}
            />
          </div>
        )}
      </div>
    </div>
  );
}

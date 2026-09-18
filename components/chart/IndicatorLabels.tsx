'use client';

import React from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Settings, X, ArrowUp, ArrowDown } from 'lucide-react';
import { FigButton, FigTooltip } from '@/components/ui/fig';

// 2. Internal packages & stores
import { useChartStore, type DataSourceMode, type PanelId, type IndicatorId, type IndicatorSettingsSection } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { ChartSettingsDropdown } from '@/components/ui/ChartSettingsDropdown';

interface IndicatorLabelsProps {
  panelId: PanelId;
  isLoading?: boolean;
}

const SOURCE_OPTIONS: { label: string; value: DataSourceMode }[] = [
  { label: 'Spot', value: 'spot' },
  { label: 'Futures', value: 'futures' },
  { label: 'Both', value: 'both' },
];

export function IndicatorLabels({ panelId, isLoading = false }: IndicatorLabelsProps) {
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const collapsed = useChartStore(s => s.panels[panelId].indicatorLabelsCollapsed);
  const setCollapsed = useChartStore(s => s.setIndicatorLabelsCollapsed);
  const panel = useChartStore(s => s.panels[panelId]);
  const setDataSourceMode = useChartStore(s => s.setDataSourceMode);
  const setMt5CompareShowBinance = useChartStore(s => s.setMt5CompareShowBinance);
  const connected = useChartRuntimeStore(s => s.panels[panelId].connected);
  const mt5BridgeStatus = useChartRuntimeStore(s => s.tradingStatus.mt5BridgeStatus);
  const contractLabel = panel.contractType === 'futures' ? 'Futures' : 'Spot';

  const removeIndicator = useChartStore(s => s.removeIndicator);
  const addIndicator = useChartStore(s => s.addIndicator);
  const moveIndicator = useChartStore(s => s.moveIndicator);
  const openIndicatorSettings = useChartStore(s => s.openIndicatorSettings);
  
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setCvdEnabled = useChartStore(s => s.setCvdEnabled);
  const setVolumeBarsEnabled = useChartStore(s => s.setVolumeBarsEnabled);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setHistoricalSessionProfileEnabled = useChartStore(s => s.setHistoricalSessionProfileEnabled);
  const setDefaultProfileEnabled = useChartStore(s => s.setDefaultProfileEnabled);
  const setLiquidityHeatmapEnabled = useChartStore(s => s.setLiquidityHeatmapEnabled);
  const setLiquidityEnabled = useChartStore(s => s.setLiquidityEnabled);
  const setStatsIndicatorEnabled = useChartStore(s => s.setStatsIndicatorEnabled);

  const effectiveActiveIndicators = Array.from(new Set([
    ...(panel.activeIndicators || ['volumeBars', 'stats']),
    ...(panel.bubblesEnabled ? ['bubbles'] : []),
    ...(panel.cvdEnabled ? ['cvd'] : []),
    ...(panel.volumeBarsEnabled ? ['volumeBars'] : []),
    ...(panel.sessionsEnabled ? ['sessions'] : []),
    ...(panel.historicalSessionProfileEnabled ? ['historicalSessions'] : []),
    ...(panel.defaultProfileEnabled ? ['profile'] : []),
    ...(panel.liquidityHeatmapEnabled ? ['heatmap'] : []),
    ...(panel.liquidityEnabled ? ['liquidityMap'] : []),
    ...(panel.statsIndicatorEnabled ? ['stats'] : []),
    ...(panel.vwapEnabled ? ['vwap'] : []),
  ]));

  const getIndicatorConfig = (id: IndicatorId) => {
    switch (id) {
      case 'bubbles': return { label: 'Bubbles', enabled: panel.bubblesEnabled, toggle: () => setBubblesEnabled(panelId, !panel.bubblesEnabled) };
      case 'cvd': return { label: 'CVD', enabled: panel.cvdEnabled, toggle: () => setCvdEnabled(panelId, !panel.cvdEnabled) };
      case 'volumeBars': return { label: 'Volume', enabled: panel.volumeBarsEnabled, toggle: () => setVolumeBarsEnabled(panelId, !panel.volumeBarsEnabled) };
      case 'sessions': return { label: 'Sessions', enabled: panel.sessionsEnabled, toggle: () => setSessionsEnabled(panelId, !panel.sessionsEnabled) };
      case 'historicalSessions': return { label: 'HSVP', enabled: panel.historicalSessionProfileEnabled, toggle: () => setHistoricalSessionProfileEnabled(panelId, !panel.historicalSessionProfileEnabled) };
      case 'profile': return { label: 'VOP', enabled: panel.defaultProfileEnabled, toggle: () => setDefaultProfileEnabled(panelId, !panel.defaultProfileEnabled) };
      case 'heatmap': return { label: 'Heatmap', enabled: panel.liquidityHeatmapEnabled, toggle: () => setLiquidityHeatmapEnabled(panelId, !panel.liquidityHeatmapEnabled) };
      case 'liquidityMap': return { label: 'Liquidity', enabled: panel.liquidityEnabled, toggle: () => setLiquidityEnabled(panelId, !panel.liquidityEnabled) };
      case 'stats': return { label: 'Stats', enabled: panel.statsIndicatorEnabled, toggle: () => setStatsIndicatorEnabled(panelId, !panel.statsIndicatorEnabled) };
      case 'vwap': return { label: 'VWAP', enabled: panel.vwapEnabled, toggle: () => panel.vwapEnabled ? removeIndicator(panelId, 'vwap') : addIndicator(panelId, 'vwap') };
      default: return null;
    }
  };

  return (
    <>
      <div
        className="absolute left-3 top-2 z-30 flex flex-col items-start gap-1"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <FigTooltip text={collapsed ? 'Expand chart info and indicators' : 'Collapse chart info and indicators'}>
          <FigButton
            variant="ghost"
            icon
            size="compact"
            onClick={() => setCollapsed(panelId, !collapsed)}
            aria-label={collapsed ? 'Expand chart info and indicators' : 'Collapse chart info and indicators'}
          >
            {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
          </FigButton>
        </FigTooltip>

        {!collapsed && (
          <>
            <div className="flex h-7 items-center gap-1.5 rounded-sm text-[13px] font-semibold leading-none text-[#E8E8E8]">
              <span className="whitespace-nowrap font-bold">{panel.pair}</span>
              <span className="whitespace-nowrap text-text-dim">/</span>
              <span className="whitespace-nowrap text-[#D1D4DC]">{contractLabel}</span>
              <span className="text-text-dim/70">{'\u00b7'}</span>
              <span className="whitespace-nowrap text-[#D1D4DC]">Binance</span>
              <FigTooltip text={connected ? 'Live feed connected' : 'Live feed disconnected'}>
                <span
                  className={`h-2 w-2 rounded-full cursor-pointer ${connected ? 'bg-[#089981]' : 'bg-[#f23645]'}`}
                  aria-hidden="true"
                />
              </FigTooltip>
              <span className="text-text-dim/70">{'\u00b7'}</span>
              <div className="ml-0.5 flex items-center gap-0.5">
                {SOURCE_OPTIONS.map(({ label, value }) => (
                  <FigTooltip key={value} text={`${label} source`}>
                    <FigButton
                      variant="ghost"
                      size="small"
                      selected={panel.dataSourceMode === value}
                      onClick={() => panel.dataSourceMode !== value && setDataSourceMode(panelId, value)}
                      className={`h-5 px-1.5 text-[11px] font-bold ${
                        panel.dataSourceMode === value
                          ? 'text-accent'
                          : 'text-text-dim hover:text-[#E8E8E8]'
                      }`}
                      aria-pressed={panel.dataSourceMode === value}
                    >
                      {label}
                    </FigButton>
                  </FigTooltip>
                ))}
              </div>
              {panel.chartMode === 'side-by-side' && (
                <>
                  <span className="text-text-dim/70">{'\u00b7'}</span>
                  <FigTooltip text={mt5BridgeStatus === 'connected' ? 'MT5 Bridge Connected' : 'MT5 Bridge Disconnected'}>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[11px]">
                      <span className="text-cyan-400 font-bold">MT5</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${mt5BridgeStatus === 'connected' ? 'bg-[#00E5FF]' : 'bg-[#EF5350]'}`}
                        aria-hidden="true"
                      />
                    </div>
                  </FigTooltip>
                  <span className="text-text-dim/70">{'\u00b7'}</span>
                  <FigTooltip text={panel.mt5CompareShowBinance ? 'Hide Binance chart (show MT5 centered)' : 'Show Binance chart side-by-side'}>
                    <FigButton
                      variant="ghost"
                      size="small"
                      onClick={() => setMt5CompareShowBinance(panelId, !panel.mt5CompareShowBinance)}
                      className={`h-5 px-1.5 text-[11px] font-semibold transition-colors ${
                        panel.mt5CompareShowBinance
                          ? 'bg-[#089981]/20 text-[#089981] border border-[#089981]/30 hover:bg-[#089981]/30'
                          : 'text-[#94A3B8] hover:text-[#E8E8E8] bg-white/[0.03] border border-white/[0.08]'
                      }`}
                      aria-pressed={panel.mt5CompareShowBinance}
                    >
                      {panel.mt5CompareShowBinance ? 'Binance: On' : 'Binance: Off'}
                    </FigButton>
                  </FigTooltip>
                </>
              )}
              {isLoading && (
                <div
                  className="ml-1 flex items-center gap-0.5"
                  role="status"
                  aria-label={`${panelId === 'left' ? 'Left' : 'Right'} panel loading`}
                >
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="chart-panel-loading-dot h-1.5 w-1.5 rounded-full bg-[#909090]"
                      style={{ animationDelay: `${dot * 0.16}s` }}
                    />
                  ))}
                </div>
              )}
            </div>

            {effectiveActiveIndicators.map((id) => {
              const config = getIndicatorConfig(id as IndicatorId);
              if (!config) return null;

              return (
                <div
                  key={id}
                  className={`flex h-6 items-center rounded px-1.5 text-[12px] font-black uppercase tracking-[0.14em] text-[#E8E8E8] transition-all duration-150 hover:bg-[#1F1F1F] hover:shadow-[0_4px_18px_rgba(0,0,0,0.32)] ${
                    config.enabled ? 'opacity-100' : 'opacity-45'
                  }`}
                >
                  <span className="whitespace-nowrap">{config.label}</span>
                  <div className="ml-1.5 flex items-center gap-0.5 [--spacer-4:20px] [--spacer-3:20px]">
                    <FigTooltip text={`Move ${config.label} up`}>
                      <FigButton
                        variant="ghost"
                        icon
                        className="shrink-0 cursor-pointer"
                        onClick={() => moveIndicator(panelId, id as IndicatorId, 'up')}
                        aria-label={`Move ${config.label} up`}
                      >
                        <ArrowUp size={12} strokeWidth={2.4} />
                      </FigButton>
                    </FigTooltip>
                    <FigTooltip text={`Move ${config.label} down`}>
                      <FigButton
                        variant="ghost"
                        icon
                        className="shrink-0 cursor-pointer"
                        onClick={() => moveIndicator(panelId, id as IndicatorId, 'down')}
                        aria-label={`Move ${config.label} down`}
                      >
                        <ArrowDown size={12} strokeWidth={2.4} />
                      </FigButton>
                    </FigTooltip>
                    <FigTooltip text={`${config.enabled ? 'Hide' : 'Show'} ${config.label}`}>
                      <FigButton
                        variant="ghost"
                        icon
                        className="shrink-0 cursor-pointer"
                        onClick={config.toggle}
                        aria-label={`${config.enabled ? 'Hide' : 'Show'} ${config.label}`}
                      >
                        {config.enabled ? <Eye size={12} strokeWidth={2.4} /> : <EyeOff size={12} strokeWidth={2.4} />}
                      </FigButton>
                    </FigTooltip>
                    <FigTooltip text={`${config.label} settings`}>
                      <FigButton
                        variant="ghost"
                        icon
                        className="shrink-0 cursor-pointer"
                        onClick={() => {
                          if (id === 'profile') {
                            openIndicatorSettings(panelId, 'profiles');
                            return;
                          }
                          setOpenSection(id);
                        }}
                        aria-label={`${config.label} settings`}
                      >
                        <Settings size={12} strokeWidth={2.4} />
                      </FigButton>
                    </FigTooltip>
                    <FigTooltip text={`Remove ${config.label}`}>
                      <FigButton
                        variant="ghost"
                        icon
                        className="shrink-0 cursor-pointer"
                        onClick={() => removeIndicator(panelId, id as IndicatorId)}
                        aria-label={`Remove ${config.label}`}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </FigButton>
                    </FigTooltip>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {openSection && (
        <ChartSettingsDropdown
          panelId={panelId}
          indicatorSection={openSection as IndicatorSettingsSection}
          indicatorTitle={getIndicatorConfig(openSection as IndicatorId)?.label}
          onClose={() => setOpenSection(null)}
        />
      )}
    </>
  );
}

'use client';

import React from 'react';
// 1. External packages
import { ChevronRight, ChevronDown, Eye, EyeOff, Settings, X, ArrowUp, ArrowDown } from 'lucide-react';

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
  const connected = useChartRuntimeStore(s => s.panels[panelId].connected);
  const contractLabel = panel.contractType === 'futures' ? 'Futures' : 'Spot';

  const removeIndicator = useChartStore(s => s.removeIndicator);
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
        <button
          type="button"
          onClick={() => setCollapsed(panelId, !collapsed)}
          className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#1F1F1F] text-[#8B949E] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
          title={collapsed ? 'Expand chart info and indicators' : 'Collapse chart info and indicators'}
          aria-label={collapsed ? 'Expand chart info and indicators' : 'Collapse chart info and indicators'}
        >
          {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
        </button>

        {!collapsed && (
          <>
            <div className="flex h-7 items-center gap-1.5 rounded-sm text-[13px] font-semibold leading-none text-[#E8E8E8]">
              <span className="whitespace-nowrap font-bold">{panel.pair}</span>
              <span className="whitespace-nowrap text-text-dim">/</span>
              <span className="whitespace-nowrap text-[#D1D4DC]">{contractLabel}</span>
              <span className="text-text-dim/70">{'\u00b7'}</span>
              <span className="whitespace-nowrap text-[#D1D4DC]">Binance</span>
              <span
                className={`h-2 w-2 rounded-full ${connected ? 'bg-[#089981]' : 'bg-[#f23645]'}`}
                title={connected ? 'Live feed connected' : 'Live feed disconnected'}
                aria-hidden="true"
              />
              <span className="text-text-dim/70">{'\u00b7'}</span>
              <div className="ml-0.5 flex items-center gap-0.5">
                {SOURCE_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => panel.dataSourceMode !== value && setDataSourceMode(panelId, value)}
                    className={`h-5 rounded-sm px-1.5 text-[11px] font-bold transition-colors ${
                      panel.dataSourceMode === value
                        ? 'text-accent'
                        : 'text-text-dim hover:text-[#E8E8E8]'
                    }`}
                    title={`${label} source`}
                    aria-pressed={panel.dataSourceMode === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
                  className={`group flex h-4.5 items-center rounded px-1.5 text-[12px] font-black uppercase tracking-[0.14em] text-[#E8E8E8] transition-all duration-150 hover:bg-[#1F1F1F] hover:shadow-[0_4px_18px_rgba(0,0,0,0.32)] hover:backdrop-blur-sm ${
                    config.enabled ? 'opacity-100' : 'opacity-45'
                  }`}
                >
                  <span className="whitespace-nowrap">{config.label}</span>
                  <div className="ml-1.5 flex w-0 translate-x-[-4px] items-center gap-0.5 overflow-hidden opacity-0 transition-all duration-180 group-hover:w-[105px] group-hover:translate-x-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveIndicator(panelId, id as IndicatorId, 'up')}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
                      title={`Move ${config.label} up`}
                    >
                      <ArrowUp size={12} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIndicator(panelId, id as IndicatorId, 'down')}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
                      title={`Move ${config.label} down`}
                    >
                      <ArrowDown size={12} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={config.toggle}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
                      title={`${config.enabled ? 'Hide' : 'Show'} ${config.label}`}
                    >
                      {config.enabled ? <Eye size={14} strokeWidth={2.4} /> : <EyeOff size={14} strokeWidth={2.4} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (id === 'profile') {
                          openIndicatorSettings(panelId, 'profiles');
                          return;
                        }
                        setOpenSection(id);
                      }}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#1F1F1F] hover:text-accent"
                      title={`${config.label} settings`}
                    >
                      <Settings size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIndicator(panelId, id as IndicatorId)}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#1F1F1F] hover:text-[#f23645]"
                      title={`Remove ${config.label}`}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
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

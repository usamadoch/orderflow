'use client';

import { ChevronRight, ChevronDown, Eye, EyeOff, Settings } from 'lucide-react';
import { useState } from 'react';
import { useChartStore, type PanelId, type IndicatorSettingsSection } from '@/lib/store/chart';

interface IndicatorLabelsProps {
  panelId: PanelId;
}

interface IndicatorLabelConfig {
  id: IndicatorSettingsSection;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

export function IndicatorLabels({ panelId }: IndicatorLabelsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const panel = useChartStore(s => s.panels[panelId]);
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setCvdEnabled = useChartStore(s => s.setCvdEnabled);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setDefaultProfileEnabled = useChartStore(s => s.setDefaultProfileEnabled);
  const openIndicatorSettings = useChartStore(s => s.openIndicatorSettings);

  const indicators: IndicatorLabelConfig[] = [
    {
      id: 'bubbles',
      label: 'Bubbles',
      enabled: panel.bubblesEnabled,
      onToggle: () => setBubblesEnabled(panelId, !panel.bubblesEnabled),
    },
    {
      id: 'cvd',
      label: 'CVD',
      enabled: panel.cvdEnabled,
      onToggle: () => setCvdEnabled(panelId, !panel.cvdEnabled),
    },
    {
      id: 'sessions',
      label: 'Sessions',
      enabled: panel.sessionsEnabled,
      onToggle: () => setSessionsEnabled(panelId, !panel.sessionsEnabled),
    },
    {
      id: 'volumeProfile',
      label: 'VOP',
      enabled: panel.defaultProfileEnabled,
      onToggle: () => setDefaultProfileEnabled(panelId, !panel.defaultProfileEnabled),
    },
  ];

  return (
    <div
      className="absolute left-3 top-3 z-30 flex flex-col items-start gap-0.5"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#060606] text-[#8B949E] transition-colors hover:bg-[#111111] hover:text-[#E8E8E8]"
        title={collapsed ? 'Expand indicator labels' : 'Collapse indicator labels'}
        aria-label={collapsed ? 'Expand indicator labels' : 'Collapse indicator labels'}
      >
        {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
      </button>

      {!collapsed && indicators.map((indicator) => (
        <div
          key={indicator.id}
          className={`group flex h-4.5 items-center rounded px-1 text-[12px] font-black uppercase tracking-[0.14em] text-[#E8E8E8] transition-all duration-150 hover:bg-[#050505] hover:shadow-[0_4px_18px_rgba(0,0,0,0.32)] hover:backdrop-blur-sm ${
            indicator.enabled ? 'opacity-100' : 'opacity-45'
          }`}
        >
          <span className="whitespace-nowrap">{indicator.label}</span>
          <div className="ml-1.5 flex w-0 translate-x-[-4px] items-center gap-0.5 overflow-hidden opacity-0 transition-all duration-180 group-hover:w-[36px] group-hover:translate-x-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={indicator.onToggle}
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#151515] hover:text-[#E8E8E8]"
              title={`${indicator.enabled ? 'Hide' : 'Show'} ${indicator.label}`}
              aria-label={`${indicator.enabled ? 'Hide' : 'Show'} ${indicator.label}`}
            >
              {indicator.enabled ? <Eye size={16} strokeWidth={2.4} /> : <EyeOff size={16} strokeWidth={2.4} />}
            </button>
            <button
              type="button"
              onClick={() => openIndicatorSettings(panelId, indicator.id)}
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#151515] hover:text-accent"
              title={`${indicator.label} settings`}
              aria-label={`${indicator.label} settings`}
            >
              <Settings size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

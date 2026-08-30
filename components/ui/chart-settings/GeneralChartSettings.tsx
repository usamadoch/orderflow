import { forwardRef, useState, useEffect } from 'react';
import { useChartStore, PanelId } from '../../../lib/store/chart';
import { TIMEZONE_OPTIONS } from './constants';
import { formatDateTime } from '../../../lib/utils/format';

interface GeneralChartSettingsProps {
  panelId: PanelId;
}

export const GeneralChartSettings = forwardRef<HTMLDivElement, GeneralChartSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  
  const tickSize = useChartStore(s => s.tickSize);
  const setTickSize = useChartStore(s => s.setTickSize);
  const setAutoBucketSize = useChartStore(s => s.setAutoBucketSize);
  const setBucketSize = useChartStore(s => s.setBucketSize);
  
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const setGlobalTimezone = useChartStore(s => s.setGlobalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);
  const setGlobalTimeFormat = useChartStore(s => s.setGlobalTimeFormat);
  
  const crosshairSyncEnabled = useChartStore(s => s.crosshairSyncEnabled);
  const setCrosshairSyncEnabled = useChartStore(s => s.setCrosshairSyncEnabled);
  const drawingsSyncEnabled = useChartStore(s => s.drawingsSyncEnabled);
  const setDrawingsSyncEnabled = useChartStore(s => s.setDrawingsSyncEnabled);

  // Time update for Global Time display
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div ref={ref} className="space-y-8">
      {/* Bucket Size */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Aggregation</div>
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Tick Size</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={tickSize}
              onChange={(e) => setTickSize(parseFloat(e.target.value) || 0.5)}
              className="w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
            />
            <span className="text-[9px] text-text-dim font-black uppercase">Price</span>
          </div>
        </div>
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoBucketSize(panelId, !panel.autoBucketSize)}
              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.autoBucketSize
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              Auto
            </button>
            <input
              type="number"
              value={panel.bucketSize}
              disabled={panel.autoBucketSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) setBucketSize(panelId, val);
              }}
              className={`w-16 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold transition-all text-main ${panel.autoBucketSize ? 'opacity-50 cursor-not-allowed' : 'focus:border-accent focus:outline-none'}`}
              min="1"
            />
            <span className="text-[9px] text-text-dim font-black uppercase">Ticks</span>
          </div>
        </div>
      </div>

      {/* Global Time */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Global Time</div>
          <span className="text-[10px] font-mono font-bold text-accent">
            {formatDateTime(now, globalTimezone, globalTimeFormat)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Timezone</label>
            <select
              value={globalTimezone}
              onChange={(e) => setGlobalTimezone(e.target.value)}
              className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Time Format</label>
            <select
              value={globalTimeFormat}
              onChange={(e) => setGlobalTimeFormat(e.target.value as '12h' | '24h')}
              className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
            >
              <option value="24h">24-hour</option>
              <option value="12h">12-hour (AM/PM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Synchronized Crosshair & Drawings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Interaction</div>
        </div>
        
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sync Crosshairs</label>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
              {crosshairSyncEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={() => setCrosshairSyncEnabled(!crosshairSyncEnabled)}
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${crosshairSyncEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                }`}
            >
              <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${crosshairSyncEnabled ? 'left-5' : 'left-1'
                }`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sync Drawings</label>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
              {drawingsSyncEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={() => setDrawingsSyncEnabled(!drawingsSyncEnabled)}
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${drawingsSyncEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
                }`}
            >
              <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${drawingsSyncEnabled ? 'left-5' : 'left-1'
                }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
GeneralChartSettings.displayName = 'GeneralChartSettings';

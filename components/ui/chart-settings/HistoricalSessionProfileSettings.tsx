import { forwardRef } from 'react';
import { useChartStore, PanelId, SessionId } from '../../../lib/store/chart';
import { TIMEZONE_OPTIONS } from './constants';

interface HistoricalSessionProfileSettingsProps {
  panelId: PanelId;
}

export const HistoricalSessionProfileSettings = forwardRef<HTMLDivElement, HistoricalSessionProfileSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setHistoricalSessionProfileEnabled = useChartStore(s => s.setHistoricalSessionProfileEnabled);
  const setHistoricalSessionProfileSession = useChartStore(s => s.setHistoricalSessionProfileSession);
  const setHistoricalSessionProfileSessions = useChartStore(s => s.setHistoricalSessionProfileSessions);
  const setHistoricalSessionProfileDisplayMode = useChartStore(s => s.setHistoricalSessionProfileDisplayMode);
  const setHistoricalSessionProfileCount = useChartStore(s => s.setHistoricalSessionProfileCount);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);

  const timezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === globalTimezone)?.label ?? (globalTimezone === 'local' ? 'Local (PC)' : globalTimezone);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Historical Session Volume Profile</div>
        <button
          onClick={() => setHistoricalSessionProfileEnabled(panelId, !panel.historicalSessionProfileEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.historicalSessionProfileEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'}`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.historicalSessionProfileEnabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {panel.historicalSessionProfileEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between text-[10px] font-mono bg-[#181818] px-3 py-1.5 rounded-md border border-[#262626]">
            <span className="text-text-dim/80">Zone: <strong className="text-accent">{timezoneLabel}</strong></span>
            <span className="text-text-dim/80">Format: <strong className="text-accent">{globalTimeFormat}</strong></span>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Session</label>
            <select
              value={panel.historicalSessionProfileSession}
              onChange={(e) => setHistoricalSessionProfileSession(panelId, e.target.value as SessionId | 'multiple')}
              className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
            >
              {Object.keys(panel.sessions).map(sid => (
                <option key={sid} value={sid}>
                  {sid === 'newYork' ? 'New York' : sid.charAt(0).toUpperCase() + sid.slice(1)}
                </option>
              ))}
              <option value="multiple">Multiple</option>
            </select>
          </div>

          {panel.historicalSessionProfileSession === 'multiple' && (
            <div className="space-y-2">
              <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sessions</label>
                <div className="flex flex-col gap-2">
                  {Object.keys(panel.sessions).map(sid => (
                    <label key={sid} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={panel.historicalSessionProfileSessions.includes(sid)}
                        onChange={(e) => {
                          const current = panel.historicalSessionProfileSessions;
                          if (e.target.checked) {
                            setHistoricalSessionProfileSessions(panelId, [...current, sid]);
                          } else {
                            if (current.length > 1) { // Prevent unchecking all
                              setHistoricalSessionProfileSessions(panelId, current.filter(s => s !== sid));
                            }
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-[#333] bg-[#1F1F1F] text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-main">
                        {sid === 'newYork' ? 'New York' : sid.charAt(0).toUpperCase() + sid.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Profile Display</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setHistoricalSessionProfileDisplayMode(panelId, 'separate')}
                    className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.historicalSessionProfileDisplayMode === 'separate'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#333] text-text-dim hover:border-[#444]'
                      }`}
                  >
                    Separate
                  </button>
                  <button
                    onClick={() => setHistoricalSessionProfileDisplayMode(panelId, 'combined')}
                    className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${panel.historicalSessionProfileDisplayMode === 'combined'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#333] text-text-dim hover:border-[#444]'
                      }`}
                  >
                    Combined
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sessions to Display</label>
            <select
              value={panel.historicalSessionProfileCount}
              onChange={(e) => setHistoricalSessionProfileCount(panelId, Number(e.target.value))}
              className="w-full bg-[#1F1F1F] border border-[#333] rounded px-2 py-1.5 text-[12px] font-bold text-main appearance-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 8, 10, 12, 15].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
});
HistoricalSessionProfileSettings.displayName = 'HistoricalSessionProfileSettings';

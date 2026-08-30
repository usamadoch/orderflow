import { forwardRef } from 'react';
import { useChartStore, PanelId, SessionId } from '../../../lib/store/chart';
import { TimeInput } from '../TimeInput';
import { TIMEZONE_OPTIONS } from './constants';

interface SessionsSettingsProps {
  panelId: PanelId;
}

export const SessionsSettings = forwardRef<HTMLDivElement, SessionsSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setSessionEnabled = useChartStore(s => s.setSessionEnabled);
  const setSessionTime = useChartStore(s => s.setSessionTime);
  const setSessionColor = useChartStore(s => s.setSessionColor);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);

  const timezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === globalTimezone)?.label ?? (globalTimezone === 'local' ? 'Local (PC)' : globalTimezone);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Sessions</div>
        <button
          onClick={() => setSessionsEnabled(panelId, !panel.sessionsEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.sessionsEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.sessionsEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between text-[10px] font-mono bg-[#181818] px-3 py-1.5 rounded-md border border-[#262626]">
          <span className="text-text-dim/80">Zone: <strong className="text-accent">{timezoneLabel}</strong></span>
          <span className="text-text-dim/80">Format: <strong className="text-accent">{globalTimeFormat}</strong></span>
        </div>

        {(['tokyo', 'london', 'newYork'] as SessionId[]).map((sid) => {
          const session = panel.sessions[sid];
          const label = sid.toUpperCase().replace('YORK', ' YORK');
          return (
            <div key={sid} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
                <span className="text-[9px] font-bold font-mono tracking-tighter" style={{ color: session.color }}>
                  {label}
                </span>
                <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSessionEnabled(panelId, sid, !session.enabled)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 ${session.enabled
                    ? 'bg-accent/5 border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">Enabled</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${session.enabled ? 'bg-accent shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
                </button>

                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1F1F1F] bg-[#1F1F1F]">
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Color</span>
                  <input
                    type="color"
                    value={session.color}
                    onChange={(e) => setSessionColor(panelId, sid, e.target.value)}
                    className="w-4 h-4 bg-transparent border-none cursor-pointer outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <TimeInput
                  label="Start Time"
                  hour={session.startHour}
                  minute={session.startMin}
                  timeFormat={globalTimeFormat}
                  onChange={(h, m) => {
                    setSessionTime(panelId, sid, 'startHour', h);
                    setSessionTime(panelId, sid, 'startMin', m);
                  }}
                />
                <TimeInput
                  label="End Time"
                  hour={session.endHour}
                  minute={session.endMin}
                  timeFormat={globalTimeFormat}
                  onChange={(h, m) => {
                    setSessionTime(panelId, sid, 'endHour', h);
                    setSessionTime(panelId, sid, 'endMin', m);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
SessionsSettings.displayName = 'SessionsSettings';

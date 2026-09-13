'use client';

import { forwardRef, useState } from 'react';
import { FigSwitch } from '../fig';
import { useChartStore, PanelId, SessionId } from '../../../lib/store/chart';
import { TimeInput } from '../TimeInput';
import { TIMEZONE_OPTIONS } from './constants';
import { ColorPickerPopover } from '../ColorPickerPopover';

interface SessionsSettingsProps {
  panelId: PanelId;
}

export const SessionsSettings = forwardRef<HTMLDivElement, SessionsSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setSessionsEnabled = useChartStore(s => s.setSessionsEnabled);
  const setSessionEnabled = useChartStore(s => s.setSessionEnabled);
  const setSessionTime = useChartStore(s => s.setSessionTime);
  const setSessionColor = useChartStore(s => s.setSessionColor);
  const setSessionOpacity = useChartStore(s => s.setSessionOpacity);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);

  const [activePickerSession, setActivePickerSession] = useState<SessionId | null>(null);

  const timezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === globalTimezone)?.label ?? (globalTimezone === 'local' ? 'Local (PC)' : globalTimezone);

  return (
    <div ref={ref} className="scroll-mt-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Sessions</div>
        <FigSwitch
          checked={panel.sessionsEnabled}
          onChange={(checked) => setSessionsEnabled(panelId, checked)}
          aria-label="Toggle Sessions"
        />
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
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1F1F1F] bg-[#1F1F1F]">
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Enabled</span>
                  <FigSwitch
                    checked={session.enabled}
                    onChange={(checked) => setSessionEnabled(panelId, sid, checked)}
                    aria-label={`Toggle ${label} session`}
                  />
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActivePickerSession(activePickerSession === sid ? null : sid)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg border border-[#1F1F1F] bg-[#1F1F1F] hover:border-[#333] transition-all duration-200 cursor-pointer"
                    title={`Change ${label} session color`}
                  >
                    <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Color</span>
                    <div
                      className="w-6 h-3 rounded-[3px] border border-white/20 shadow-sm transition-transform hover:scale-105"
                      style={{ backgroundColor: session.color, opacity: session.opacity ?? 0.15 }}
                    />
                  </button>

                  {activePickerSession === sid && (
                    <ColorPickerPopover
                      color={session.color}
                      opacity={session.opacity ?? 0.15}
                      onColorChange={(newColor) => setSessionColor(panelId, sid, newColor)}
                      onOpacityChange={(newOpacity) => setSessionOpacity(panelId, sid, newOpacity)}
                      onClose={() => setActivePickerSession(null)}
                    />
                  )}
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

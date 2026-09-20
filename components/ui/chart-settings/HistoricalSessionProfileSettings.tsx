'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, FigSelect, PropskitSlider } from '../fig';
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
  const setSessionProfileResolutionTicks = useChartStore(s => s.setSessionProfileResolutionTicks);
  const tickSize = useChartStore(s => s.tickSize);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);

  const timezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === globalTimezone)?.label ?? (globalTimezone === 'local' ? 'Local (PC)' : globalTimezone);

  const maxProfileResolutionTicks = 100;
  const sessionResolutionTicks = panel.sessionProfileResolutionTicks ?? 0;
  let sessionProfileRowSizeLabel = 'Auto';
  if (sessionResolutionTicks > 0) {
    if (tickSize > 0) {
      sessionProfileRowSizeLabel = `${sessionResolutionTicks} Ticks (${(sessionResolutionTicks * tickSize).toFixed(Math.max(0, -Math.floor(Math.log10(tickSize))))})`;
    } else {
      sessionProfileRowSizeLabel = `${sessionResolutionTicks} Ticks`;
    }
  }

  const handleSessionProfileResolutionChange = (val: number) => {
    setSessionProfileResolutionTicks(panelId, val);
  };

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Historical Session Volume Profile</div>
        <FigSwitch
          checked={panel.historicalSessionProfileEnabled}
          onChange={(checked) => setHistoricalSessionProfileEnabled(panelId, checked)}
          aria-label="Toggle Historical Session Volume Profile"
        />
      </div>

      {panel.historicalSessionProfileEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between text-[10px] font-mono bg-[#181818] px-3 py-1.5 rounded-md border border-[#262626]">
            <span className="text-text-dim/80">Zone: <strong className="text-accent">{timezoneLabel}</strong></span>
            <span className="text-text-dim/80">Format: <strong className="text-accent">{globalTimeFormat}</strong></span>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Session</label>
            <FigSelect
              value={panel.historicalSessionProfileSession}
              onChange={(val) => setHistoricalSessionProfileSession(panelId, val as SessionId | 'multiple')}
              options={[
                ...Object.keys(panel.sessions).map(sid => ({
                  value: sid,
                  label: sid === 'newYork' ? 'New York' : sid.charAt(0).toUpperCase() + sid.slice(1)
                })),
                { value: 'multiple', label: 'Multiple' }
              ]}
              className="w-full"
            />
          </div>

          {panel.historicalSessionProfileSession === 'multiple' && (
            <div className="space-y-2">
              <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sessions</label>
                <div className="flex flex-col gap-2">
                  {Object.keys(panel.sessions).map(sid => (
                    <div
                      key={sid}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]"
                    >
                      <span className="text-[11px] font-bold text-main">
                        {sid === 'newYork' ? 'New York' : sid.charAt(0).toUpperCase() + sid.slice(1)}
                      </span>
                      <FigSwitch
                        checked={panel.historicalSessionProfileSessions.includes(sid)}
                        onChange={(checked) => {
                          const current = panel.historicalSessionProfileSessions;
                          if (checked) {
                            setHistoricalSessionProfileSessions(panelId, [...current, sid]);
                          } else {
                            if (current.length > 1) { // Prevent unchecking all
                              setHistoricalSessionProfileSessions(panelId, current.filter(s => s !== sid));
                            }
                          }
                        }}
                        aria-label={`Toggle ${sid === 'newYork' ? 'New York' : sid} historical session`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Profile Display</label>
                <FigSegmentedControl
                  full
                  value={panel.historicalSessionProfileDisplayMode}
                  onChange={(val) => setHistoricalSessionProfileDisplayMode(panelId, val as 'separate' | 'combined')}
                  options={[
                    { value: 'separate', label: 'Separate' },
                    { value: 'combined', label: 'Combined' },
                  ]}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Sessions to Display</label>
            <FigSelect
              value={String(panel.historicalSessionProfileCount)}
              onChange={(val) => setHistoricalSessionProfileCount(panelId, Number(val))}
              options={[1, 2, 3, 4, 5, 8, 10, 12, 15].map(n => ({
                value: String(n),
                label: String(n),
              }))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Row Size"
              value={sessionResolutionTicks}
              min={0}
              max={maxProfileResolutionTicks}
              step={1}
              title={`Resolution: ${sessionProfileRowSizeLabel}`}
              onChange={handleSessionProfileResolutionChange}
              onInput={handleSessionProfileResolutionChange}
            />
          </div>
        </div>
      )}
    </div>
  );
});
HistoricalSessionProfileSettings.displayName = 'HistoricalSessionProfileSettings';

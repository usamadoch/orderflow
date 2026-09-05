import { forwardRef } from 'react';

export const AlertsSettings = forwardRef<HTMLDivElement, Record<string, never>>((props, ref) => {
  return (
    <div ref={ref} className="space-y-8">
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Alerts</div>
        <div className="bg-[#1F1F1F] p-4 rounded-lg border border-[#333] text-center">
          <p className="text-[12px] text-text-dim">Alerts configuration will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
});
AlertsSettings.displayName = 'AlertsSettings';

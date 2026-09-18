'use client';

import { forwardRef, useState, useEffect } from 'react';
import { FigSwitch, FigSegmentedControl, FigSelect, FigButton, PropskitNumber } from '../fig';
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
  
  const bracketDragConfirmEnabled = useChartStore(s => s.bracketDragConfirmEnabled);
  const setBracketDragConfirmEnabled = useChartStore(s => s.setBracketDragConfirmEnabled);

  const setMt5CompareShowBinance = useChartStore(s => s.setMt5CompareShowBinance);
  const setShowPositionPnl = useChartStore(s => s.setShowPositionPnl);

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
            <PropskitNumber
              value={tickSize}
              step={0.1}
              min={0.01}
              onChange={(val) => setTickSize(val || 0.5)}
              className="w-20"
            />
            <span className="text-[9px] text-text-dim font-black uppercase">Price</span>
          </div>
        </div>
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Bucket Size</label>
          <div className="flex items-center gap-2">
            <FigButton
              size="small"
              variant={panel.autoBucketSize ? 'primary' : 'ghost'}
              onClick={() => setAutoBucketSize(panelId, !panel.autoBucketSize)}
            >
              Auto
            </FigButton>
            <PropskitNumber
              value={panel.bucketSize}
              min={1}
              step={1}
              disabled={panel.autoBucketSize}
              onChange={(val) => {
                if (val > 0) setBucketSize(panelId, val);
              }}
              className="w-20"
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
            <FigSelect
              value={globalTimezone}
              onChange={(val) => setGlobalTimezone(val)}
              options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz.value, label: tz.label }))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Time Format</label>
            <FigSegmentedControl
              full
              value={globalTimeFormat}
              onChange={(val) => setGlobalTimeFormat(val as '12h' | '24h')}
              options={[
                { value: '24h', label: '24-hour' },
                { value: '12h', label: '12-hour' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Synchronized Drawings & Interaction */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Interaction</div>
        </div>


        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div>
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">TP / SL Drag Confirmation</label>
            <div className="text-[9px] text-text-dim/40 font-medium">Require confirmation popup when dragging TP/SL lines</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
              {bracketDragConfirmEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <FigSwitch
              checked={bracketDragConfirmEnabled}
              onChange={(checked) => setBracketDragConfirmEnabled(checked)}
              aria-label="TP / SL Drag Confirmation"
            />
          </div>
        </div>

        {/* Position P&L Display */}
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div>
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Show Position P&L</label>
            <div className="text-[9px] text-text-dim/40 font-medium">Display floating unrealized profit/loss on active position entry lines</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
              {(panel.showPositionPnl ?? true) ? 'Enabled' : 'Disabled'}
            </span>
            <FigSwitch
              checked={panel.showPositionPnl ?? true}
              onChange={(checked) => setShowPositionPnl(panelId, checked)}
              aria-label="Show Position P&L"
            />
          </div>
        </div>
      </div>

      {/* MT5 Compare Chart Mode */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">MT5 Compare Mode</div>
        </div>

        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div>
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Show Binance in MT5 Compare</label>
            <div className="text-[9px] text-text-dim/40 font-medium">Display Binance candles side-by-side with MT5. When disabled, only MT5 candles and live Bid/Ask lines are shown.</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-text-dim/40 font-black uppercase tracking-tighter">
              {(panel.mt5CompareShowBinance ?? false) ? 'Enabled' : 'Disabled'}
            </span>
            <FigSwitch
              checked={panel.mt5CompareShowBinance ?? false}
              onChange={(checked) => setMt5CompareShowBinance(panelId, checked)}
              aria-label="Show Binance in MT5 Compare"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
GeneralChartSettings.displayName = 'GeneralChartSettings';

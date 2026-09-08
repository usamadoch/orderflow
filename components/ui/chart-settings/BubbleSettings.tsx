'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, FigButton, PropskitSlider, PropskitNumber } from '../fig';
import { 
  useChartStore, 
  PanelId, 
  BubbleScaleMode, 
  BubbleColorMode, 
  BubbleVolumeColorMode, 
  BubbleSide, 
  BubbleSizeBy, 
  BubbleDisplayMode 
} from '../../../lib/store/chart';

interface BubbleSettingsProps {
  panelId: PanelId;
  onShowDocs: () => void;
}

export const BubbleSettings = forwardRef<HTMLDivElement, BubbleSettingsProps>(({ panelId, onShowDocs }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  const setBubblesEnabled = useChartStore(s => s.setBubblesEnabled);
  const setBubbleSizeBy = useChartStore(s => s.setBubbleSizeBy);
  const setBubbleThreshold = useChartStore(s => s.setBubbleThreshold);
  const setBubbleThresholdMode = useChartStore(s => s.setBubbleThresholdMode);
  const setBubbleMinOrders = useChartStore(s => s.setBubbleMinOrders);
  const setBubbleSide = useChartStore(s => s.setBubbleSide);
  const setBubbleScaleMode = useChartStore(s => s.setBubbleScaleMode);
  const setBubbleFilterRender = useChartStore(s => s.setBubbleFilterRender);
  const setBubbleStdDevVal = useChartStore(s => s.setBubbleStdDevVal);
  const setBubbleOutStdDevPerc = useChartStore(s => s.setBubbleOutStdDevPerc);
  const setBubbleColorMode = useChartStore(s => s.setBubbleColorMode);
  const setBubbleVolumeColorMode = useChartStore(s => s.setBubbleVolumeColorMode);
  const setBubbleDisplayMode = useChartStore(s => s.setBubbleDisplayMode);
  const setBubbleBidColor = useChartStore(s => s.setBubbleBidColor);
  const setBubbleAskColor = useChartStore(s => s.setBubbleAskColor);
  const setBubbleLineWidth = useChartStore(s => s.setBubbleLineWidth);
  const setBubbleOpacity = useChartStore(s => s.setBubbleOpacity);



  const bubbleSides: { label: string; value: BubbleSide }[] = [
    { label: 'Buy', value: 'buy' },
    { label: 'Sell', value: 'sell' },
    { label: 'Both', value: 'both' },
  ];
  const bubbleSizeModes: { label: string; value: BubbleSizeBy }[] = [
    { label: 'Volume', value: 'volume' },
    { label: 'Orders', value: 'orders' },
  ];
  const bubbleScaleModes: { label: string; value: BubbleScaleMode; title: string }[] = [
    { label: 'Linear', value: 'linear', title: 'Direct value proportion' },
    { label: 'SQRT', value: 'sqrt', title: 'Compresses outliers while preserving relative size' },
    { label: 'Log', value: 'log', title: 'Strongest compression for very uneven values' },
  ];
  const bubbleColorModes: { label: string; value: BubbleColorMode }[] = [
    { label: 'Ask/Bid Split', value: 'askBidSplit' },
    { label: 'Delta', value: 'delta' },
    { label: 'Volume', value: 'volume' },
  ];
  const bubbleVolumeColorModes: { label: string; value: BubbleVolumeColorMode }[] = [
    { label: 'Delta Absolute', value: 'deltaAbsolute' },
    { label: 'Delta Percentual', value: 'deltaPercentual' },
  ];
  const bubbleDisplayModes: { label: string; value: BubbleDisplayMode }[] = [
    { label: '2D (Flat)', value: '2d' },
    { label: '3D (Spheres)', value: '3d' },
  ];
  const showOrderBubbleControls = panel.bubbleSizeBy === 'orders';

  return (
    <div ref={ref} className="scroll-mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Bubbles</div>
          <FigButton
            variant="link"
            size="small"
            onClick={onShowDocs}
            className="text-[10px] font-bold text-accent hover:underline p-0 h-auto"
          >
            DOCS
          </FigButton>
        </div>
        <FigSwitch
          checked={panel.bubblesEnabled}
          onChange={(checked) => setBubblesEnabled(panelId, checked)}
        />
      </div>

      {panel.bubblesEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="text-[10px] text-yellow-500/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 leading-relaxed font-medium">
            Note: Minimum thresholds are strictly enforced by the server-side collector. Setting UI limits below those thresholds will have no effect.
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Size By</label>
              <FigSegmentedControl
                full
                value={panel.bubbleSizeBy}
                onChange={(val) => setBubbleSizeBy(panelId, val as BubbleSizeBy)}
                options={bubbleSizeModes.map(({ label, value }) => ({ label, value }))}
              />
            </div>
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Bubble Mode</label>
              <FigSegmentedControl
                full
                value={panel.bubbleColorMode}
                onChange={(val) => setBubbleColorMode(panelId, val as BubbleColorMode)}
                options={bubbleColorModes.map(({ label, value }) => ({ label, value }))}
              />
              {panel.bubbleColorMode === 'volume' && (
                <div className="mt-2">
                  <FigSegmentedControl
                    full
                    value={panel.bubbleVolumeColorMode}
                    onChange={(val) => setBubbleVolumeColorMode(panelId, val as BubbleVolumeColorMode)}
                    options={bubbleVolumeColorModes.map(({ label, value }) => ({ label, value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {!showOrderBubbleControls && (
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Volume</label>
                <FigSegmentedControl
                  value={panel.bubbleThresholdMode}
                  onChange={(val) => setBubbleThresholdMode(panelId, val as 'absolute' | 'relative')}
                  options={[
                    { label: 'Fixed (BTC)', value: 'absolute' },
                    { label: 'Adaptive (x Avg)', value: 'relative' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-text-dim/70">
                  {panel.bubbleThresholdMode === 'absolute' ? 'Threshold (BTC)' : 'Multiplier'}
                </span>
                <PropskitNumber
                  value={panel.bubbleThreshold}
                  onChange={(val) => {
                    if (val >= 0.1) {
                      setBubbleThreshold(panelId, val);
                    }
                  }}
                  step={panel.bubbleThresholdMode === 'relative' ? 0.5 : 1}
                  min={0.1}
                  className="w-24"
                />
              </div>
              {panel.bubbleThresholdMode === 'absolute' && Number(panel.bubbleThreshold) < 1 && (
                <div className="text-[10px] text-orange-400 mt-1 font-medium">
                  ⚠ Collector floor is 1 BTC — history below this won&apos;t have data
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <PropskitSlider
              label="Filter Bubble"
              value={panel.bubbleFilterRender}
              min={0}
              max={20}
              step={0.5}
              units="px"
              onChange={(val) => setBubbleFilterRender(panelId, val)}
              onInput={(val) => setBubbleFilterRender(panelId, val)}
              title="Hides bubbles smaller than this pixel radius after scaling"
            />

            <PropskitSlider
              label="Std Dev Val"
              value={panel.bubbleStdDevVal}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(val) => setBubbleStdDevVal(panelId, val)}
              onInput={(val) => setBubbleStdDevVal(panelId, val)}
              title="Standard deviation multiplier for scale ceiling"
            />

            <PropskitSlider
              label="Outlier Cap"
              value={panel.bubbleOutStdDevPerc}
              min={0}
              max={50}
              step={1}
              units="%"
              onChange={(val) => setBubbleOutStdDevPerc(panelId, val)}
              onInput={(val) => setBubbleOutStdDevPerc(panelId, val)}
              title="Percentage of largest values treated as outliers"
            />
          </div>

          {showOrderBubbleControls && (
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Min Orders"
                value={panel.bubbleMinOrders}
                min={1}
                max={1000}
                step={1}
                onChange={(val) => setBubbleMinOrders(panelId, val)}
                onInput={(val) => setBubbleMinOrders(panelId, val)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
            <FigSegmentedControl
              full
              value={panel.bubbleSide}
              onChange={(val) => setBubbleSide(panelId, val as BubbleSide)}
              options={bubbleSides.map(({ label, value }) => ({ label, value }))}
            />
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale Mode</label>
              <FigSegmentedControl
                value={panel.bubbleScaleMode}
                onChange={(val) => setBubbleScaleMode(panelId, val as BubbleScaleMode)}
                options={bubbleScaleModes.map(({ label, value, title }) => ({ label, value, title }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Display Mode</label>
              <FigSegmentedControl
                value={panel.bubbleDisplayMode}
                onChange={(val) => setBubbleDisplayMode(panelId, val as BubbleDisplayMode)}
                options={bubbleDisplayModes.map(({ label, value }) => ({ label, value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[9px] font-bold text-text-dim uppercase tracking-wide mb-1 block">Buy Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={panel.bubbleBidColor}
                    onChange={(e) => setBubbleBidColor(panelId, e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] font-mono text-text-dim">{panel.bubbleBidColor}</span>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-text-dim uppercase tracking-wide mb-1 block">Sell Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={panel.bubbleAskColor}
                    onChange={(e) => setBubbleAskColor(panelId, e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] font-mono text-text-dim">{panel.bubbleAskColor}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-3 space-y-3 pt-2 border-t border-[#2A2A2A]">
              <PropskitSlider
                label="Line Width"
                value={panel.bubbleLineWidth}
                min={0}
                max={5}
                step={0.5}
                units="px"
                onChange={(val) => setBubbleLineWidth(panelId, val)}
                onInput={(val) => setBubbleLineWidth(panelId, val)}
              />
              <PropskitSlider
                label="Opacity"
                value={Math.round(panel.bubbleOpacity * 100)}
                min={10}
                max={100}
                step={5}
                units="%"
                onChange={(val) => setBubbleOpacity(panelId, val / 100)}
                onInput={(val) => setBubbleOpacity(panelId, val / 100)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
BubbleSettings.displayName = 'BubbleSettings';

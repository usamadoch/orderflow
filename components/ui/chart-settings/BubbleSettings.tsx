import { forwardRef, useState, useEffect } from 'react';
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

  const [localThreshold, setLocalThreshold] = useState(String(panel.bubbleThreshold));

  useEffect(() => {
    setLocalThreshold(String(panel.bubbleThreshold));
  }, [panel.bubbleThreshold]);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalThreshold(raw);
    const val = Number(raw);
    if (!isNaN(val) && val >= 1) {
      setBubbleThreshold(panelId, val);
    }
  };

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
          <button onClick={onShowDocs} className="text-[10px] font-bold text-accent hover:underline">DOCS</button>
        </div>
        <button
          onClick={() => setBubblesEnabled(panelId, !panel.bubblesEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.bubblesEnabled ? 'bg-accent' : 'bg-[#1F1F1F]'
            }`}
        >
          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.bubblesEnabled ? 'left-5' : 'left-1'
            }`} />
        </button>
      </div>

      {panel.bubblesEnabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="text-[10px] text-yellow-500/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 leading-relaxed font-medium">
            Note: Minimum thresholds are strictly enforced by the server-side collector. Setting UI limits below those thresholds will have no effect.
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Size By</label>
              <div className="grid grid-cols-2 gap-1">
                {bubbleSizeModes.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBubbleSizeBy(panelId, value)}
                    className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${
                      panel.bubbleSizeBy === value
                        ? 'bg-[#1F1F1F] border-accent text-accent'
                        : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Bubble Mode</label>
              <div className="grid grid-cols-3 gap-1">
                {bubbleColorModes.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBubbleColorMode(panelId, value)}
                    className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${
                      panel.bubbleColorMode === value
                        ? 'bg-[#1F1F1F] border-accent text-accent'
                        : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {panel.bubbleColorMode === 'volume' && (
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {bubbleVolumeColorModes.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBubbleVolumeColorMode(panelId, value)}
                      className={`py-1.5 rounded text-[9px] font-black uppercase border transition-all duration-200 ${
                        panel.bubbleVolumeColorMode === value
                          ? 'bg-[#1F1F1F] border-accent text-accent'
                          : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!showOrderBubbleControls && (
            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Volume</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBubbleThresholdMode(panelId, panel.bubbleThresholdMode === 'absolute' ? 'relative' : 'absolute')}
                  className="px-2 py-1 bg-[#1F1F1F] border border-[#1F1F1F] rounded text-[10px] font-black text-text-dim hover:text-main transition-colors uppercase"
                >
                  {panel.bubbleThresholdMode === 'absolute' ? 'Fixed (BTC)' : 'Adaptive (x Avg)'}
                </button>
                <input
                  type="number"
                  value={localThreshold}
                  onChange={handleThresholdChange}
                  step={panel.bubbleThresholdMode === 'relative' ? "0.5" : "1"}
                  className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="0.1"
                />
              </div>
              {panel.bubbleThresholdMode === 'absolute' && Number(localThreshold) < 1 && (
                <div className="text-[10px] text-orange-400 mt-2 font-medium">
                  ⚠ Collector floor is 1 BTC — history below this won&apos;t have data
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide" title="Hides bubbles smaller than this pixel radius after scaling">Filter Bubble (px)</label>
                <input
                  type="number"
                  value={panel.bubbleFilterRender}
                  onChange={(e) => setBubbleFilterRender(panelId, Number(e.target.value))}
                  className="w-16 bg-[#1A1A1A] border border-[#1A1A1A] rounded px-2 py-1 text-right text-[11px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="0"
                  max="20"
                  step="0.5"
                />
              </div>
              <input
                type="range"
                value={panel.bubbleFilterRender}
                onChange={(e) => setBubbleFilterRender(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent mt-1"
                min="0"
                max="20"
                step="0.5"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide" title="Standard deviation multiplier for scale ceiling">Std Dev Val</label>
                <input
                  type="number"
                  value={panel.bubbleStdDevVal}
                  onChange={(e) => setBubbleStdDevVal(panelId, Number(e.target.value))}
                  className="w-16 bg-[#1A1A1A] border border-[#1A1A1A] rounded px-2 py-1 text-right text-[11px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="0.5"
                  max="5"
                  step="0.1"
                />
              </div>
              <input
                type="range"
                value={panel.bubbleStdDevVal}
                onChange={(e) => setBubbleStdDevVal(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent mt-1"
                min="0.5"
                max="5"
                step="0.1"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide" title="Percentage of largest values treated as outliers">Outlier Cap %</label>
                <input
                  type="number"
                  value={panel.bubbleOutStdDevPerc}
                  onChange={(e) => setBubbleOutStdDevPerc(panelId, Number(e.target.value))}
                  className="w-16 bg-[#1A1A1A] border border-[#1A1A1A] rounded px-2 py-1 text-right text-[11px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="0"
                  max="50"
                  step="1"
                />
              </div>
              <input
                type="range"
                value={panel.bubbleOutStdDevPerc}
                onChange={(e) => setBubbleOutStdDevPerc(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-accent mt-1"
                min="0"
                max="50"
                step="1"
              />
            </div>
          </div>

          {showOrderBubbleControls && (
            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Orders</label>
                <input
                  type="number"
                  value={panel.bubbleMinOrders}
                  onChange={(e) => setBubbleMinOrders(panelId, Number(e.target.value))}
                  className="w-20 bg-[#1F1F1F] border border-[#1F1F1F] rounded px-2 py-1 text-right text-[12px] font-bold focus:border-accent focus:outline-none transition-all text-main font-mono"
                  min="1"
                  max="1000"
                  step="1"
                />
              </div>
              <input
                type="range"
                value={panel.bubbleMinOrders}
                onChange={(e) => setBubbleMinOrders(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1"
                max="1000"
                step="1"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
            <div className="flex gap-1">
              {bubbleSides.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setBubbleSide(panelId, value)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.bubbleSide === value
                    ? 'bg-[#1F1F1F] border-accent text-accent'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Scale Mode</label>
              <div className="flex gap-1 w-36">
                {bubbleScaleModes.map(({ label, value, title }) => (
                  <button
                    key={value}
                    type="button"
                    title={title}
                    onClick={() => setBubbleScaleMode(panelId, value)}
                    className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.bubbleScaleMode === value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Color Mode</label>
              <div className="flex gap-1 w-48">
                {bubbleColorModes.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBubbleColorMode(panelId, value)}
                    className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.bubbleColorMode === value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            {panel.bubbleColorMode === 'volume' && (
              <div className="flex justify-between items-center mt-2 border-t border-[#333] pt-2">
                <label className="text-[10px] font-bold text-text-dim uppercase tracking-wide">Volume Base</label>
                <div className="flex gap-1 w-48">
                  {bubbleVolumeColorModes.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBubbleVolumeColorMode(panelId, value)}
                      className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.bubbleVolumeColorMode === value
                        ? 'bg-[#1F1F1F] border-accent text-accent'
                        : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Display Mode</label>
              <div className="flex gap-1 w-36">
                {bubbleDisplayModes.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBubbleDisplayMode(panelId, value)}
                    className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all duration-200 border ${panel.bubbleDisplayMode === value
                      ? 'bg-[#1F1F1F] border-accent text-accent'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
            
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Line Width</label>
                  <span className="text-[10px] font-mono text-main">{panel.bubbleLineWidth}px</span>
                </div>
                <input
                  type="range"
                  value={panel.bubbleLineWidth}
                  onChange={(e) => setBubbleLineWidth(panelId, Number(e.target.value))}
                  className="w-full h-1 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-accent"
                  min="0"
                  max="5"
                  step="0.5"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Opacity</label>
                  <span className="text-[10px] font-mono text-main">{Math.round(panel.bubbleOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={panel.bubbleOpacity}
                  onChange={(e) => setBubbleOpacity(panelId, Number(e.target.value))}
                  className="w-full h-1 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-accent"
                  min="0.1"
                  max="1"
                  step="0.05"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
BubbleSettings.displayName = 'BubbleSettings';

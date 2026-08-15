import React from 'react';
import { X } from 'lucide-react';

interface BubblesDocsModalProps {
  onClose: () => void;
}

export function BubblesDocsModal({ onClose }: BubblesDocsModalProps) {
  return (
    <div 
      className="pointer-events-auto fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-3 py-6"
      onClick={onClose}
    >
      <div 
        className="popup-contrast flex max-h-[min(600px,calc(100vh-48px))] w-full flex-col overflow-y-auto rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] shadow-2xl"
        style={{ maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1F1F1F] bg-[#1F1F1F]/50 p-4 sticky top-0 z-10 backdrop-blur-sm">
          <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">
            Volume Bubbles Documentation
          </h3>
          <button onClick={onClose} className="p-1 text-text-dim transition-colors hover:text-main">
            <X size={14} />
          </button>
        </div>
        
        <div className="p-4 space-y-6 text-[11px] leading-relaxed text-text-dim">
          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Overview</h4>
            <p>
              Volume bubbles represent significant trading activity at specific price levels within a given time. 
              Instead of reading raw numbers on a footprint chart, you can visually spot where the most volume or orders were executed.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Color & Opacity</h4>
            <p>
              The bubbles use a distinct color scheme to differentiate buyers from sellers, and opacity to reflect the relative intensity of volume compared to the recent market activity.
            </p>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#333]">
                <div className="w-8 h-8 rounded-full border border-[#0D5B0B] bg-[#0D5B0B]/80 shadow-[0_0_8px_rgba(13,91,11,0.5)] flex-shrink-0" />
                <div>
                  <div className="font-bold text-main uppercase tracking-wider">Buy Volume (Green)</div>
                  <div className="text-[10px] mt-0.5">Aggressive buying into the ask. Hex: #0D5B0B</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#333]">
                <div className="w-8 h-8 rounded-full border border-[#4A1E6F] bg-[#4A1E6F]/80 shadow-[0_0_8px_rgba(74,30,111,0.5)] flex-shrink-0" />
                <div>
                  <div className="font-bold text-main uppercase tracking-wider">Sell Volume (Purple)</div>
                  <div className="text-[10px] mt-0.5">Aggressive selling into the bid. Hex: #4A1E6F</div>
                </div>
              </div>
            </div>
            <p className="mt-2">
              <strong>Opacity:</strong> Bubbles start with a lighter, transparent fill for lower volume near your minimum threshold (40% opacity), scaling up to fully saturated, dark colors (90% opacity) for extreme volume spikes.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Bubble Sizing (2px to 8px)</h4>
            <p>
              By default, bubbles are configured to be small and unintrusive, with a minimum radius of 2px and a maximum of 8px. Because they are small, the numeric volume is hidden by default to keep the chart clean. 
              The size of the bubble corresponds to the volume relative to the maximum outlier volume in the current view.
            </p>
            
            <div className="bg-[#1F1F1F] p-4 rounded-lg border border-[#333] space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 flex justify-center">
                  <div className="rounded-full border border-[#0D5B0B] bg-[#0D5B0B]" style={{ width: 4, height: 4, opacity: 0.4 }} />
                </div>
                <div>
                  <div className="font-bold text-main">Min Radius (2px)</div>
                  <div className="text-[10px]">Volume is just above the minimum threshold. Barely visible.</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 flex justify-center">
                  <div className="rounded-full border border-[#0D5B0B] bg-[#0D5B0B]" style={{ width: 10, height: 10, opacity: 0.65 }} />
                </div>
                <div>
                  <div className="font-bold text-main">Medium Radius (5px)</div>
                  <div className="text-[10px]">Average volume spike. Clear and noticeable.</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 flex justify-center">
                  <div className="rounded-full border border-[#0D5B0B] bg-[#0D5B0B]" style={{ width: 16, height: 16, opacity: 0.9 }} />
                </div>
                <div>
                  <div className="font-bold text-main">Max Radius (8px)</div>
                  <div className="text-[10px]">Extreme volume, representing the 95th percentile of recent activity.</div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] italic">
              Note: Radius refers to the distance from the center to the edge. A 2px radius bubble is 4px wide, and an 8px radius bubble is 16px wide.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Settings & Filters</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Bubble Source:</strong> Choose between Footprint Cells (price level aggregates) or raw Aggregate Trades (individual large market orders).</li>
              <li><strong>Min Volume / Min Orders:</strong> Sets the baseline threshold. Anything below this value will not be rendered.</li>
              <li><strong>Scale Mode:</strong> Choose between Linear, Square Root (SQRT), or Logarithmic scaling for bubble sizes. SQRT is recommended as it highlights outliers without shrinking average trades into oblivion.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

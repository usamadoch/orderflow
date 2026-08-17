import React, { useState } from 'react';
import { X } from 'lucide-react';

interface BubblesDocsModalProps {
  onClose: () => void;
}

export function BubblesDocsModal({ onClose }: BubblesDocsModalProps) {
  const [demoRadius, setDemoRadius] = useState(5);
  // Calculate a demo opacity and volume so it scales realistically
  const t = (demoRadius - 2) / (12 - 2);
  const demoOpacity = 0.4 + (Math.max(0, Math.min(1, t))) * 0.5;
  const ratio = t * t; // Simulating SQRT scaling
  const demoVolume = Math.round(100 + ratio * (50000 - 100));

  const abbreviateVol = (vol: number) => {
    if (vol >= 1000) return (vol / 1000).toFixed(1) + 'k';
    return vol.toFixed(0);
  };

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
            How Volume Bubbles Work
          </h3>
          <button onClick={onClose} className="p-1 text-text-dim transition-colors hover:text-main">
            <X size={14} />
          </button>
        </div>
        
        <div className="p-4 space-y-6 text-[11px] leading-relaxed text-text-dim">
          <section className="space-y-2">
            <p>
              Volume bubbles help you easily spot where the biggest trades are happening. Instead of reading a bunch of numbers, you can just look for the biggest and brightest circles on the chart.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Colors (Buyers vs Sellers)</h4>
            <p>
              We use two distinct colors to show you who is being more aggressive:
            </p>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#333]">
                <div className="w-8 h-8 rounded-full border border-[#0D5B0B] bg-[#0D5B0B]/80 shadow-[0_0_8px_rgba(13,91,11,0.5)] flex-shrink-0" />
                <div>
                  <div className="font-bold text-main uppercase tracking-wider">Buy Volume (Green)</div>
                  <div className="text-[10px] mt-0.5">Buyers are aggressively buying.</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#333]">
                <div className="w-8 h-8 rounded-full border border-[#4A1E6F] bg-[#4A1E6F]/80 shadow-[0_0_8px_rgba(74,30,111,0.5)] flex-shrink-0" />
                <div>
                  <div className="font-bold text-main uppercase tracking-wider">Sell Volume (Purple)</div>
                  <div className="text-[10px] mt-0.5">Sellers are aggressively selling.</div>
                </div>
              </div>
            </div>
            <p className="mt-2">
              <strong>Tip:</strong> The bubbles also change how "see-through" (opaque) they are. A very light, see-through bubble means low volume. A solid, dark bubble means huge volume!
            </p>
          </section>

          <section className="space-y-4">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Bubble Size Sandbox</h4>
            <p>
              Drag the slider below to see how a bubble grows when the volume goes up. Notice how it gets more solid and eventually shows the number inside!
            </p>
            
            <div className="bg-[#1F1F1F] p-4 rounded-lg border border-[#333] space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-text-dim uppercase">Small</span>
                <input 
                  type="range" 
                  min="2" 
                  max="12" 
                  step="1" 
                  value={demoRadius} 
                  onChange={(e) => setDemoRadius(Number(e.target.value))}
                  className="flex-1 h-1 bg-[#0F0F0F] rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="text-[10px] font-bold text-text-dim uppercase">Large</span>
              </div>

              <div className="flex items-center gap-6 mt-4">
                <div className="w-24 h-24 flex items-center justify-center bg-[#0F0F0F] rounded-lg border border-[#333]">
                  <div 
                    className="rounded-full border border-[#0D5B0B] bg-[#0D5B0B] transition-all duration-200 flex items-center justify-center" 
                    style={{ 
                      width: demoRadius * 2, 
                      height: demoRadius * 2, 
                      opacity: demoOpacity 
                    }} 
                  >
                    {demoRadius >= 6 && <span className="text-[9px] text-[#E8E8E8] font-mono">{abbreviateVol(demoVolume)}</span>}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-main text-[14px]">Size: {demoRadius}px radius</div>
                  <div className="text-[11px] text-text-dim mt-1">
                    {demoRadius <= 3 && "This represents volume just barely above your minimum filter. It's kept small and light so your chart doesn't get cluttered."}
                    {demoRadius > 3 && demoRadius < 8 && "This represents a solid, average burst of volume. It's highly visible but not overwhelming."}
                    {demoRadius >= 8 && "This represents an extreme volume spike! It's drawn large and solid, and if it's big enough, we'll even draw the exact volume number inside it."}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-[12px] font-bold text-main uppercase tracking-wider">Useful Settings</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Min Volume:</strong> The minimum amount of volume required to even draw a bubble. Anything less is ignored.</li>
              <li><strong>Scale Mode:</strong> How we calculate the size. "SQRT" (Square Root) is best because it makes huge outliers stand out without making normal trades completely invisible.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

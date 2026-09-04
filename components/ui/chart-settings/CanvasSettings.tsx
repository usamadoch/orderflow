import { forwardRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useChartStore } from '../../../lib/store/chart';
import { ColorPickerPopover } from '../ColorPickerPopover';

export const CanvasSettings = forwardRef<HTMLDivElement, Record<string, never>>((props, ref) => {
  const candleUpColor = useChartStore(s => s.candleUpColor);
  const setCandleUpColor = useChartStore(s => s.setCandleUpColor);
  const candleUpOpacity = useChartStore(s => s.candleUpOpacity);
  const setCandleUpOpacity = useChartStore(s => s.setCandleUpOpacity);

  const candleDownColor = useChartStore(s => s.candleDownColor);
  const setCandleDownColor = useChartStore(s => s.setCandleDownColor);
  const candleDownOpacity = useChartStore(s => s.candleDownOpacity);
  const setCandleDownOpacity = useChartStore(s => s.setCandleDownOpacity);

  const candleUpWickColor = useChartStore(s => s.candleUpWickColor);
  const setCandleUpWickColor = useChartStore(s => s.setCandleUpWickColor);
  const candleUpWickOpacity = useChartStore(s => s.candleUpWickOpacity);
  const setCandleUpWickOpacity = useChartStore(s => s.setCandleUpWickOpacity);

  const candleDownWickColor = useChartStore(s => s.candleDownWickColor);
  const setCandleDownWickColor = useChartStore(s => s.setCandleDownWickColor);
  const candleDownWickOpacity = useChartStore(s => s.candleDownWickOpacity);
  const setCandleDownWickOpacity = useChartStore(s => s.setCandleDownWickOpacity);

  const chartBackgroundType = useChartStore(s => s.chartBackgroundType);
  const setChartBackgroundType = useChartStore(s => s.setChartBackgroundType);
  const chartBackgroundColor = useChartStore(s => s.chartBackgroundColor);
  const setChartBackgroundColor = useChartStore(s => s.setChartBackgroundColor);
  const chartBackgroundGradientTop = useChartStore(s => s.chartBackgroundGradientTop);
  const setChartBackgroundGradientTop = useChartStore(s => s.setChartBackgroundGradientTop);
  const chartBackgroundGradientBottom = useChartStore(s => s.chartBackgroundGradientBottom);
  const setChartBackgroundGradientBottom = useChartStore(s => s.setChartBackgroundGradientBottom);

  const showVerticalGridLines = useChartStore(s => s.showVerticalGridLines);
  const setShowVerticalGridLines = useChartStore(s => s.setShowVerticalGridLines);
  const verticalGridLineColor = useChartStore(s => s.verticalGridLineColor);
  const setVerticalGridLineColor = useChartStore(s => s.setVerticalGridLineColor);
  const verticalGridLineOpacity = useChartStore(s => s.verticalGridLineOpacity);
  const setVerticalGridLineOpacity = useChartStore(s => s.setVerticalGridLineOpacity);
  const verticalGridLineStyle = useChartStore(s => s.verticalGridLineStyle);
  const setVerticalGridLineStyle = useChartStore(s => s.setVerticalGridLineStyle);

  const showHorizontalGridLines = useChartStore(s => s.showHorizontalGridLines);
  const setShowHorizontalGridLines = useChartStore(s => s.setShowHorizontalGridLines);
  const horizontalGridLineColor = useChartStore(s => s.horizontalGridLineColor);
  const setHorizontalGridLineColor = useChartStore(s => s.setHorizontalGridLineColor);
  const horizontalGridLineOpacity = useChartStore(s => s.horizontalGridLineOpacity);
  const setHorizontalGridLineOpacity = useChartStore(s => s.setHorizontalGridLineOpacity);
  const horizontalGridLineStyle = useChartStore(s => s.horizontalGridLineStyle);
  const setHorizontalGridLineStyle = useChartStore(s => s.setHorizontalGridLineStyle);

  const crosshairColor = useChartStore(s => s.crosshairColor);
  const setCrosshairColor = useChartStore(s => s.setCrosshairColor);
  const crosshairOpacity = useChartStore(s => s.crosshairOpacity);
  const setCrosshairOpacity = useChartStore(s => s.setCrosshairOpacity);
  const crosshairThickness = useChartStore(s => s.crosshairThickness);
  const setCrosshairThickness = useChartStore(s => s.setCrosshairThickness);
  const crosshairStyle = useChartStore(s => s.crosshairStyle);
  const setCrosshairStyle = useChartStore(s => s.setCrosshairStyle);

  const [activePicker, setActivePicker] = useState<string | null>(null);

  const renderColorButton = (id: string, label: string, color: string, opacity?: number) => {
    const isActive = activePicker === id;
    return (
      <button
        type="button"
        onClick={() => setActivePicker(isActive ? null : id)}
        className={`flex items-center justify-center p-1.5 rounded-lg border bg-[#1A1A1A] cursor-pointer transition-all duration-200 ${
          isActive ? 'border-[#3D7EFF] ring-1 ring-[#3D7EFF]' : 'border-[#333] hover:border-[#4A4A4A]'
        }`}
        title={`Change ${label} color`}
      >
        <div
          className="w-7 h-5 rounded-[3px] border border-white/20 shadow-sm"
          style={{ backgroundColor: color, opacity: opacity ?? 1 }}
        />
      </button>
    );
  };

  const renderLineAppearanceButton = (
    id: string,
    color: string,
    opacity: number,
    style: 'solid' | 'dashed' | 'dotted'
  ) => {
    const isActive = activePicker === id;
    return (
      <button
        type="button"
        onClick={() => setActivePicker(isActive ? null : id)}
        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border bg-[#1A1A1A] cursor-pointer transition-all duration-200 ${
          isActive ? 'border-[#3D7EFF] ring-1 ring-[#3D7EFF]' : 'border-[#333] hover:border-[#4A4A4A]'
        }`}
        title="Change appearance"
      >
        <div
          className="w-5 h-5 rounded-[3px] border border-white/20 shadow-sm"
          style={{ backgroundColor: color, opacity }}
        />
        <div className="w-6 flex items-center justify-center">
          {style === 'solid' && (
            <div className="w-full bg-white rounded-full h-px" />
          )}
          {style === 'dashed' && (
            <div className="w-full flex justify-between">
              <div className="w-1.5 bg-white rounded-full h-px" />
              <div className="w-1.5 bg-white rounded-full h-px" />
              <div className="w-1.5 bg-white rounded-full h-px" />
            </div>
          )}
          {style === 'dotted' && (
            <div className="w-full flex justify-between">
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          )}
        </div>
      </button>
    );
  };

  const renderCrosshairButton = () => {
    const isActive = activePicker === 'crosshair';
    return (
      <button
        type="button"
        onClick={() => setActivePicker(isActive ? null : 'crosshair')}
        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border bg-[#1A1A1A] cursor-pointer transition-all duration-200 ${
          isActive ? 'border-[#3D7EFF] ring-1 ring-[#3D7EFF]' : 'border-[#333] hover:border-[#4A4A4A]'
        }`}
        title="Change crosshair appearance"
      >
        <div
          className="w-5 h-5 rounded-[3px] border border-white/20 shadow-sm"
          style={{ backgroundColor: crosshairColor, opacity: crosshairOpacity }}
        />
        <div className="w-6 flex items-center justify-center">
          {crosshairStyle === 'solid' && (
            <div className="w-full bg-white rounded-full" style={{ height: `${crosshairThickness}px` }} />
          )}
          {crosshairStyle === 'dashed' && (
            <div className="w-full flex justify-between">
              <div className="w-1.5 bg-white rounded-full" style={{ height: `${crosshairThickness}px` }} />
              <div className="w-1.5 bg-white rounded-full" style={{ height: `${crosshairThickness}px` }} />
              <div className="w-1.5 bg-white rounded-full" style={{ height: `${crosshairThickness}px` }} />
            </div>
          )}
          {crosshairStyle === 'dotted' && (
            <div className="w-full flex justify-between">
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div ref={ref} className="space-y-8">
      {/* Candles */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Candles</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Buy / Up</label>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-dim">Body</span>
              <div className="relative">
                {renderColorButton('candle-up', 'Buy Body', candleUpColor, candleUpOpacity)}
                {activePicker === 'candle-up' && (
                  <ColorPickerPopover
                    color={candleUpColor}
                    opacity={candleUpOpacity}
                    showOpacity={true}
                    onColorChange={setCandleUpColor}
                    onOpacityChange={setCandleUpOpacity}
                    onClose={() => setActivePicker(null)}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-dim">Wick</span>
              <div className="relative">
                {renderColorButton('candle-up-wick', 'Buy Wick', candleUpWickColor, candleUpWickOpacity)}
                {activePicker === 'candle-up-wick' && (
                  <ColorPickerPopover
                    color={candleUpWickColor}
                    opacity={candleUpWickOpacity}
                    showOpacity={true}
                    onColorChange={setCandleUpWickColor}
                    onOpacityChange={setCandleUpWickOpacity}
                    onClose={() => setActivePicker(null)}
                  />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
            <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">Sell / Down</label>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-dim">Body</span>
              <div className="relative">
                {renderColorButton('candle-down', 'Sell Body', candleDownColor, candleDownOpacity)}
                {activePicker === 'candle-down' && (
                  <ColorPickerPopover
                    color={candleDownColor}
                    opacity={candleDownOpacity}
                    showOpacity={true}
                    onColorChange={setCandleDownColor}
                    onOpacityChange={setCandleDownOpacity}
                    onClose={() => setActivePicker(null)}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-dim">Wick</span>
              <div className="relative">
                {renderColorButton('candle-down-wick', 'Sell Wick', candleDownWickColor, candleDownWickOpacity)}
                {activePicker === 'candle-down-wick' && (
                  <ColorPickerPopover
                    color={candleDownWickColor}
                    opacity={candleDownWickOpacity}
                    showOpacity={true}
                    onColorChange={setCandleDownWickColor}
                    onOpacityChange={setCandleDownWickOpacity}
                    onClose={() => setActivePicker(null)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Background</div>
        
        <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Type</label>
            <select
              value={chartBackgroundType}
              onChange={(e) => setChartBackgroundType(e.target.value as 'solid' | 'gradient')}
              className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1 text-[11px] font-bold text-main appearance-none cursor-pointer outline-none focus:border-accent"
            >
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>

          {chartBackgroundType === 'solid' ? (
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Color</label>
              <div className="relative">
                {renderColorButton('bg-solid', 'Solid Background', chartBackgroundColor)}
                {activePicker === 'bg-solid' && (
                  <ColorPickerPopover
                    color={chartBackgroundColor}
                    showOpacity={false}
                    onColorChange={setChartBackgroundColor}
                    onClose={() => setActivePicker(null)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Gradient Colors</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  {renderColorButton('bg-grad-top', 'Gradient Top', chartBackgroundGradientTop)}
                  {activePicker === 'bg-grad-top' && (
                    <ColorPickerPopover
                      color={chartBackgroundGradientTop}
                      showOpacity={false}
                      onColorChange={setChartBackgroundGradientTop}
                      onClose={() => setActivePicker(null)}
                    />
                  )}
                </div>
                <div className="relative">
                  {renderColorButton('bg-grad-bottom', 'Gradient Bottom', chartBackgroundGradientBottom)}
                  {activePicker === 'bg-grad-bottom' && (
                    <ColorPickerPopover
                      color={chartBackgroundGradientBottom}
                      showOpacity={false}
                      onColorChange={setChartBackgroundGradientBottom}
                      onClose={() => setActivePicker(null)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Lines */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Grid Lines</div>
        
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={showVerticalGridLines}
              onClick={() => setShowVerticalGridLines(!showVerticalGridLines)}
              className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                showVerticalGridLines
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-[#141414] border-[#3D404A] hover:border-[#555] text-transparent'
              }`}
            >
              <Check size={12} strokeWidth={3} className={showVerticalGridLines ? 'opacity-100' : 'opacity-0'} />
            </button>
            <label
              onClick={() => setShowVerticalGridLines(!showVerticalGridLines)}
              className="text-[11px] font-bold text-text-dim uppercase tracking-wide cursor-pointer select-none"
            >
              Vert Grid Lines
            </label>
          </div>
          <div className="relative">
            {renderLineAppearanceButton('grid-vert', verticalGridLineColor, verticalGridLineOpacity, verticalGridLineStyle)}
            {activePicker === 'grid-vert' && (
              <ColorPickerPopover
                color={verticalGridLineColor}
                opacity={verticalGridLineOpacity}
                showOpacity={true}
                showLineStyle={true}
                lineStyle={verticalGridLineStyle}
                onLineStyleChange={setVerticalGridLineStyle}
                onColorChange={setVerticalGridLineColor}
                onOpacityChange={setVerticalGridLineOpacity}
                onClose={() => setActivePicker(null)}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={showHorizontalGridLines}
              onClick={() => setShowHorizontalGridLines(!showHorizontalGridLines)}
              className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                showHorizontalGridLines
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-[#141414] border-[#3D404A] hover:border-[#555] text-transparent'
              }`}
            >
              <Check size={12} strokeWidth={3} className={showHorizontalGridLines ? 'opacity-100' : 'opacity-0'} />
            </button>
            <label
              onClick={() => setShowHorizontalGridLines(!showHorizontalGridLines)}
              className="text-[11px] font-bold text-text-dim uppercase tracking-wide cursor-pointer select-none"
            >
              Horz Grid Lines
            </label>
          </div>
          <div className="relative">
            {renderLineAppearanceButton('grid-horz', horizontalGridLineColor, horizontalGridLineOpacity, horizontalGridLineStyle)}
            {activePicker === 'grid-horz' && (
              <ColorPickerPopover
                color={horizontalGridLineColor}
                opacity={horizontalGridLineOpacity}
                showOpacity={true}
                showLineStyle={true}
                lineStyle={horizontalGridLineStyle}
                onLineStyleChange={setHorizontalGridLineStyle}
                onColorChange={setHorizontalGridLineColor}
                onOpacityChange={setHorizontalGridLineOpacity}
                onClose={() => setActivePicker(null)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Crosshair */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Crosshair</div>
        
        <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Appearance</label>
          <div className="relative">
            {renderCrosshairButton()}
            {activePicker === 'crosshair' && (
              <ColorPickerPopover
                color={crosshairColor}
                opacity={crosshairOpacity}
                onColorChange={setCrosshairColor}
                onOpacityChange={setCrosshairOpacity}
                showThickness={true}
                thickness={crosshairThickness}
                onThicknessChange={setCrosshairThickness}
                showLineStyle={true}
                lineStyle={crosshairStyle}
                onLineStyleChange={setCrosshairStyle}
                onClose={() => setActivePicker(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
CanvasSettings.displayName = 'CanvasSettings';


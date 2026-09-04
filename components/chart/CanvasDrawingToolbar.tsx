import React, { useState, useRef, useEffect } from 'react';
import { Check, Lock, Plus, Settings, Square, Unlock, X } from 'lucide-react';
import type { DrawnLine, DrawingStrokeWidth, PanelId } from '@/lib/store/chart';
import { useChartStore } from '@/lib/store/chart';

export const DEFAULT_DRAWING_STROKE_WIDTH: DrawingStrokeWidth = 2;
export const DEFAULT_DRAWING_COLOR = '#787B86';

export const COLOR_PALETTE_ROWS: string[][] = [
  // Row 0: Grayscale (10 swatches)
  ['#FFFFFF', '#E0E3EB', '#D1D4DC', '#B2B5BE', '#9598A1', '#787B86', '#5D606B', '#434651', '#2A2E39', '#000000'],
  // Row 1: Primary pure hues (10 swatches)
  ['#F23645', '#FF9800', '#FFEB3B', '#4CAF50', '#00BCD4', '#2196F3', '#2962FF', '#7E57C2', '#9C27B0', '#E91E63'],
  // Row 2: Lightest tints (10 swatches)
  ['#FADBD8', '#FFE0B2', '#FFF9C4', '#C8E6C9', '#B2EBF2', '#BBDEFB', '#C5CAE9', '#D1C4E9', '#E1BEE7', '#F8BBD0'],
  // Row 3: Soft pastels (10 swatches)
  ['#F1948A', '#FFCC80', '#FFF59D', '#A5D6A7', '#80DEEA', '#90CAF9', '#9FA8DA', '#B39DDB', '#CE93D8', '#F48FB1'],
  // Row 4: Light-medium (10 swatches)
  ['#E57373', '#FFB74D', '#FFF176', '#81C784', '#4DD0E1', '#64B5F6', '#7986CB', '#9575CD', '#BA68C8', '#F06292'],
  // Row 5: Medium-vibrant (10 swatches)
  ['#EF5350', '#FFA726', '#FFEE58', '#66BB6A', '#26C6DA', '#42A5F5', '#5C6BC0', '#7E57C2', '#AB47BC', '#EC407A'],
  // Row 6: Deep (10 swatches)
  ['#D32F2F', '#F57C00', '#FBC02D', '#388E3C', '#0097A7', '#1976D2', '#1565C0', '#512DA8', '#7B1FA2', '#C2185B'],
  // Row 7: Darkest / Shadow (10 swatches)
  ['#B71C1C', '#E65100', '#F57F17', '#1B5E20', '#006064', '#0D47A1', '#0A2558', '#311B92', '#4A148C', '#880E4F'],
];

/**
 * Parses user hex input:
 * - 3-digit: #RGB -> #RRGGBB
 * - 6-digit: #RRGGBB -> #RRGGBB
 * - 8-digit: #RRGGBBAA -> splits into color (#RRGGBB) + opacity (AA / 255)
 */
export function parseHexColor(input: string): { color: string; opacity?: number } | null {
  let hex = input.trim();
  if (hex.startsWith('#')) hex = hex.slice(1);

  // 3-digit hex #RGB -> #RRGGBB
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[0] + hex[0];
    const g = hex[1] + hex[1];
    const b = hex[2] + hex[2];
    return { color: `#${r}${g}${b}`.toUpperCase() };
  }

  // 6-digit hex #RRGGBB
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { color: `#${hex}`.toUpperCase() };
  }

  // 8-digit hex #RRGGBBAA -> split into color #RRGGBB and opacity (AA / 255)
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    const colorHex = `#${hex.slice(0, 6)}`.toUpperCase();
    const alphaHex = hex.slice(6, 8);
    const opacity = Math.round((parseInt(alphaHex, 16) / 255) * 100) / 100;
    return { color: colorHex, opacity };
  }

  return null;
}

interface ColorPickerPopoverProps {
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onClose: () => void;
  chartBounds?: { width: number; height: number };
  controlsTop: number;
  controlsLeft: number;
}

export function ColorPickerPopover({
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  onClose,
  chartBounds,
  controlsTop,
  controlsLeft,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [showCustomHex, setShowCustomHex] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);

  // Close on escape or outside click
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const currentOpacity = opacity ?? 1;
  const opacityPercent = Math.round(currentOpacity * 100);

  const applyHex = (val: string) => {
    const parsed = parseHexColor(val);
    if (parsed) {
      setHexError(false);
      onColorChange(parsed.color);
      if (parsed.opacity !== undefined) {
        onOpacityChange(parsed.opacity);
      }
    } else {
      setHexError(true);
    }
  };

  // Popover positioning logic: flip upward if close to bottom, align right if close to right edge
  const popoverStyle: React.CSSProperties = {};
  if (chartBounds) {
    if (controlsTop + 36 + 285 > chartBounds.height && controlsTop > 285) {
      popoverStyle.bottom = '100%';
      popoverStyle.marginBottom = '8px';
    } else {
      popoverStyle.top = '100%';
      popoverStyle.marginTop = '8px';
    }

    if (controlsLeft + 234 > chartBounds.width) {
      popoverStyle.right = 0;
    } else {
      popoverStyle.left = 0;
    }
  } else {
    popoverStyle.top = '100%';
    popoverStyle.marginTop = '8px';
    popoverStyle.left = 0;
  }

  const renderSwatch = (swatchColor: string, idx: number) => {
    const isSelected = color.toUpperCase() === swatchColor.toUpperCase();
    return (
      <button
        key={`${swatchColor}-${idx}`}
        type="button"
        data-swatch="true"
        onClick={() => {
          onColorChange(swatchColor);
          setHexInput(swatchColor);
        }}
        className={`h-[18px] w-[18px] p-0.5 rounded-[4px] transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
          isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1E222D]' : 'hover:ring-1 hover:ring-white/40'
        }`}
        style={{ backgroundColor: 'transparent', border: 'none' }}
        title={swatchColor}
        aria-label={`Select color ${swatchColor}`}
      >
        <span
          className="block w-full h-full rounded-[2px]"
          style={{ backgroundColor: swatchColor }}
        />
      </button>
    );
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-[236px] rounded-lg border border-[#333333] bg-[#1E222D] p-3 shadow-2xl backdrop-blur-md select-none text-white"
      style={popoverStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Row 0: Grayscale Palette */}
      <div className="grid grid-cols-10 gap-1 mb-2">
        {COLOR_PALETTE_ROWS[0].map((swatchColor, idx) => renderSwatch(swatchColor, idx))}
      </div>

      {/* Rows 1-7: 10-Column Hue Matrix */}
      <div className="grid grid-cols-10 gap-1 mb-2.5">
        {COLOR_PALETTE_ROWS.slice(1).flatMap((row, rIdx) =>
          row.map((swatchColor, cIdx) => renderSwatch(swatchColor, (rIdx + 1) * 10 + cIdx))
        )}
      </div>

      <div className="my-2 h-px bg-[#333333]" />

      {/* Custom Color Button / Hex Input */}
      {!showCustomHex ? (
        <div className="flex items-center pb-1">
          <button
            type="button"
            data-swatch="true"
            onClick={() => setShowCustomHex(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-[#848E9C] hover:bg-[#2A2E39] hover:text-white transition-colors cursor-pointer"
            title="Add custom color"
            aria-label="Add custom color"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 pb-1">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const val = e.target.value;
                setHexInput(val);
                const parsed = parseHexColor(val);
                if (parsed) {
                  setHexError(false);
                  onColorChange(parsed.color);
                  if (parsed.opacity !== undefined) {
                    onOpacityChange(parsed.opacity);
                  }
                }
              }}
              onBlur={() => applyHex(hexInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyHex(hexInput);
                }
              }}
              placeholder="#RRGGBB or #RRGGBBAA"
              className={`h-7 flex-1 rounded border px-2 font-mono text-[11px] outline-none ${
                hexError
                  ? 'border-red-500 bg-red-950/20 text-red-200'
                  : 'border-[#333333] bg-[#131722] text-[#E8E8E8] focus:border-[#3D7EFF]'
              }`}
            />
            {/* Native Eyedropper / Color Picker Trigger */}
            <button
              type="button"
              data-swatch="true"
              onClick={() => colorInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#333333] bg-[#262B37] transition-colors hover:border-[#4A4A4A] hover:bg-[#2A2E39] cursor-pointer"
              title="Pick from screen"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: color }}
              />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color.startsWith('#') && color.length === 7 ? color : '#3D7EFF'}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setHexInput(val);
                setHexError(false);
                onColorChange(val);
              }}
              className="sr-only"
            />
            <button
              type="button"
              data-swatch="true"
              onClick={() => applyHex(hexInput)}
              className="flex h-7 w-7 items-center justify-center rounded bg-[#3D7EFF] text-white hover:bg-[#2F6AE6] cursor-pointer"
              title="Apply color"
            >
              <Check size={14} strokeWidth={2.5} />
            </button>
          </div>
          {hexError && (
            <p className="text-[10px] text-red-400">Invalid hex (use #RGB, #RRGGBB, or #RRGGBBAA)</p>
          )}
        </div>
      )}

      {/* Opacity Slider with Gradient Track & Value Badge */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-normal text-[#848E9C]">Opacity</span>
          <div className="flex items-center justify-center rounded border border-[#333333] bg-[#1E222D] px-2 py-0.5 text-[11px] font-mono text-[#D1D4DC]">
            {opacityPercent}%
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacityPercent}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="color-picker-slider w-full h-2.5 rounded-full appearance-none cursor-pointer border border-[#333333]"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.05), ${color})`,
          }}
          title={`Opacity: ${opacityPercent}%`}
        />
      </div>
    </div>
  );
}

export function ModifyConfirmRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">{label}</span>
      <span className="text-right text-[11px] font-black uppercase text-[#E8E8E8]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

export interface DrawingToolbarProps {
  panelId: PanelId;
  selectedDrawing: DrawnLine;
  selectedDrawingControls: { top: number; left: number };
  chartBounds?: { width: number; height: number };
  onDelete: () => void;
  onRedraw: () => void;
}

export function DrawingToolbar({
  panelId,
  selectedDrawing: initialDrawing,
  selectedDrawingControls,
  chartBounds,
  onDelete,
  onRedraw,
}: DrawingToolbarProps) {
  // Subscribe to live drawing updates from store so changes reflect with 0ms latency
  const selectedDrawing = useChartStore((state) =>
    state.panels[panelId]?.drawnLines.find((l) => l.id === initialDrawing.id)
  ) ?? initialDrawing;

  const [activePicker, setActivePicker] = useState<'color' | 'border' | 'fill' | null>(null);

  return (
    <div
      className="popup-contrast absolute flex items-center gap-1 rounded border border-[#333] bg-[#1F1F1F]/95 p-1 shadow-xl backdrop-blur-sm z-30"
      style={{
        top: `${selectedDrawingControls.top}px`,
        left: `${selectedDrawingControls.left}px`,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {/* Lock / Unlock */}
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().updateLine(panelId, selectedDrawing.id, { locked: !selectedDrawing.locked });
          onRedraw();
        }}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          selectedDrawing.locked ? 'text-[#3D7EFF] hover:bg-[#2A2E39]' : 'text-gray-400 hover:bg-[#2A2E39] hover:text-[#E8E8E8]'
        }`}
        title={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
        aria-label={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
      >
        {selectedDrawing.locked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
      </button>

      {/* Stroke Width Selector */}
      <select
        value={selectedDrawing.strokeWidth ?? DEFAULT_DRAWING_STROKE_WIDTH}
        onChange={(event) => {
          useChartStore.getState().updateLine(panelId, selectedDrawing.id, {
            strokeWidth: Number(event.target.value) as DrawingStrokeWidth,
          });
          onRedraw();
        }}
        disabled={selectedDrawing.locked}
        className="h-7 rounded border border-[#333] bg-[#1F1F1F] px-1 text-[11px] font-bold text-[#E8E8E8] outline-none transition-colors hover:border-[#555] disabled:cursor-not-allowed disabled:opacity-45"
        title="Stroke width"
        aria-label="Stroke width"
      >
        {[1, 2, 3, 4].map((width) => (
          <option key={width} value={width}>
            {width}px
          </option>
        ))}
      </select>

      <div className="mx-0.5 h-5 w-px bg-[#333]" />

      {/* Color Controls: Box has separate Border & Fill, other drawings have single Color */}
      {selectedDrawing.type === 'box' ? (
        <>
          {/* Border Color & Border Opacity */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === 'border' ? null : 'border')}
              disabled={selectedDrawing.locked}
              className={`flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors ${
                activePicker === 'border' ? 'bg-[#2A2E39]' : 'hover:bg-[#2A2E39]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Border color & opacity"
              aria-label="Border color & opacity"
            >
              <span className="text-[10px] font-semibold text-[#A3A3A3]">Border</span>
              <span
                className="block h-3.5 w-3.5 rounded-full border border-white/30"
                style={{ backgroundColor: selectedDrawing.color ?? DEFAULT_DRAWING_COLOR }}
              />
            </button>
            {activePicker === 'border' && (
              <ColorPickerPopover
                color={selectedDrawing.color ?? DEFAULT_DRAWING_COLOR}
                opacity={selectedDrawing.opacity ?? 1}
                onColorChange={(color) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { color });
                  onRedraw();
                }}
                onOpacityChange={(opacity) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { opacity });
                  onRedraw();
                }}
                onClose={() => setActivePicker(null)}
                chartBounds={chartBounds}
                controlsTop={selectedDrawingControls.top}
                controlsLeft={selectedDrawingControls.left}
              />
            )}
          </div>

          <div className="mx-0.5 h-4 w-px bg-[#333]" />

          {/* Fill Toggle & Fill Color & Independent Fill Opacity */}
          <div className="relative flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const currentShowFill = selectedDrawing.showFill !== false;
                useChartStore.getState().updateLine(panelId, selectedDrawing.id, { showFill: !currentShowFill });
                onRedraw();
              }}
              disabled={selectedDrawing.locked}
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                selectedDrawing.showFill !== false ? 'text-[#3D7EFF] hover:bg-[#2A2E39]' : 'text-gray-500 hover:bg-[#2A2E39]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title={selectedDrawing.showFill !== false ? 'Hide box fill' : 'Show box fill'}
              aria-label={selectedDrawing.showFill !== false ? 'Hide box fill' : 'Show box fill'}
            >
              <Square size={14} className={selectedDrawing.showFill !== false ? 'fill-current' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === 'fill' ? null : 'fill')}
              disabled={selectedDrawing.locked || selectedDrawing.showFill === false}
              className={`flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors ${
                activePicker === 'fill' ? 'bg-[#2A2E39]' : 'hover:bg-[#2A2E39]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Fill color & opacity"
              aria-label="Fill color & opacity"
            >
              <span className="text-[10px] font-semibold text-[#A3A3A3]">Fill</span>
              <span
                className="block h-3.5 w-3.5 rounded-full border border-white/30"
                style={{
                  backgroundColor: selectedDrawing.fillColor ?? (selectedDrawing.color ?? '#3D7EFF'),
                  opacity: selectedDrawing.showFill === false ? 0.3 : 1,
                }}
              />
            </button>
            {activePicker === 'fill' && (
              <ColorPickerPopover
                color={selectedDrawing.fillColor ?? (selectedDrawing.color ?? '#3D7EFF')}
                opacity={selectedDrawing.fillOpacity ?? selectedDrawing.opacity ?? 1}
                onColorChange={(fillColor) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { fillColor });
                  onRedraw();
                }}
                onOpacityChange={(fillOpacity) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { fillOpacity });
                  onRedraw();
                }}
                onClose={() => setActivePicker(null)}
                chartBounds={chartBounds}
                controlsTop={selectedDrawingControls.top}
                controlsLeft={selectedDrawingControls.left}
              />
            )}
          </div>
        </>
      ) : (
        /* Non-box drawing (horizontal, vertical, horizontal-ray) */
        <div className="relative">
          <button
            type="button"
            onClick={() => setActivePicker(activePicker === 'color' ? null : 'color')}
            disabled={selectedDrawing.locked}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              activePicker === 'color' ? 'bg-[#2A2E39]' : 'hover:bg-[#2A2E39]'
            } disabled:cursor-not-allowed disabled:opacity-45`}
            title="Color & opacity"
            aria-label="Color & opacity"
          >
            <span
              className="block h-4 w-4 rounded-full border border-white/40 shadow-sm"
              style={{
                backgroundColor: selectedDrawing.color ?? DEFAULT_DRAWING_COLOR,
              }}
            />
          </button>
          {activePicker === 'color' && (
            <ColorPickerPopover
              color={selectedDrawing.color ?? DEFAULT_DRAWING_COLOR}
              opacity={selectedDrawing.opacity ?? 1}
              onColorChange={(color) => {
                useChartStore.getState().updateLine(panelId, selectedDrawing.id, { color });
                onRedraw();
              }}
              onOpacityChange={(opacity) => {
                useChartStore.getState().updateLine(panelId, selectedDrawing.id, { opacity });
                onRedraw();
              }}
              onClose={() => setActivePicker(null)}
              chartBounds={chartBounds}
              controlsTop={selectedDrawingControls.top}
              controlsLeft={selectedDrawingControls.left}
            />
          )}
        </div>
      )}

      <div className="mx-0.5 h-5 w-px bg-[#333]" />

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().removeLine(panelId, selectedDrawing.id);
          onDelete();
          onRedraw();
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
        title="Delete drawing"
        aria-label="Delete drawing"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

interface CustomProfileToolbarProps {
  panelId: PanelId;
  customProfileLocked: boolean;
  customProfileControls: { top: number; left: number };
  onRedraw: () => void;
}

export function CustomProfileToolbar({
  panelId,
  customProfileLocked,
  customProfileControls,
  onRedraw,
}: CustomProfileToolbarProps) {
  return (
    <div
      className="popup-contrast absolute flex items-center gap-1 p-1 bg-[#1F1F1F]/90 backdrop-blur-sm border border-[#333] rounded shadow-xl z-20"
      style={{
        top: `${customProfileControls.top}px`,
        left: `${customProfileControls.left}px`,
        transform: 'translateY(-4px)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().setCustomProfileLocked(panelId, !customProfileLocked);
          onRedraw();
        }}
        className={`p-1.5 hover:bg-[#1F1F1F] rounded-md transition-all ${customProfileLocked ? 'text-[#3D7EFF]' : 'text-gray-400'}`}
        title={customProfileLocked ? "Unlock Profile" : "Lock Profile"}
      >
        {customProfileLocked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().openIndicatorSettings(panelId, 'profiles');
        }}
        className="p-1.5 text-gray-400 hover:bg-[#1F1F1F] hover:text-accent rounded-md transition-all"
        title="Profile Settings"
        aria-label="Profile Settings"
      >
        <Settings size={15} strokeWidth={2.5} />
      </button>
      <div className="w-[1px] h-4 bg-[#333] mx-0.5" />
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().setCustomProfileRange(panelId, null);
          onRedraw();
        }}
        className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-md transition-all"
        title="Remove Profile"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

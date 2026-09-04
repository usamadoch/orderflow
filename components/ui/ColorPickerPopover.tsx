import React, { useState, useRef, useEffect } from 'react';
import { Check, Plus } from 'lucide-react';

export const DEFAULT_DRAWING_STROKE_WIDTH = 2;
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

export interface ColorPickerPopoverProps {
  color: string;
  opacity?: number;
  onColorChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  onClose: () => void;
  showOpacity?: boolean;
  chartBounds?: { width: number; height: number };
  controlsTop?: number;
  controlsLeft?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ColorPickerPopover({
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  onClose,
  showOpacity = true,
  chartBounds,
  controlsTop,
  controlsLeft,
  className = '',
  style,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [showCustomHex, setShowCustomHex] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');

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

  // Check if popover should flip upward in standard DOM context
  useEffect(() => {
    if (!chartBounds && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const scrollParent = popoverRef.current.closest('.overflow-y-auto') || document.documentElement;
      const parentBottom = scrollParent.getBoundingClientRect().bottom;
      if (rect.bottom > parentBottom - 10 || rect.bottom > window.innerHeight - 20) {
        setPlacement('top');
      }
    }
  }, [chartBounds]);

  const currentOpacity = opacity ?? 1;
  const opacityPercent = Math.round(currentOpacity * 100);

  const applyHex = (val: string) => {
    const parsed = parseHexColor(val);
    if (parsed) {
      setHexError(false);
      onColorChange(parsed.color);
      if (parsed.opacity !== undefined && onOpacityChange) {
        onOpacityChange(parsed.opacity);
      }
    } else {
      setHexError(true);
    }
  };

  // Popover positioning logic
  const popoverStyle: React.CSSProperties = { ...style };
  if (chartBounds && controlsTop !== undefined && controlsLeft !== undefined) {
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
    // Standard relative container placement
    if (placement === 'top') {
      popoverStyle.bottom = '100%';
      popoverStyle.marginBottom = '6px';
    } else {
      popoverStyle.top = '100%';
      popoverStyle.marginTop = '6px';
    }
    popoverStyle.right = 0;
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
      className={`absolute z-[1100] w-[236px] rounded-lg border border-[#333333] bg-[#1E222D] p-3 shadow-2xl backdrop-blur-md select-none text-white ${className}`}
      style={popoverStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
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
                  if (parsed.opacity !== undefined && onOpacityChange) {
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
      {showOpacity && onOpacityChange && (
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
      )}
    </div>
  );
}

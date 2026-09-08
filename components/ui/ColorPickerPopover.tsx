import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const DEFAULT_DRAWING_STROKE_WIDTH = 1;
export const DEFAULT_DRAWING_COLOR = '#FFFFFF';

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
  thickness?: number;
  onThicknessChange?: (thickness: number) => void;
  showThickness?: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  onLineStyleChange?: (style: 'solid' | 'dashed' | 'dotted') => void;
  showLineStyle?: boolean;
  onClose: () => void;
  showOpacity?: boolean;
  chartBounds?: { width: number; height: number };
  controlsTop?: number;
  controlsLeft?: number;
  className?: string;
  style?: React.CSSProperties;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function ColorPickerPopover({
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  thickness = 1,
  onThicknessChange,
  showThickness = false,
  lineStyle = 'solid',
  onLineStyleChange,
  showLineStyle = false,
  onClose,
  showOpacity = true,
  chartBounds,
  controlsTop,
  controlsLeft,
  className = '',
  style,
  triggerRef,
}: ColorPickerPopoverProps) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [showCustomHex, setShowCustomHex] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getAnchor = useCallback((): HTMLElement | null => {
    if (triggerRef?.current) return triggerRef.current;
    if (!markerRef.current) return null;
    const prev = markerRef.current.previousElementSibling;
    if (prev instanceof HTMLElement) return prev;
    return markerRef.current.parentElement;
  }, [triggerRef]);

  const updatePosition = useCallback(() => {
    if (chartBounds) return;
    const anchor = getAnchor();
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.width === 0 && anchorRect.height === 0 && anchorRect.top === 0 && anchorRect.bottom === 0) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;
    const gap = 6;

    const popoverEl = popoverRef.current;
    const popoverWidth = popoverEl?.offsetWidth || 236;
    const popoverHeight = popoverEl?.offsetHeight || 380;

    // Vertical placement
    const spaceBelow = viewportHeight - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - margin;

    let top: number;
    if (spaceBelow >= popoverHeight + gap) {
      top = anchorRect.bottom + gap;
    } else if (spaceAbove >= popoverHeight + gap) {
      top = anchorRect.top - popoverHeight - gap;
    } else {
      if (spaceBelow >= spaceAbove) {
        top = anchorRect.bottom + gap;
      } else {
        top = anchorRect.top - popoverHeight - gap;
      }
      top = Math.max(margin, Math.min(top, viewportHeight - popoverHeight - margin));
    }

    // Horizontal placement
    // Default: align right edge of popover with right edge of anchor button
    let left = anchorRect.right - popoverWidth;

    // If aligning to the right of the button pushes it off the left edge of the screen,
    // align to the left edge of the button instead
    if (left < margin) {
      left = anchorRect.left;
    }

    // Always clamp within viewport margins so it's never clipped on left or right
    left = Math.max(margin, Math.min(left, viewportWidth - popoverWidth - margin));

    setCoords({ top, left });
  }, [chartBounds, getAnchor]);

  useIsomorphicLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // Track scroll and resize across any container
  useEffect(() => {
    if (chartBounds) return;
    updatePosition();

    const handleScroll = () => {
      updatePosition();
    };
    const handleWindowResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [chartBounds, updatePosition]);

  // Observe popover size changes (e.g. toggling custom hex)
  useEffect(() => {
    if (chartBounds || !popoverRef.current) return;
    updatePosition();
    const ro = new ResizeObserver(() => {
      updatePosition();
    });
    ro.observe(popoverRef.current);
    return () => ro.disconnect();
  }, [chartBounds, updatePosition, showCustomHex, showOpacity, showThickness, showLineStyle]);

  // Close on escape or outside click
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      const anchor = getAnchor();
      if (anchor && anchor.contains(target)) {
        return;
      }
      onClose();
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
  }, [getAnchor, onClose]);

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

  // Popover styles
  const toolbarStyle: React.CSSProperties = { ...style };
  if (chartBounds && controlsTop !== undefined && controlsLeft !== undefined) {
    if (controlsTop + 36 + 285 > chartBounds.height && controlsTop > 285) {
      toolbarStyle.bottom = '100%';
      toolbarStyle.marginBottom = '8px';
    } else {
      toolbarStyle.top = '100%';
      toolbarStyle.marginTop = '8px';
    }

    if (controlsLeft + 234 > chartBounds.width) {
      toolbarStyle.right = 0;
    } else {
      toolbarStyle.left = 0;
    }
  }

  const portalStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords ? `${coords.top}px` : '-9999px',
    left: coords ? `${coords.left}px` : '-9999px',
    maxHeight: 'calc(100vh - 16px)',
    overflowY: 'auto',
    opacity: coords ? 1 : 0,
    pointerEvents: coords ? 'auto' : 'none',
    transition: 'opacity 0.08s ease-out',
    ...style,
  };

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

  const popoverContent = (
    <div
      ref={popoverRef}
      className={
        chartBounds
          ? `absolute z-[1100] w-[236px] rounded-lg border border-[#333333] bg-[#1E222D] p-3 shadow-2xl select-none text-white ${className}`
          : `fixed z-[99999] w-[236px] rounded-lg border border-[#333333] bg-[#1E222D] p-3 shadow-2xl select-none text-white custom-scrollbar ${className}`
      }
      style={chartBounds ? toolbarStyle : portalStyle}
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

      {/* Thickness Controls */}
      {showThickness && onThicknessChange && (
        <div className="space-y-1.5 pt-2">
          <span className="text-[12px] font-normal text-[#848E9C]">Thickness</span>
          <div className="flex rounded-[4px] border border-[#363A45] overflow-hidden divide-x divide-[#363A45] bg-[#1E222D]">
            {[1, 2, 3, 4].map((t) => {
              const isSelected = thickness === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onThicknessChange(t)}
                  className={`flex-1 h-7 flex items-center justify-center transition-colors cursor-pointer ${
                    isSelected ? 'bg-white' : 'bg-transparent hover:bg-[#2A2E39]'
                  }`}
                  aria-label={`Thickness ${t}`}
                >
                  <div
                    className={`w-4 rounded-full ${isSelected ? 'bg-[#131722]' : 'bg-white'}`}
                    style={{ height: `${t}px` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Line Style Controls */}
      {showLineStyle && onLineStyleChange && (
        <div className="space-y-1.5 pt-2">
          <span className="text-[12px] font-normal text-[#848E9C]">Line style</span>
          <div className="flex rounded-[4px] border border-[#363A45] overflow-hidden divide-x divide-[#363A45] bg-[#1E222D]">
            {[
              {
                id: 'solid',
                label: 'Solid',
                render: (isSelected: boolean) => (
                  <div className={`w-5 h-px ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                ),
              },
              {
                id: 'dashed',
                label: 'Dashed',
                render: (isSelected: boolean) => (
                  <div className="w-5 flex justify-between">
                    <div className={`w-1 h-px ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                    <div className={`w-1 h-px ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                    <div className={`w-1 h-px ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                  </div>
                ),
              },
              {
                id: 'dotted',
                label: 'Dotted',
                render: (isSelected: boolean) => (
                  <div className="w-5 flex justify-between">
                    <div className={`w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                    <div className={`w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                    <div className={`w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                    <div className={`w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-[#131722]' : 'bg-white'}`} />
                  </div>
                ),
              },
            ].map((styleOption) => {
              const isSelected = lineStyle === styleOption.id;
              return (
                <button
                  key={styleOption.id}
                  type="button"
                  onClick={() => onLineStyleChange(styleOption.id as 'solid' | 'dashed' | 'dotted')}
                  className={`flex-1 h-7 flex items-center justify-center transition-colors cursor-pointer ${
                    isSelected ? 'bg-white' : 'bg-transparent hover:bg-[#2A2E39]'
                  }`}
                  aria-label={styleOption.label}
                >
                  {styleOption.render(isSelected)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (chartBounds) {
    return popoverContent;
  }

  return (
    <>
      <span ref={markerRef} style={{ display: 'none' }} aria-hidden="true" />
      {mounted && typeof document !== 'undefined' ? createPortal(popoverContent, document.body) : null}
    </>
  );
}

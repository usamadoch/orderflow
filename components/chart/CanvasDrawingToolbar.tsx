import React, { useState } from 'react';
import { Lock, Settings, Square, Unlock, Trash2 } from 'lucide-react';
import { FigButton, FigTooltip } from '@/components/ui/fig';
import type { DrawnLine, DrawingStrokeWidth, PanelId } from '@/lib/store/chart';
import { useChartStore } from '@/lib/store/chart';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';

import {
  DEFAULT_DRAWING_STROKE_WIDTH,
  DEFAULT_DRAWING_COLOR,
  COLOR_PALETTE_ROWS,
  parseHexColor,
  ColorPickerPopover,
} from '@/components/ui/ColorPickerPopover';

export {
  DEFAULT_DRAWING_STROKE_WIDTH,
  DEFAULT_DRAWING_COLOR,
  COLOR_PALETTE_ROWS,
  parseHexColor,
  ColorPickerPopover,
};


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

  const [activePicker, setActivePicker] = useState<'color' | 'border' | 'fill' | 'profit' | 'stop' | null>(null);
  const isPosition = selectedDrawing.type === 'long-position' || selectedDrawing.type === 'short-position';

  return (
    <div
      className="popup-contrast absolute flex items-center gap-1 rounded border border-[#282828] bg-[#181818] p-1 shadow-2xl z-30"
      style={{
        top: `${selectedDrawingControls.top}px`,
        left: `${selectedDrawingControls.left}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {/* Lock / Unlock */}
      <FigTooltip text={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}>
        <FigButton
          variant="ghost"
          icon
          onClick={() => {
            useChartStore.getState().updateLine(panelId, selectedDrawing.id, { locked: !selectedDrawing.locked });
            onRedraw();
          }}
          aria-label={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
        >
          {selectedDrawing.locked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
        </FigButton>
      </FigTooltip>

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

      {/* Color Controls: Box has separate Border & Fill, Position has Profit & Stop, other drawings have single Color */}
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
            <FigButton
              variant="ghost"
              icon
              size="compact"
              onClick={() => {
                const currentShowFill = selectedDrawing.showFill !== false;
                useChartStore.getState().updateLine(panelId, selectedDrawing.id, { showFill: !currentShowFill });
                onRedraw();
              }}
              disabled={selectedDrawing.locked}
              className={selectedDrawing.showFill !== false ? 'text-[#3D7EFF]' : 'text-gray-500'}
              title={selectedDrawing.showFill !== false ? 'Hide box fill' : 'Show box fill'}
              aria-label={selectedDrawing.showFill !== false ? 'Hide box fill' : 'Show box fill'}
            >
              <Square size={14} className={selectedDrawing.showFill !== false ? 'fill-current' : ''} />
            </FigButton>
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
      ) : isPosition ? (
        <>
          {/* Profit Box Color & Opacity */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === 'profit' ? null : 'profit')}
              disabled={selectedDrawing.locked}
              className={`flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors ${
                activePicker === 'profit' ? 'bg-[#2A2E39]' : 'hover:bg-[#2A2E39]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Profit box color & opacity"
              aria-label="Profit box color & opacity"
            >
              <span className="text-[10px] font-semibold text-[#A3A3A3]">Profit</span>
              <span
                className="block h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                style={{
                  backgroundColor: selectedDrawing.profitColor ?? CHART_BULLISH_COLOR,
                  opacity: selectedDrawing.profitOpacity ?? 1,
                }}
              />
            </button>
            {activePicker === 'profit' && (
              <ColorPickerPopover
                color={selectedDrawing.profitColor ?? CHART_BULLISH_COLOR}
                opacity={selectedDrawing.profitOpacity ?? 0.28}
                onColorChange={(profitColor) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { profitColor });
                  onRedraw();
                }}
                onOpacityChange={(profitOpacity) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { profitOpacity });
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

          {/* Stop Loss Box Color & Opacity */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === 'stop' ? null : 'stop')}
              disabled={selectedDrawing.locked}
              className={`flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors ${
                activePicker === 'stop' ? 'bg-[#2A2E39]' : 'hover:bg-[#2A2E39]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Stop loss color & opacity"
              aria-label="Stop loss color & opacity"
            >
              <span className="text-[10px] font-semibold text-[#A3A3A3]">Stop</span>
              <span
                className="block h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                style={{
                  backgroundColor: selectedDrawing.stopColor ?? CHART_BEARISH_COLOR,
                  opacity: selectedDrawing.stopOpacity ?? 1,
                }}
              />
            </button>
            {activePicker === 'stop' && (
              <ColorPickerPopover
                color={selectedDrawing.stopColor ?? CHART_BEARISH_COLOR}
                opacity={selectedDrawing.stopOpacity ?? 0.28}
                onColorChange={(stopColor) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { stopColor });
                  onRedraw();
                }}
                onOpacityChange={(stopOpacity) => {
                  useChartStore.getState().updateLine(panelId, selectedDrawing.id, { stopOpacity });
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
      <FigTooltip text="Delete drawing">
        <FigButton
          variant="ghost"
          icon
          onClick={() => {
            useChartStore.getState().removeLine(panelId, selectedDrawing.id);
            onDelete();
            onRedraw();
          }}
          aria-label="Delete drawing"
        >
          <Trash2 size={15} strokeWidth={2.5} />
        </FigButton>
      </FigTooltip>
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
      className="popup-contrast absolute flex items-center gap-1 p-1 bg-[#181818] border border-[#282828] rounded shadow-2xl z-20"
      style={{
        top: `${customProfileControls.top}px`,
        left: `${customProfileControls.left}px`,
        transform: 'translateY(-4px)',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <FigTooltip text={customProfileLocked ? "Unlock Profile" : "Lock Profile"}>
        <FigButton
          variant="ghost"
          icon
          onClick={() => {
            useChartStore.getState().setCustomProfileLocked(panelId, !customProfileLocked);
            onRedraw();
          }}
          aria-label={customProfileLocked ? "Unlock Profile" : "Lock Profile"}
        >
          {customProfileLocked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
        </FigButton>
      </FigTooltip>
      <FigTooltip text="Profile Settings">
        <FigButton
          variant="ghost"
          icon
          onClick={() => {
            useChartStore.getState().openIndicatorSettings(panelId, 'profiles');
          }}
          aria-label="Profile Settings"
        >
          <Settings size={15} strokeWidth={2.5} />
        </FigButton>
      </FigTooltip>
      <div className="w-[1px] h-4 bg-[#333] mx-0.5" />
      <FigTooltip text="Remove Profile">
        <FigButton
          variant="ghost"
          icon
          onClick={() => {
            useChartStore.getState().setCustomProfileRange(panelId, null);
            onRedraw();
          }}
          aria-label="Remove Profile"
        >
          <Trash2 size={15} strokeWidth={2.5} />
        </FigButton>
      </FigTooltip>
    </div>
  );
}

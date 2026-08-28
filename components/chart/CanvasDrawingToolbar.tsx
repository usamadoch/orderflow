import React from 'react';
import { Lock, Settings, Unlock, X } from 'lucide-react';
import type { DrawnLine, DrawingStrokeWidth, PanelId } from '@/lib/store/chart';
import { useChartStore } from '@/lib/store/chart';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';

const DRAWING_COLORS = [
  CHART_BEARISH_COLOR,
  '#FF9801',
  '#FFEB3B',
  '#4CAF50',
  CHART_BULLISH_COLOR,
  '#00BCD4',
  '#2962FF',
  '#673AB7',
  '#E91E63',
] as const;
const DEFAULT_DRAWING_STROKE_WIDTH: DrawingStrokeWidth = 2;

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

interface DrawingToolbarProps {
  panelId: PanelId;
  selectedDrawing: DrawnLine;
  selectedDrawingControls: { top: number; left: number };
  onDelete: () => void;
  onRedraw: () => void;
}

export function DrawingToolbar({
  panelId,
  selectedDrawing,
  selectedDrawingControls,
  onDelete,
  onRedraw,
}: DrawingToolbarProps) {
  return (
    <div
      className="popup-contrast absolute flex items-center gap-1 rounded border border-[#333] bg-[#1F1F1F]/95 p-1 shadow-xl backdrop-blur-sm z-30"
      style={{
        top: `${selectedDrawingControls.top}px`,
        left: `${selectedDrawingControls.left}px`,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          useChartStore.getState().updateLine(panelId, selectedDrawing.id, { locked: !selectedDrawing.locked });
          onRedraw();
        }}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${selectedDrawing.locked ? 'text-[#3D7EFF] hover:bg-[#1F1F1F]' : 'text-gray-400 hover:bg-[#1F1F1F] hover:text-[#E8E8E8]'}`}
        title={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
        aria-label={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
      >
        {selectedDrawing.locked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
      </button>
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
          <option key={width} value={width}>{width}px</option>
        ))}
      </select>
      <div className="mx-0.5 h-5 w-px bg-[#333]" />
      <div className="flex items-center gap-0.5" title="Drawing color">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              useChartStore.getState().updateLine(panelId, selectedDrawing.id, { color });
              onRedraw();
            }}
            disabled={selectedDrawing.locked}
            className="flex h-7 w-5 items-center justify-center rounded hover:bg-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
            title={color}
            aria-label={`Set drawing color ${color}`}
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full border ${selectedDrawing.color === color ? 'border-white' : 'border-black/40'}`}
              style={{ backgroundColor: color }}
            />
          </button>
        ))}
      </div>
      <div className="mx-0.5 h-5 w-px bg-[#333]" />
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

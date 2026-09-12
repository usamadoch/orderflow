'use client';

import React, { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { useChartStore } from '@/lib/store/chart';
import { parseTimeframeInput } from '../chart/chartCanvasUtils';

const TIMEFRAME_LABELS: Record<string, string> = {
  '1m': '1 Minute',
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '1h': '1 Hour',
  '4h': '4 Hours',
};

export function TimeframeInputModal() {
  const inputState = useChartRuntimeStore((s) => s.timeframeInputState);
  const setTimeframeInputState = useChartRuntimeStore((s) => s.setTimeframeInputState);
  const setTimeframe = useChartStore((s) => s.setTimeframe);

  // Auto-dismiss after 6 seconds of inactivity
  useEffect(() => {
    if (!inputState?.isOpen) return;

    const timer = setTimeout(() => {
      setTimeframeInputState(null);
    }, 6000);

    return () => clearTimeout(timer);
  }, [inputState, setTimeframeInputState]);

  if (!inputState?.isOpen) return null;

  const resolvedTimeframe = parseTimeframeInput(inputState.buffer);
  const resolvedLabel = resolvedTimeframe ? TIMEFRAME_LABELS[resolvedTimeframe] : null;

  const handleApply = () => {
    if (resolvedTimeframe && inputState.panelId) {
      setTimeframe(inputState.panelId, resolvedTimeframe);
    }
    setTimeframeInputState(null);
  };

  const handleCancel = () => {
    setTimeframeInputState(null);
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-28"
      role="dialog"
      aria-label="Change Interval"
    >
      <div className="pointer-events-auto flex min-w-[240px] flex-col items-center rounded-xl border border-[#383838] bg-[#1E1E1E]/95 p-4 shadow-2xl backdrop-blur-md transition-all">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8A8A8A]">
          <Clock size={13} strokeWidth={2.5} className="text-[#3D7EFF]" />
          <span>Change Interval</span>
        </div>

        <div className="my-2 flex items-center justify-center font-mono text-3xl font-black tracking-wide text-white">
          <span>{inputState.buffer || ' '}</span>
          <span className="ml-0.5 inline-block h-6 w-0.5 animate-pulse bg-[#3D7EFF]" />
        </div>

        <div className="min-h-[20px] text-center text-[12px] font-semibold">
          {resolvedLabel ? (
            <span className="text-[#3D7EFF]">{resolvedLabel}</span>
          ) : inputState.buffer.length > 0 ? (
            <span className="text-[#F23645]">Allowed: 1m, 5m, 15m, 1h, 4h</span>
          ) : (
            <span className="text-[#666]">Type interval and press Enter</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-[#2A2A2A] pt-2 text-[10px] text-[#787B86]">
          <button
            type="button"
            onClick={handleApply}
            disabled={!resolvedTimeframe}
            className="cursor-pointer hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <kbd className="rounded bg-[#2A2A2A] px-1 py-0.5 font-mono text-[#CCC]">Enter</kbd> to apply
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer hover:text-white"
          >
            <kbd className="rounded bg-[#2A2A2A] px-1 py-0.5 font-mono text-[#CCC]">Esc</kbd> to cancel
          </button>
        </div>
      </div>
    </div>
  );
}

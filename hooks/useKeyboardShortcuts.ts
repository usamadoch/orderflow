'use client';

import { useEffect } from 'react';
import { useChartStore } from '@/lib/store/chart';

const TIMEFRAME_KEYS: Record<string, string> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '4h',
};

export function useKeyboardShortcuts() {
  const setTimeframe = useChartStore(s => s.setTimeframe);
  const setChartMode = useChartStore(s => s.setChartMode);
  const setBarWidth = useChartStore(s => s.setBarWidth);
  const setScrollOffset = useChartStore(s => s.setScrollOffset);
  const setBucketSize = useChartStore(s => s.setBucketSize);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const activePanel = useChartStore.getState().activePanel;
      const panel = useChartStore.getState().panels[activePanel];

      // 1-5: Timeframe shortcuts
      if (TIMEFRAME_KEYS[key]) {
        e.preventDefault();
        setTimeframe(activePanel, TIMEFRAME_KEYS[key]);
        return;
      }

      // C: Candle mode
      if (key === 'c') {
        e.preventDefault();
        setChartMode(activePanel, 'candle');
        return;
      }

      // F: Footprint mode
      if (key === 'f') {
        e.preventDefault();
        setChartMode(activePanel, 'footprint');
        return;
      }

      // R: Reset zoom/scroll
      if (key === 'r') {
        e.preventDefault();
        setBarWidth(activePanel, 12);
        setScrollOffset(activePanel, 0);
        return;
      }

      // [ / ]: Adjust bucket size
      if (key === '[') {
        e.preventDefault();
        const newSize = Math.max(1, panel.bucketSize - 1);
        setBucketSize(activePanel, newSize);
        return;
      }
      if (key === ']') {
        e.preventDefault();
        setBucketSize(activePanel, panel.bucketSize + 1);
        return;
      }

      // E: Log exhaustion map (Verification)
      if (key === 'e') {
        e.preventDefault();
        console.log(`--- Exhaustion Map (${activePanel} panel) ---`);
        if (panel.exhaustionMap.size === 0) {
          console.log('No exhaustion signals detected.');
        } else {
          panel.exhaustionMap.forEach((res, time) => {
            console.log(`[${new Date(time * 1000).toLocaleTimeString()}] Score: ${res.score} (${res.rank}) Dir: ${res.direction}`);
            console.log(`   Reasons: ${res.reasons.join(', ')}`);
          });
        }
        return;
      }

      // M: Toggle measurement tool
      if (key === 'm') {
        e.preventDefault();
        useChartStore.getState().setMeasureToolActive(activePanel, !panel.measureToolActive);
        return;
      }

      // S: Toggle sessions
      if (key === 's') {
        e.preventDefault();
        useChartStore.getState().setSessionsEnabled(activePanel, !panel.sessionsEnabled);
        return;
      }

      // Escape: Clear active measurement
      if (key === 'escape') {
        e.preventDefault();
        if (panel.activeMeasurement) {
          useChartStore.getState().setActiveMeasurement(activePanel, null);
        } else if (panel.isDrawMode) {
          useChartStore.getState().setDrawMode(activePanel, false);
        } else if (panel.lineDrawMode !== 'none') {
          useChartStore.getState().setLineDrawMode(activePanel, 'none');
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTimeframe, setChartMode, setBarWidth, setScrollOffset, setBucketSize]);
}

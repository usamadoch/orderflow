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

      // I: Log iceberg levels (Verification)
      if (key === 'i') {
        e.preventDefault();
        console.log(`--- Iceberg Levels (${activePanel} panel) ---`);
        if (panel.icebergLevels.length === 0) {
          console.log('No iceberg levels detected.');
        } else {
          console.table(panel.icebergLevels.map(level => ({
            price: level.price,
            score: level.score,
            rank: level.rank,
            side: level.side,
            totalVolume: level.totalVolume.toFixed(2),
            candleCount: level.candleCount,
            avgVolumePerCandle: level.avgVolumePerCandle.toFixed(2),
            cumulativeDelta: level.cumulativeDelta.toFixed(2),
            reasons: level.reasons.join('; '),
          })));
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

      // Q: Toggle liquidity map
      if (key === 'q') {
        e.preventDefault();
        useChartStore.getState().setLiquidityEnabled(activePanel, !panel.liquidityEnabled);
        return;
      }

      // K: Toggle iceberg levels
      if (key === 'k') {
        e.preventDefault();
        useChartStore.getState().setIcebergEnabled(activePanel, !panel.icebergEnabled);
        return;
      }

      // V: Toggle liquidity vacuum zones
      if (key === 'v') {
        e.preventDefault();
        useChartStore.getState().setLiquidityVacuumEnabled(activePanel, !panel.liquidityVacuumEnabled);
        return;
      }

      // L: Log liquidity zones (verification)
      if (key === 'l') {
        e.preventDefault();
        console.log(`--- Liquidity Zones (${activePanel} panel) ---`);
        const zones = panel.liquidityZones;
        if (zones.length === 0) {
          console.log('No liquidity zones available.');
        } else {
          console.log(`${zones.length} zones:`);
          console.table(zones.map(z => ({
            price: z.price,
            totalQty: z.totalQty.toFixed(2),
            side: z.side,
            intensity: z.intensity.toFixed(2),
            levelCount: z.levelCount,
          })));
        }
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

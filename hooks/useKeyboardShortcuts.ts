'use client';

import { useEffect, useRef } from 'react';
import { useChartStore } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import {
  moveDrawnLine,
  moveCustomProfileRange,
  parseTimeframeInput,
} from '@/components/chart/chartCanvasUtils';

function isTypingOrInModal(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.getAttribute?.('contenteditable') === 'true'
  ) {
    return true;
  }

  const dialog = target.closest('[role="dialog"], dialog, .modal-content, [data-modal="true"]');
  if (dialog && dialog.getAttribute('aria-label') !== 'Change Interval') {
    return true;
  }

  return false;
}

export function useKeyboardShortcuts() {
  const isFirstArrowInSequence = useRef(true);
  const arrowMoveHistoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 1. Context safety: never trigger when typing in inputs/modals (except timeframe modal)
      if (isTypingOrInModal(e)) {
        return;
      }

      const rawKey = e.key;
      const lowerKey = rawKey.toLowerCase();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      const chartStore = useChartStore.getState();
      const runtimeStore = useChartRuntimeStore.getState();
      const activePanel = chartStore.activePanel;
      const panel = chartStore.panels[activePanel];
      const runtimePanel = runtimeStore.panels[activePanel];
      const timeframeInputState = runtimeStore.timeframeInputState;

      // ── 2. Timeframe Modal Input Interception ─────────────────────────────
      if (timeframeInputState?.isOpen) {
        if (rawKey === 'Enter') {
          e.preventDefault();
          const resolved = parseTimeframeInput(timeframeInputState.buffer);
          if (resolved && timeframeInputState.panelId) {
            chartStore.setTimeframe(timeframeInputState.panelId, resolved);
          }
          runtimeStore.setTimeframeInputState(null);
          return;
        }

        if (rawKey === 'Escape') {
          e.preventDefault();
          runtimeStore.setTimeframeInputState(null);
          return;
        }

        if (rawKey === 'Backspace') {
          e.preventDefault();
          const nextBuffer = timeframeInputState.buffer.slice(0, -1);
          runtimeStore.setTimeframeInputState({
            ...timeframeInputState,
            buffer: nextBuffer,
          });
          return;
        }

        if (/^[0-9mhdMHD]$/.test(rawKey)) {
          e.preventDefault();
          if (timeframeInputState.buffer.length < 8) {
            runtimeStore.setTimeframeInputState({
              ...timeframeInputState,
              buffer: timeframeInputState.buffer + lowerKey,
            });
          }
          return;
        }

        // Swallow any other key while timeframe modal is open
        e.preventDefault();
        return;
      }

      // ── 3. Undo / Redo Shortcuts ──────────────────────────────────────────
      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (isCtrlOrCmd && !e.shiftKey && lowerKey === 'z') {
        e.preventDefault();
        chartStore.undo(activePanel);
        return;
      }

      // Redo: Ctrl+Y / Cmd+Shift+Z / Ctrl+Shift+Z
      if (
        (isCtrlOrCmd && lowerKey === 'y') ||
        (isCtrlOrCmd && e.shiftKey && lowerKey === 'z')
      ) {
        e.preventDefault();
        chartStore.redo(activePanel);
        return;
      }

      // ── 4. Utility / Dialog Shortcuts ─────────────────────────────────────
      // Pair / Symbol Search: Ctrl+K / Cmd+K
      if (isCtrlOrCmd && lowerKey === 'k') {
        e.preventDefault();
        const trigger = document.getElementById(`pair-selector-trigger-${activePanel}`);
        trigger?.click();
        return;
      }

      // Split Layout Toggle: Alt+S
      if (e.altKey && !e.shiftKey && !isCtrlOrCmd && lowerKey === 's') {
        e.preventDefault();
        const currentMode = chartStore.layoutMode;
        chartStore.setLayoutMode(currentMode === 'dual' ? 'single' : 'dual');
        return;
      }

      // Reset Chart Zoom, Scroll & Auto-scale: Alt+R
      if (e.altKey && !e.shiftKey && !isCtrlOrCmd && lowerKey === 'r') {
        e.preventDefault();
        chartStore.setBarWidth(activePanel, 12);
        chartStore.setScrollOffset(activePanel, 0);
        runtimeStore.triggerPanelRefresh(activePanel);
        return;
      }

      // Focus Mode: Alt+Shift+Z
      if (e.altKey && e.shiftKey && lowerKey === 'z') {
        e.preventDefault();
        chartStore.setFocusMode(!chartStore.focusMode);
        return;
      }

      // Indicators Modal: / (when no modifiers)
      if (!isCtrlOrCmd && !e.altKey && !e.shiftKey && rawKey === '/') {
        e.preventDefault();
        const trigger = document.getElementById(`panel-indicators-trigger-${activePanel}`);
        trigger?.click();
        return;
      }

      // ── 5. Zoom In / Out with Keyboard: Ctrl+Up / Ctrl+Down ────────────────
      if (isCtrlOrCmd && (rawKey === 'ArrowUp' || rawKey === 'ArrowDown')) {
        e.preventDefault();
        const currentBarWidth = panel?.barWidth ?? 12;
        if (rawKey === 'ArrowUp') {
          chartStore.setBarWidth(activePanel, Math.min(60, currentBarWidth + 2));
        } else {
          chartStore.setBarWidth(activePanel, Math.max(4, currentBarWidth - 2));
        }
        return;
      }

      // ── 6. Selection Deletion: Delete / Backspace ──────────────────────────
      if (rawKey === 'Delete' || rawKey === 'Backspace') {
        const selectedDrawingId = runtimePanel?.selectedDrawingId;
        if (selectedDrawingId) {
          e.preventDefault();
          chartStore.removeLine(activePanel, selectedDrawingId);
          runtimeStore.setSelectedDrawingId(activePanel, null);
          return;
        }

        if (runtimePanel?.isProfileSelected && panel?.customProfileRange) {
          e.preventDefault();
          chartStore.setCustomProfileRange(activePanel, null);
          runtimeStore.setProfileSelected(activePanel, false);
          return;
        }
      }

      // ── 7. Escape: Deselect / Cancel Active Operations ─────────────────────
      if (rawKey === 'Escape') {
        e.preventDefault();
        if (runtimePanel?.selectedDrawingId) {
          runtimeStore.setSelectedDrawingId(activePanel, null);
          return;
        }
        if (runtimePanel?.isProfileSelected) {
          runtimeStore.setProfileSelected(activePanel, false);
          return;
        }
        if (runtimePanel?.activeMeasurement) {
          runtimeStore.setActiveMeasurement(activePanel, null);
          return;
        }
        if (panel?.isDrawMode) {
          chartStore.setDrawMode(activePanel, false);
          return;
        }
        if (panel?.lineDrawMode && panel.lineDrawMode !== 'none') {
          chartStore.setLineDrawMode(activePanel, 'none');
          return;
        }
        return;
      }

      // ── 8. Arrow Keys Navigation & Object Movement ─────────────────────────
      if (
        rawKey === 'ArrowLeft' ||
        rawKey === 'ArrowRight' ||
        rawKey === 'ArrowUp' ||
        rawKey === 'ArrowDown'
      ) {
        const selectedDrawingId = runtimePanel?.selectedDrawingId;
        const isProfileSelected = runtimePanel?.isProfileSelected;
        const candles = runtimePanel?.candles ?? [];
        const tickStep = panel?.bucketSize && panel.bucketSize > 0 ? panel.bucketSize : 0.1;

        // Case A: Drawing is selected -> move drawing (never move chart viewport)
        if (selectedDrawingId) {
          e.preventDefault();
          const line = panel?.drawnLines.find((l) => l.id === selectedDrawingId);
          if (line && !line.locked) {
            let deltaBars = 0;
            let deltaPrice = 0;

            if (rawKey === 'ArrowLeft') deltaBars = -1;
            if (rawKey === 'ArrowRight') deltaBars = 1;
            if (rawKey === 'ArrowUp') deltaPrice = tickStep;
            if (rawKey === 'ArrowDown') deltaPrice = -tickStep;

            // Aggregated history snapshot on continuous arrow presses
            if (isFirstArrowInSequence.current) {
              chartStore.pushHistory(activePanel);
              isFirstArrowInSequence.current = false;
            }
            if (arrowMoveHistoryTimer.current) clearTimeout(arrowMoveHistoryTimer.current);
            arrowMoveHistoryTimer.current = setTimeout(() => {
              isFirstArrowInSequence.current = true;
            }, 600);

            const updates = moveDrawnLine(line, deltaBars, deltaPrice, candles);
            chartStore.updateLine(activePanel, selectedDrawingId, updates);
            runtimeStore.triggerFootprintRedraw(activePanel);
          }
          return;
        }

        // Case B: Profile is selected -> move profile (never move chart viewport)
        if (isProfileSelected && panel?.customProfileRange) {
          e.preventDefault();
          if (!panel.customProfileLocked) {
            let deltaBars = 0;
            let deltaPrice = 0;

            if (rawKey === 'ArrowLeft') deltaBars = -1;
            if (rawKey === 'ArrowRight') deltaBars = 1;
            if (rawKey === 'ArrowUp') deltaPrice = tickStep;
            if (rawKey === 'ArrowDown') deltaPrice = -tickStep;

            if (isFirstArrowInSequence.current) {
              chartStore.pushHistory(activePanel);
              isFirstArrowInSequence.current = false;
            }
            if (arrowMoveHistoryTimer.current) clearTimeout(arrowMoveHistoryTimer.current);
            arrowMoveHistoryTimer.current = setTimeout(() => {
              isFirstArrowInSequence.current = true;
            }, 600);

            const newRange = moveCustomProfileRange(panel.customProfileRange, deltaBars, deltaPrice, candles);
            chartStore.setCustomProfileRange(activePanel, newRange, true);
            runtimeStore.triggerFootprintRedraw(activePanel);
          }
          return;
        }

        // Case C: Nothing selected -> move chart viewport
        if (rawKey === 'ArrowLeft') {
          e.preventDefault();
          const currentPanel = useChartStore.getState().panels[activePanel];
          const currentOffset = currentPanel?.scrollOffset ?? 0;
          const barWidth = currentPanel?.barWidth ?? 12;
          const step = isCtrlOrCmd ? 10 * barWidth : barWidth;
          chartStore.setScrollOffset(activePanel, currentOffset + step);
          return;
        }

        if (rawKey === 'ArrowRight') {
          e.preventDefault();
          const currentPanel = useChartStore.getState().panels[activePanel];
          const currentOffset = currentPanel?.scrollOffset ?? 0;
          const barWidth = currentPanel?.barWidth ?? 12;
          const step = isCtrlOrCmd ? 10 * barWidth : barWidth;
          chartStore.setScrollOffset(activePanel, Math.max(0, currentOffset - step));
          return;
        }
      }

      // ── 9. Timeframe Typing Initialization (digits 1-9) ───────────────────
      if (!isCtrlOrCmd && !e.altKey && /^[1-9]$/.test(rawKey)) {
        e.preventDefault();
        runtimeStore.setTimeframeInputState({
          isOpen: true,
          buffer: rawKey,
          panelId: activePanel,
        });
        return;
      }

      // ── 10. Existing Single-Key Shortcuts (No Modifiers) ──────────────────
      if (!isCtrlOrCmd && !e.altKey && !e.shiftKey) {
        // C: Candle mode
        if (lowerKey === 'c') {
          e.preventDefault();
          chartStore.setChartMode(activePanel, 'candle');
          return;
        }

        // F: Footprint mode
        if (lowerKey === 'f') {
          e.preventDefault();
          chartStore.setChartMode(activePanel, 'footprint');
          return;
        }

        // R: Reset zoom/scroll
        if (lowerKey === 'r') {
          e.preventDefault();
          chartStore.setBarWidth(activePanel, 12);
          chartStore.setScrollOffset(activePanel, 0);
          return;
        }

        // [ / ]: Adjust bucket size
        if (rawKey === '[') {
          e.preventDefault();
          const newSize = Math.max(1, (panel?.bucketSize ?? 1) - 1);
          chartStore.setBucketSize(activePanel, newSize);
          return;
        }
        if (rawKey === ']') {
          e.preventDefault();
          chartStore.setBucketSize(activePanel, (panel?.bucketSize ?? 1) + 1);
          return;
        }

        // M: Toggle measurement tool
        if (lowerKey === 'm') {
          e.preventDefault();
          const nextActive = !runtimePanel?.measureToolActive;
          if (nextActive) {
            chartStore.setDrawMode(activePanel, false);
            chartStore.setLineDrawMode(activePanel, 'none');
          }
          runtimeStore.setMeasureToolActive(activePanel, nextActive);
          return;
        }

        // S: Toggle sessions
        if (lowerKey === 's') {
          e.preventDefault();
          chartStore.setSessionsEnabled(activePanel, !panel?.sessionsEnabled);
          return;
        }

        // V / P: Toggle / select Custom Volume Profile from toolbar
        if (lowerKey === 'v' || lowerKey === 'p') {
          e.preventDefault();
          const nextActive = !panel?.isDrawMode;
          if (nextActive) {
            chartStore.setLineDrawMode(activePanel, 'none');
            runtimeStore.setMeasureToolActive(activePanel, false);
          }
          chartStore.setDrawMode(activePanel, nextActive);
          return;
        }

        // E: Log exhaustion map (verification)
        if (lowerKey === 'e') {
          e.preventDefault();
          console.log(`--- Exhaustion Map (${activePanel} panel) ---`);
          if (!runtimePanel || runtimePanel.exhaustionMap.size === 0) {
            console.log('No exhaustion signals detected.');
          } else {
            runtimePanel.exhaustionMap.forEach((res, time) => {
              console.log(
                `[${new Date(time * 1000).toLocaleTimeString()}] Score: ${res.score} (${res.rank}) Dir: ${res.direction}`
              );
              console.log(`   Reasons: ${res.reasons.join(', ')}`);
            });
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (arrowMoveHistoryTimer.current) {
        clearTimeout(arrowMoveHistoryTimer.current);
      }
    };
  }, []);
}

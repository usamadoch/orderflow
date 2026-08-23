import { SessionConfig } from '../store/chart';
import { Candle } from '../../types/candle';
import { getZonedTimeParts } from './format';

export interface SessionOccurrence {
  firstIndex: number;
  lastIndex: number;
}

/**
 * Identifies every occurrence of a specific session across the visible candle range.
 * Returns an array of first and last candle indices for each contiguous block.
 */
export function getSessionOccurrences(
  session: SessionConfig,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number }
): SessionOccurrence[] {
  const occurrences: SessionOccurrence[] = [];
  let currentBlock: SessionOccurrence | null = null;

  // We iterate the candles within the visible range (clamped to available data)
  const startIdx = Math.max(0, Math.floor(visibleRange.firstIndex));
  const endIdx = Math.min(candles.length - 1, Math.ceil(visibleRange.lastIndex));

  for (let i = startIdx; i <= endIdx; i++) {
    const candle = candles[i];
    // Sessions are configured in UTC. Their schedule should not shift when the display timezone changes.
    const { hour, minute } = getZonedTimeParts(candle.time * 1000, 'UTC');

    const candleTimeInMins = hour * 60 + minute;
    const sessionStartTimeInMins = session.startHour * 60 + session.startMin;
    const sessionEndTimeInMins = session.endHour * 60 + session.endMin;

    // Handle normal session (does not wrap midnight - as per spec Task 1)
    const isInside = candleTimeInMins >= sessionStartTimeInMins && candleTimeInMins < sessionEndTimeInMins;

    if (isInside) {
      if (!currentBlock) {
        currentBlock = { firstIndex: i, lastIndex: i };
      } else {
        currentBlock.lastIndex = i;
      }
    } else {
      if (currentBlock) {
        occurrences.push(currentBlock);
        currentBlock = null;
      }
    }
  }

  if (currentBlock) {
    occurrences.push(currentBlock);
  }

  return occurrences;
}

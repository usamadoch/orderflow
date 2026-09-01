import { useChartStore } from '../store/chart';
import { getTimestampForZonedDate, getZonedTimeParts } from './format';
import type { PanelState, SessionId } from '../../types/chart';

export interface HistoricalSessionRange {
  id: string;
  segments: { startTimeMs: number; endTimeMs: number }[];
}

/**
 * Calculates the previous N completed trading session ranges based on the specified timezone.
 */
export function getHistoricalSessionRanges(
  currentTimeMs: number,
  panel: PanelState,
  timezone: string = useChartStore.getState().globalTimezone || 'local'
): HistoricalSessionRange[] {
  const ranges: HistoricalSessionRange[] = [];
  
  const activeSessions: SessionId[] = panel.historicalSessionProfileSession === 'multiple'
    ? panel.historicalSessionProfileSessions
    : [panel.historicalSessionProfileSession as SessionId];

  if (activeSessions.length === 0) return ranges;

  const displayMode = panel.historicalSessionProfileDisplayMode;
  const count = panel.historicalSessionProfileCount;
  const tz = timezone || useChartStore.getState().globalTimezone || 'local';

  const getSessionTimes = (sessionId: SessionId, year: number, month: number, date: number) => {
    const config = panel.sessions[sessionId];
    const crossesMidnight = config.endHour < config.startHour || (config.endHour === config.startHour && config.endMin <= config.startMin);
    
    const sTime = getTimestampForZonedDate(year, month, date, config.startHour, config.startMin, tz);
    
    let eTime: number;
    if (crossesMidnight) {
      // The session ends on the next local day
      // To reliably add 1 day, we add it to the naive date and then extract the parts
      const nextDayNaive = new Date(year, month - 1, date + 1);
      eTime = getTimestampForZonedDate(
        nextDayNaive.getFullYear(),
        nextDayNaive.getMonth() + 1,
        nextDayNaive.getDate(),
        config.endHour,
        config.endMin,
        tz
      );
    } else {
      eTime = getTimestampForZonedDate(year, month, date, config.endHour, config.endMin, tz);
    }
    return { startTimeMs: sTime, endTimeMs: eTime };
  };

  // Start with today in the chosen timezone
  const currentZoned = getZonedTimeParts(currentTimeMs, tz);
  
  let currentYear = currentZoned.year;
  let currentMonth = currentZoned.month;
  let currentDate = currentZoned.day;
  
  let daysFound = 0;

  // Search back up to 60 days to find enough completed sessions
  for (let i = 0; i < 60; i++) {
    if (daysFound >= count) break;

    let allCompleted = true;
    const dayRanges: HistoricalSessionRange[] = [];

    if (displayMode === 'combined' || panel.historicalSessionProfileSession !== 'multiple') {
      const daySegments: { startTimeMs: number; endTimeMs: number }[] = [];
      for (const sessionId of activeSessions) {
        const times = getSessionTimes(sessionId, currentYear, currentMonth, currentDate);
        if (times.endTimeMs > currentTimeMs) {
          allCompleted = false;
        }
        daySegments.push(times);
      }
      
      if (allCompleted && daySegments.length > 0) {
        daySegments.sort((a, b) => a.startTimeMs - b.startTimeMs);
        dayRanges.push({
          id: `combined-${currentYear}-${currentMonth}-${currentDate}`,
          segments: daySegments
        });
      }
    } else {
      for (const sessionId of activeSessions) {
        const times = getSessionTimes(sessionId, currentYear, currentMonth, currentDate);
        if (times.endTimeMs > currentTimeMs) {
          allCompleted = false;
        }
        dayRanges.push({
          id: `${sessionId}-${currentYear}-${currentMonth}-${currentDate}`,
          segments: [times]
        });
      }
    }
    
    if (allCompleted && dayRanges.length > 0) {
      dayRanges.sort((a, b) => a.segments[0].startTimeMs - b.segments[0].startTimeMs);
      ranges.unshift(...dayRanges);
      daysFound++;
    }
    
    // Step back one day using naive date logic to handle month boundaries properly
    const prevDayNaive = new Date(currentYear, currentMonth - 1, currentDate - 1);
    currentYear = prevDayNaive.getFullYear();
    currentMonth = prevDayNaive.getMonth() + 1; // back to 1-indexed
    currentDate = prevDayNaive.getDate();
  }
  
  if (panel.mergedProfileRanges && panel.mergedProfileRanges.length > 0) {
    const mergedRanges: HistoricalSessionRange[] = [];
    let currentMerge: HistoricalSessionRange | null = null;
    let currentMergeEnd = 0;

    for (const range of ranges) {
      const rangeStart = range.segments[0].startTimeMs / 1000;
      
      let insideMergeRange = false;
      for (const m of panel.mergedProfileRanges) {
        if (rangeStart >= m.start && rangeStart < m.end) {
          insideMergeRange = true;
          currentMergeEnd = Math.max(currentMergeEnd, m.end);
          break;
        }
      }

      if (currentMerge) {
        if (rangeStart < currentMergeEnd) {
          currentMerge.segments.push(...range.segments);
          currentMerge.id += `_merged_${range.id}`;
        } else {
          mergedRanges.push(currentMerge);
          currentMerge = null;
          if (insideMergeRange) {
            currentMerge = { ...range, segments: [...range.segments] };
          } else {
            mergedRanges.push(range);
          }
        }
      } else {
        if (insideMergeRange) {
          currentMerge = { ...range, segments: [...range.segments] };
        } else {
          mergedRanges.push(range);
        }
      }
    }
    if (currentMerge) mergedRanges.push(currentMerge);
    return mergedRanges;
  }

  return ranges;
}

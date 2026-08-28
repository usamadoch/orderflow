import { useChartStore } from '../store/chart';
import { getTimestampForZonedDate, getZonedTimeParts } from './format';

export interface HistoricalSessionRange {
  startTimeMs: number;
  endTimeMs: number;
}

/**
 * Calculates the previous N completed trading session ranges based on the specified timezone.
 */
export function getHistoricalSessionRanges(
  currentTimeMs: number,
  count: number,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  timezone: string = useChartStore.getState().globalTimezone || 'local'
): HistoricalSessionRange[] {
  const ranges: HistoricalSessionRange[] = [];
  
  const crossesMidnight = endHour < startHour || (endHour === startHour && endMin <= startMin);
  
  // Start with today in the chosen timezone
  const tz = timezone || useChartStore.getState().globalTimezone || 'local';
  const currentZoned = getZonedTimeParts(currentTimeMs, tz);
  
  let currentYear = currentZoned.year;
  let currentMonth = currentZoned.month;
  let currentDate = currentZoned.day;
  
  // Search back up to 60 days to find enough completed sessions
  for (let i = 0; i < 60; i++) {
    if (ranges.length >= count) break;

    const sTime = getTimestampForZonedDate(currentYear, currentMonth, currentDate, startHour, startMin, tz);
    
    let eTime: number;
    if (crossesMidnight) {
      // The session ends on the next local day
      // To reliably add 1 day, we add it to the naive date and then extract the parts
      const nextDayNaive = new Date(currentYear, currentMonth - 1, currentDate + 1);
      eTime = getTimestampForZonedDate(
        nextDayNaive.getFullYear(),
        nextDayNaive.getMonth() + 1,
        nextDayNaive.getDate(),
        endHour,
        endMin,
        tz
      );
    } else {
      eTime = getTimestampForZonedDate(currentYear, currentMonth, currentDate, endHour, endMin, tz);
    }
    
    // Check if the session is completed relative to the currentTimeMs
    if (eTime <= currentTimeMs) {
      // Unshift to put oldest sessions first
      ranges.unshift({ startTimeMs: sTime, endTimeMs: eTime });
    }
    
    // Step back one day using naive date logic to handle month boundaries properly
    const prevDayNaive = new Date(currentYear, currentMonth - 1, currentDate - 1);
    currentYear = prevDayNaive.getFullYear();
    currentMonth = prevDayNaive.getMonth() + 1; // back to 1-indexed
    currentDate = prevDayNaive.getDate();
  }
  
  return ranges;
}

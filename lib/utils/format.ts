/**
 * Parses a timeframe string (e.g., '1m', '5m', '1h') into seconds.
 */
export function timeframeToSeconds(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) return 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 60;
  }
}

/**
 * Formats a duration in seconds into a countdown string (e.g., '04:59', '1:23:45').
 */
export function formatCountdown(seconds: number): string {
  if (seconds < 0) return '00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats a price with appropriate precision and comma separators.
 */
export function formatPrice(price: number, precision?: number): string {
  if (price === 0) return '0.00';

  // If precision is not provided, use default logic
  let p = precision;
  if (p === undefined) {
    if (price < 1) p = 6;
    else if (price < 10) p = 4;
    else if (price < 100) p = 3;
    else p = 2;
  }

  const parts = price.toFixed(p).split('.');
  // Add thousand separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// Memoized cache for Intl.DateTimeFormat instances and hourly timezone offsets to eliminate render stutters
const offsetCache = new Map<string, number>();
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function getCachedFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}

/**
 * Returns timezone offset in milliseconds for a timestamp.
 * Caches by timezone and hour bucket to avoid repeated Intl allocations.
 */
export function getTimezoneOffsetMs(timestampMs: number, timezone: string): number {
  if (!timezone || timezone === 'local') {
    return -new Date(timestampMs).getTimezoneOffset() * 60000;
  }
  if (timezone === 'UTC') {
    return 0;
  }

  // Bucket by hour: 3,600,000 ms
  const hourBucket = Math.floor(timestampMs / 3600000);
  const cacheKey = `${timezone}_${hourBucket}`;
  const cached = offsetCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const d = new Date(timestampMs);
  const formatter = getCachedFormatter(timezone);
  const parts = formatter.formatToParts(d);
  let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') hour = parseInt(part.value, 10);
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }
  if (hour === 24) hour = 0;

  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = targetUtcMs - (Math.floor(timestampMs / 1000) * 1000);

  if (offsetCache.size > 2000) {
    offsetCache.clear();
  }
  offsetCache.set(cacheKey, offsetMs);
  return offsetMs;
}

/**
 * Gets date parts (year, month, day, hour, minute) in the specified timezone with zero allocation overhead.
 */
export function getZonedTimeParts(timestampMs: number, timezone: string) {
  if (timezone === 'UTC') {
    const d = new Date(timestampMs);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }
  if (!timezone || timezone === 'local') {
    const d = new Date(timestampMs);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }

  const offsetMs = getTimezoneOffsetMs(timestampMs, timezone);
  const d = new Date(timestampMs + offsetMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/**
 * Iteratively finds the exact Unix timestamp (in milliseconds) for a given year, month, date, hour, and minute in a specific timezone.
 * @param month 1-indexed (1 = January)
 */
export function getTimestampForZonedDate(year: number, month: number, date: number, hour: number, minute: number, timezone: string): number {
  if (!timezone || timezone === 'local') {
    return new Date(year, month - 1, date, hour, minute).getTime();
  }
  if (timezone === 'UTC') {
    return Date.UTC(year, month - 1, date, hour, minute);
  }
  
  // Approximate with UTC first
  let t = Date.UTC(year, month - 1, date, hour, minute);
  
  // Converge to the correct timestamp (handles DST boundaries)
  for (let i = 0; i < 3; i++) {
    const parts = getZonedTimeParts(t, timezone);
    const currentNaive = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute).getTime();
    const targetNaive = new Date(year, month - 1, date, hour, minute).getTime();
    
    const diffMs = targetNaive - currentNaive;
    if (diffMs === 0) break;
    
    t += diffMs;
  }
  return t;
}

/**
 * Formats a timestamp (in seconds or milliseconds) into a localized time string.
 */
export function formatTime(timestamp: number, timezone: string = 'local', format: '12h' | '24h' = '24h'): string {
  const ms = timestamp > 100_000_000_000 ? timestamp : timestamp * 1000;
  const key = `time_${timezone}_${format}`;
  let dtFormat = dateTimeFormatCache.get(key);
  if (!dtFormat) {
    dtFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone === 'local' ? undefined : timezone,
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12: format === '12h',
    });
    dateTimeFormatCache.set(key, dtFormat);
  }
  return dtFormat.format(new Date(ms));
}

/**
 * Formats a timestamp (in seconds or milliseconds) into a localized date-and-time string.
 */
export function formatDateTime(timestamp: number, timezone: string = 'local', format: '12h' | '24h' = '24h'): string {
  const ms = timestamp > 100_000_000_000 ? timestamp : timestamp * 1000;
  const key = `datetime_${timezone}_${format}`;
  let dtFormat = dateTimeFormatCache.get(key);
  if (!dtFormat) {
    dtFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone === 'local' ? undefined : timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: format === '12h',
    });
    dateTimeFormatCache.set(key, dtFormat);
  }
  return dtFormat.format(new Date(ms));
}

/**
 * Converts a 24-hour hour (0..23) into 12-hour components (1..12 and 'AM' | 'PM').
 */
export function to12Hour(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const clamped = Math.max(0, Math.min(23, Math.floor(hour24)));
  const period: 'AM' | 'PM' = clamped >= 12 ? 'PM' : 'AM';
  const hour12 = clamped % 12 === 0 ? 12 : clamped % 12;
  return { hour12, period };
}

/**
 * Converts a 12-hour hour (1..12) and period ('AM' | 'PM') into 24-hour hour (0..23).
 */
export function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  const h = Math.max(1, Math.min(12, Math.floor(hour12)));
  if (period === 'AM') {
    return h === 12 ? 0 : h;
  }
  return h === 12 ? 12 : h + 12;
}

/**
 * Formats a duration in seconds into a human-readable string (e.g., "45s", "14m", "1h 15m").
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  return `${m}m`;
}
/**
 * Formats a volume value with optional abbreviation (e.g., "124.3 BTC" or "1.2k").
 */
export function formatVol(v: number, symbol: string = ''): string {
  let result = '';
  if (v >= 1000) {
    result = (v / 1000).toFixed(1) + 'k';
  } else {
    result = v.toFixed(1);
  }
  return symbol ? `${result} ${symbol}` : result;
}

/**
 * Formats a delta value with a proper sign and optional abbreviation.
 */
export function formatDelta(d: number): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const abs = Math.abs(d);
  let val = '';
  if (abs >= 1000) {
    val = (abs / 1000).toFixed(1) + 'k';
  } else {
    // Add thousand separators for non-abbreviated values
    val = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return sign + val;
}

/**
 * Converts a hex color string and opacity to an rgba string.
 * Example: hexToRgba('#B39DDB', 0.07) -> 'rgba(179, 157, 219, 0.07)'
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

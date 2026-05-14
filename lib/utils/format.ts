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

/**
 * Formats a timestamp into a 12-hour AM/PM string.
 */
export function formatTime12h(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'

  return `${hours}:${minutes} ${ampm}`;
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

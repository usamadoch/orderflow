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


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
 * Formats a price with appropriate precision.
 */
export function formatPrice(price: number): string {
  if (price === 0) return '0.00';
  
  if (price < 1) return price.toFixed(6);
  if (price < 10) return price.toFixed(4);
  if (price < 100) return price.toFixed(3);
  return price.toFixed(2);
}

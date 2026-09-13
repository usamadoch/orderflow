import { SessionConfig } from '../store/chart';
import { Candle } from '../../types/candle';
import { getSessionOccurrences } from '../utils/sessions';
import { hexToRgba } from '../utils/format';

const SESSION_TEXT_FONT = 'bold 10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

/**
 * Renders highlighted session boxes on the canvas behind all chart candles.
 * - Clean rectangular box bounding the session candles (sessionHigh to sessionLow)
 * - Default 15% opacity background fill
 * - Session identification name (Tokyo, London, New York) rendered at the bottom of the box
 */
export function drawSessions(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (index: number) => number,
  priceToY?: ((price: number) => number) | number,
  barWidthArg: number = 6,
  canvasHeightArg: number = 0,
  timeAxisHeightArg: number | Record<string, SessionConfig> = 0,
  sessionsArg?: Record<string, SessionConfig> | boolean,
  sessionsEnabledArg: boolean | string = false,
  timezoneArg: string = 'local'
) {
  let resolvedPriceToY: ((price: number) => number) | undefined;
  let barWidth = barWidthArg;
  let canvasHeight = canvasHeightArg;
  let timeAxisHeight = typeof timeAxisHeightArg === 'number' ? timeAxisHeightArg : 0;
  let sessions: Record<string, SessionConfig> | undefined =
    typeof sessionsArg === 'object' && sessionsArg !== null ? sessionsArg : undefined;
  let sessionsEnabled = typeof sessionsEnabledArg === 'boolean' ? sessionsEnabledArg : false;
  let timezone = timezoneArg;

  if (typeof priceToY === 'function') {
    resolvedPriceToY = priceToY;
  } else if (typeof priceToY === 'number') {
    // Legacy signature compatibility: (ctx, candles, visibleRange, indexToX, barWidth, canvasHeight, timeAxisHeight, sessions, sessionsEnabled, timezone)
    barWidth = priceToY;
    canvasHeight = barWidthArg;
    timeAxisHeight = typeof canvasHeightArg === 'number' ? canvasHeightArg : 0;
    sessions =
      typeof timeAxisHeightArg === 'object' && timeAxisHeightArg !== null
        ? (timeAxisHeightArg as Record<string, SessionConfig>)
        : undefined;
    sessionsEnabled = typeof sessionsArg === 'boolean' ? sessionsArg : false;
    timezone = typeof sessionsEnabledArg === 'string' ? sessionsEnabledArg : 'local';
  }

  if (!sessionsEnabled || !sessions || !candles || candles.length === 0) return;

  for (const [key, config] of Object.entries(sessions)) {
    if (!config || !config.enabled) continue;

    const sessionName =
      key === 'tokyo'
        ? 'Tokyo'
        : key === 'london'
        ? 'London'
        : key === 'newYork'
        ? 'New York'
        : key.charAt(0).toUpperCase() + key.slice(1);

    const occurrences = getSessionOccurrences(config, candles, visibleRange, timezone);

    for (const block of occurrences) {
      const blockStart = Math.max(0, block.firstIndex);
      const blockEnd = Math.min(candles.length - 1, block.lastIndex);
      if (blockStart > blockEnd) continue;

      const x1 = indexToX(block.firstIndex) - barWidth / 2;
      const x2 = indexToX(block.lastIndex) + barWidth / 2;
      if (x1 === null || x2 === null) continue;

      let sessionHigh = -Infinity;
      let sessionLow = Infinity;

      for (let i = blockStart; i <= blockEnd; i++) {
        const c = candles[i];
        if (c.high > sessionHigh) sessionHigh = c.high;
        if (c.low < sessionLow) sessionLow = c.low;
      }

      if (!Number.isFinite(sessionHigh) || !Number.isFinite(sessionLow)) continue;

      let y1: number;
      let y2: number;

      if (resolvedPriceToY) {
        const rawYHigh = resolvedPriceToY(sessionHigh);
        const rawYLow = resolvedPriceToY(sessionLow);
        y1 = Math.min(rawYHigh, rawYLow);
        y2 = Math.max(rawYHigh, rawYLow);
      } else {
        y1 = 0;
        y2 = canvasHeight - timeAxisHeight;
      }

      const width = x2 - x1;
      const height = y2 - y1;
      if (width <= 0 || height <= 0) continue;

      // 1. Draw clean background fill with default 15% opacity
      const sessionOpacity = config.opacity ?? 0.15;
      ctx.fillStyle = hexToRgba(config.color, sessionOpacity);
      ctx.fillRect(x1, y1, width, height);

      // 2. Draw session identification text at the bottom of the box
      if (width >= 8) {
        ctx.save();
        ctx.font = SESSION_TEXT_FONT;
        ctx.fillStyle = config.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const textX = x1 + 2;
        const textY =
          canvasHeight > 0 && y2 + 16 > canvasHeight - timeAxisHeight
            ? Math.max(y1 + 2, y2 - 14)
            : y2 + 4;

        ctx.fillText(sessionName, textX, textY);
        ctx.restore();
      }
    }
  }
}

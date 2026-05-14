import { SessionConfig } from '../store/chart';
import { Candle } from '../../types/candle';
import { getSessionOccurrences } from '../utils/sessions';
import { hexToRgba } from '../utils/format';

/**
 * Renders session boxes on the canvas behind all chart content.
 */
export function drawSessions(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (index: number) => number,
  barWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  sessions: { tokyo: SessionConfig; london: SessionConfig; newYork: SessionConfig },
  sessionsEnabled: boolean
) {
  if (!sessionsEnabled) return;

  const sessionConfigs = [
    { config: sessions.tokyo, label: 'TYO' },
    { config: sessions.london, label: 'LON' },
    { config: sessions.newYork, label: 'NYC' },
  ];

  for (const { config, label } of sessionConfigs) {
    if (!config.enabled) continue;

    const occurrences = getSessionOccurrences(config, candles, visibleRange);

    for (const block of occurrences) {
      const x1 = indexToX(block.firstIndex) - barWidth / 2;
      const x2 = indexToX(block.lastIndex) + barWidth / 2;

      if (x1 === null || x2 === null) continue;

      const y1 = 0;
      const y2 = canvasHeight - timeAxisHeight;
      const width = x2 - x1;
      const height = y2 - y1;

      // Draw background fill
      ctx.fillStyle = hexToRgba(config.color, 0.07);
      ctx.fillRect(x1, y1, width, height);

      // Draw label if wide enough
      if (width > 30) {
        ctx.font = '9px "JetBrains Mono"';
        ctx.fillStyle = hexToRgba(config.color, 0.5);
        ctx.fillText(label, x1 + 4, 12);
      }
    }
  }
}

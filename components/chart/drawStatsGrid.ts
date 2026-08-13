import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { LiquidityHistoryManager } from '@/lib/liquidity/history';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';

export const STATS_GRID_ROW_HEIGHT = 18;
const FONT = '10px Inter, sans-serif';

export function formatStatValue(value: number, isSigned: boolean): string {
  if (!Number.isFinite(value)) return '';
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Math.abs(value));
  if (isSigned) {
    return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : '0';
  }
  return value < 0 ? `-${formatted}` : formatted;
}

export function drawStatsGrid(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  startY: number,
  items: string[],
  engine: AggregationEngine,
  liquidityHistory: LiquidityHistoryManager | null,
  logicalWidth: number,
  priceAxisWidth: number
) {
  if (items.length === 0 || candles.length === 0) return;

  const chartWidth = logicalWidth - priceAxisWidth;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, startY, chartWidth, items.length * STATS_GRID_ROW_HEIGHT);
  ctx.clip();

  // Background for the grid area
  ctx.fillStyle = '#0F0F0F';
  ctx.fillRect(0, startY, chartWidth, items.length * STATS_GRID_ROW_HEIGHT);

  // Top border
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(chartWidth, startY);
  ctx.stroke();

  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const rowLabels = items.map(id => {
    switch(id) {
      case 'volume': return 'Volume';
      case 'delta': return 'Delta';
      case 'cvd': return 'CVD';
      default: return id;
    }
  });

  // Calculate stats for visible candles
  const statsByCandle = new Map<number, { volume: number, delta: number, cvd: number }>();
  
  // Build CVD up to the current visible range
  const allFootprints = engine.getAllFootprintCandles();
  let runningCvd = 0;
  const cvdMap = new Map<number, number>();
  for (const fp of allFootprints) {
    runningCvd += fp.delta;
    cvdMap.set(fp.time, runningCvd);
  }

  for (let i = firstIndex; i <= lastIndex; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const fp = engine.getFootprintCandle(candle.time);
    const volume = candle.volume;
    const delta = fp?.delta ?? 0;
    const cvd = cvdMap.get(candle.time) ?? 0;
    statsByCandle.set(i, { volume, delta, cvd });
  }

  // Draw rows
  for (let r = 0; r < items.length; r++) {
    const itemId = items[r];
    const rowY = startY + r * STATS_GRID_ROW_HEIGHT + STATS_GRID_ROW_HEIGHT / 2;

    for (let i = firstIndex; i <= lastIndex; i++) {
      const stats = statsByCandle.get(i);
      if (!stats) continue;

      const x = indexToX(i);
      if (x < 0 || x > chartWidth) continue;

      let text = '';
      let color = '#888';

      if (itemId === 'volume') {
        text = formatStatValue(stats.volume, false);
        color = '#aaa';
      } else if (itemId === 'delta') {
        text = formatStatValue(stats.delta, true);
        color = stats.delta > 0 ? CHART_BULLISH_COLOR : stats.delta < 0 ? CHART_BEARISH_COLOR : '#aaa';
      } else if (itemId === 'cvd') {
        text = formatStatValue(stats.cvd, true);
        color = stats.cvd > 0 ? CHART_BULLISH_COLOR : stats.cvd < 0 ? CHART_BEARISH_COLOR : '#aaa';
      }

      ctx.fillStyle = color;
      ctx.fillText(text, x, rowY);
    }
  }

  // Draw row labels on the left edge with a subtle background gradient
  ctx.textAlign = 'left';
  for (let r = 0; r < items.length; r++) {
    const rowTop = startY + r * STATS_GRID_ROW_HEIGHT;
    const rowY = rowTop + STATS_GRID_ROW_HEIGHT / 2;
    
    // Gradient fade so the text doesn't clash with candle stats underneath it
    const grad = ctx.createLinearGradient(0, 0, 50, 0);
    grad.addColorStop(0, '#0F0F0F');
    grad.addColorStop(0.7, '#0F0F0F');
    grad.addColorStop(1, 'rgba(15, 15, 15, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, rowTop, 50, STATS_GRID_ROW_HEIGHT);
    
    ctx.fillStyle = '#666';
    ctx.fillText(rowLabels[r], 4, rowY);
  }

  ctx.restore();
}

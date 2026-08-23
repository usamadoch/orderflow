import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { LiquidityHistoryManager } from '@/lib/liquidity/history';
import { CHART_BEARISH_RGB, CHART_BULLISH_RGB, chartColorToRgba } from '@/lib/config/chartColors';

export const STATS_GRID_ROW_HEIGHT = 24;
const FONT = '600 11px "JetBrains Mono", monospace';

export function formatStatValue(value: number, isSigned: boolean): string {
  if (!Number.isFinite(value)) return '';
  const absVal = Math.abs(value);
  let formatted = '';
  if (absVal >= 1000000) {
    formatted = (absVal / 1000000).toFixed(1) + 'M';
  } else if (absVal >= 1000) {
    formatted = (absVal / 1000).toFixed(1) + 'k';
  } else {
    formatted = Number(absVal.toFixed(2)).toString();
  }
  
  if (isSigned) {
    return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : '0';
  }
  return formatted;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function getSoftScale(maxValue: number, avgValue: number, visibleScale: number) {
  if (maxValue <= 0) return 0;
  const dominance = avgValue > 0 ? maxValue / avgValue : 1;
  const maxFactor = dominance >= 4 ? 1.08 : dominance >= 2.5 ? 1.22 : 1.55;
  return Math.max(
    visibleScale,
    avgValue * 2.2,
    maxValue * maxFactor
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getVisualStrength(value: number, scale: number) {
  if (value <= 0 || scale <= 0) return 0;
  return clamp01(value / scale);
}

function getCellOpacity(value: number, scale: number) {
  const strength = getVisualStrength(value, scale);
  if (strength <= 0) return 0.08;
  return 0.12 + Math.pow(strength, 0.85) * 0.88;
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
  priceAxisWidth: number,
  barWidth: number
) {
  if (items.length === 0 || candles.length === 0) return;

  const chartWidth = logicalWidth - priceAxisWidth;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, startY, chartWidth, items.length * STATS_GRID_ROW_HEIGHT);
  ctx.clip();

  ctx.fillStyle = '#0F0F0F';
  ctx.fillRect(0, startY, chartWidth, items.length * STATS_GRID_ROW_HEIGHT);

  const rowLabels = items.map(id => {
    switch(id) {
      case 'volume': return 'Vol';
      case 'delta': return 'Delta';
      case 'cvd': return 'CVD';
      default: return id.substring(0, 3);
    }
  });

  const statsByCandle = new Map<number, { volume: number, delta: number, cvd: number }>();
  
  const allFootprints = engine.getAllFootprintCandles();
  let runningCvd = 0;
  const cvdMap = new Map<number, number>();
  for (const fp of allFootprints) {
    runningCvd += fp.delta;
    cvdMap.set(fp.time, runningCvd);
  }

  const visibleVolumes: number[] = [];
  const visibleDeltas: number[] = [];
  const visibleCvds: number[] = [];
  
  let maxVol = 0, totalVol = 0, volCount = 0;
  let maxDelta = 0, totalDelta = 0, deltaCount = 0;
  let maxCvd = 0, totalCvd = 0, cvdCount = 0;

  for (let i = firstIndex; i <= lastIndex; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const fp = engine.getFootprintCandle(candle.time);
    const volume = candle.volume;
    const delta = fp?.delta ?? 0;
    const cvd = cvdMap.get(candle.time) ?? 0;
    
    statsByCandle.set(i, { volume, delta, cvd });

    if (volume > 0) {
      if (volume > maxVol) maxVol = volume;
      visibleVolumes.push(volume);
      totalVol += volume;
      volCount++;
    }

    const absDelta = Math.abs(delta);
    if (absDelta > 0) {
      if (absDelta > maxDelta) maxDelta = absDelta;
      visibleDeltas.push(absDelta);
      totalDelta += absDelta;
      deltaCount++;
    }

    const absCvd = Math.abs(cvd);
    if (absCvd > 0) {
      if (absCvd > maxCvd) maxCvd = absCvd;
      visibleCvds.push(absCvd);
      totalCvd += absCvd;
      cvdCount++;
    }
  }

  const volumeScale = getSoftScale(
    maxVol, 
    volCount > 0 ? totalVol / volCount : 0, 
    percentile(visibleVolumes, 0.85)
  );
  
  const deltaScale = getSoftScale(
    maxDelta, 
    deltaCount > 0 ? totalDelta / deltaCount : 0, 
    percentile(visibleDeltas, 0.85)
  );

  const cvdScale = getSoftScale(
    maxCvd,
    cvdCount > 0 ? totalCvd / cvdCount : 0,
    percentile(visibleCvds, 0.85)
  );

  const gap = 1;
  const cellWidth = Math.max(1, barWidth - gap);

  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let r = 0; r < items.length; r++) {
    const itemId = items[r];
    const rowY = startY + r * STATS_GRID_ROW_HEIGHT;
    
    for (let i = firstIndex; i <= lastIndex; i++) {
      const stats = statsByCandle.get(i);
      if (!stats) continue;

      const x = indexToX(i);
      const cellLeft = x - barWidth / 2 + gap / 2;
      
      if (cellLeft > chartWidth || cellLeft + cellWidth < 0) continue;

      let bgColor = '#1A1A1A';
      const textColor = '#E8E8E8';
      let text = '';

      if (itemId === 'volume') {
        const opacity = getCellOpacity(stats.volume, volumeScale);
        bgColor = `rgba(150, 150, 150, ${opacity})`;
        text = formatStatValue(stats.volume, false);
      } else if (itemId === 'delta') {
        const opacity = getCellOpacity(Math.abs(stats.delta), deltaScale);
        bgColor = stats.delta >= 0 
          ? chartColorToRgba(CHART_BULLISH_RGB, opacity)
          : chartColorToRgba(CHART_BEARISH_RGB, opacity);
        text = formatStatValue(stats.delta, true);
      } else if (itemId === 'cvd') {
        const opacity = getCellOpacity(Math.abs(stats.cvd), cvdScale);
        bgColor = stats.cvd >= 0 
          ? chartColorToRgba(CHART_BULLISH_RGB, opacity)
          : chartColorToRgba(CHART_BEARISH_RGB, opacity);
        text = formatStatValue(stats.cvd, true);
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(cellLeft, rowY + gap, cellWidth, STATS_GRID_ROW_HEIGHT - gap);

      if (cellWidth >= 20) {
        ctx.fillStyle = textColor;
        ctx.fillText(text, cellLeft + cellWidth / 2, rowY + STATS_GRID_ROW_HEIGHT / 2 + gap / 2);
      }
    }
  }

  ctx.textAlign = 'left';
  ctx.font = '600 11px Inter, sans-serif';
  for (let r = 0; r < items.length; r++) {
    const rowTop = startY + r * STATS_GRID_ROW_HEIGHT;
    const rowY = rowTop + STATS_GRID_ROW_HEIGHT / 2;
    
    ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    ctx.fillRect(0, rowTop + gap, 40, STATS_GRID_ROW_HEIGHT - gap);
    
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(rowLabels[r], 4, rowY + gap / 2);
  }

  ctx.restore();
}

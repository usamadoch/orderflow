import type { AggregationEngine } from '@/lib/aggregation/engine';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';
import type { VolumeBarsColorMode, VolumeBarsInputData } from '@/lib/store/chart';
import type { BubbleEvent } from '@/types/bubble';
import type { Candle } from '@/types/candle';

import type { DrawVolumeBarsOptions, VolumeBarPoint } from '@/types/chart';

function getFootprintValue(candle: Candle, engine: AggregationEngine, inputData: VolumeBarsInputData) {
  if (inputData !== 'volume') return null;
  const footprint = engine.getFootprintCandle(candle.time);
  if (!footprint) return null;
  return {
    value: footprint.volume,
    delta: footprint.delta,
  };
}

function formatBarValue(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 100) return Math.round(value).toString();
  return value.toFixed(value >= 10 ? 1 : 2);
}

function applyOpacity(color: string, opacity: number) {
  const alpha = Math.max(0.1, Math.min(1, opacity));
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function resolveBarColor(
  point: VolumeBarPoint,
  previousPoint: VolumeBarPoint | null,
  candle: Candle,
  colorMode: VolumeBarsColorMode,
  opacity: number,
) {
  const neutral = '#6B7280';
  const up = CHART_BULLISH_COLOR;
  const down = CHART_BEARISH_COLOR;

  if (colorMode === 'fixed') return applyOpacity(neutral, opacity);
  if (colorMode === 'delta') {
    if (point.delta !== null && point.delta !== 0) {
      return applyOpacity(point.delta > 0 ? up : down, opacity);
    }
  }
  if (colorMode === 'volumeSlope') {
    if (previousPoint && point.value !== previousPoint.value) {
      return applyOpacity(point.value > previousPoint.value ? up : down, opacity);
    }
    return applyOpacity(neutral, opacity);
  }

  return applyOpacity(candle.close >= candle.open ? up : down, opacity);
}

export function drawVolumeBars(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (index: number) => number,
  currentBarWidth: number,
  chartWidth: number,
  chartHeight: number,
  timeAxisHeight: number,
  profileWidth: number,
  engine: AggregationEngine,
  aggregateEvents: BubbleEvent[],
  options: DrawVolumeBarsOptions,
) {
  if (!options.enabled) return;

  const startIndex = Math.max(0, firstIndex);
  const endIndex = Math.min(candles.length - 1, lastIndex);
  const flowSourceUsed = options.activeDataSourceMode;
  if (startIndex > endIndex) {
    options.onDebug?.({
      panelId: options.panelId,
      volumeBarsEnabled: true,
      inputData: options.inputData,
      volumeInputData: options.inputData,
      marketSource: options.marketSource,
      flowSourceUsed,
      visibleBarsCount: 0,
      volumeBarsVisibleCount: 0,
      volumeBarsHistoricalCount: 0,
      volumeBarsLiveCount: 0,
      maxVisibleValue: 0,
      averageValue: options.averageLineEnabled ? 0 : null,
      unavailableReason: null,
      liveOnlyReason: null,
    });
    return;
  }

  const unavailableReason: string | null = null;
  const rawCache = new Map<number, { value: number; delta: number | null }>();

  const getRawData = (idx: number) => {
    if (idx < 0 || idx >= candles.length) return { value: 0, delta: null };
    const cached = rawCache.get(idx);
    if (cached) return cached;

    let value = 0;
    let delta: number | null = null;
    const candle = candles[idx];
    
    if (options.inputData === 'volume') {
      value = candle.volume ?? 0;
    } else {
      // Both 'orders' and 'aggregateTrades' map to native tradeCount
      value = candle.tradeCount ?? 0;
    }

    const footprintValue = getFootprintValue(candle, engine, options.inputData);
    if (footprintValue) {
      delta = footprintValue.delta;
    }

    const data = { value, delta };
    rawCache.set(idx, data);
    return data;
  };

  const points: VolumeBarPoint[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const { value, delta } = getRawData(index);

    if (!Number.isFinite(value) || value <= 0) continue;
    
    if (options.filterMode === 'relative') {
      let sum = 0;
      let count = 0;
      const length = Math.max(1, options.movingAverageLength);
      for (let i = 0; i < length; i++) {
        const pastIdx = index - i;
        if (pastIdx >= 0) {
          sum += getRawData(pastIdx).value;
          count++;
        }
      }
      const sma = count > 0 ? sum / count : 0;
      
      if (options.filterMin > 0 && value < sma * options.filterMin) continue;
      if (options.filterMax > 0 && value > sma * options.filterMax) continue;
    } else {
      if (value < options.filterMin) continue;
      if (options.filterMax > 0 && value > options.filterMax) continue;
    }

    const source = candles[index].isClosed ? 'historical' : 'live';
    points.push({ index, value, delta, unavailable: false, source });
  }

  const maxVisibleValue = points.reduce((max, point) => Math.max(max, point.value), 0);
  const averagePoints = options.averageLineEnabled
    ? points.slice(-Math.max(1, options.averageLength))
    : [];
  const averageValue = averagePoints.length > 0
    ? averagePoints.reduce((sum, point) => sum + point.value, 0) / averagePoints.length
    : options.averageLineEnabled ? 0 : null;
  const historicalCount = points.filter((point) => point.source === 'historical').length;
  const liveCount = points.length - historicalCount;
  const liveOnlyReason = null;

  options.onDebug?.({
    panelId: options.panelId,
    volumeBarsEnabled: true,
    inputData: options.inputData,
    volumeInputData: options.inputData,
    marketSource: options.marketSource,
    flowSourceUsed,
    visibleBarsCount: points.length,
    volumeBarsVisibleCount: points.length,
    volumeBarsHistoricalCount: historicalCount,
    volumeBarsLiveCount: liveCount,
    maxVisibleValue,
    averageValue,
    unavailableReason,
    liveOnlyReason,
  });

  const panelHeight = options.panelHeight !== undefined
    ? options.panelHeight
    : Math.max(24, Math.min(chartHeight * 0.35, chartHeight * (options.heightPct / 100)));
  const top = options.panelTop !== undefined
    ? options.panelTop
    : Math.max(0, chartHeight - 2 - panelHeight);
  const bottom = top + panelHeight - 2;
  const drawableRight = Math.max(0, chartWidth - profileWidth);

  if (points.length === 0 || maxVisibleValue <= 0) {
    if (unavailableReason) {
      const message = unavailableReason === 'order-count-unavailable'
        ? 'ORDERS UNAVAILABLE'
        : 'AGG DATA UNAVAILABLE';
      ctx.save();
      ctx.fillStyle = '#0F0F0F';
      ctx.fillRect(0, top, drawableRight, panelHeight);
      ctx.fillStyle = '#1F1F1F';
      ctx.fillRect(0, top, drawableRight, 1);
      ctx.fillStyle = 'rgba(156, 163, 175, 0.76)';
      ctx.font = '700 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(message, 8, top + panelHeight / 2);
      ctx.restore();
    }
    return;
  }

  const barBodyWidth = Math.max(1, Math.min(currentBarWidth * 0.72, currentBarWidth - 2));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, drawableRight, panelHeight);
  ctx.clip();

  ctx.fillStyle = '#0F0F0F';
  ctx.fillRect(0, top, drawableRight, panelHeight);
  ctx.fillStyle = '#1F1F1F';
  ctx.fillRect(0, top, drawableRight, 1);

  let previousPoint: VolumeBarPoint | null = null;
  for (const point of points) {
    const x = indexToX(point.index);
    if (!Number.isFinite(x) || x < -currentBarWidth || x > drawableRight + currentBarWidth) {
      previousPoint = point;
      continue;
    }

    const candle = candles[point.index];
    const barHeight = Math.max(1, (point.value / maxVisibleValue) * (panelHeight - 4));
    const left = x - barBodyWidth / 2;
    const y = bottom - barHeight;

    ctx.fillStyle = resolveBarColor(point, previousPoint, candle, options.colorMode, options.opacity);
    ctx.fillRect(left, y, barBodyWidth, barHeight);

    if (options.showValueText && barBodyWidth >= options.textSize * 1.4 && barHeight >= options.textSize + 3) {
      ctx.fillStyle = 'rgba(232, 232, 232, 0.72)';
      ctx.font = `700 ${options.textSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatBarValue(point.value), x, y - 2);
    }

    previousPoint = point;
  }

  if (options.averageLineEnabled && averageValue !== null && averageValue > 0) {
    const averageY = bottom - Math.min(panelHeight - 4, (averageValue / maxVisibleValue) * (panelHeight - 4));
    ctx.strokeStyle = 'rgba(240, 185, 11, 0.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, averageY);
    ctx.lineTo(drawableRight, averageY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}



import type { AggregationEngine } from '@/lib/aggregation/engine';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '@/lib/config/chartColors';
import type { VolumeBarsColorMode, VolumeBarsInputData, VolumeBarsMarketSource } from '@/lib/store/chart';
import type { BubbleEvent } from '@/types/bubble';
import type { Candle } from '@/types/candle';

export interface VolumeBarsDebugSnapshot {
  panelId: string;
  volumeBarsEnabled: boolean;
  inputData: VolumeBarsInputData;
  volumeInputData: VolumeBarsInputData;
  marketSource: VolumeBarsMarketSource;
  flowSourceUsed: 'spot' | 'futures' | 'both';
  visibleBarsCount: number;
  volumeBarsVisibleCount: number;
  volumeBarsHistoricalCount: number;
  volumeBarsLiveCount: number;
  maxVisibleValue: number;
  averageValue: number | null;
  unavailableReason: string | null;
  liveOnlyReason: string | null;
}

interface DrawVolumeBarsOptions {
  panelId: string;
  enabled: boolean;
  inputData: VolumeBarsInputData;
  marketSource: VolumeBarsMarketSource;
  filterMin: number;
  filterMax: number;
  colorMode: VolumeBarsColorMode;
  opacity: number;
  heightPct: number;
  showValueText: boolean;
  textSize: number;
  averageLineEnabled: boolean;
  averageLength: number;
  activeChartContractType: 'spot' | 'futures';
  activeDataSourceMode: 'spot' | 'futures' | 'both';
  onDebug?: (snapshot: VolumeBarsDebugSnapshot) => void;
}

interface VolumeBarPoint {
  index: number;
  value: number;
  delta: number | null;
  unavailable: boolean;
  source: 'historical' | 'live';
}

function getSourcesForMarketSource(
  marketSource: VolumeBarsMarketSource,
  activeChartContractType: 'spot' | 'futures',
  activeDataSourceMode: 'spot' | 'futures' | 'both',
) {
  if (marketSource === 'active') {
    return activeDataSourceMode === 'both' ? ['spot', 'futures'] as const : [activeDataSourceMode];
  }

  return marketSource === 'both' ? ['spot', 'futures'] as const : [marketSource];
}

function getEventValue(event: BubbleEvent, inputData: VolumeBarsInputData) {
  if (inputData === 'volume') return event.volume;
  if (inputData === 'aggregateTrades') return 1;

  return typeof event.tradeCount === 'number' && Number.isFinite(event.tradeCount)
    ? event.tradeCount
    : null;
}

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

  const selectedSources = new Set(getSourcesForMarketSource(
    options.marketSource,
    options.activeChartContractType,
    options.activeDataSourceMode,
  ));
  const useAggregateEvents = options.inputData !== 'volume';
  const visibleEvents = useAggregateEvents
    ? aggregateEvents.filter((event) => selectedSources.has(event.contractType))
    : [];
  const eventBuckets = new Map<number, {
    value: number;
    delta: number;
    missingOrderCount: number;
    historicalEventCount: number;
    liveEventCount: number;
  }>();

  if (useAggregateEvents) {
    for (const event of visibleEvents) {
      const candleIndex = findCandleIndexForEvent(candles, startIndex, endIndex, event.time);
      if (candleIndex === null) continue;
      const eventValue = getEventValue(event, options.inputData);
      const bucket = eventBuckets.get(candleIndex) ?? {
        value: 0,
        delta: 0,
        missingOrderCount: 0,
        historicalEventCount: 0,
        liveEventCount: 0,
      };
      if (eventValue === null) {
        bucket.missingOrderCount += 1;
      } else {
        bucket.value += eventValue;
      }
      bucket.delta += event.side === 'buy' ? event.volume : -event.volume;
      if (event.origin === 'restored') {
        bucket.historicalEventCount += 1;
      } else {
        bucket.liveEventCount += 1;
      }
      eventBuckets.set(candleIndex, bucket);
    }
  }

  let unavailableReason: string | null = null;
  const points: VolumeBarPoint[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const candle = candles[index];
    let value = 0;
    let delta: number | null = null;
    let unavailable = false;

    if (useAggregateEvents) {
      const bucket = eventBuckets.get(index);
      value = bucket?.value ?? 0;
      delta = bucket?.delta ?? null;
      if (options.inputData === 'orders' && bucket?.missingOrderCount) {
        unavailable = true;
        unavailableReason = 'order-count-unavailable';
      }
    } else if (Number.isFinite(candle.volume)) {
      value = candle.volume;
    } else {
      const footprintValue = getFootprintValue(candle, engine, options.inputData);
      if (footprintValue) {
        value = footprintValue.value;
        delta = footprintValue.delta;
      }
    }

    if (!Number.isFinite(value) || value <= 0) continue;
    if (value < options.filterMin) continue;
    if (options.filterMax > 0 && value > options.filterMax) continue;
    if (unavailable) continue;

    const source = useAggregateEvents
      ? eventBuckets.get(index)?.liveEventCount
        ? 'live'
        : 'historical'
      : candle.isClosed
        ? 'historical'
        : 'live';
    points.push({ index, value, delta, unavailable, source });
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
  const liveOnlyReason = useAggregateEvents && points.length > 0 && historicalCount === 0 && liveCount > 0
    ? 'aggregate-history-unavailable-live-only'
    : null;
  if (useAggregateEvents && points.length === 0 && visibleEvents.length === 0) {
    unavailableReason = unavailableReason ?? 'aggregate-events-unavailable';
  }

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

  const panelHeight = Math.max(24, Math.min(chartHeight * 0.35, chartHeight * (options.heightPct / 100)));
  const bottom = chartHeight - 2;
  const top = Math.max(0, bottom - panelHeight);
  const drawableRight = Math.max(0, chartWidth - profileWidth);

  if (points.length === 0 || maxVisibleValue <= 0) {
    if (unavailableReason) {
      const message = unavailableReason === 'order-count-unavailable'
        ? 'ORDERS UNAVAILABLE'
        : 'AGG DATA UNAVAILABLE';
      ctx.save();
      ctx.fillStyle = 'rgba(5, 5, 5, 0.28)';
      ctx.fillRect(0, top, drawableRight, panelHeight);
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
  ctx.rect(0, top, drawableRight, panelHeight + timeAxisHeight);
  ctx.clip();

  ctx.fillStyle = 'rgba(5, 5, 5, 0.28)';
  ctx.fillRect(0, top, drawableRight, panelHeight);

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

function findCandleIndexForEvent(
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  eventTime: number,
) {
  if (!Number.isFinite(eventTime)) return null;
  if (!candles[firstIndex] || !candles[lastIndex]) return null;
  if (eventTime < candles[firstIndex].time) return null;

  let left = firstIndex;
  let right = lastIndex;
  let match: number | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (candles[mid].time <= eventTime) {
      match = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (match === null) return null;
  const nextTime = candles[match + 1]?.time ?? Number.POSITIVE_INFINITY;
  return eventTime < nextTime ? match : null;
}

import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { CHART_BEARISH_RGB, CHART_BULLISH_RGB, chartColorToRgba } from '@/lib/config/chartColors';
import { recordAggregateBubbleDebug } from '@/lib/debug/marketMetrics';
import type { AggregateBubbleMarketSource, BubbleEvent, BubbleEventContractType, BubbleSizeBy, BubbleSource } from '@/types/bubble';

const BUBBLE_BULLISH_RGB: { r: number; g: number; b: number } = { r: 13, g: 91, b: 11 }; // #0D5B0B
const BUBBLE_BEARISH_RGB: { r: number; g: number; b: number } = { r: 74, g: 30, b: 111 }; // #4A1E6F

export type BubbleSide = 'both' | 'buy' | 'sell';
export type BubbleScaleMode = 'linear' | 'sqrt' | 'log';

interface BubbleSettings {
  bubbleSizeBy?: BubbleSizeBy;
  aggregateBubbleMarketSource?: AggregateBubbleMarketSource;
  activeChartContractType?: BubbleEventContractType;
  activeDataSourceMode?: BubbleEventContractType | 'both';
  bubbleThreshold: number;
  bubbleThresholdMode?: 'absolute' | 'relative';
  bubbleMinOrders?: number;
  bubbleMinRadius: number;
  bubbleMaxRadius: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode?: BubbleScaleMode;
}

interface AggregateBubbleDebugContext {
  panelId: string;
  bubbleSource: BubbleSource;
  bufferSize: number;
  maxBufferSize: number;
  activeChartContractType: BubbleEventContractType;
  activeDataSourceMode: BubbleEventContractType | 'both';
  engine: AggregationEngine;
  bucketSize: number;
}

type SourceCountMap = Record<BubbleEventContractType, number>;

function scaleBubbleValue(value: number, minValue: number, maxValue: number, scaleMode: BubbleScaleMode) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || !Number.isFinite(minValue) || value <= minValue || maxValue <= minValue) {
    return 0;
  }

  const range = maxValue - minValue;
  const normalizedValue = value - minValue;
  const ratio = normalizedValue / range;

  const scaled = scaleMode === 'sqrt'
    ? Math.sqrt(ratio)
    : scaleMode === 'log'
      ? Math.log(1 + normalizedValue) / Math.log(1 + range)
      : ratio;

  if (!Number.isFinite(scaled)) return 0;
  return Math.max(0, Math.min(1, scaled));
}

function abbreviateVol(vol: number): string {
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'k';
  return vol.toFixed(0);
}

const TRADE_COUNT_FALLBACK_POLICY = 'missing-or-invalid-trade-count-treated-as-1';

function getAggregateBubbleSizingValue(event: BubbleEvent, bubbleSizeBy: BubbleSizeBy) {
  if (bubbleSizeBy === 'volume') {
    return {
      value: event.volume,
      tradeCountFallback: false,
    };
  }

  const tradeCount = typeof event.tradeCount === 'number' && Number.isFinite(event.tradeCount)
    ? event.tradeCount
    : null;
  if (tradeCount !== null && tradeCount > 0) {
    return {
      value: Math.max(1, Math.round(tradeCount)),
      tradeCountFallback: false,
    };
  }

  // Some aggregate events lack first/last raw trade ids, so tradeCount is unknown.
  // Use 1 as a conservative lower bound; Min Orders > 1 will filter these out.
  return {
    value: 1,
    tradeCountFallback: true,
  };
}

function formatAggregateBubbleLabel(value: number, bubbleSizeBy: BubbleSizeBy) {
  if (bubbleSizeBy === 'orders') return abbreviateVol(Math.round(value));
  return abbreviateVol(value);
}

function normalizeEventSeconds(time: number) {
  return time > 10_000_000_000 ? time / 1000 : time;
}

function getCandleIntervalSeconds(candles: Candle[], index: number) {
  const next = candles[index + 1];
  if (next) return Math.max(1, next.time - candles[index].time);

  const previous = candles[index - 1];
  if (previous) return Math.max(1, candles[index].time - previous.time);

  return 60;
}

function findCandleIndexForEvent(candles: Candle[], eventSeconds: number, firstIndex: number, lastIndex: number) {
  let left = Math.max(0, firstIndex - 1);
  let right = Math.min(lastIndex, candles.length - 1);
  let found = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (candles[mid].time <= eventSeconds) {
      found = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return found;
}

function getAggregateEventPlacement(
  event: BubbleEvent,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  barWidth: number
) {
  const eventSeconds = normalizeEventSeconds(event.time);
  const index = findCandleIndexForEvent(candles, eventSeconds, firstIndex, lastIndex);
  if (index < firstIndex || index > lastIndex) return null;

  const intervalSeconds = getCandleIntervalSeconds(candles, index);
  const fraction = Math.max(0, Math.min(1, (eventSeconds - candles[index].time) / intervalSeconds));
  const candleX = indexToX(index);
  if (!Number.isFinite(candleX)) return null;

  return {
    index,
    eventSeconds,
    x: candleX + (fraction - 0.5) * barWidth,
  };
}

function summarizeEvent(event: BubbleEvent) {
  const tradeCount = typeof event.tradeCount === 'number' && Number.isFinite(event.tradeCount)
    ? event.tradeCount
    : null;

  return {
    time: event.time,
    price: event.price,
    volume: event.volume,
    side: event.side,
    source: event.source,
    symbol: event.symbol,
    contractType: event.contractType,
    tradeCount,
  };
}

function getNearestFootprintBucket(
  engine: AggregationEngine,
  candleTime: number,
  price: number,
  bucketSize: number
) {
  if (!Number.isFinite(bucketSize) || bucketSize <= 0) return null;

  const fallbackBucket = Math.floor(price / bucketSize) * bucketSize;
  const footprint = engine.getFootprintCandle(candleTime);
  if (!footprint) {
    return {
      bucket: fallbackBucket,
      bidVol: null,
      askVol: null,
    };
  }

  let nearestBucket = fallbackBucket;
  let nearestCell = footprint.cells.get(nearestBucket) ?? null;
  let nearestDistance = Math.abs(price - (nearestBucket + bucketSize / 2));

  footprint.cells.forEach((cell, bucket) => {
    const distance = Math.abs(price - (bucket + bucketSize / 2));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestBucket = bucket;
      nearestCell = cell;
    }
  });

  return {
    bucket: nearestBucket,
    bidVol: nearestCell?.bidVol ?? null,
    askVol: nearestCell?.askVol ?? null,
  };
}

function incrementReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function createSourceCounts(): SourceCountMap {
  return { spot: 0, futures: 0 };
}

function countEventSource(counts: SourceCountMap, event: BubbleEvent) {
  if (event.contractType === 'spot' || event.contractType === 'futures') {
    counts[event.contractType] += 1;
  }
}

function getResolvedAggregateMarketSource(
  aggregateBubbleMarketSource: AggregateBubbleMarketSource,
  activeChartContractType: BubbleEventContractType,
  activeDataSourceMode: BubbleEventContractType | 'both'
): BubbleEventContractType | 'both' {
  if (aggregateBubbleMarketSource === 'active') {
    return activeDataSourceMode === 'both' ? 'both' : activeDataSourceMode || activeChartContractType;
  }

  return aggregateBubbleMarketSource;
}

function isEventIncludedByMarketSource(
  event: BubbleEvent,
  resolvedMarketSource: BubbleEventContractType | 'both'
) {
  return resolvedMarketSource === 'both' || event.contractType === resolvedMarketSource;
}

export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  bucketSize: number,
  engine: AggregationEngine,
  barWidth: number,
  settings: BubbleSettings
) {
  const { bubbleThreshold, bubbleThresholdMode = 'absolute', bubbleMinRadius, bubbleMaxRadius, bubbleSide, bubbleScaleMode = 'sqrt' } = settings;

  // Performance guard - bars too small, bubbles would overlap and be unreadable
  if (barWidth < 4) return;

  // Compute adaptive threshold if relative
  let actualThreshold = bubbleThreshold;
  if (bubbleThresholdMode === 'relative') {
    let sumVol = 0;
    let count = 0;
    for (let i = firstIndex; i <= lastIndex; i++) {
      if (candles[i]) {
        sumVol += candles[i].volume;
        count++;
      }
    }
    const avgCandleVol = count > 0 ? sumVol / count : 0;
    const avgCellVol = avgCandleVol / 25; // Estimate average volume per bucket cell
    actualThreshold = bubbleThreshold * avgCellVol;
  }

  // Use a high-percentile scale so one outlier or edge-culling change does not
  // make all bubbles shrink or lose labels while panning.
  const scaleVolumes: number[] = [];
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fp = engine.getFootprintCandle(c.time);
    if (!fp) continue;

    fp.cells.forEach((cell) => {
      if (bubbleSide !== 'sell' && cell.askVol >= actualThreshold) scaleVolumes.push(cell.askVol);
      if (bubbleSide !== 'buy' && cell.bidVol >= actualThreshold) scaleVolumes.push(cell.bidVol);
    });
  }

  if (scaleVolumes.length === 0) return;

  scaleVolumes.sort((a, b) => a - b);
  const percentileIndex = Math.min(scaleVolumes.length - 1, Math.floor((scaleVolumes.length - 1) * 0.95));
  const maxVol = Math.max(1, scaleVolumes[percentileIndex]);

  // Step 2 - Iterate visible candles and draw bubbles
  for (let i = firstIndex; i <= lastIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const fp = engine.getFootprintCandle(c.time);
    if (!fp) continue;
    const x = indexToX(i);
    if (x === null || x === undefined || !Number.isFinite(x)) continue;

    const qualifiedCells: { price: number; vol: number; side: 'buy' | 'sell' }[] = [];

    fp.cells.forEach((cell, priceBucket) => {
      if (bubbleSide !== 'sell' && cell.askVol >= actualThreshold) {
        qualifiedCells.push({ price: priceBucket, vol: cell.askVol, side: 'buy' });
      }
      if (bubbleSide !== 'buy' && cell.bidVol >= actualThreshold) {
        qualifiedCells.push({ price: priceBucket, vol: cell.bidVol, side: 'sell' });
      }
    });

    // Cap at 20 bubbles per candle - keep highest volume ones
    if (qualifiedCells.length > 20) {
      qualifiedCells.sort((a, b) => b.vol - a.vol);
      qualifiedCells.length = 20;
    }

    for (const { price, vol, side } of qualifiedCells) {
      const y = priceToY(price + bucketSize / 2);
      if (!Number.isFinite(y)) continue;

      const t = scaleBubbleValue(vol, actualThreshold, maxVol, bubbleScaleMode);
      const radius = bubbleMinRadius + t * (bubbleMaxRadius - bubbleMinRadius);
      const opacity = 0.4 + t * 0.5;

      const isBuy = side === 'buy';
      const rgb = isBuy ? BUBBLE_BULLISH_RGB : BUBBLE_BEARISH_RGB;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = chartColorToRgba(rgb, opacity);
      ctx.fill();

      ctx.strokeStyle = chartColorToRgba(rgb, 1);
      ctx.lineWidth = 1;
      ctx.stroke();

      if (radius >= 12) {
        const label = abbreviateVol(vol);
        ctx.font = '500 9px "JetBrains Mono"';
        const textWidth = ctx.measureText(label).width;
        if (radius * 1.6 >= textWidth) {
          ctx.fillStyle = '#E8E8E8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
        }
      }
    }
  }
}

export function drawAggregateTradeBubbles(
  ctx: CanvasRenderingContext2D,
  events: BubbleEvent[],
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  settings: BubbleSettings,
  debugContext?: AggregateBubbleDebugContext
) {
  const {
    bubbleSizeBy = 'volume',
    aggregateBubbleMarketSource = 'active',
    activeChartContractType = 'spot',
    activeDataSourceMode = activeChartContractType,
    bubbleThreshold,
    bubbleThresholdMode = 'absolute',
    bubbleMinOrders = 1,
    bubbleMinRadius,
    bubbleMaxRadius,
    bubbleSide,
    bubbleScaleMode = 'sqrt',
  } = settings;
  const actualMinOrders = Number.isFinite(bubbleMinOrders)
    ? Math.max(1, Math.min(1000, Math.round(bubbleMinOrders)))
    : 1;
  const filterReasons: Record<string, number> = {};
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const resolvedMarketSource = getResolvedAggregateMarketSource(
    aggregateBubbleMarketSource,
    activeChartContractType,
    activeDataSourceMode
  );
  const totalEventCountBySource = createSourceCounts();
  const visibleEventCountBySource = createSourceCounts();
  const renderedCountBySource = createSourceCounts();
  const restoredEventCountBySource = createSourceCounts();
  const restoredEvents = events.filter((event) => event.origin === 'restored');
  const restoredTimes = restoredEvents
    .map((event) => event.time)
    .filter((time) => Number.isFinite(time));
  events.forEach((event) => countEventSource(totalEventCountBySource, event));
  restoredEvents.forEach((event) => countEventSource(restoredEventCountBySource, event));
  let tradeCountFallbackCount = 0;
  let latestFiltered: (ReturnType<typeof summarizeEvent> & { reason: string; eventSeconds: number | null }) | null = null;
  let latestRendered: (ReturnType<typeof summarizeEvent> & {
    renderedValue: number;
    renderedValueSource: BubbleSizeBy;
    tradeCountFallback: boolean;
    renderedX: number;
    renderedY: number;
    nearestCandleTime: number | null;
    candleHigh: number | null;
    candleLow: number | null;
    nearestFootprintBucket: number | null;
    nearestFootprintBidVol: number | null;
    nearestFootprintAskVol: number | null;
  }) | null = null;

  const publishDebug = (
    visibleEventCount: number,
    renderedCount: number,
    actualThreshold: number | null,
    visibleWindow: { startTime: number; endTime: number } | null
  ) => {
    if (!debugContext) return;

    recordAggregateBubbleDebug({
      panelId: debugContext.panelId,
      bubbleSource: debugContext.bubbleSource,
      bubbleSizeBy,
      aggregateBubbleMarketSource,
      activeChartMarketSource: {
        contractType: debugContext.activeChartContractType,
        dataSourceMode: debugContext.activeDataSourceMode,
      },
      bufferSize: debugContext.bufferSize,
      maxBufferSize: debugContext.maxBufferSize,
      restoredEventCount: restoredEvents.length,
      liveEventCount: Math.max(0, events.length - restoredEvents.length),
      totalHydratedCount: events.length,
      duplicateSkippedCount: 0,
      restoreQueryRange: null,
      restoredSpotCount: restoredEventCountBySource.spot,
      restoredFuturesCount: restoredEventCountBySource.futures,
      minRestoredEventTime: restoredTimes.length > 0 ? Math.min(...restoredTimes) : null,
      maxRestoredEventTime: restoredTimes.length > 0 ? Math.max(...restoredTimes) : null,
      storageThresholds: null,
      currentRenderedCountAfterRestore: null,
      visibleEventCount,
      renderedCount,
      totalEventCountBySource,
      visibleEventCountBySource,
      renderedCountBySource,
      visibleEventCountBySizeMode: {
        volume: bubbleSizeBy === 'volume' ? visibleEventCount : 0,
        orders: bubbleSizeBy === 'orders' ? visibleEventCount : 0,
      },
      renderedCountBySizeMode: {
        volume: bubbleSizeBy === 'volume' ? renderedCount : 0,
        orders: bubbleSizeBy === 'orders' ? renderedCount : 0,
      },
      filteredCount: Object.values(filterReasons).reduce((sum, count) => sum + count, 0),
      filterReasons,
      tradeCountFallbackCount,
      tradeCountFallbackPolicy: bubbleSizeBy === 'orders' ? TRADE_COUNT_FALLBACK_POLICY : null,
      latestEvent: latestEvent ? summarizeEvent(latestEvent) : null,
      latestRendered,
      latestFiltered,
      visibleWindow,
      settings: {
        sizeBy: bubbleSizeBy,
        marketSource: aggregateBubbleMarketSource,
        resolvedMarketSource,
        minVolume: bubbleThreshold,
        minOrders: actualMinOrders,
        thresholdMode: bubbleThresholdMode,
        side: bubbleSide,
        scaleMode: bubbleScaleMode,
        minRadius: bubbleMinRadius,
        maxRadius: bubbleMaxRadius,
        actualThreshold,
        actualThresholdMode: actualThreshold === null ? null : bubbleSizeBy,
      },
    });
  };

  if (barWidth < 4 || events.length === 0 || candles.length === 0) {
    const reason = barWidth < 4 ? 'bar-width-too-small' : events.length === 0 ? 'empty-buffer' : 'no-candles';
    incrementReason(filterReasons, reason);
    if (latestEvent) {
      latestFiltered = {
        ...summarizeEvent(latestEvent),
        reason,
        eventSeconds: Number.isFinite(latestEvent.time) ? normalizeEventSeconds(latestEvent.time) : null,
      };
    }
    publishDebug(0, 0, null, null);
    return;
  }

  const firstCandle = candles[firstIndex];
  const lastCandle = candles[lastIndex];
  if (!firstCandle || !lastCandle) {
    incrementReason(filterReasons, 'missing-visible-candle');
    publishDebug(0, 0, null, null);
    return;
  }

  const visibleStartSeconds = firstCandle.time;
  const visibleEndSeconds = lastCandle.time + getCandleIntervalSeconds(candles, lastIndex);
  const visibleWindow = { startTime: visibleStartSeconds, endTime: visibleEndSeconds };
  const visibleEvents: BubbleEvent[] = [];

  for (const event of events) {
    let reason: string | null = null;
    const eventSeconds = Number.isFinite(event.time) ? normalizeEventSeconds(event.time) : null;

    if (event.source !== 'aggregateTrade') reason = 'not-aggregate-trade';
    else if (!isEventIncludedByMarketSource(event, resolvedMarketSource)) reason = 'excluded-by-market-source';
    else if (bubbleSide !== 'both' && event.side !== bubbleSide) reason = 'excluded-by-side-filter';
    else if (!Number.isFinite(event.price)) reason = 'invalid-price';
    else if (bubbleSizeBy === 'volume' && (!Number.isFinite(event.volume) || event.volume <= 0)) reason = 'invalid-volume';
    else if (eventSeconds === null || !Number.isFinite(eventSeconds)) reason = 'invalid-time';
    else if (eventSeconds < visibleStartSeconds || eventSeconds > visibleEndSeconds) reason = 'outside-visible-time-range';

    if (reason) {
      incrementReason(filterReasons, reason);
      latestFiltered = {
        ...summarizeEvent(event),
        reason,
        eventSeconds,
      };
      continue;
    }

    visibleEvents.push(event);
    countEventSource(visibleEventCountBySource, event);
  }

  if (visibleEvents.length === 0) {
    publishDebug(0, 0, null, visibleWindow);
    return;
  }

  if (bubbleSizeBy === 'orders') {
    tradeCountFallbackCount = visibleEvents.reduce((count, event) => (
      count + (getAggregateBubbleSizingValue(event, bubbleSizeBy).tradeCountFallback ? 1 : 0)
    ), 0);
  }

  let actualThreshold = bubbleSizeBy === 'orders' ? actualMinOrders : bubbleThreshold;
  if (bubbleSizeBy === 'volume' && bubbleThresholdMode === 'relative') {
    const avgEventVol = visibleEvents.reduce((sum, event) => sum + event.volume, 0) / visibleEvents.length;
    actualThreshold = bubbleThreshold * avgEventVol;
  }

  const qualifiedEvents = visibleEvents.filter((event) => {
    const sizing = getAggregateBubbleSizingValue(event, bubbleSizeBy);
    if (sizing.value >= actualThreshold) return true;

    const reason = bubbleSizeBy === 'orders' ? 'below-min-orders' : 'below-min-volume';
    incrementReason(filterReasons, reason);
    latestFiltered = {
      ...summarizeEvent(event),
      reason,
      eventSeconds: normalizeEventSeconds(event.time),
    };
    return false;
  });
  if (qualifiedEvents.length === 0) {
    publishDebug(visibleEvents.length, 0, actualThreshold, visibleWindow);
    return;
  }

  const scaleValues = qualifiedEvents
    .map((event) => getAggregateBubbleSizingValue(event, bubbleSizeBy).value)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  // Use a stable anchor so one whale trade doesn't crush all other bubbles.
  // The median gives us a reliable "normal" trade size. We cap maxValue at 5×
  // the median so large trades still stand out but smaller trades remain visible.
  const medianIndex = Math.floor((scaleValues.length - 1) / 2);
  const medianValue = scaleValues[medianIndex] ?? 1;
  const percentileIndex = Math.min(scaleValues.length - 1, Math.floor((scaleValues.length - 1) * 0.95));
  const rawMax = scaleValues[percentileIndex] ?? 1;
  const anchoredCap = Math.max(medianValue * 5, actualThreshold * 3);
  const maxValue = Math.max(1, Math.min(rawMax, anchoredCap));


  let renderedCount = 0;
  for (const event of qualifiedEvents) {
    const placement = getAggregateEventPlacement(event, candles, firstIndex, lastIndex, indexToX, barWidth);
    if (placement === null || !Number.isFinite(placement.x)) {
      incrementReason(filterReasons, 'x-placement-failed');
      latestFiltered = {
        ...summarizeEvent(event),
        reason: 'x-placement-failed',
        eventSeconds: Number.isFinite(event.time) ? normalizeEventSeconds(event.time) : null,
      };
      continue;
    }

    const y = priceToY(event.price);
    if (!Number.isFinite(y)) {
      incrementReason(filterReasons, 'y-placement-failed');
      latestFiltered = {
        ...summarizeEvent(event),
        reason: 'y-placement-failed',
        eventSeconds: placement.eventSeconds,
      };
      continue;
    }

    const sizing = getAggregateBubbleSizingValue(event, bubbleSizeBy);
    const t = scaleBubbleValue(sizing.value, actualThreshold, maxValue, bubbleScaleMode);
    const radius = bubbleMinRadius + t * (bubbleMaxRadius - bubbleMinRadius);
    const opacity = 0.4 + t * 0.5;

    const isBuy = event.side === 'buy';
    const rgb = isBuy ? BUBBLE_BULLISH_RGB : BUBBLE_BEARISH_RGB;

    ctx.beginPath();
    ctx.arc(placement.x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = chartColorToRgba(rgb, opacity);
    ctx.fill();

    const distinguishMarketSource = resolvedMarketSource === 'both';
    ctx.strokeStyle = chartColorToRgba(rgb, 1);
    ctx.lineWidth = distinguishMarketSource && event.contractType === 'futures' ? 1.5 : 1;
    ctx.setLineDash(distinguishMarketSource && event.contractType === 'futures' ? [3, 2] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    if (radius >= 12) {
      const label = formatAggregateBubbleLabel(sizing.value, bubbleSizeBy);
      ctx.font = '500 9px "JetBrains Mono"';
      const textWidth = ctx.measureText(label).width;
      if (radius * 1.6 >= textWidth) {
        ctx.fillStyle = '#E8E8E8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, placement.x, y);
      }
    }

    renderedCount += 1;
    countEventSource(renderedCountBySource, event);

    if (debugContext) {
      const candle = candles[placement.index];
      const nearestFootprintBucket = candle
        ? getNearestFootprintBucket(debugContext.engine, candle.time, event.price, debugContext.bucketSize)
        : null;

      latestRendered = {
        ...summarizeEvent(event),
        renderedValue: sizing.value,
        renderedValueSource: bubbleSizeBy,
        tradeCountFallback: sizing.tradeCountFallback,
        renderedX: placement.x,
        renderedY: y,
        nearestCandleTime: candle?.time ?? null,
        candleHigh: candle?.high ?? null,
        candleLow: candle?.low ?? null,
        nearestFootprintBucket: nearestFootprintBucket?.bucket ?? null,
        nearestFootprintBidVol: nearestFootprintBucket?.bidVol ?? null,
        nearestFootprintAskVol: nearestFootprintBucket?.askVol ?? null,
      };
    }
  }

  publishDebug(visibleEvents.length, renderedCount, actualThreshold, visibleWindow);
}

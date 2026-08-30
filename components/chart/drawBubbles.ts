import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { chartColorToRgba } from '@/lib/config/chartColors';
import { recordAggregateBubbleDebug } from '@/lib/debug/marketMetrics';
import type { AggregateBubbleMarketSource, BubbleEvent, BubbleEventContractType, BubbleSizeBy, BubbleScaleMode, BubbleSettings, AggregateBubbleDebugContext, SourceCountMap } from '@/types/bubble';




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
    bubbleFilterRender,
    bubbleStdDevVal,
    bubbleOutStdDevPerc,
    bubbleSide,
    bubbleScaleMode = 'sqrt',
    bubbleMinOrders = 10,
    bubbleDisplayMode = '2d',
    bubbleBidColor = '#4ade80',
    bubbleAskColor = '#f87171',
    bubbleLineWidth = 1,
    bubbleOpacity = 0.5,
  } = settings;
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
      visibleEventCountBySizeMode: { volume: visibleEventCount, orders: 0 },
      renderedCountBySizeMode: { volume: renderedCount, orders: 0 },
      filteredCount: Object.values(filterReasons).reduce((sum, count) => sum + count, 0),
      filterReasons,
      tradeCountFallbackCount,
      tradeCountFallbackPolicy: null,
      latestEvent: latestEvent ? summarizeEvent(latestEvent) : null,
      latestRendered,
      latestFiltered,
      visibleWindow,
      settings: {
        sizeBy: bubbleSizeBy,
        marketSource: aggregateBubbleMarketSource,
        resolvedMarketSource,
        minVolume: bubbleThreshold,
        minOrders: bubbleMinOrders,
        thresholdMode: bubbleThresholdMode,
        side: bubbleSide,
        scaleMode: bubbleScaleMode,
        filterRender: bubbleFilterRender,
        stdDevVal: bubbleStdDevVal,
        outlierPerc: bubbleOutStdDevPerc,
        actualThreshold,
        actualThresholdMode: null,
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
    else if (!Number.isFinite(event.price)) reason = 'invalid-price';
    else if (!Number.isFinite(event.volume) || event.volume <= 0) reason = 'invalid-volume';
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

  const groupedEvents: BubbleEvent[] = [];
  let currentGroup: BubbleEvent | null = null;
  
  for (const event of visibleEvents) {
    if (!currentGroup) {
      currentGroup = { ...event };
      continue;
    }
    
    const timeDiffSec = normalizeEventSeconds(event.time) - normalizeEventSeconds(currentGroup.time);
    
    if (
      event.side === currentGroup.side &&
      event.contractType === currentGroup.contractType &&
      timeDiffSec >= 0 && timeDiffSec <= 0.05
    ) {
      const combinedVolume = currentGroup.volume + event.volume;
      if (combinedVolume > 0) {
        currentGroup.price = (currentGroup.price * currentGroup.volume + event.price * event.volume) / combinedVolume;
      }
      currentGroup.volume = combinedVolume;
      
      if (typeof event.tradeCount === 'number' && typeof currentGroup.tradeCount === 'number') {
        currentGroup.tradeCount += event.tradeCount;
      } else {
        currentGroup.tradeCount = undefined;
      }
    } else {
      groupedEvents.push(currentGroup);
      currentGroup = { ...event };
    }
  }
  if (currentGroup) {
    groupedEvents.push(currentGroup);
  }

  if (bubbleSizeBy === 'orders') {
    tradeCountFallbackCount = groupedEvents.reduce((count, event) => (
      count + (getAggregateBubbleSizingValue(event, bubbleSizeBy).tradeCountFallback ? 1 : 0)
    ), 0);
  }

  let actualThreshold = bubbleThreshold;
  if (bubbleThresholdMode === 'relative') {
    const avgEventVol = groupedEvents.reduce((sum, event) => sum + event.volume, 0) / groupedEvents.length;
    actualThreshold = bubbleThreshold * avgEventVol;
  }

  const qualifiedEvents = groupedEvents.filter((event) => {
    if (event.volume >= actualThreshold) return true;
    incrementReason(filterReasons, 'below-min-volume');
    latestFiltered = {
      ...summarizeEvent(event),
      reason: 'below-min-volume',
      eventSeconds: normalizeEventSeconds(event.time),
    };
    return false;
  });
  if (qualifiedEvents.length === 0) {
    publishDebug(visibleEvents.length, 0, actualThreshold, visibleWindow);
    return;
  }

  const scaleValues = qualifiedEvents
    .map((event) => event.volume)
    .filter((value) => Number.isFinite(value) && value > 0);

  let mean = 1;
  let stdDev = 0;
  let maxValue = 1;
  if (scaleValues.length > 0) {
    mean = scaleValues.reduce((sum, val) => sum + val, 0) / scaleValues.length;
    const variance = scaleValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scaleValues.length;
    stdDev = Math.sqrt(variance);

    const calculatedMax = mean + (stdDev * bubbleStdDevVal);
    
    // Process outliers
    scaleValues.sort((a, b) => a - b);
    const outlierIndex = Math.min(scaleValues.length - 1, Math.floor(scaleValues.length * (1 - (bubbleOutStdDevPerc / 100))));
    const outlierCap = scaleValues[outlierIndex] ?? calculatedMax;

    maxValue = Math.max(1, Math.min(calculatedMax, outlierCap));
  }


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

    const sizing = { value: event.volume, tradeCountFallback: false };
    const t = scaleBubbleValue(sizing.value, actualThreshold, maxValue, bubbleScaleMode);
    const radius = t * 60; // Max radius internally clamped to 60px
    const opacity = (0.4 + t * 0.5) * (bubbleOpacity / 0.5);

    const isBuy = event.side === 'buy';
    if (radius < bubbleFilterRender) continue;
    
    // In Tier 3, since we don't have price level grouping yet (Tier 4), 
    // each bubble is a single raw event (either pure buy or pure sell).
    // Therefore, for 'delta' and 'volume' modes, it is equivalent to 'askBidSplit' 
    // (100% buy or 100% sell delta). The color logic will be expanded in Tier 4.
    const colorStr = isBuy ? bubbleBidColor : bubbleAskColor;
    
    ctx.beginPath();
    ctx.arc(placement.x, y, radius, 0, Math.PI * 2);

    if (bubbleDisplayMode === '3d') {
      const gradient = ctx.createRadialGradient(
        placement.x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        placement.x, y, radius
      );
      gradient.addColorStop(0, chartColorToRgba(colorStr, Math.min(1, opacity + 0.4)));
      gradient.addColorStop(0.7, chartColorToRgba(colorStr, opacity));
      gradient.addColorStop(1, chartColorToRgba(colorStr, opacity * 0.4));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = chartColorToRgba(colorStr, opacity);
    }
    
    ctx.fill();

    const distinguishMarketSource = resolvedMarketSource === 'both';
    ctx.strokeStyle = chartColorToRgba(colorStr, Math.min(1, opacity + 0.2));
    ctx.lineWidth = distinguishMarketSource && event.contractType === 'futures' ? Math.max(1.5, bubbleLineWidth * 1.5) : bubbleLineWidth;
    ctx.setLineDash(distinguishMarketSource && event.contractType === 'futures' ? [3, 2] : []);
    
    if (bubbleLineWidth > 0) {
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (radius >= 12) {
      const label = formatAggregateBubbleLabel(sizing.value, 'volume');
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
        renderedValueSource: 'volume' as const,
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



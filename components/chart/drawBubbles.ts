import { Candle } from '@/types/candle';
import { AggregationEngine } from '@/lib/aggregation/engine';
import { chartColorToRgba } from '@/lib/config/chartColors';
import { recordAggregateBubbleDebug } from '@/lib/debug/marketMetrics';
import type { AggregateBubbleMarketSource, BubbleEvent, BubbleEventContractType, BubbleSizeBy, BubbleScaleMode, BubbleColorMode, BubbleSettings, AggregateBubbleDebugContext, SourceCountMap } from '@/types/bubble';




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



function formatAggregateBubbleLabel(value: number, bubbleSizeBy: BubbleSizeBy) {
  if (bubbleSizeBy === 'orders') return abbreviateVol(Math.round(value));
  return abbreviateVol(value);
}

const BUBBLE_FONT_FAMILY = '"BlinkMacSystemFont", -apple-system, system-ui, sans-serif';

function getBubbleFont(radius: number): string {
  if (radius >= 28) return `700 12px ${BUBBLE_FONT_FAMILY}`;
  if (radius >= 20) return `700 11px ${BUBBLE_FONT_FAMILY}`;
  if (radius >= 15) return `600 10px ${BUBBLE_FONT_FAMILY}`;
  return `600 9px ${BUBBLE_FONT_FAMILY}`;
}

interface ClusterBubble extends BubbleEvent {
  buyVolume: number;
  sellVolume: number;
  buyTradeCount: number;
  sellTradeCount: number;
  tradeCountFallback: boolean;
  minPrice?: number;
  maxPrice?: number;
  candleIndex?: number;
}

function getClusterSizingValue(
  cluster: ClusterBubble,
  bubbleSizeBy: BubbleSizeBy,
  bubbleColorMode: BubbleColorMode
) {
  const isOrders = bubbleSizeBy === 'orders';
  const buyVal = isOrders ? cluster.buyTradeCount : cluster.buyVolume;
  const sellVal = isOrders ? cluster.sellTradeCount : cluster.sellVolume;
  const delta = buyVal - sellVal;
  const total = buyVal + sellVal;

  if (bubbleColorMode === 'delta') {
    return {
      value: Math.max(1, Math.abs(delta)),
      delta,
      total,
      side: delta >= 0 ? ('buy' as const) : ('sell' as const),
      tradeCountFallback: cluster.tradeCountFallback,
    };
  }

  if (bubbleColorMode === 'volume') {
    return {
      value: Math.max(1, total),
      delta,
      total,
      side: delta >= 0 ? ('buy' as const) : ('sell' as const),
      tradeCountFallback: cluster.tradeCountFallback,
    };
  }

  // askBidSplit: returns the active side volume/count
  const sideVal = cluster.side === 'buy' ? buyVal : sellVal;
  return {
    value: Math.max(1, sideVal),
    delta,
    total,
    side: cluster.side,
    tradeCountFallback: cluster.tradeCountFallback,
  };
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

function clusterEvents(
  visibleEvents: BubbleEvent[],
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  barWidth: number,
  settings: BubbleSettings,
  debugContext?: AggregateBubbleDebugContext
): ClusterBubble[] {
  const {
    bubbleColorMode = 'askBidSplit',
    bubbleGroupingMode = 'automatic',
    bubblePriceAggrMode = 'extension',
    bubbleTickGroupingMode = 'automatic',
    bubbleTickCount = 3,
    bubbleTimeWindowMs = 250,
    bucketSize,
  } = settings;

  const effectiveGroupingMode = bubbleGroupingMode === 'automatic'
    ? (barWidth >= 8 ? 'price' : 'time')
    : bubbleGroupingMode;

  const baseTickSize = (bucketSize && Number.isFinite(bucketSize) && bucketSize > 0)
    ? bucketSize
    : (debugContext?.bucketSize && Number.isFinite(debugContext.bucketSize) && debugContext.bucketSize > 0)
      ? debugContext.bucketSize
      : 10;

  const effectiveTickCount = bubbleTickGroupingMode === 'fixed'
    ? Math.max(1, Math.round(bubbleTickCount || 3))
    : 3;

  const effectivePriceBucket = effectiveTickCount * baseTickSize;
  const clusterTimeWindowSec = Math.max(0.05, (bubbleTimeWindowMs || 250) / 1000);

  const clusters: ClusterBubble[] = [];

  for (const event of visibleEvents) {
    const eventSec = normalizeEventSeconds(event.time);
    const rawTradeCount = typeof event.tradeCount === 'number' && Number.isFinite(event.tradeCount) && event.tradeCount > 0
      ? Math.max(1, Math.round(event.tradeCount))
      : 1;
    const isFallback = !(typeof event.tradeCount === 'number' && Number.isFinite(event.tradeCount) && event.tradeCount > 0);

    let matchedCluster: ClusterBubble | null = null;

    if (effectiveGroupingMode === 'price') {
      const candleIndex = findCandleIndexForEvent(candles, eventSec, firstIndex, lastIndex);

      let bestDist = Infinity;
      for (let i = clusters.length - 1; i >= 0; i--) {
        const candidate = clusters[i];
        if (candidate.candleIndex !== candleIndex) {
          if (candidate.candleIndex !== undefined && candleIndex !== undefined && candleIndex - candidate.candleIndex > 1) {
            break;
          }
          continue;
        }

        if (candidate.contractType !== event.contractType) {
          continue;
        }

        // In askBidSplit mode:
        // - 'extension' mode keeps buy and sell separate
        // - 'extensionRetracement' absorbs opposing trades into the cluster
        if (bubbleColorMode === 'askBidSplit' && bubblePriceAggrMode === 'extension' && candidate.side !== event.side) {
          continue;
        }

        const cMin = candidate.minPrice ?? candidate.price;
        const cMax = candidate.maxPrice ?? candidate.price;
        
        // Strict cluster vertical span cap: cluster cannot exceed effectivePriceBucket height
        const prospectiveMin = Math.min(cMin, event.price);
        const prospectiveMax = Math.max(cMax, event.price);
        const withinBucketSpan = (prospectiveMax - prospectiveMin) <= effectivePriceBucket;

        if (withinBucketSpan) {
          const dist = Math.abs(event.price - candidate.price);
          if (dist < bestDist) {
            bestDist = dist;
            matchedCluster = candidate;
          }
        }
      }

      if (matchedCluster) {
        matchedCluster.minPrice = Math.min(matchedCluster.minPrice ?? matchedCluster.price, event.price);
        matchedCluster.maxPrice = Math.max(matchedCluster.maxPrice ?? matchedCluster.price, event.price);
      }
    } else {
      // 'time' mode
      for (let i = clusters.length - 1; i >= 0; i--) {
        const candidate = clusters[i];
        const timeDiff = eventSec - normalizeEventSeconds(candidate.time);
        if (timeDiff > clusterTimeWindowSec * 2) {
          break;
        }

        if (candidate.contractType !== event.contractType) {
          continue;
        }

        if (timeDiff < 0 || timeDiff > clusterTimeWindowSec) {
          continue;
        }

        if (bubbleColorMode === 'askBidSplit' && candidate.side !== event.side) {
          continue;
        }

        const maxPriceDiff = effectivePriceBucket ? effectivePriceBucket * 1.5 : candidate.price * 0.0005;
        if (Math.abs(event.price - candidate.price) > maxPriceDiff) {
          continue;
        }

        matchedCluster = candidate;
        break;
      }
    }

    if (matchedCluster) {
      const totalVolBefore = matchedCluster.buyVolume + matchedCluster.sellVolume;
      const combinedVol = totalVolBefore + event.volume;
      if (combinedVol > 0) {
        matchedCluster.price = (matchedCluster.price * totalVolBefore + event.price * event.volume) / combinedVol;
        matchedCluster.time = (matchedCluster.time * totalVolBefore + event.time * event.volume) / combinedVol;
      }
      matchedCluster.volume = combinedVol;

      if (event.side === 'buy') {
        matchedCluster.buyVolume += event.volume;
        matchedCluster.buyTradeCount += rawTradeCount;
      } else {
        matchedCluster.sellVolume += event.volume;
        matchedCluster.sellTradeCount += rawTradeCount;
      }

      matchedCluster.tradeCount = matchedCluster.buyTradeCount + matchedCluster.sellTradeCount;
      if (isFallback) {
        matchedCluster.tradeCountFallback = true;
      }

      if (bubbleColorMode !== 'askBidSplit' || (effectiveGroupingMode === 'price' && bubblePriceAggrMode === 'extensionRetracement')) {
        const netDelta = matchedCluster.buyVolume - matchedCluster.sellVolume;
        matchedCluster.side = netDelta >= 0 ? 'buy' : 'sell';
      }
    } else {
      const candleIndex = findCandleIndexForEvent(candles, eventSec, firstIndex, lastIndex);
      clusters.push({
        ...event,
        buyVolume: event.side === 'buy' ? event.volume : 0,
        sellVolume: event.side === 'sell' ? event.volume : 0,
        buyTradeCount: event.side === 'buy' ? rawTradeCount : 0,
        sellTradeCount: event.side === 'sell' ? rawTradeCount : 0,
        tradeCountFallback: isFallback,
        minPrice: event.price,
        maxPrice: event.price,
        candleIndex,
      });
    }
  }

  return clusters;
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
    bubbleSide = 'both',
    bubbleScaleMode = 'sqrt',
    bubbleColorMode = 'askBidSplit',
    bubbleVolumeColorMode = 'deltaAbsolute',
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
      tradeCountFallbackPolicy: bubbleSizeBy === 'orders' ? 'fallback-to-1' : null,
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
        actualThresholdMode: bubbleSizeBy,
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
    else if (bubbleColorMode === 'askBidSplit' && bubbleSide !== 'both' && event.side !== bubbleSide) reason = 'excluded-by-side-filter';
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

  // Ensure chronological order for grouping
  visibleEvents.sort((a, b) => normalizeEventSeconds(a.time) - normalizeEventSeconds(b.time));

  const clusters = clusterEvents(
    visibleEvents,
    candles,
    firstIndex,
    lastIndex,
    barWidth,
    settings,
    debugContext
  );

  if (bubbleSizeBy === 'orders') {
    tradeCountFallbackCount = clusters.reduce((count, cluster) => (
      count + (cluster.tradeCountFallback ? 1 : 0)
    ), 0);
  }

  const actualMinOrders = Math.max(1, Math.round(bubbleMinOrders));
  let actualThreshold = bubbleSizeBy === 'orders' ? actualMinOrders : bubbleThreshold;
  if (bubbleSizeBy === 'volume' && bubbleThresholdMode === 'relative') {
    const avgClusterVol = clusters.reduce((sum, c) => sum + (c.buyVolume + c.sellVolume), 0) / (clusters.length || 1);
    actualThreshold = bubbleThreshold * avgClusterVol;
  }

  const qualifiedEvents = clusters.filter((cluster) => {
    const sizing = getClusterSizingValue(cluster, bubbleSizeBy, bubbleColorMode);

    if (bubbleSide !== 'both' && sizing.side !== bubbleSide) {
      incrementReason(filterReasons, 'excluded-by-side-filter');
      latestFiltered = {
        ...summarizeEvent(cluster),
        reason: 'excluded-by-side-filter',
        eventSeconds: normalizeEventSeconds(cluster.time),
      };
      return false;
    }

    if (sizing.value < actualThreshold) {
      const reason = bubbleSizeBy === 'orders' ? 'below-min-orders' : 'below-min-volume';
      incrementReason(filterReasons, reason);
      latestFiltered = {
        ...summarizeEvent(cluster),
        reason,
        eventSeconds: normalizeEventSeconds(cluster.time),
      };
      return false;
    }

    return true;
  });

  if (qualifiedEvents.length === 0) {
    publishDebug(visibleEvents.length, 0, actualThreshold, visibleWindow);
    return;
  }

  const scaleValues = qualifiedEvents
    .map((cluster) => getClusterSizingValue(cluster, bubbleSizeBy, bubbleColorMode).value)
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
  for (const cluster of qualifiedEvents) {
    const placement = getAggregateEventPlacement(cluster, candles, firstIndex, lastIndex, indexToX, barWidth);
    if (placement === null || !Number.isFinite(placement.x)) {
      incrementReason(filterReasons, 'x-placement-failed');
      latestFiltered = {
        ...summarizeEvent(cluster),
        reason: 'x-placement-failed',
        eventSeconds: Number.isFinite(cluster.time) ? normalizeEventSeconds(cluster.time) : null,
      };
      continue;
    }

    const y = priceToY(cluster.price);
    if (!Number.isFinite(y)) {
      incrementReason(filterReasons, 'y-placement-failed');
      latestFiltered = {
        ...summarizeEvent(cluster),
        reason: 'y-placement-failed',
        eventSeconds: placement.eventSeconds,
      };
      continue;
    }

    const sizing = getClusterSizingValue(cluster, bubbleSizeBy, bubbleColorMode);
    const t = scaleBubbleValue(sizing.value, actualThreshold, maxValue, bubbleScaleMode);
    const radius = t * 60; // Max radius internally clamped to 60px
    if (radius < bubbleFilterRender) continue;

    const isBuy = sizing.side === 'buy';
    const baseColor = isBuy ? bubbleBidColor : bubbleAskColor;

    let opacity = (0.4 + t * 0.5) * (bubbleOpacity / 0.5);
    let label = formatAggregateBubbleLabel(sizing.value, bubbleSizeBy);
    let isDashedBorder = false;
    let hasInnerAccentRing = false;

    if (bubbleColorMode === 'delta') {
      // In Delta mode: signed delta label (+/-) with actual net delta
      const sign = sizing.delta >= 0 ? '+' : '-';
      label = `${sign}${formatAggregateBubbleLabel(Math.abs(sizing.delta), bubbleSizeBy)}`;
      const deltaIntensity = 0.35 + t * 0.65;
      opacity = deltaIntensity * (bubbleOpacity / 0.5);
    } else if (bubbleColorMode === 'volume') {
      if (bubbleVolumeColorMode === 'deltaPercentual') {
        // Delta Percentual mode: display directional aggression percentage with dashed perimeter
        const deltaPerc = sizing.total > 0 ? Math.round((sizing.delta / sizing.total) * 100) : 0;
        const sign = deltaPerc > 0 ? '+' : '';
        label = `${sign}${deltaPerc}%`;
        isDashedBorder = true;
      } else {
        // Delta Absolute mode: standard volume with double-ring volume boundary
        label = formatAggregateBubbleLabel(sizing.total, bubbleSizeBy);
        hasInnerAccentRing = true;
      }
    } else {
      label = formatAggregateBubbleLabel(sizing.value, bubbleSizeBy);
    }

    ctx.beginPath();
    ctx.arc(placement.x, y, radius, 0, Math.PI * 2);

    if (bubbleDisplayMode === '3d') {
      const gradient = ctx.createRadialGradient(
        placement.x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        placement.x, y, radius
      );
      gradient.addColorStop(0, chartColorToRgba(baseColor, Math.min(1, opacity + 0.4)));
      gradient.addColorStop(0.7, chartColorToRgba(baseColor, opacity));
      gradient.addColorStop(1, chartColorToRgba(baseColor, opacity * 0.4));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = chartColorToRgba(baseColor, opacity);
    }
    
    ctx.fill();

    const distinguishMarketSource = resolvedMarketSource === 'both';
    ctx.strokeStyle = chartColorToRgba(baseColor, Math.min(1, opacity + 0.2));
    ctx.lineWidth = distinguishMarketSource && cluster.contractType === 'futures' ? Math.max(1.5, bubbleLineWidth * 1.5) : bubbleLineWidth;
    
    if (isDashedBorder) {
      ctx.setLineDash([4, 2]);
    } else if (distinguishMarketSource && cluster.contractType === 'futures') {
      ctx.setLineDash([3, 2]);
    } else {
      ctx.setLineDash([]);
    }
    
    if (bubbleLineWidth > 0) {
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (hasInnerAccentRing && radius >= 14 && bubbleLineWidth > 0) {
      ctx.beginPath();
      ctx.arc(placement.x, y, radius * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = chartColorToRgba(baseColor, Math.min(1, opacity * 0.6));
      ctx.lineWidth = Math.max(0.5, bubbleLineWidth * 0.75);
      ctx.stroke();
    }

    if (radius >= 11) {
      ctx.font = getBubbleFont(radius);
      const textWidth = ctx.measureText(label).width;
      if (radius * 1.6 >= textWidth) {
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, placement.x, y);
      }
    }

    renderedCount += 1;
    countEventSource(renderedCountBySource, cluster);

    if (debugContext) {
      const candle = candles[placement.index];
      const nearestFootprintBucket = candle
        ? getNearestFootprintBucket(debugContext.engine, candle.time, cluster.price, debugContext.bucketSize)
        : null;

      latestRendered = {
        ...summarizeEvent(cluster),
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

export { clusterEvents, getClusterSizingValue };

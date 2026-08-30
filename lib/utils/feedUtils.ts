import { type PanelState } from '../store/chart';
import {
  AggregationEngine,
  BASE_FOOTPRINT_TIMEFRAME_SECONDS,
} from '../aggregation/engine';
import { getCandleTimeForTrade } from './aggregation';
import type { FineProfileRow } from '../../types/volumeProfile';
import type { Candle } from '../../types/candle';
import type { Trade } from '../../types/trade';
import type { AggregateBubbleMarketSource, BubbleEvent } from '../../types/bubble';
import {
  FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS,
  FOOTPRINT_RESTORE_ASSUMED_DRAWABLE_WIDTH_PX,
  FOOTPRINT_RESTORE_MIN_VISIBLE_BARS,
  FOOTPRINT_RESTORE_MAX_VISIBLE_BARS,
  FOOTPRINT_RESTORE_BUFFER_BARS,
  MAX_DEDUPE_KEYS,
  ENABLE_BROWSER_MARKET_WRITES,
  FINE_PROFILE_RESTORE_CHUNK_SECONDS,
  AGGREGATE_BUBBLE_RESTORE_SECONDS,
} from '../config/constants';
import type {
  TradeSource,
  FootprintWorkReason,
  FootprintWorkNeed,
  FootprintRestoreRange,
  AggregateBubbleStorageThresholds,
} from '../../types/feed';

export const queuedRawTradeStorageKeys = new Set<string>();
export const closedCandleStorageKeys = new Set<string>();
export const queuedFineProfileCandleKeys = new Set<string>();

export function getFootprintWorkNeed(panel: PanelState): FootprintWorkNeed {
  const reasons: FootprintWorkReason[] = [];

  if (panel.chartMode === 'footprint') reasons.push('chart-mode-footprint');

  if (panel.cvdEnabled) reasons.push('cvd');
  if (panel.absorptionEnabled) reasons.push('absorption');
  if (panel.exhaustionEnabled) reasons.push('exhaustion');
  if (panel.icebergEnabled) reasons.push('iceberg');
  if (panel.liquidityVacuumEnabled) reasons.push('liquidity-vacuum');
  if (ENABLE_BROWSER_MARKET_WRITES) reasons.push('browser-market-writes');

  return {
    needed: reasons.length > 0,
    reasons,
  };
}

export function getTradeSourcesForDataSourceMode(dataSourceMode: TradeSource | 'both'): TradeSource[] {
  return dataSourceMode === 'both' ? ['spot', 'futures'] : [dataSourceMode];
}

export function getTradeSourcesForAggregateMarketSource(
  aggregateBubbleMarketSource: AggregateBubbleMarketSource,
  contractType: TradeSource,
  dataSourceMode: TradeSource | 'both',
) {
  if (aggregateBubbleMarketSource === 'active') {
    return getTradeSourcesForDataSourceMode(dataSourceMode || contractType);
  }

  return aggregateBubbleMarketSource === 'both'
    ? ['spot', 'futures'] as TradeSource[]
    : [aggregateBubbleMarketSource];
}

export function needsAggregateEventsForVolumeBars(panel: PanelState) {
  return panel.volumeBarsEnabled && panel.volumeBarsInputData !== 'volume';
}

export function needsAggregateEvents(panel: PanelState) {
  return (
    panel.bubblesEnabled ||
    needsAggregateEventsForVolumeBars(panel)
  );
}

export function getTradeDedupeKey(trade: Trade, source: TradeSource) {
  if (Number.isFinite(trade.id)) return `${source}:${trade.id}`;
  return `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker}`;
}

export function getAggregateTradeCount(trade: Trade) {
  const firstTradeId = Number(trade.firstTradeId);
  const lastTradeId = Number(trade.lastTradeId);

  if (!Number.isFinite(firstTradeId) || !Number.isFinite(lastTradeId) || lastTradeId < firstTradeId) {
    return undefined;
  }

  return Math.floor(lastTradeId - firstTradeId + 1);
}

export function createAggregateBubbleEvent(trade: Trade, source: TradeSource, symbol: string): BubbleEvent | null {
  if (!Number.isFinite(trade.time) || !Number.isFinite(trade.price) || !Number.isFinite(trade.quantity)) {
    return null;
  }

  const tradeCount = getAggregateTradeCount(trade);
  return {
    time: trade.time,
    price: trade.price,
    side: trade.isBuyerMaker ? 'sell' : 'buy',
    volume: trade.quantity,
    ...(tradeCount === undefined ? {} : { tradeCount }),
    source: 'aggregateTrade',
    symbol,
    contractType: source,
    ...(Number.isFinite(trade.id) ? { aggregateTradeId: trade.id } : {}),
    ...(Number.isFinite(trade.firstTradeId) ? { firstTradeId: trade.firstTradeId } : {}),
    ...(Number.isFinite(trade.lastTradeId) ? { lastTradeId: trade.lastTradeId } : {}),
    origin: 'live',
  };
}

export function getTimeframeSeconds(timeframe: string) {
  if (timeframe.endsWith('m')) return parseInt(timeframe, 10) * 60;
  if (timeframe.endsWith('h')) return parseInt(timeframe, 10) * 3600;
  if (timeframe.endsWith('d')) return parseInt(timeframe, 10) * 86400;
  return 60;
}

export function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export function rememberBounded(set: Set<string>, key: string) {
  set.add(key);

  while (set.size > MAX_DEDUPE_KEYS) {
    const oldest = set.values().next().value;
    if (oldest === undefined) break;
    set.delete(oldest);
  }
}

export function claimRawTradeStorage(symbol: string, trade: Trade) {
  if (!Number.isFinite(trade.id)) return false;

  const key = `${symbol}:${trade.id}`;
  if (queuedRawTradeStorageKeys.has(key)) return false;

  rememberBounded(queuedRawTradeStorageKeys, key);
  return true;
}

export function claimClosedCandleStorage(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  bucketSize: number,
) {
  const key = `${symbol}:${contractType}:${dataSourceMode}:${timeframe}:${candleTime}:${bucketSize}`;
  if (closedCandleStorageKeys.has(key)) return false;

  rememberBounded(closedCandleStorageKeys, key);
  return true;
}

export function claimFineProfileStorage(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  baseBucketSize: number,
  bucketPrice: number,
) {
  const key = `${symbol}:${contractType}:${dataSourceMode}:${timeframe}:${candleTime}:${baseBucketSize}:${bucketPrice}`;
  if (queuedFineProfileCandleKeys.has(key)) return false;

  rememberBounded(queuedFineProfileCandleKeys, key);
  return true;
}

export function cloneFineProfileRows(rows: Iterable<FineProfileRow>) {
  return Array.from(rows, (row) => ({ ...row }));
}

export function mergeHistoryCandles(existing: Candle[], incoming: Candle[]) {
  const byTime = new Map<number, Candle>();

  for (const candle of existing) {
    byTime.set(candle.time, candle);
  }

  for (const candle of incoming) {
    const current = byTime.get(candle.time);
    if (current?.isClosed && !candle.isClosed) continue;
    byTime.set(candle.time, candle);
  }

  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-500);
}

export function getHistoryWindow(candles: Candle[], timeframeSeconds: number) {
  if (candles.length === 0) return null;

  const startSeconds = candles[0].time;
  const inferredSeconds = candles.length >= 2
    ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
    : timeframeSeconds;
  const endSeconds = candles[candles.length - 1].time + inferredSeconds;

  return {
    startSeconds,
    endSeconds,
    startMs: startSeconds * 1000,
    endMs: endSeconds * 1000,
  };
}

export function getBaseFootprintWindow(candles: Candle[], timeframeSeconds: number) {
  const window = getHistoryWindow(candles, timeframeSeconds);
  if (!window) return null;

  const startSeconds = Math.floor(window.startSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS;
  const endSeconds = Math.ceil(window.endSeconds / BASE_FOOTPRINT_TIMEFRAME_SECONDS) * BASE_FOOTPRINT_TIMEFRAME_SECONDS;

  return {
    startSeconds,
    endSeconds,
    startMs: startSeconds * 1000,
    endMs: endSeconds * 1000,
  };
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function inferCandleSpanSeconds(candles: Candle[], index: number, fallbackSeconds: number) {
  const current = candles[index]?.time;
  const next = candles[index + 1]?.time;
  if (Number.isFinite(current) && Number.isFinite(next) && next > current) {
    return next - current;
  }

  const previous = candles[index - 1]?.time;
  if (Number.isFinite(current) && Number.isFinite(previous) && current > previous) {
    return current - previous;
  }

  return Math.max(BASE_FOOTPRINT_TIMEFRAME_SECONDS, fallbackSeconds);
}

export function alignFootprintRange(startSeconds: number, endSeconds: number): FootprintRestoreRange {
  return {
    startSeconds: Math.floor(startSeconds / FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS) * FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS,
    endSeconds: Math.ceil(endSeconds / FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS) * FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS,
  };
}

export function getFootprintRestorePlan(
  candles: Candle[],
  panel: PanelState,
  timeframeSeconds: number,
) {
  const historyRange = getBaseFootprintWindow(candles, timeframeSeconds);
  if (!historyRange || candles.length === 0) return null;

  const safeBarWidth = Math.max(1, Number.isFinite(panel.barWidth) ? panel.barWidth : 12);
  const safeScrollOffset = Math.max(0, Number.isFinite(panel.scrollOffset) ? panel.scrollOffset : 0);
  const approximateVisibleBars = clampNumber(
    Math.ceil(FOOTPRINT_RESTORE_ASSUMED_DRAWABLE_WIDTH_PX / safeBarWidth),
    FOOTPRINT_RESTORE_MIN_VISIBLE_BARS,
    FOOTPRINT_RESTORE_MAX_VISIBLE_BARS,
  );
  const rawLastVisibleIndex = candles.length - 1 - Math.floor(safeScrollOffset / safeBarWidth);
  const lastVisibleIndex = clampNumber(rawLastVisibleIndex, 0, candles.length - 1);
  const firstIndex = clampNumber(
    lastVisibleIndex - approximateVisibleBars - FOOTPRINT_RESTORE_BUFFER_BARS,
    0,
    lastVisibleIndex,
  );
  const lastIndex = clampNumber(
    lastVisibleIndex + FOOTPRINT_RESTORE_BUFFER_BARS,
    firstIndex,
    candles.length - 1,
  );
  const requestedRange = alignFootprintRange(
    candles[firstIndex].time,
    candles[lastIndex].time + inferCandleSpanSeconds(candles, lastIndex, timeframeSeconds),
  );

  return {
    historyRange: {
      startSeconds: historyRange.startSeconds,
      endSeconds: historyRange.endSeconds,
    },
    requestedRange,
    clampedRange: requestedRange,
    requestedVisibleBars: lastIndex - firstIndex + 1,
    approximateVisibleBars,
    skippedBecauseRangeTooLarge: false,
  };
}

export function getFootprintRestoreChunks(range: FootprintRestoreRange) {
  const chunks: FootprintRestoreRange[] = [];
  let cursor = range.startSeconds;

  while (cursor < range.endSeconds) {
    const next = Math.min(range.endSeconds, cursor + FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS);
    chunks.push({ startSeconds: cursor, endSeconds: next });
    cursor = next;
  }

  return chunks;
}

export function getBaseCandleTimeForTrade(tradeTimeMs: number) {
  return getCandleTimeForTrade(tradeTimeMs, BASE_FOOTPRINT_TIMEFRAME_SECONDS);
}

export function getFootprintCoverage(candles: Candle[], engine: AggregationEngine) {
  let footprintCandles = 0;
  let footprintCandlesWithCells = 0;

  for (const candle of candles) {
    const footprint = engine.getFootprintCandle(candle.time);
    if (!footprint) continue;

    footprintCandles += 1;
    if (footprint.cells.size > 0) {
      footprintCandlesWithCells += 1;
    }
  }

  return { footprintCandles, footprintCandlesWithCells };
}

export function formatSeconds(seconds: number | null) {
  return seconds == null ? 'n/a' : new Date(seconds * 1000).toISOString();
}

export function formatMilliseconds(milliseconds: number | null) {
  return milliseconds == null ? 'n/a' : new Date(milliseconds).toISOString();
}

export function alignFineProfileRange(startSeconds: number, endSeconds: number) {
  return {
    startSeconds: Math.floor(startSeconds / FINE_PROFILE_RESTORE_CHUNK_SECONDS) * FINE_PROFILE_RESTORE_CHUNK_SECONDS,
    endSeconds: Math.ceil(endSeconds / FINE_PROFILE_RESTORE_CHUNK_SECONDS) * FINE_PROFILE_RESTORE_CHUNK_SECONDS,
  };
}

export function getFineProfileRestoreChunks(ranges: Array<{ startSeconds: number; endSeconds: number }>) {
  const chunksMap = new Map<number, { startSeconds: number; endSeconds: number }>();

  for (const range of ranges) {
    const aligned = alignFineProfileRange(range.startSeconds, range.endSeconds);
    for (
      let chunkStart = aligned.startSeconds;
      chunkStart < aligned.endSeconds;
      chunkStart += FINE_PROFILE_RESTORE_CHUNK_SECONDS
    ) {
      if (!chunksMap.has(chunkStart)) {
        chunksMap.set(chunkStart, {
          startSeconds: chunkStart,
          endSeconds: Math.min(aligned.endSeconds, chunkStart + FINE_PROFILE_RESTORE_CHUNK_SECONDS),
        });
      } else {
        const existing = chunksMap.get(chunkStart)!;
        existing.endSeconds = Math.max(existing.endSeconds, Math.min(aligned.endSeconds, chunkStart + FINE_PROFILE_RESTORE_CHUNK_SECONDS));
      }
    }
  }

  return Array.from(chunksMap.values()).sort((a, b) => a.startSeconds - b.startSeconds);
}

export function getAggregateBubbleEventKey(event: BubbleEvent) {
  if (Number.isFinite(event.aggregateTradeId)) {
    return `${event.symbol}:${event.contractType}:id:${event.aggregateTradeId}`;
  }

  return `${event.symbol}:${event.contractType}:${event.time}:${event.price}:${event.volume}:${event.side}`;
}

export function getAggregateBubbleRestoreRange(candles: Candle[], timeframeSeconds: number) {
  const window = getHistoryWindow(candles, timeframeSeconds);
  if (!window) return null;

  const restoreEndSeconds = window.endSeconds;
  const restoreStartSeconds = Math.max(window.startSeconds, restoreEndSeconds - AGGREGATE_BUBBLE_RESTORE_SECONDS);

  return {
    startTime: restoreStartSeconds * 1000,
    endTime: restoreEndSeconds * 1000,
  };
}

export function parseAggregateBubbleThresholds(response: Response): AggregateBubbleStorageThresholds | null {
  const minVolume = Number(response.headers.get('x-aggregate-bubble-min-volume'));
  const minTradeCount = Number(response.headers.get('x-aggregate-bubble-min-trade-count'));
  const minTradeCountVolume = Number(response.headers.get('x-aggregate-bubble-min-trade-count-volume'));

  if (!Number.isFinite(minVolume) || !Number.isFinite(minTradeCount) || !Number.isFinite(minTradeCountVolume)) {
    return null;
  }

  return { minVolume, minTradeCount, minTradeCountVolume };
}

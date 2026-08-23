import { useEffect, useRef, useState, useMemo } from 'react';
import { AggregationEngine } from '../../../lib/aggregation/engine';
import { RawTradeVolumeProfileEngine } from '../../../lib/volumeProfile/profileEngine';
import { OrderbookManager } from '../../../lib/liquidity/orderbook';
import { LiquidityHistoryManager } from '../../../lib/liquidity/history';
import { AggregationWorkerClient } from '../../../lib/worker/aggregationWorkerClient';
import type { Trade } from '../../../types/trade';
import type { TradeSource } from '../../../types/feed';
import type { FineProfileRow } from '../../../types/volumeProfile';
import type { BubbleEvent } from '../../../types/bubble';

/**
 * Extracts component-level engine refs, queues, and small sync useEffects
 * from FeedProvider. These are the refs declared at lines 162-194 of the
 * original FeedProvider and the small useEffects that keep them in sync
 * (bucketSize sync, liquidityBucketSize sync, liquidityHistoryDepth sync).
 */
export function useFeedAggregation(
  bucketSize: number,
  liquidityBucketSize: number,
  liquidityHistoryDepth: number,
) {
  // --- Engine refs ---
  const connectedRef = useRef(false);
  const bucketSizeRef = useRef(bucketSize);
  const engineRef = useRef<AggregationEngine>(new AggregationEngine(bucketSize));
  const aggregationWorkerClient = useMemo(() => new AggregationWorkerClient(), []);
  const volumeProfileEngineRef = useRef(new RawTradeVolumeProfileEngine());
  const pendingFootprintRedrawRef = useRef(false);
  const pendingProfileRedrawRef = useRef(false);
  const pendingAggregateBubbleEventsRef = useRef<BubbleEvent[]>([]);
  const rawTradeQueueRef = useRef<Trade[]>([]);
  const workerTradeQueueRef = useRef<{ trade: Trade, currentCandleTime: number }[]>([]);
  const fineProfileQueueRef = useRef<FineProfileRow[]>([]);
  const liveFineProfileRowsRef = useRef<Map<number, Map<number, FineProfileRow>>>(new Map());
  const contractPriceRef = useRef<number | null>(null);
  const processedTradeIdsRef = useRef<Set<string>>(new Set());
  const firstFullyCoveredCandleTimeRef = useRef<Record<TradeSource, number | null>>({ spot: null, futures: null });
  const latestTradeBaseCandleTimeRef = useRef<Record<TradeSource, number | null>>({ spot: null, futures: null });
  const lastProfileRevisionAtRef = useRef(0);
  const [volumeProfileRevision, setVolumeProfileRevision] = useState(0);

  // --- Orderbook / liquidity refs ---
  const orderbookRef = useRef<OrderbookManager>(new OrderbookManager());
  const pendingAggregationRef = useRef(false);
  const liquidityHistoryRef = useRef<LiquidityHistoryManager>(new LiquidityHistoryManager(liquidityBucketSize, liquidityHistoryDepth));
  const bubblesEnabledRef = useRef(false);
  const bubbleSourceRef = useRef<string>('aggregateTrades');
  const aggregateEventsNeededRef = useRef(false);
  const footprintIngestionSkippedRef = useRef(0);
  const icebergDisabledNoopSkippedRef = useRef(0);

  // --- Small sync useEffects ---
  useEffect(() => {
    bucketSizeRef.current = bucketSize;
  }, [bucketSize]);

  useEffect(() => {
    liquidityHistoryRef.current.setBucketSize(liquidityBucketSize);
  }, [liquidityBucketSize]);

  useEffect(() => {
    liquidityHistoryRef.current.setMaxSnapshots(liquidityHistoryDepth);
  }, [liquidityHistoryDepth]);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      aggregationWorkerClient.terminate();
    };
  }, [aggregationWorkerClient]);

  return {
    connectedRef,
    bucketSizeRef,
    engineRef,
    volumeProfileEngineRef,
    pendingFootprintRedrawRef,
    pendingProfileRedrawRef,
    pendingAggregateBubbleEventsRef,
    rawTradeQueueRef,
    workerTradeQueueRef,
    fineProfileQueueRef,
    liveFineProfileRowsRef,
    contractPriceRef,
    processedTradeIdsRef,
    firstFullyCoveredCandleTimeRef,
    latestTradeBaseCandleTimeRef,
    lastProfileRevisionAtRef,
    volumeProfileRevision,
    setVolumeProfileRevision,
    orderbookRef,
    pendingAggregationRef,
    liquidityHistoryRef,
    bubblesEnabledRef,
    bubbleSourceRef,
    aggregateEventsNeededRef,
    footprintIngestionSkippedRef,
    icebergDisabledNoopSkippedRef,
    aggregationWorkerClient,
  };
}

export type BubbleSource = 'footprintCells' | 'aggregateTrades';
export type BubbleSizeBy = 'volume' | 'orders';
export type AggregateBubbleMarketSource = 'active' | 'spot' | 'futures' | 'both';
export type BubbleEventSide = 'buy' | 'sell';
export type BubbleEventContractType = 'spot' | 'futures';

export interface BubbleEvent {
  time: number;
  price: number;
  side: BubbleEventSide;
  volume: number;
  tradeCount?: number;
  source: 'aggregateTrade';
  symbol: string;
  contractType: BubbleEventContractType;
  aggregateTradeId?: number;
  firstTradeId?: number;
  lastTradeId?: number;
  origin?: 'live' | 'restored';
}

import type { AggregationEngine } from '@/lib/aggregation/engine';

export type BubbleSide = 'both' | 'buy' | 'sell';
export type BubbleScaleMode = 'linear' | 'sqrt' | 'log';

export interface BubbleSettings {
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

export interface AggregateBubbleDebugContext {
  panelId: string;
  bubbleSource: BubbleSource;
  bufferSize: number;
  maxBufferSize: number;
  activeChartContractType: BubbleEventContractType;
  activeDataSourceMode: BubbleEventContractType | 'both';
  engine: AggregationEngine;
  bucketSize: number;
}

export type SourceCountMap = Record<BubbleEventContractType, number>;

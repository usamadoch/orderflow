export type BubbleSource = 'aggregateTrades';
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
export type BubbleColorMode = 'askBidSplit' | 'delta' | 'volume';
export type BubbleVolumeColorMode = 'deltaAbsolute' | 'deltaPercentual';
export type BubbleDisplayMode = '2d' | '3d';

export interface BubbleSettings {
  bubbleSizeBy?: BubbleSizeBy;
  aggregateBubbleMarketSource?: AggregateBubbleMarketSource;
  activeChartContractType?: BubbleEventContractType;
  activeDataSourceMode?: BubbleEventContractType | 'both';
  bubbleThreshold: number;
  bubbleThresholdMode?: 'absolute' | 'relative';
  bubbleMinOrders?: number;
  bubbleFilterRender: number;
  bubbleStdDevVal: number;
  bubbleOutStdDevPerc: number;
  bubbleSide: BubbleSide;
  bubbleScaleMode?: BubbleScaleMode;
  bubbleColorMode?: BubbleColorMode;
  bubbleVolumeColorMode?: BubbleVolumeColorMode;
  bubbleDisplayMode?: BubbleDisplayMode;
  bubbleBidColor?: string;
  bubbleAskColor?: string;
  bubbleLineWidth?: number;
  bubbleOpacity?: number;
}

export interface AggregateBubbleDebugContext {
  panelId: string;
  bufferSize: number;
  maxBufferSize: number;
  activeChartContractType: BubbleEventContractType;
  activeDataSourceMode: BubbleEventContractType | 'both';
  engine: AggregationEngine;
  bucketSize: number;
}

export type SourceCountMap = Record<BubbleEventContractType, number>;

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

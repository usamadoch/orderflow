export type FootprintMode = 'bid-ask' | 'delta';

export interface FootprintCell {
  askVol: number;    // volume hitting the ask (buyers aggressive)
  bidVol: number;    // volume hitting the bid (sellers aggressive)
  // TODO: Orders-based bubbles need tradeCount/orderCount here plus live aggregation, storage, restore API, and schema support.
}

export interface FootprintCandle {
  time:       number;                         // unix seconds, matches Candle.time
  open:       number;
  high:       number;
  low:        number;
  close:      number;
  volume:     number;
  delta:      number;                         // askVol total − bidVol total
  cells:      Map<number, FootprintCell>;     // key = bucket price (normalized)
  isClosed:   boolean;
}

export interface CandleVisualStats {
  maxVol: number;
  maxDelta: number;
  avgVol: number;
  avgDelta: number;
  volumeScale: number;
  deltaScale: number;
}

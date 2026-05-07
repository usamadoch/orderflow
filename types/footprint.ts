export interface FootprintCell {
  askVol: number;    // volume hitting the ask (buyers aggressive)
  bidVol: number;    // volume hitting the bid (sellers aggressive)
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

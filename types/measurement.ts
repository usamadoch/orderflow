export interface MeasurementMetrics {
  // Price
  startPrice:       number
  endPrice:         number
  priceDiff:        number      // endPrice - startPrice (signed)
  pricePercent:     number      // (priceDiff / startPrice) * 100 (signed)
  ticks:            number      // abs(priceDiff) / 0.01

  // Time
  startIndex:       number      // candle array index (earlier of the two)
  endIndex:         number      // candle array index (later of the two)
  candleCount:      number      // abs(endIndex - startIndex) + 1
  elapsedSeconds:   number      // candleCount * timeframeSeconds
  elapsedLabel:     string      // human readable e.g. "14m", "1h 15m"

  // Direction
  isPositive:       boolean     // endPrice > startPrice
}
export interface FootprintMeasurementMetrics {
  totalVolume:  number
  totalDelta:   number
  totalBuyVol:  number
  totalSellVol: number
  buySellRatio: number
  isPartial:    boolean   // true if some candles in range had no footprint data
}

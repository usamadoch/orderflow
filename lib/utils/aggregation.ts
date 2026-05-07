export function normalizePriceToBucket(price: number, bucketSize: number): number {
  return Math.floor(price / bucketSize) * bucketSize;
}

export function getCandleTimeForTrade(tradeTimeMs: number, timeframeSeconds: number): number {
  return Math.floor((tradeTimeMs / 1000) / timeframeSeconds) * timeframeSeconds;
}

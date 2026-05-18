import { LiquidityBehavior } from '../../types/liquidity';

export function getLiquidityBehavior(priceHistory: number[]): LiquidityBehavior {
  let peakQty = 0;
  let firstSeen = -1;
  let lastSeen = -1;
  let appearances = 0;
  
  for (let i = 0; i < priceHistory.length; i++) {
    const qty = priceHistory[i];
    if (qty > 0) {
      if (firstSeen === -1) firstSeen = i;
      lastSeen = i;
      appearances++;
      if (qty > peakQty) peakQty = qty;
    }
  }

  const currentQty = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : 0;
  
  // Approximate classification: if it disappears after being present, we mark it pulled by default.
  // Real consumed/pulled requires candle High/Low context.
  let wasPulled = false;
  const wasConsumed = false;
  
  if (appearances > 0 && currentQty === 0 && priceHistory.length >= 2) {
      // It disappeared.
      // We will refine this in later versions with actual candle range checks.
      wasPulled = true; 
  }
  
  let ageScore = 0;
  if (firstSeen !== -1 && priceHistory.length > 0) {
      // 1 = oldest visible (firstSeen = 0), 0 = newest (firstSeen = length - 1)
      ageScore = 1 - (firstSeen / priceHistory.length);
  }

  return {
    peakQty,
    currentQty,
    firstSeen,
    lastSeen,
    appearances,
    wasPulled,
    wasConsumed,
    ageScore
  };
}

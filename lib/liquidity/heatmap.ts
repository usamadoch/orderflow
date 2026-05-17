import { LiquidityHistoryManager } from './history';
import { getLiquidityBehavior } from './analysis';
import { HeatmapRow, LiquidityBehavior } from '../../types/liquidity';

export function buildHeatmapRows(
  liquidityHistory: LiquidityHistoryManager,
  visiblePriceMin: number,
  visiblePriceMax: number,
  bucketSize: number,
  currentPrice: number
): HeatmapRow[] {
  const rows: HeatmapRow[] = [];
  
  // Cap computation to 300 levels (150 above, 150 below current price)
  // to avoid performance issues when zoomed extremely far out
  const maxLevels = 300;
  const halfLevels = Math.floor(maxLevels / 2);
  const currentBucket = Math.floor(currentPrice / bucketSize) * bucketSize;
  
  const absoluteMinBucket = currentBucket - (halfLevels * bucketSize);
  const absoluteMaxBucket = currentBucket + ((halfLevels - 1) * bucketSize);

  const minBucket = Math.max(absoluteMinBucket, Math.floor(visiblePriceMin / bucketSize) * bucketSize);
  const maxBucket = Math.min(absoluteMaxBucket, Math.ceil(visiblePriceMax / bucketSize) * bucketSize);

  let maxPeakQty = 0;
  const rawRows: { price: number; side: 'bid' | 'ask' | 'both'; peakQty: number; currentQty: number; ageScore: number; behavior: LiquidityBehavior }[] = [];

  const historyLen = liquidityHistory.getHistory().length;
  if (historyLen === 0) return [];

  for (let price = minBucket; price <= maxBucket; price += bucketSize) {
    const centerPrice = price + bucketSize / 2;
    
    const bidHistory = liquidityHistory.getPriceHistory(centerPrice, 'bid');
    const askHistory = liquidityHistory.getPriceHistory(centerPrice, 'ask');
    
    const bidBehavior = getLiquidityBehavior(bidHistory);
    const askBehavior = getLiquidityBehavior(askHistory);
    
    if (bidBehavior.peakQty === 0 && askBehavior.peakQty === 0) {
      continue;
    }
    
    let side: 'bid' | 'ask' | 'both' = 'both';
    let peakQty = 0;
    let currentQty = 0;
    let behavior: LiquidityBehavior;
    
    if (bidBehavior.peakQty > 0 && askBehavior.peakQty > 0) {
        side = 'both';
        peakQty = bidBehavior.peakQty + askBehavior.peakQty;
        currentQty = bidBehavior.currentQty + askBehavior.currentQty;
        
        const firstSeen = Math.min(
            bidBehavior.firstSeen === -1 ? Infinity : bidBehavior.firstSeen, 
            askBehavior.firstSeen === -1 ? Infinity : askBehavior.firstSeen
        );
        
        behavior = {
            ...bidBehavior,
            peakQty,
            currentQty,
            firstSeen: firstSeen === Infinity ? -1 : firstSeen,
            lastSeen: Math.max(bidBehavior.lastSeen, askBehavior.lastSeen),
            appearances: Math.max(bidBehavior.appearances, askBehavior.appearances),
            wasPulled: bidBehavior.wasPulled || askBehavior.wasPulled,
            wasConsumed: bidBehavior.wasConsumed || askBehavior.wasConsumed,
            ageScore: Math.max(bidBehavior.ageScore, askBehavior.ageScore)
        };
    } else if (bidBehavior.peakQty > 0) {
        side = 'bid';
        peakQty = bidBehavior.peakQty;
        currentQty = bidBehavior.currentQty;
        behavior = bidBehavior;
    } else {
        side = 'ask';
        peakQty = askBehavior.peakQty;
        currentQty = askBehavior.currentQty;
        behavior = askBehavior;
    }

    if (peakQty > maxPeakQty) {
      maxPeakQty = peakQty;
    }

    let ageScore = behavior.ageScore;
    if (currentQty === 0 && behavior.lastSeen !== -1) {
        const snapshotsSinceLastSeen = (historyLen - 1) - behavior.lastSeen;
        const decay = snapshotsSinceLastSeen / historyLen;
        ageScore = Math.min(1, ageScore + decay);
    }
    behavior.ageScore = ageScore;

    rawRows.push({
      price: centerPrice,
      side,
      peakQty,
      currentQty,
      ageScore,
      behavior
    });
  }

  for (const row of rawRows) {
    const intensity = maxPeakQty > 0 ? Math.sqrt(row.peakQty / maxPeakQty) : 0;
    rows.push({
      ...row,
      intensity
    });
  }

  return rows;
}

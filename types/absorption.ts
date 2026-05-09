export type AbsorptionDirection = 'buyer' | 'seller';
export type AbsorptionRank = 'minor' | 'strong' | 'extreme';

export interface AbsorptionResult {
  candleTime:  number;
  score:       number;
  rank:        AbsorptionRank;        // minor: 40–60, strong: 60–80, extreme: 80–100
  direction:   AbsorptionDirection;
  provisional: boolean;               // true for live (unclosed) candle
  reasons:     string[];              // human-readable explanations for tooltip
  signals: {
    deltaExtremity:       number;     // pts contributed (max 25)
    volumeExtremity:      number;     // pts contributed (max 15)
    poorProgression:      number;     // pts contributed (max 30)
    imbalanceCluster:     number;     // pts contributed (max 20) — future
    repeatedDefense:      number;     // pts contributed (max 10) — future
  };
}

export type ExhaustionDirection = 'buyer' | 'seller';
export type ExhaustionRank = 'weak' | 'moderate' | 'strong' | 'extreme';

export interface ExhaustionResult {
  candleTime:   number;
  score:        number;                  // 0–100
  rank:         ExhaustionRank;          // weak: 30–50, moderate: 50–65, strong: 65–80, extreme: 80–100
  direction:    ExhaustionDirection;
  provisional:  boolean;                 // true if candle is still open
  reasons:      string[];
  signals: {
    momentumDecay:       number;         // pts from delta weakening across recent candles
    weakContinuation:    number;         // pts from large delta but small price move
    wickRejection:       number;         // pts from wick near the exhaustion extreme
    rangeShrink:         number;         // pts from shrinking candle bodies during aggression
    imbalanceNoExtension: number;        // pts from imbalances not leading to continuation
  };
}

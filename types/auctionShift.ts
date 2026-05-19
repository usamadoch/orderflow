export type AuctionShiftState =
  | 'balanced'
  | 'initiative_buying'
  | 'initiative_selling'
  | 'absorption_reversal'
  | 'exhaustion_transition';

export type AuctionShiftDirection = 'buying' | 'selling' | 'neutral';

export interface AuctionShiftComponentScores {
  balance: number;
  initiative: number;
  absorption: number;
  exhaustion: number;
  volumeExpansion: number;
  acceptance: number;
  followThrough: number;
}

export interface AuctionShiftResult {
  candleTime: number;
  state: AuctionShiftState;
  priorState: AuctionShiftState | null;
  direction: AuctionShiftDirection;
  confidence: number;
  provisional: boolean;
  transition: boolean;
  reasons: string[];
  signals: AuctionShiftComponentScores;
}

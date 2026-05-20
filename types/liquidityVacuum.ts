export type LiquidityVacuumDirection = 'up' | 'down';
export type LiquidityVacuumRank = 'weak' | 'probable' | 'strong';

export interface LiquidityVacuumAnchor {
  index: number;
  candleTime: number;
  priceLow: number;
  priceHigh: number;
  volume: number;
  delta: number;
}

export interface LiquidityVacuumZone {
  id: string;
  direction: LiquidityVacuumDirection;
  rank: LiquidityVacuumRank;
  score: number;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  priceLow: number;
  priceHigh: number;
  anchorBefore: LiquidityVacuumAnchor;
  anchorAfter: LiquidityVacuumAnchor;
  speedRatio: number;
  participationRatio: number;
  thinProfileRatio: number;
  deltaImbalanceRatio: number;
  reasons: string[];
  signals: {
    fastMovement: number;
    lowParticipation: number;
    thinStructure: number;
    deltaImbalance: number;
    activeAnchors: number;
  };
  detectedAt: number;
  provisional: boolean;
  isActive: boolean;
  revisited: boolean;
}

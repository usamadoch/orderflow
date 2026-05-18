export type IcebergSide = 'bid_defense' | 'ask_defense';
export type IcebergRank = 'suspected' | 'probable' | 'confirmed';

export interface IcebergLevel {
  price: number;
  side: IcebergSide;
  score: number;
  rank: IcebergRank;
  provisional: boolean;
  totalVolume: number;
  candleCount: number;
  avgVolumePerCandle: number;
  cumulativeDelta: number;
  windowStartIndex: number;
  windowEndIndex: number;
  reasons: string[];
  signals: {
    volumeAccumulation: number;
    sideConsistency: number;
    pricePersistence: number;
    deltaNeutralization: number;
    volumeStability: number;
  };
  detectedAt: number;
  isActive: boolean;
}

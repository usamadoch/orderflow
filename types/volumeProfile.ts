import { Candle } from './candle';
import { Trade } from './trade';

export interface VolumeProfileCacheKeyParts {
  symbol: string;
  contractType: string;
  dataSourceMode: string;
  baseBucketSize: number;
}

export interface VolumeProfileBuildRequest {
  candles: Candle[];
  profileBucketSize: number;
  priceHigh?: number;
  priceLow?: number;
  nodeSensitivity?: number;
  inputData?: 'volume' | 'orders' | 'aggregateTrades';
  filterMin?: number;
  filterMax?: number;
  debugContext?: {
    label: string;
    panelId?: string;
    selectedStartTime?: number;
    selectedEndTime?: number;
  };
}

export interface FineProfileRow {
  candleTime: number;
  baseBucketSize: number;
  bucketPrice: number;
  bidVol: number;
  askVol: number;
  totalVol: number;
  tradeCount: number;
  orderCount?: number;
}

export interface FineProfileRowSnapshot {
  row: FineProfileRow;
  origin: string;
}

export type FineRowInsertResult = 'inserted' | 'invalid-base-bucket' | 'invalid-price' | 'non-positive-volume';

export interface ProfileRow {
  price:    number;   // normalized bucket price (same bucketing as footprint)
  totalVol: number;   // bid + ask volume combined
  bidVol:   number;   // sell aggression volume
  askVol:   number;   // buy aggression volume
  hasFP:    boolean;  // true if at least one source candle had footprint data
}

export interface VolumeProfile {
  rows:     ProfileRow[];   // sorted low → high by price
  poc:      number;         // price of highest volume bucket
  vaHigh:   number;         // top of 70% value area
  vaLow:    number;         // bottom of 70% value area
  lvns:     number[];       // local low-volume node bucket prices
  hvns:     number[];       // local high-volume node bucket prices
  maxVol:   number;         // highest single row volume (for bar width scaling)
  maxAbsDelta: number;      // highest absolute delta (for delta bar scaling)
  totalVol: number;         // sum of all row volumes
  developingPoc?: { time: number; price: number }[]; // historical trail of POC
}

export interface VolumeProfileSource {
  ingestTrade(trade: Trade): void;
  hydrateTrades(trades: Trade[]): void;
  hydrateProfileRows(rows: FineProfileRow[], origin?: string): void;
  removeTradesInTimeRange(startMs: number, endMs: number): void;
  reset(): void;
  pruneBefore(timeMs: number): void;
  buildProfile(request: VolumeProfileBuildRequest): VolumeProfile | null;
}

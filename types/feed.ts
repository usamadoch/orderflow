export type ConnectionState = 'CONNECTING' | 'SYNCING' | 'LIVE' | 'RESYNCING' | 'DISCONNECTED';

export type TradeSource = 'spot' | 'futures';

export type FootprintWorkReason =
  | 'chart-mode-footprint'
  | 'footprint-cell-bubbles'
  | 'cvd'
  | 'absorption'
  | 'exhaustion'
  | 'iceberg'
  | 'liquidity-vacuum'
  | 'browser-market-writes';

export interface FootprintWorkNeed {
  needed: boolean;
  reasons: FootprintWorkReason[];
}

export interface RawTradeHydrationStats {
  pages: number;
  fetched: number;
  hydrated: number;
  oldestTime: number | null;
  newestTime: number | null;
  reachedStart: boolean;
  hydratedCandleTimes: Set<number>;
}

export interface FootprintHistoryRow {
  candleTime: number;
  bucketPrice: number;
  bidVol: number;
  askVol: number;
  delta?: number;
}

export interface FootprintRestoreRange {
  startSeconds: number;
  endSeconds: number;
}

export interface FootprintHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
  cellsHydrated: number;
  bucketMatches: number;
  bucketMisses: number;
  requestedRange: FootprintRestoreRange | null;
  clampedRange: FootprintRestoreRange | null;
  chunkCount: number;
  chunksFetched: number;
  chunksSkipped: number;
  rowsPerChunk: number[];
  skippedBecauseRangeTooLarge: boolean;
  restoreFailureReason: string | null;
}

export interface FineProfileHydrationStats {
  rowsFetched: number;
  candlesHydrated: number;
  chunksFetched?: number;
  chunksSkipped?: number;
}

export interface AggregateBubbleStorageThresholds {
  minVolume: number;
  minTradeCount: number;
  minTradeCountVolume: number;
}

export interface AggregateBubbleHydrationStats {
  rowsFetched: number;
  rowsHydrated: number;
  duplicateSkipped: number;
  spotCount: number;
  futuresCount: number;
  oldestTime: number | null;
  newestTime: number | null;
  range: {
    startTime: number;
    endTime: number;
  } | null;
  thresholds: AggregateBubbleStorageThresholds | null;
}

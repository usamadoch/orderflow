import { Trade } from '@/types/trade';
import { VolumeProfile, ProfileRow, findPOC, findValueArea, findLowVolumeNodes } from '@/lib/utils/volumeProfile';
import { normalizePriceToBucket } from '@/lib/utils/aggregation';
import { Candle } from '@/types/candle';

export interface VolumeProfileBuildRequest {
  candles: Candle[];
  profileBucketSize: number;
  priceHigh?: number;
  priceLow?: number;
}

export interface FineProfileRow {
  candleTime: number;
  baseBucketSize: number;
  bucketPrice: number;
  bidVol: number;
  askVol: number;
  totalVol: number;
  tradeCount: number;
}

export interface VolumeProfileSource {
  ingestTrade(trade: Trade): void;
  hydrateTrades(trades: Trade[]): void;
  hydrateProfileRows(rows: FineProfileRow[]): void;
  removeTradesInTimeRange(startMs: number, endMs: number): void;
  reset(): void;
  pruneBefore(timeMs: number): void;
  buildProfile(request: VolumeProfileBuildRequest): VolumeProfile | null;
}

const DEFAULT_MAX_TRADES = 50000;
const TRADE_PRUNE_BATCH = 5000;

/**
 * Panel-local implementation today, but intentionally hidden behind
 * VolumeProfileSource so a shared raw-trade cache can replace it later.
 */
export class RawTradeVolumeProfileEngine implements VolumeProfileSource {
  private trades: Trade[] = [];
  private seenKeys = new Set<string>();
  private fineRowsByCandle = new Map<number, Map<string, FineProfileRow>>();
  private maxTrades: number;
  private version = 0;
  private sorted = true;
  private cachedProfile: {
    key: string;
    profile: VolumeProfile | null;
  } | null = null;

  constructor(maxTrades: number = DEFAULT_MAX_TRADES) {
    this.maxTrades = maxTrades;
  }

  ingestTrade(trade: Trade) {
    this.addTrade(trade);
    this.enforceLimit();
  }

  hydrateTrades(trades: Trade[]) {
    for (const trade of trades) {
      this.addTrade(trade);
    }
    this.trades.sort((a, b) => a.time - b.time);
    this.sorted = true;
    this.enforceLimit();
  }

  hydrateProfileRows(rows: FineProfileRow[]) {
    if (rows.length === 0) return;

    for (const row of rows) {
      this.setFineRow(row);
    }

    this.version += 1;
    this.cachedProfile = null;
  }

  removeTradesInTimeRange(startMs: number, endMs: number) {
    if (endMs <= startMs || this.trades.length === 0) return;

    const beforeTradeCount = this.trades.length;
    this.trades = this.trades.filter((trade) => trade.time < startMs || trade.time >= endMs);

    if (this.trades.length !== beforeTradeCount) {
      this.rebuildSeenKeys();
      this.version += 1;
      this.cachedProfile = null;
    }
  }

  reset() {
    this.trades = [];
    this.seenKeys.clear();
    this.fineRowsByCandle.clear();
    this.version += 1;
    this.sorted = true;
    this.cachedProfile = null;
  }

  pruneBefore(timeMs: number) {
    const beforeTradeCount = this.trades.length;
    const beforeRowCount = this.fineRowsByCandle.size;

    this.trades = this.trades.filter((trade) => trade.time >= timeMs);
    this.pruneRowsBefore(Math.floor(timeMs / 1000));

    if (this.trades.length !== beforeTradeCount) {
      this.rebuildSeenKeys();
    }

    if (this.trades.length !== beforeTradeCount || this.fineRowsByCandle.size !== beforeRowCount) {
      this.version += 1;
      this.cachedProfile = null;
    }
  }

  buildProfile({ candles, profileBucketSize, priceHigh, priceLow }: VolumeProfileBuildRequest) {
    if (candles.length === 0 || profileBucketSize <= 0) return null;

    this.ensureSorted();
    const { startMs, endMs } = getCandleTimeWindow(candles);
    const cacheKey = [
      this.version,
      startMs,
      endMs,
      profileBucketSize,
      priceHigh ?? '',
      priceLow ?? '',
    ].join(':');

    if (this.cachedProfile?.key === cacheKey) {
      return this.cachedProfile.profile;
    }

    const profile = this.buildProfileFromRowsAndTrades(candles, startMs, endMs, profileBucketSize, priceHigh, priceLow);
    this.cachedProfile = { key: cacheKey, profile };

    return profile;
  }

  private addTrade(trade: Trade) {
    const key = getTradeKey(trade);
    if (this.seenKeys.has(key)) return;

    const last = this.trades[this.trades.length - 1];
    if (last && trade.time < last.time) {
      this.sorted = false;
    }

    this.seenKeys.add(key);
    this.trades.push(trade);
    this.version += 1;
    this.cachedProfile = null;
  }

  private enforceLimit() {
    if (this.trades.length <= this.maxTrades + TRADE_PRUNE_BATCH) return;

    this.trades = this.trades.slice(this.trades.length - this.maxTrades);
    this.rebuildSeenKeys();
    this.version += 1;
    this.cachedProfile = null;
  }

  private setFineRow(row: FineProfileRow) {
    if (row.baseBucketSize <= 0 || row.totalVol <= 0) return;

    const candleRows = this.fineRowsByCandle.get(row.candleTime) ?? new Map<string, FineProfileRow>();
    candleRows.set(getFineRowKey(row), { ...row });
    this.fineRowsByCandle.set(row.candleTime, candleRows);
  }

  private pruneRowsBefore(timeSeconds: number) {
    for (const candleTime of this.fineRowsByCandle.keys()) {
      if (candleTime < timeSeconds) {
        this.fineRowsByCandle.delete(candleTime);
      }
    }
  }

  private buildProfileFromRowsAndTrades(
    candles: Candle[],
    startMs: number,
    endMs: number,
    profileBucketSize: number,
    priceHigh?: number,
    priceLow?: number,
  ) {
    const map = new Map<number, ProfileRow>();
    const candleTimes = new Set(candles.map((candle) => candle.time));
    const fineCoveredCandleTimes = new Set<number>();

    for (const candle of candles) {
      const candleRows = this.fineRowsByCandle.get(candle.time);
      if (!candleRows || candleRows.size === 0) continue;

      for (const row of candleRows.values()) {
        if (!isCompatibleProfileBucket(row.baseBucketSize, profileBucketSize)) continue;
        fineCoveredCandleTimes.add(candle.time);

        const price = normalizePriceToBucket(row.bucketPrice, profileBucketSize);
        if (priceHigh !== undefined && price > priceHigh) continue;
        if (priceLow !== undefined && price < priceLow) continue;

        const profileRow = getOrCreateProfileRow(map, price);
        profileRow.bidVol += row.bidVol;
        profileRow.askVol += row.askVol;
        profileRow.totalVol += row.totalVol;
      }
    }

    if (this.trades.length > 0) {
      const startIndex = lowerBoundTradeTime(this.trades, startMs);
      const endIndex = lowerBoundTradeTime(this.trades, endMs);

      for (const trade of this.trades.slice(startIndex, endIndex)) {
        const candleTime = getCandleTimeForTradeMs(trade.time, candles);
        if (!candleTimes.has(candleTime) || fineCoveredCandleTimes.has(candleTime)) continue;

        const price = normalizePriceToBucket(trade.price, profileBucketSize);
        if (priceHigh !== undefined && price > priceHigh) continue;
        if (priceLow !== undefined && price < priceLow) continue;

        const row = getOrCreateProfileRow(map, price);
        if (trade.isBuyerMaker) {
          row.bidVol += trade.quantity;
        } else {
          row.askVol += trade.quantity;
        }
        row.totalVol += trade.quantity;
      }
    }

    return buildVolumeProfileFromRowMap(map);
  }

  private ensureSorted() {
    if (this.sorted) return;

    this.trades.sort((a, b) => a.time - b.time);
    this.sorted = true;
    this.version += 1;
    this.cachedProfile = null;
  }

  private rebuildSeenKeys() {
    this.seenKeys.clear();
    for (const trade of this.trades) {
      this.seenKeys.add(getTradeKey(trade));
    }
  }
}

export function buildVolumeProfileFromTrades(
  trades: Trade[],
  profileBucketSize: number,
  priceHigh?: number,
  priceLow?: number,
): VolumeProfile | null {
  if (trades.length === 0 || profileBucketSize <= 0) return null;

  const map = new Map<number, ProfileRow>();

  for (const trade of trades) {
    const price = normalizePriceToBucket(trade.price, profileBucketSize);

    if (priceHigh !== undefined && price > priceHigh) continue;
    if (priceLow !== undefined && price < priceLow) continue;

    const row = getOrCreateProfileRow(map, price);

    if (trade.isBuyerMaker) {
      row.bidVol += trade.quantity;
    } else {
      row.askVol += trade.quantity;
    }
    row.totalVol += trade.quantity;
  }

  return buildVolumeProfileFromRowMap(map);
}

function buildVolumeProfileFromRowMap(map: Map<number, ProfileRow>): VolumeProfile | null {
  if (map.size === 0) return null;

  const rows = Array.from(map.values()).sort((a, b) => a.price - b.price);
  const totalVol = rows.reduce((sum, row) => sum + row.totalVol, 0);
  const maxVol = rows.reduce((max, row) => Math.max(max, row.totalVol), 0);
  const maxAbsDelta = rows.reduce((max, row) => Math.max(max, Math.abs(row.askVol - row.bidVol)), 0);
  const poc = findPOC(rows);
  const { vaHigh, vaLow } = findValueArea(rows, totalVol);
  const lvns = findLowVolumeNodes(rows);

  return {
    rows,
    totalVol,
    maxVol,
    maxAbsDelta,
    poc,
    vaHigh,
    vaLow,
    lvns,
  };
}

function getOrCreateProfileRow(map: Map<number, ProfileRow>, price: number) {
  let row = map.get(price);
  if (!row) {
    row = { price, totalVol: 0, bidVol: 0, askVol: 0, hasFP: true };
    map.set(price, row);
  }

  return row;
}

function getCandleTimeWindow(candles: Candle[]) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  const inferredSeconds = candles.length >= 2
    ? Math.max(1, last.time - candles[candles.length - 2].time)
    : 60;

  return {
    startMs: first.time * 1000,
    endMs: (last.time + inferredSeconds) * 1000,
  };
}

function getTradeKey(trade: Trade) {
  const source = (trade as Trade & { source?: string }).source ?? '';

  return trade.id == null
    ? `${source}:${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker ? 1 : 0}`
    : `${source}:id:${trade.id}`;
}

function getFineRowKey(row: FineProfileRow) {
  return `${row.baseBucketSize}:${row.bucketPrice}`;
}

function isCompatibleProfileBucket(baseBucketSize: number, profileBucketSize: number) {
  if (baseBucketSize <= 0 || profileBucketSize <= 0) return false;
  if (baseBucketSize > profileBucketSize) return false;

  const ratio = profileBucketSize / baseBucketSize;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

function getCandleTimeForTradeMs(tradeTimeMs: number, candles: Candle[]) {
  if (candles.length < 2) return candles[0]?.time ?? Math.floor(tradeTimeMs / 1000);

  const timeframeSeconds = Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time);
  return Math.floor((tradeTimeMs / 1000) / timeframeSeconds) * timeframeSeconds;
}

function lowerBoundTradeTime(trades: Trade[], timeMs: number) {
  let low = 0;
  let high = trades.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (trades[mid].time < timeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

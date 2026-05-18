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

export interface VolumeProfileSource {
  ingestTrade(trade: Trade): void;
  hydrateTrades(trades: Trade[]): void;
  reset(): void;
  pruneBefore(timeMs: number): void;
  buildProfile(request: VolumeProfileBuildRequest): VolumeProfile | null;
}

const DEFAULT_MAX_TRADES = 50000;

/**
 * Panel-local implementation today, but intentionally hidden behind
 * VolumeProfileSource so a shared raw-trade cache can replace it later.
 */
export class RawTradeVolumeProfileEngine implements VolumeProfileSource {
  private trades: Trade[] = [];
  private seenKeys = new Set<string>();
  private maxTrades: number;

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
    this.enforceLimit();
  }

  reset() {
    this.trades = [];
    this.seenKeys.clear();
  }

  pruneBefore(timeMs: number) {
    if (this.trades.length === 0) return;

    const kept = this.trades.filter((trade) => trade.time >= timeMs);
    if (kept.length === this.trades.length) return;

    this.trades = kept;
    this.rebuildSeenKeys();
  }

  buildProfile({ candles, profileBucketSize, priceHigh, priceLow }: VolumeProfileBuildRequest) {
    if (candles.length === 0 || profileBucketSize <= 0 || this.trades.length === 0) return null;

    const { startMs, endMs } = getCandleTimeWindow(candles);
    const windowTrades = this.trades.filter((trade) => trade.time >= startMs && trade.time < endMs);

    return buildVolumeProfileFromTrades(windowTrades, profileBucketSize, priceHigh, priceLow);
  }

  private addTrade(trade: Trade) {
    const key = getTradeKey(trade);
    if (this.seenKeys.has(key)) return;

    this.seenKeys.add(key);
    this.trades.push(trade);
  }

  private enforceLimit() {
    if (this.trades.length <= this.maxTrades) return;

    this.trades = this.trades.slice(this.trades.length - this.maxTrades);
    this.rebuildSeenKeys();
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

    let row = map.get(price);
    if (!row) {
      row = { price, totalVol: 0, bidVol: 0, askVol: 0, hasFP: true };
      map.set(price, row);
    }

    if (trade.isBuyerMaker) {
      row.bidVol += trade.quantity;
    } else {
      row.askVol += trade.quantity;
    }
    row.totalVol += trade.quantity;
  }

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
  return trade.id == null
    ? `${trade.time}:${trade.price}:${trade.quantity}:${trade.isBuyerMaker ? 1 : 0}`
    : `id:${trade.id}`;
}

/**
 * OrderbookManager — maintains a local in-memory orderbook from
 * Binance snapshot + incremental depth updates.
 */

export interface OrderbookSnapshot {
  lastUpdateId: number;
  bids: [string, string][]; // [price, qty]
  asks: [string, string][];
}

export interface DepthUpdate {
  e: string;       // event type
  E: number;       // event time
  s: string;       // symbol
  U: number;       // first update ID
  u: number;       // last update ID (use this as "updateId")
  b: [string, string][]; // bids
  a: [string, string][]; // asks
}

export class OrderbookManager {
  private bids: Map<number, number> = new Map(); // price -> qty
  private asks: Map<number, number> = new Map();
  private lastUpdateId: number = 0;
  private initialized: boolean = false;

  /**
   * Populate from REST snapshot.
   */
  initFromSnapshot(snapshot: OrderbookSnapshot): void {
    this.bids.clear();
    this.asks.clear();

    for (const [p, q] of snapshot.bids) {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      if (qty > 0) this.bids.set(price, qty);
    }

    for (const [p, q] of snapshot.asks) {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      if (qty > 0) this.asks.set(price, qty);
    }

    this.lastUpdateId = snapshot.lastUpdateId;
    this.initialized = true;
  }

  /**
   * Apply one incremental depth update.
   * Skips stale updates (u <= lastUpdateId from snapshot).
   */
  applyUpdate(update: DepthUpdate): void {
    if (!this.initialized) return;

    // Skip stale updates
    if (update.u <= this.lastUpdateId) return;

    for (const [p, q] of update.b) {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      if (qty === 0) {
        this.bids.delete(price);
      } else {
        this.bids.set(price, qty);
      }
    }

    for (const [p, q] of update.a) {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      if (qty === 0) {
        this.asks.delete(price);
      } else {
        this.asks.set(price, qty);
      }
    }

    this.lastUpdateId = update.u;
  }

  /**
   * Returns top N bids sorted descending by price.
   */
  getTopBids(n: number = 200): [number, number][] {
    const sorted = Array.from(this.bids.entries())
      .sort((a, b) => b[0] - a[0]);
    return sorted.slice(0, n);
  }

  /**
   * Returns top N asks sorted ascending by price.
   */
  getTopAsks(n: number = 200): [number, number][] {
    const sorted = Array.from(this.asks.entries())
      .sort((a, b) => a[0] - b[0]);
    return sorted.slice(0, n);
  }

  /**
   * Highest bid price.
   */
  getBestBid(): number | null {
    if (this.bids.size === 0) return null;
    let best = -Infinity;
    for (const price of this.bids.keys()) {
      if (price > best) best = price;
    }
    return best;
  }

  /**
   * Lowest ask price.
   */
  getBestAsk(): number | null {
    if (this.asks.size === 0) return null;
    let best = Infinity;
    for (const price of this.asks.keys()) {
      if (price < best) best = price;
    }
    return best;
  }

  /**
   * Mid price = (bestBid + bestAsk) / 2
   */
  getMidPrice(): number | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (bid === null || ask === null) return null;
    return (bid + ask) / 2;
  }

  /**
   * Full bids map (read-only access for aggregation).
   */
  getAllBids(): Map<number, number> {
    return this.bids;
  }

  /**
   * Full asks map (read-only access for aggregation).
   */
  getAllAsks(): Map<number, number> {
    return this.asks;
  }

  /**
   * Whether the orderbook has been initialized from a snapshot.
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.bids.clear();
    this.asks.clear();
    this.lastUpdateId = 0;
    this.initialized = false;
  }
}

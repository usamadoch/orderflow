/**
 * OrderbookManager — maintains a local in-memory orderbook from
 * Binance snapshot + incremental depth updates.
 *
 * Dual-mode sequence validation:
 *
 * BINANCE SPOT (@depth@100ms):
 *   1. Buffering incoming diffs before snapshot.
 *   2. Dropping updates where u <= snapshot.lastUpdateId.
 *   3. First bridging event: U <= lastUpdateId + 1 <= u.
 *   4. Subsequent updates: U === rollingU + 1.
 *
 * BINANCE USD-M FUTURES (@depth@100ms):
 *   Futures events carry a `pu` field (previous event's final update ID).
 *   U values are match-engine transaction IDs that jump unpredictably.
 *   1. Buffering incoming diffs before snapshot.
 *   2. Dropping updates where u <= snapshot.lastUpdateId.
 *   3. First bridging event: U <= lastUpdateId AND lastUpdateId <= u
 *      (or pu <= lastUpdateId AND lastUpdateId <= u).
 *   4. Subsequent updates: pu === rollingU.
 *
 * Auto gap detection, resync tracking, and clean reset for both modes.
 */

export interface OrderbookSnapshot {
  lastUpdateId: number;
  bids: [string, string][]; // [price, qty]
  asks: [string, string][];
}

export interface DepthUpdate {
  e?: string;       // event type
  E?: number;       // event time
  s?: string;       // symbol
  U: number;        // first update ID
  u: number;        // last update ID (use this as "updateId")
  pu?: number;      // previous event's final update ID (Binance Futures only)
  b: [string, string][]; // bids
  a: [string, string][]; // asks
}

/** Returns true if this event comes from a Binance Futures depth stream (has `pu` field). */
function isFuturesEvent(update: DepthUpdate): boolean {
  return typeof update.pu === 'number';
}

export class OrderbookManager {
  private bids: Map<number, number> = new Map(); // price -> qty
  private asks: Map<number, number> = new Map();
  private lastSnapshotUpdateId: number = 0;
  private rollingU: number = 0;
  private initialized: boolean = false;
  private awaitingFirstUpdate: boolean = false;
  private buffer: DepthUpdate[] = [];
  public resyncCount: number = 0;
  public onGapDetected?: () => void;
  public onResync?: (reason: string) => void;

  /**
   * Populate from REST snapshot.
   * Discards stale buffer entries and applies the first bridging update.
   */
  initFromSnapshot(snapshot: OrderbookSnapshot): boolean {
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

    this.lastSnapshotUpdateId = snapshot.lastUpdateId;
    this.rollingU = snapshot.lastUpdateId;
    this.initialized = false;
    this.awaitingFirstUpdate = true;

    // Discard any buffered events where u <= snapshot.lastUpdateId
    const pending = this.buffer.filter((update) => update.u > snapshot.lastUpdateId);
    this.buffer = [];

    if (pending.length === 0) {
      // Buffer empty or all events were older than snapshot; wait for next live update
      return true;
    }

    const first = pending[0];
    const snapId = snapshot.lastUpdateId;

    if (isFuturesEvent(first)) {
      // ── Futures bridging: first event must cover the snapshot ──
      // Valid bridge: (pu <= snapId OR U <= snapId) AND snapId <= u
      const bridges = ((first.pu! <= snapId) || (first.U <= snapId)) && (snapId <= first.u);
      if (!bridges) {
        // All buffered events are after the snapshot — gap
        if (first.U > snapId && (first.pu === undefined || first.pu! > snapId)) {
          this.triggerResync(`Futures buffer gap: first event U=${first.U}, pu=${first.pu} > snapId=${snapId}`);
          return false;
        }
        // Event is stale (u < snapId), shouldn't happen since we filtered, skip
        return true;
      }

      this.applyLevels(first);
      this.rollingU = first.u;
      this.initialized = true;
      this.awaitingFirstUpdate = false;

      // Apply subsequent buffered events with pu continuity
      for (let i = 1; i < pending.length; i++) {
        const update = pending[i];
        if (update.pu !== this.rollingU) {
          this.triggerResync(`Futures buffer seq gap: pu=${update.pu} !== rollingU=${this.rollingU}`);
          return false;
        }
        this.applyLevels(update);
        this.rollingU = update.u;
      }
    } else {
      // ── Spot bridging: U <= lastUpdateId + 1 <= u ──
      const targetSeq = snapId + 1;
      if (first.U > targetSeq) {
        this.triggerResync(`Buffer gap: first buffered U (${first.U}) > lastUpdateId+1 (${targetSeq})`);
        return false;
      }

      this.applyLevels(first);
      this.rollingU = first.u;
      this.initialized = true;
      this.awaitingFirstUpdate = false;

      // Apply subsequent buffered updates in strict rolling sequence
      for (let i = 1; i < pending.length; i++) {
        const update = pending[i];
        if (update.U !== this.rollingU + 1) {
          this.triggerResync(`Sequence gap in buffer: update.U (${update.U}) !== rollingU+1 (${this.rollingU + 1})`);
          return false;
        }
        this.applyLevels(update);
        this.rollingU = update.u;
      }
    }

    return true;
  }

  /**
   * Apply one incremental depth update.
   * Can accept either a parsed DepthUpdate or raw JSON string (parsed off-thread).
   */
  applyUpdate(updateOrRaw: DepthUpdate | string): boolean {
    let update: DepthUpdate;
    if (typeof updateOrRaw === 'string') {
      try {
        update = JSON.parse(updateOrRaw) as DepthUpdate;
      } catch (err) {
        console.error('[Orderbook] Failed to parse raw depth update:', err);
        return false;
      }
    } else {
      update = updateOrRaw;
    }

    if (!update || !Array.isArray(update.b) || !Array.isArray(update.a)) {
      return false;
    }

    // If not yet initialized and not awaiting first update, buffer it
    if (!this.initialized && !this.awaitingFirstUpdate) {
      this.buffer.push(update);
      if (this.buffer.length > 5000) {
        this.buffer.shift();
      }
      return true;
    }

    // Drop stale updates (u <= lastSnapshotUpdateId)
    if (update.u <= this.lastSnapshotUpdateId) {
      return false;
    }

    const futures = isFuturesEvent(update);

    // If awaiting the first update to bridge the snapshot:
    if (this.awaitingFirstUpdate) {
      const snapId = this.lastSnapshotUpdateId;

      if (futures) {
        // Futures bridging: (pu <= snapId OR U <= snapId) AND snapId <= u
        const bridges = ((update.pu! <= snapId) || (update.U <= snapId)) && (snapId <= update.u);
        if (bridges) {
          this.applyLevels(update);
          this.rollingU = update.u;
          this.initialized = true;
          this.awaitingFirstUpdate = false;
          return true;
        } else if (update.U > snapId && (update.pu === undefined || update.pu! > snapId)) {
          this.triggerResync(`Futures first event gap: U=${update.U}, pu=${update.pu} > snapId=${snapId}`);
          return false;
        }
        // Event doesn't bridge yet (u <= snapId-ish range), discard
        return false;
      } else {
        // Spot bridging: U <= lastUpdateId + 1 <= u
        const targetSeq = snapId + 1;
        if (update.U <= targetSeq && targetSeq <= update.u) {
          this.applyLevels(update);
          this.rollingU = update.u;
          this.initialized = true;
          this.awaitingFirstUpdate = false;
          return true;
        } else if (update.U > targetSeq) {
          this.triggerResync(`First event gap: update.U (${update.U}) > lastUpdateId+1 (${targetSeq})`);
          return false;
        }
        // Older than targetSeq, discard
        return false;
      }
    }

    // ── Subsequent updates: rolling continuity check ──
    if (futures) {
      // Futures: pu must equal the previous event's u (our rollingU)
      if (update.pu !== this.rollingU) {
        this.triggerResync(`Futures seq gap: pu=${update.pu} !== rollingU=${this.rollingU}`);
        return false;
      }
    } else {
      // Spot: U must equal rollingU + 1
      if (update.U !== this.rollingU + 1) {
        this.triggerResync(`Sequence gap detected: update.U (${update.U}) !== rollingU+1 (${this.rollingU + 1})`);
        return false;
      }
    }

    this.applyLevels(update);
    this.rollingU = update.u;
    return true;
  }

  private applyLevels(update: DepthUpdate): void {
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
  }

  private triggerResync(reason: string): void {
    console.warn(`[Orderbook] ${reason} — triggering resync`);
    this.resyncCount++;
    this.reset();
    if (this.onResync) this.onResync(reason);
    if (this.onGapDetected) this.onGapDetected();
  }

  /**
   * Simulate a dropped/out-of-order sequence gap for testing.
   */
  simulateGap(): void {
    this.triggerResync('Simulated sequence gap');
  }

  /**
   * Top N bids sorted descending by price.
   */
  getTopBids(n: number = 200): [number, number][] {
    const sorted = Array.from(this.bids.entries())
      .sort((a, b) => b[0] - a[0]);
    return sorted.slice(0, n);
  }

  /**
   * Top N asks sorted ascending by price.
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
   * Rolling sequence updateId.
   */
  getRollingU(): number {
    return this.rollingU;
  }

  /**
   * Number of resync events triggered.
   */
  getResyncCount(): number {
    return this.resyncCount;
  }

  /**
   * Whether the orderbook has been initialized and is actively tracking diffs.
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
    this.lastSnapshotUpdateId = 0;
    this.rollingU = 0;
    this.initialized = false;
    this.awaitingFirstUpdate = false;
    this.buffer = [];
  }
}

# Liquidity Map — Level 2, Task 1 of 3
## Historical Storage Strategy and Tracking Structure

---

## Goal for This Task Only

Design and implement the data structures and storage strategy for tracking liquidity over time. Define how orderbook snapshots are captured, stored, and retrieved. No rendering yet. Establish the foundation that the heatmap renderer in Task 2 will consume.

Level 1 must be fully working before starting Level 2.

---

## Why Historical Tracking

Level 1 shows only current orderbook state. When a large bid wall disappears, it is gone — the platform has no memory of it. Historical tracking captures what happened: did that wall get consumed by aggressive selling, or was it pulled before price reached it? These are fundamentally different market behaviors with different implications.

The long-term goal is to build context — showing where liquidity has been clustering and decaying over the last N candles, not just where it is right now.

---

## The Core Data Structure

**File:** `types/liquidity.ts`

Extend with:

```ts
interface LiquiditySnapshot {
  timestamp:    number           // unix ms when this snapshot was taken
  candleTime:   number           // which 1m candle this snapshot belongs to
  zones:        SnapshotZone[]
}

interface SnapshotZone {
  price:    number
  qty:      number
  side:     'bid' | 'ask'
}

interface LiquidityHistory {
  snapshots:    LiquiditySnapshot[]    // ordered oldest → newest
  maxSnapshots: number                 // cap, default 200
}
```

`LiquidityHistory` is the in-memory store of all captured snapshots. It is a rolling buffer — when `snapshots.length > maxSnapshots`, the oldest is dropped.

`maxSnapshots = 200` means roughly 200 candle-lengths of history. On 1m that is ~3.3 hours of context.

---

## Snapshot Cadence

Take one snapshot per candle close. When `candle.isClosed === true` arrives from the feed, capture the current orderbook state at that moment.

Why per candle:
- Aligns naturally with the chart's time axis
- 200 snapshots = 200 candles = consistent with the candle history limit
- Frequent enough for meaningful tracking without excessive memory

Do not snapshot every 500ms. That would create thousands of snapshots per hour and make history tracking expensive.

---

## `LiquidityHistoryManager` Class

**File:** `lib/liquidity/history.ts`

Manages the snapshot buffer. Lives in a ref inside `FeedProvider` alongside the `AggregationEngine`.

### `captureSnapshot(candleTime, orderbook)`
- Takes the current candle time and the `OrderbookManager` instance
- Calls `orderbook.getTopBids(300)` and `orderbook.getTopAsks(300)`
- Applies the same `liquidityBucketSize` bucketing as Level 1 aggregation
- But does NOT apply the minimum threshold filter — history captures everything above `1 BTC` to preserve detail
- Stores the resulting `LiquiditySnapshot` into the buffer
- Trims buffer if over `maxSnapshots`

### `getHistory()`
- Returns the full `snapshots` array ordered oldest → newest

### `getSnapshotForCandle(candleTime)`
- Returns the snapshot closest to a given candle time
- Used by the renderer to look up what liquidity existed at a specific point in the past

### `reset()`
- Clears all snapshots
- Called on pair or timeframe change

### `getPriceHistory(price, side)`
- For a specific price bucket, returns the quantity at that level across all snapshots in time order
- Returns `number[]` — an array of qty values, one per snapshot, oldest first
- This is the time series used to build the heatmap — how much liquidity existed at this price level over time

---

## Derived Metrics Per Price Level

Beyond raw qty over time, compute behavioral metrics per price level. These feed into Level 3 signal detection.

**File:** `lib/liquidity/analysis.ts`

### `getLiquidityBehavior(priceHistory: number[])`

Takes the time series array for one price level. Returns:

```ts
interface LiquidityBehavior {
  peakQty:        number    // maximum qty seen at this level
  currentQty:     number    // qty in the most recent snapshot
  firstSeen:      number    // index of first snapshot where qty > 0
  lastSeen:       number    // index of last snapshot where qty > 0
  appearances:    number    // how many snapshots had qty > 0
  wasPulled:      boolean   // disappeared before price reached it
  wasConsumed:    boolean   // disappeared as price traded through it
  ageScore:       number    // 0–1, how old is this level (1 = oldest visible)
}
```

**`wasPulled` vs `wasConsumed` classification:**

These are the two most important behavioral distinctions in liquidity tracking.

- `wasConsumed`: qty at this level dropped to zero (or near zero) at the same time price traded at or through this level. The level was hit.
- `wasPulled`: qty at this level dropped to zero before price reached it. The wall disappeared without being traded through.

To classify: when a level's qty drops significantly (>60% drop in one snapshot), check if the current candle's high/low traded through that price. If yes → consumed. If no → pulled.

This classification is approximate and will have edge cases. Accuracy improves with tighter snapshot cadence in future versions.

**`ageScore`**: normalize the snapshot index of `firstSeen` — oldest levels get score near 1, newest near 0. Used for fade rendering in the heatmap.

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
liquidityHistoryEnabled:  boolean   // default true, persisted
liquidityHistoryDepth:    number    // max snapshots, default 200, persisted
```

The `LiquidityHistory` object itself lives in a ref inside `FeedProvider` — same pattern as the `AggregationEngine`. It is mutable and imperative. Do not put it in Zustand.

Expose it via an extension of `ChartEngineContext`:

```ts
interface ChartEngineContextValue {
  engine:           AggregationEngine | null
  liquidityHistory: LiquidityHistoryManager | null   // new
}
```

---

## FeedProvider Integration

**File:** `components/FeedProvider.tsx`

Add `LiquidityHistoryManager` ref alongside the existing engine ref.

In the candle callback, when `candle.isClosed === true`:
```
engine.ingestCandle(candle)          // existing
absorptionEngine.score(...)          // existing
exhaustionEngine.score(...)          // existing
liquidityHistory.captureSnapshot(candle.time, orderbookManager)   // new
```

On pair or timeframe change: call `liquidityHistory.reset()`.

---

## Memory Estimate

200 snapshots × 300 price levels × 2 sides × 8 bytes per number = ~960KB

Well within browser memory constraints. At `maxSnapshots = 500` it approaches 2.4MB — still acceptable but set default at 200 for safety.

---

## How to Verify This Task is Done

Add a temporary keyboard shortcut `H` that logs the history state.

Log the following:
1. `liquidityHistory.getHistory().length` — should grow by 1 on each candle close
2. `liquidityHistory.getSnapshotForCandle(someTime)` — should return a snapshot with zones
3. `liquidityHistory.getPriceHistory(price, 'bid')` — should return an array of numbers, one per snapshot
4. After waiting 5 candles: call `getLiquidityBehavior(priceHistory)` on a level and verify the output fields make sense

Verify:
- Snapshot count grows on candle close, not continuously
- Each snapshot has both bid and ask zones
- A price level that was present in all snapshots has `appearances` equal to snapshot count
- Changing pair resets the history to zero snapshots

Do not proceed to Task 2 until the history buffer is filling correctly on candle close.
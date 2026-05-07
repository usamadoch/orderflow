# Phase 4 — Trade Aggregation Engine

---

## Goal

Take a raw stream of individual trades and build footprint data — volume grouped by price level, per candle, split into bid and ask side. This is the core data engine. Phases 5 and 6 both consume what this phase produces.

Nothing renders here. Pure data transformation.

---

## Concept First

### What a footprint cell is

A footprint chart groups price into buckets. If bucket size is $100, then prices $30000–$30099 are one row, $30100–$30199 is the next, etc.

Each cell holds:
- How much volume traded at the ask (aggressive buyers)
- How much volume traded at the bid (aggressive sellers)

This is determined by `isBuyerMaker`:
- `false` → buyer was aggressive → add quantity to **ask volume** of that price bucket
- `true` → seller was aggressive → add quantity to **bid volume** of that price bucket

Note on naming: "bid volume" and "ask volume" in footprint context means volume that hit the bid (sell aggression) and volume that hit the ask (buy aggression). Some platforms label these differently — be consistent internally.

### What a candle's footprint looks like

One candle maps to one `FootprintCandle`. It contains a map of price levels → cell data, plus the candle's OHLCV and the total delta.

### What delta is

Delta = total ask volume − total bid volume for that candle.
Positive delta = more buying aggression. Negative = more selling aggression.
Cumulative delta = running sum of delta across all candles in view.

---

## 2. Types

**File:** `types/footprint.ts`

```ts
interface FootprintCell {
  askVol: number    // volume hitting the ask (buyers aggressive)
  bidVol: number    // volume hitting the bid (sellers aggressive)
}

interface FootprintCandle {
  time:       number                         // unix seconds, matches Candle.time
  open:       number
  high:       number
  low:        number
  close:      number
  volume:     number
  delta:      number                         // askVol total − bidVol total
  cells:      Map<number, FootprintCell>     // key = bucket price (normalized)
  isClosed:   boolean
}
```

The `cells` map key is the **normalized bucket price** — the floor of the price snapped to the bucket grid. Explained in section 4.

---

## 3. Bucket Size Config

**File:** `lib/store/chart.ts` — add to existing store

Add `bucketSize: number` to store state. Default `100` (meaning $100 per row).

This is the only config the aggregation engine reads from outside. Everything else is derived.

Expose `setBucketSize(n)` action. When bucket size changes, the engine must rebuild from scratch — existing footprint data bucketed at the old size is invalid.

---

## 4. Price Normalization (Bucket Key)

**File:** `lib/utils/aggregation.ts`

### `normalizePriceToBucket(price, bucketSize)`

- Takes a raw price (e.g. `30174.5`) and a bucket size (e.g. `100`)
- Returns the floor price of the bucket it belongs to
- Formula: `Math.floor(price / bucketSize) * bucketSize`
- Example: `Math.floor(30174.5 / 100) * 100 = 30100`
- All prices in the range `[30100, 30200)` map to key `30100`

This is the only math the cell lookup depends on. Must be consistent everywhere — in the engine and in the canvas renderer.

---

## 5. Aggregation Engine

**File:** `lib/aggregation/engine.ts`

This is the main class. One instance lives for the lifetime of a session. Resets on pair, timeframe, or bucket size change.

### Private state it holds

- `footprintMap` — a `Map<number, FootprintCandle>` keyed by candle `time` (unix seconds). This is the full in-memory footprint dataset.
- `bucketSize` — current bucket size, read from store
- `maxCandles` — cap on how many footprint candles to keep in memory (match store limit, 500)

### `ingestTrade(trade, currentCandleTime)`

The hot path. Called on every incoming trade.

- Takes a `Trade` from Phase 2 and the `time` of the currently open candle
- Normalizes the trade price to a bucket key using `normalizePriceToBucket`
- Looks up or creates the `FootprintCandle` entry in `footprintMap` for `currentCandleTime`
- Looks up or creates the `FootprintCell` entry in that candle's `cells` map for the bucket key
- If `isBuyerMaker` is false → add `quantity` to `cell.askVol`
- If `isBuyerMaker` is true → add `quantity` to `cell.bidVol`
- Recalculates `delta` for that footprint candle: iterate all cells, sum `askVol − bidVol`

Delta recalc on every trade is slightly expensive but acceptable. If performance becomes an issue, maintain a running delta counter on the candle and just apply the diff per trade instead of iterating.

### `ingestCandle(candle)`

Called whenever a `Candle` arrives from the feed.

- If `candle.isClosed` is true: mark the matching `FootprintCandle` as closed, copy OHLCV onto it
- If `candle.isClosed` is false: update the OHLCV fields on the live candle (it's still mutating)
- On close: trim `footprintMap` to last `maxCandles` entries if over limit

### `getFootprintCandle(time)`

- Takes a candle `time`
- Returns the `FootprintCandle` from the map, or null if not yet built

### `getAllFootprintCandles()`

- Returns all values from `footprintMap` as an array, sorted by time ascending
- Used by the volume profile and initial canvas draw

### `reset()`

- Clears `footprintMap` entirely
- Called when pair, timeframe, or bucket size changes

---

## 6. Connecting Trades to the Correct Candle

The aggregation engine needs to know which candle a trade belongs to. Trades arrive on their own stream — they don't come labeled with a candle time.

### How to derive current candle time from a trade

Given a trade's `time` (unix ms) and the active `timeframe`, calculate which candle it falls into:

- Convert timeframe string to seconds (e.g. `"1m"` → `60`, `"5m"` → `300`)
- Formula: `Math.floor((trade.time / 1000) / timeframeSeconds) * timeframeSeconds`
- This gives the open time of the candle that trade belongs to

### `getCandelTimeForTrade(tradeTimeMs, timeframeSeconds)`

**File:** `lib/utils/aggregation.ts`

- Takes trade time in ms and timeframe duration in seconds
- Returns the candle open time in unix seconds
- Trades and candles from the same period will always produce the same key

This is how trades are bucketed into candles without relying on the kline stream to tell us.

---

## 7. Wiring Into the Store and Feed

**File:** `components/FeedProvider.tsx` — extend from Phase 2

The engine instance is created once and stored in a ref inside `FeedProvider`.

### On trade callback
- Call `engine.ingestTrade(trade, getCandleTimeForTrade(trade.time, timeframeSeconds))`

### On candle callback
- Call `engine.ingestCandle(candle)` — updates OHLCV and marks closed when relevant
- Also calls `pushCandle(candle)` on the store as before (Phase 2 behavior unchanged)

### On pair/timeframe/bucketSize change
- Call `engine.reset()` before re-subscribing

The engine does not live in Zustand — it is mutable and imperative. It lives in a ref. Components that need footprint data will call `engine.getFootprintCandle(time)` or `engine.getAllFootprintCandles()` directly, or the canvas will read from it via a passed-down ref.

---

## 8. Delta Calculation Detail

Per-candle delta:
- `delta = sum of all cell.askVol − sum of all cell.bidVol` across all price levels in that candle

Cumulative delta (for a future indicator):
- Running sum of `delta` across all footprint candles in time order
- Not built in this phase, but the per-candle delta stored on `FootprintCandle` makes it trivial to derive later

---

## 9. Memory Considerations

At 500 candles × ~50 price levels per candle × 2 numbers per cell, memory is negligible. No concern here.

The 5000 raw trade cap in the Zustand store (Phase 2) is a separate concern — that array is for potential future replay or debugging. The aggregation engine works from the live stream only and does not use the raw trades array.

---

## Completion Checklist

```
types/
└── footprint.ts                  — FootprintCell, FootprintCandle types

lib/
├── utils/
│   └── aggregation.ts            — normalizePriceToBucket, getCandleTimeForTrade
└── aggregation/
    └── engine.ts                 — AggregationEngine class

lib/store/chart.ts                — bucketSize added, setBucketSize action

components/
└── FeedProvider.tsx              — engine wired to trade + candle callbacks

Behavior:
├── Every trade classified as bid or ask aggression
├── Bucketed by price level per candle
├── Delta computed per candle
├── Engine resets cleanly on pair/tf/bucketSize change
└── FootprintCandle available by time for canvas to read
```

---

## What This Phase Does Not Cover

- Rendering footprint cells on canvas — Phase 5
- Volume profile aggregation across candles — Phase 6
- Cumulative delta line — post-MVP
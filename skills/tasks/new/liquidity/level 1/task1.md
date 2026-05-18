# Liquidity Map — Level 1, Task 1 of 2
## Orderbook Data Flow and Aggregation Engine

---

## Goal for This Task Only

Connect to the Binance orderbook WebSocket. Receive live bid and ask levels. Aggregate them into meaningful liquidity zones — not raw individual levels. Store the result in a form the canvas renderer can consume. Nothing renders yet. Verify by logging the aggregated zones to console.

---

## Why Not Raw Orderbook Levels

The Binance orderbook has thousands of individual price levels. Rendering each one as a line or bar would produce an unreadable wall of noise. The purpose of this system is to surface where significant passive liquidity is resting — clusters of large orders at meaningful price levels.

The aggregation step is what separates a useful liquidity map from a raw level-2 display.

---

## Binance Orderbook WebSocket

**Stream:** `<symbol>@depth@100ms`

Example:
```
wss://stream.binance.com:9443/ws/btcusdt@depth@100ms
```

This stream pushes incremental orderbook updates every 100ms. Each message contains:
- `bids` — array of `[price, quantity]` pairs that changed
- `asks` — array of `[price, quantity]` pairs that changed
- A `lastUpdateId` for maintaining order

A quantity of `"0"` means that level was removed from the orderbook.

**Alternative: snapshot + delta approach**

For correctness, Binance requires:
1. Fetch full orderbook snapshot via REST: `GET /api/v3/depth?symbol=BTCUSDT&limit=1000`
2. Subscribe to the depth stream
3. Apply incremental updates on top of the snapshot

This is the proper Binance orderbook sync method. Skipping the snapshot means the local orderbook will be incomplete until all price levels have been updated at least once.

The REST snapshot endpoint returns up to 5000 levels. Use `limit=500` for MVP — the top 500 bids and asks are sufficient.

---

## Local Orderbook State

**File:** `lib/liquidity/orderbook.ts`

Maintain a local in-memory orderbook as two `Map<number, number>` structures:
- `bids: Map<price, quantity>` — sorted descending by price (highest bid first)
- `asks: Map<price, quantity>` — sorted ascending by price (lowest ask first)

### `OrderbookManager` class

Manages the local state, snapshot initialization, and incremental updates.

**`initFromSnapshot(snapshot)`**
- Takes the REST snapshot response
- Populates both maps from `snapshot.bids` and `snapshot.asks`
- Records `lastUpdateId` from snapshot

**`applyUpdate(update)`**
- Takes one incremental depth update message
- Skips updates with `updateId <= lastUpdateId` — they are stale
- For each bid/ask in the update: if quantity is `"0"`, delete from map; otherwise set the new quantity
- Updates `lastUpdateId`

**`getTopBids(n)`** — returns top N bids as `[price, quantity][]` sorted descending
**`getTopAsks(n)`** — returns top N asks ascending
**`getBestBid()`** — highest bid price
**`getBestAsk()`** — lowest ask price (mid price = `(bestBid + bestAsk) / 2`)

---

## Aggregation Logic

**File:** `lib/liquidity/aggregation.ts`

Raw orderbook levels are aggregated into `LiquidityZone` objects. A zone represents a meaningful cluster of passive liquidity at a price region.

### `LiquidityZone` type

**File:** `types/liquidity.ts`

```ts
interface LiquidityZone {
  price:       number       // center price of the zone
  totalQty:    number       // total BTC quantity in this zone
  side:        'bid' | 'ask'
  zoneSize:    number       // price range this zone covers (in $)
  intensity:   number       // 0–1, scaled relative to largest zone visible
  levelCount:  number       // how many individual levels were merged
}
```

### `aggregateOrderbook(bids, asks, currentPrice, settings)` 

Takes the current orderbook state and returns `LiquidityZone[]`.

**Step 1 — Define aggregation bucket size**

Same concept as footprint bucket size. Nearby price levels are merged into one zone.
- `liquidityBucketSize` — user configurable, default `$50` for BTC
- All levels within a `$50` range collapse into one zone
- Use `normalizePriceToBucket(price, liquidityBucketSize)` — same function already in the codebase

**Step 2 — Bucket both sides**

For bids: iterate top N bids (default 200), bucket each price, accumulate quantity per bucket.
For asks: same for top 200 asks.

Only process levels within a reasonable range of current price:
- Bids: from `currentPrice * 0.98` down to `currentPrice * 0.90` — 10% below current price
- Asks: from `currentPrice * 1.02` up to `currentPrice * 1.10` — 10% above current price

Levels outside this range are too far to be relevant for near-term trading context.

**Step 3 — Filter by minimum quantity threshold**

After bucketing, discard any zone where `totalQty < minimumLiquidityThreshold`.

`minimumLiquidityThreshold` — user configurable, default `5 BTC`.

This is the primary noise filter. Zones below this threshold are ignored entirely.

**Step 4 — Calculate intensity**

Find `maxQty` — the largest zone quantity across all remaining zones.
`zone.intensity = zone.totalQty / maxQty` — ranges 0–1.

Zones near 1.0 are the most significant walls. Zones near 0.1 are minor.

**Step 5 — Return sorted zones**

Return all zones as a flat array. The renderer handles bid and ask separately via the `side` field.

---

## Update Cadence

The orderbook updates at 100ms from the stream. Running full aggregation on every message is wasteful — the visual does not need to update at 100ms.

Throttle aggregation to run at most once every `500ms`. Use a flag `pendingAggregation = true` on each orderbook update, and a `setInterval` at 500ms that:
1. Checks if `pendingAggregation` is true
2. If yes: runs `aggregateOrderbook`, updates store, clears flag

This means the liquidity map updates ~2x per second — smooth enough visually, not wasteful.

---

## Feed Adapter Extension

**File:** `lib/feeds/binance.ts`

Add to `BinanceAdapter`:

**`fetchOrderbookSnapshot(pair)`**
- REST call to `GET /api/v3/depth?symbol=BTCUSDT&limit=500`
- Returns raw snapshot object

**`subscribeOrderbook(pair, cb)`**
- Opens depth stream `<symbol>@depth@100ms`
- On each message: passes update to `OrderbookManager.applyUpdate()`
- After applying: sets `pendingAggregation = true`

The orderbook subscription runs alongside the existing klines and aggTrades streams. Use a separate WebSocket for the orderbook — do not combine with the main stream. The depth stream has higher message frequency and deserves its own connection.

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
liquidityZones:    LiquidityZone[]    // session only, not persisted
liquidityEnabled:  boolean            // default true, persisted
liquidityBucketSize:     number       // default 50, persisted
minimumLiquidityThreshold: number    // default 5, persisted
liquidityOpacity:  number            // default 0.6, persisted
liquidityRange:    number            // default 10 (percent from price), persisted
```

Actions:
- `setLiquidityZones(zones)` — called by the aggregation interval
- `setLiquidityEnabled(v)`
- `setLiquidityBucketSize(n)` — triggers re-aggregation
- `setMinimumLiquidityThreshold(n)` — triggers re-aggregation
- `setLiquidityOpacity(n)`
- `setLiquidityRange(n)`

`liquidityZones` is never persisted — it is live data that rebuilds from the feed on connect.

---

## FeedProvider Integration

**File:** `components/FeedProvider.tsx`

On connect (after historical candle fetch, before chart render):
1. Call `feedAdapter.fetchOrderbookSnapshot(pair)` 
2. Pass result to `OrderbookManager.initFromSnapshot()`
3. Call `feedAdapter.subscribeOrderbook(pair, ...)` to start stream
4. Start the 500ms aggregation interval — stores result via `setLiquidityZones`

On disconnect / pair change:
- Stop aggregation interval
- Clear `liquidityZones` in store
- `OrderbookManager` reset

The orderbook connection is tied to the pair. Changing the pair re-initializes from scratch.

---

## How to Verify This Task is Done

Add a temporary keyboard shortcut `L` that logs the current `liquidityZones` array.

Expected output example:
```
[
  { price: 64500, totalQty: 18.4, side: 'bid', intensity: 0.82, levelCount: 4 },
  { price: 64450, totalQty: 12.1, side: 'bid', intensity: 0.54, levelCount: 3 },
  { price: 65100, totalQty: 22.7, side: 'ask', intensity: 1.00, levelCount: 6 },
  { price: 65200, totalQty: 8.3,  side: 'ask', intensity: 0.37, levelCount: 2 },
  ...
]
```

Verify:
- Zones exist and have meaningful quantities — not zero, not millions
- Bid zones are below current price, ask zones are above
- Intensity values range 0–1 with the highest zone at exactly 1.0
- `levelCount` is > 1 on most zones — aggregation is working
- Log again after 2 seconds — values have updated (orderbook is live)
- Change `minimumLiquidityThreshold` to `50` — fewer zones returned (high threshold filters more)
- Change to `1` — more zones returned

Do not proceed to Task 2 until the zone array looks correct and updates live.
# Phase 8 — Historical Data Loading

---

## Goal

On connect, backfill the chart with historical candles via Binance REST before the live WebSocket stream takes over. Without this, the chart starts empty and fills one candle at a time which looks broken and gives no context.

---

## How Binance REST Works for Klines

Binance exposes a public klines endpoint — no API key needed.

```
GET https://api.binance.com/api/v3/klines
  ?symbol=BTCUSDT
  &interval=1m
  &limit=500
```

Returns an array of arrays. Each inner array is one candle in this order:
`[openTime, open, high, low, close, volume, closeTime, ...]`

All values are strings except timestamps. Parse each field to a number.
`openTime` is in milliseconds — divide by 1000 for unix seconds to match the `Candle` type.
`isClosed` is always `true` for historical candles — they are all confirmed closed.

Max limit per request is 1000. Default is 500. For MVP, 500 is sufficient.

---

## Where This Fits in the Feed Flow

Current flow:
```
connect → WebSocket opens → candles trickle in one by one
```

New flow:
```
connect → fetch historical REST → push all candles to store → WebSocket opens → live updates continue
```

The REST fetch must complete before the WebSocket starts pushing candles. Otherwise the live candle may arrive before history and the store ordering breaks.

---

## Changes to BinanceAdapter

**File:** `lib/feeds/binance.ts`

Add a `fetchHistoricalCandles(pair, timeframe, limit)` method to `BinanceAdapter`.

- Takes `pair` (e.g. `"BTCUSDT"`), `timeframe` (e.g. `"1m"`), and `limit` (default `500`)
- Calls the Binance REST klines endpoint using `fetch()`
- Maps the response array to `Candle[]` — same shape as live candles, `isClosed: true` on all
- Returns the array sorted oldest → newest (Binance already returns it this way)
- Should handle fetch errors gracefully — if REST fails, log a warning and proceed with empty history so the app still works

---

## Changes to FeedProvider

**File:** `components/FeedProvider.tsx`

The `useEffect` that subscribes to the feed needs to become async to await the history fetch before opening the socket.

Order of operations inside the effect:
1. Call `engine.reset()` and `feedAdapter.disconnect()` — clean state
2. Set `connected` to `false` in store
3. Add a `isLoadingHistory: boolean` field to the store, set it to `true` here
4. Call `feedAdapter.fetchHistoricalCandles(pair, timeframe, 500)`
5. On success: call `pushAllCandles(candles)` — a new bulk action on the store (see below)
6. Also feed each historical candle into the engine via `engine.ingestCandle(candle)`
7. Set `isLoadingHistory` to `false`
8. Now start the WebSocket: call `subscribeCandles` and `subscribeTrades` as before

---

## Store Changes

**File:** `lib/store/chart.ts`

Add:
- `isLoadingHistory: boolean` — default `false`
- `setLoadingHistory(v: boolean)` action
- `pushAllCandles(candles: Candle[])` action — replaces the entire candles array at once, does not append. Used only for the initial history load. Must not exceed `MAX_CANDLES` — slice to last 500 if over.

The existing `pushCandle` action handles live updates as before. `pushAllCandles` is only called once per pair/timeframe connect.

---

## Loading State in UI

While `isLoadingHistory` is true, show a subtle overlay on the chart canvas:

- Text: `Loading history...` centered on the canvas
- Font: `JetBrains Mono`, muted color `#4A4A4A`
- No spinner needed — this resolves in under a second on decent connection

In `ChartCanvas`, check `isLoadingHistory` from the store. If true, skip the full redraw and just render the loading text. Once it flips to false, trigger a full redraw.

---

## Edge Cases

**WebSocket candle arrives before history render:**
This should not happen given the sequential order in FeedProvider, but if the REST call is slow and a WebSocket message sneaks through, `pushCandle` will append to an empty array — which is fine. History arrives shortly after and `pushAllCandles` replaces everything cleanly.

**Duplicate candle at the seam:**
The last historical candle and the first live candle from the WebSocket may have the same `time`. The existing `pushCandle` logic already handles this — same timestamp replaces in place. No extra handling needed.

**REST fetch fails:**
Log the error, set `isLoadingHistory` to false, proceed with empty chart. App degrades gracefully — the user sees a live chart with no history, same as the old behavior before this phase.

---

## File Checklist

```
lib/feeds/binance.ts
└── fetchHistoricalCandles(pair, timeframe, limit) added

components/FeedProvider.tsx
└── async effect, history fetch before socket open

lib/store/chart.ts
├── isLoadingHistory field
├── setLoadingHistory action
└── pushAllCandles action

components/chart/ChartCanvas.tsx
└── loading state render when isLoadingHistory is true
```

---

## What This Does Not Cover

- Fetching history beyond 500 candles (pagination)
- Fetching history for the aggregation engine (trade-level history is not available via Binance REST)
- Offline caching of historical data
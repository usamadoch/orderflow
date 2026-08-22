



# Phase 2 — Binance Feed Adapter

---

## Goal

Wire live Binance market data into the app.
Two streams: candles (OHLCV) and aggregated trades (for order flow).
One clean interface so the rest of the app never cares where data comes from.

---

## 1. FeedAdapter Interface

**File:** `lib/feeds/adapter.ts`

The contract every future data source must follow. Define it once, never change it.

### Types

```ts
interface Candle {
  time:     number   // unix seconds (not ms)
  open:     number
  high:     number
  low:      number
  close:    number
  volume:   number
  isClosed: boolean  // false = candle still live, true = confirmed closed
}

interface Trade {
  time:         number   // unix ms
  price:        number
  quantity:     number
  isBuyerMaker: boolean  // true = seller aggressed, false = buyer aggressed
}
```

`isBuyerMaker` is the critical flag — it's how Binance tells us who was aggressive. Everything in order flow classification depends on this field.

### Interface

```ts
interface FeedAdapter {
  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void
  subscribeTrades(pair: string, cb: (trade: Trade) => void): void
  disconnect(): void
}
```

---

## 2. Binance WebSocket URLs

Binance provides a combined stream endpoint — one socket, multiple streams.

```
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@aggTrade
```

Always use the combined stream. Avoid opening two separate sockets.

Every message from the combined stream comes wrapped:
```json
{ "stream": "btcusdt@kline_1m", "data": { ... } }
```

Use the `stream` field to route each message to the right handler.

---

## 3. BinanceAdapter Class

**File:** `lib/feeds/binance.ts`

Implements `FeedAdapter`. Manages the WebSocket lifecycle.

### Private state it holds

- `ws` — the active WebSocket instance (or null)
- `currentPair` — e.g. `"btcusdt"`
- `currentTimeframe` — e.g. `"1m"`
- `candleCb` — callback passed in by `subscribeCandles`
- `tradeCb` — callback passed in by `subscribeTrades`
- `reconnectAttempts` — counter for backoff
- `shouldReconnect` — boolean flag, set to false on intentional disconnect

### `subscribeCandles(pair, timeframe, cb)`
- Stores pair, timeframe, and the callback
- Calls `connect()`

### `subscribeTrades(pair, cb)`
- Stores the callback
- Does not call `connect()` again — assumes `subscribeCandles` was called first
- If used standalone, calls `connect()` itself

### `connect()` — private
- Closes any existing socket
- Builds the combined stream URL from current pair + timeframe
- Opens a new `WebSocket`
- Wires `onopen`, `onmessage`, `onerror`, `onclose`
- On `onopen`: resets `reconnectAttempts` to 0
- On `onmessage`: calls `handleMessage()`
- On `onclose`: calls `scheduleReconnect()` if `shouldReconnect` is true

### `handleMessage(raw)` — private
- Takes raw string from the socket
- Parses JSON
- Reads the `stream` field to decide routing
  - If stream contains `@kline`: extract `data.k`, map to `Candle`, call `candleCb`
  - If stream contains `@aggTrade`: extract `data`, map to `Trade`, call `tradeCb`
- Kline mapping note: `k.t` is in ms, divide by 1000 for unix seconds. `k.x` is `isClosed`.
- Trade mapping note: `data.m` is `isBuyerMaker`

### `scheduleReconnect()` — private
- Checks if `reconnectAttempts` has hit the max (10). If so, logs and exits.
- Calculates delay: `Math.min(1000 * 2^attempts, 30000)` — caps at 30s
- Increments `reconnectAttempts`
- Sets a timeout that calls `connect()` again

### `disconnect()`
- Sets `shouldReconnect = false`
- Clears any pending reconnect timer
- Closes the socket

---

## 4. Active Adapter Export

**File:** `lib/feeds/index.ts`

Exports a single instance of `BinanceAdapter` as `feedAdapter`.
Every part of the app imports from here. Changing to a different adapter later = change this one file.

---

## 5. Zustand Store

**File:** `lib/store/chart.ts`

Holds all live state the chart components read from.

### State shape

```ts
{
  pair:      string     // active pair e.g. "BTCUSDT"
  timeframe: string     // active timeframe e.g. "1m"
  candles:   Candle[]   // ordered oldest → newest, capped at 500
  trades:    Trade[]    // recent trades, capped at 5000
  connected: boolean    // is the feed socket open?
}
```

### Actions

**`setPair(pair)`**
- Updates `pair`, clears `candles` and `trades`
- Clearing is intentional — old pair's data should not bleed into the new pair's chart

**`setTimeframe(tf)`**
- Same as `setPair` — updates timeframe, clears both arrays

**`setConnected(bool)`**
- Simple toggle for the connection status indicator

**`pushCandle(candle)`**
- This is the most important action in the store
- Two cases:
  - If last candle in array has the same `time` as incoming → replace it in place (live mutation mid-candle)
  - If incoming `time` is new → append to array
- After appending, trim array to last 500 if over limit
- Getting this logic wrong causes chart flicker or missing candles

**`pushTrade(trade)`**
- Appends trade to `trades` array
- Trims to last 5000

---

## 6. Feed Initialization

**File:** `components/FeedProvider.tsx` (wrap around the chart in `app/page.tsx`)

A client component with a single `useEffect`.

### What it does
- Reads `pair` and `timeframe` from the store
- On mount (and whenever `pair` or `timeframe` changes):
  - Calls `feedAdapter.disconnect()` to kill any existing connection
  - Calls `feedAdapter.subscribeCandles(pair, timeframe, pushCandle)` — also sets `connected = true` on first callback
  - Calls `feedAdapter.subscribeTrades(pair, pushTrade)`
- On unmount: calls `feedAdapter.disconnect()`, sets `connected = false`
- `[pair, timeframe]` in the dependency array is what triggers a clean re-subscribe when selectors change

---

## 7. ConnectionStatus Component

**File:** `components/ui/ConnectionStatus.tsx`

Reads only `connected` from the store.

Renders a small dot + text label:
- Connected: teal dot (`#26A69A`), text `"LIVE"` in muted gray
- Disconnected: red dot (`#EF5350`), text `"DISCONNECTED"` in red
- Font: monospace, small size

---

## 8. PairSelector Component

**File:** `components/ui/PairSelector.tsx`

Reads `pair` and `setPair` from store.
Renders buttons for `BTCUSDT` and `ETHUSDT`.
Active pair button gets accent background (`#3D7EFF`). Others muted.
On click: calls `setPair` — store clears data, FeedProvider `useEffect` re-runs automatically.

---

## 9. TimeframeSelector Component

**File:** `components/ui/TimeframeSelector.tsx`

Same pattern as PairSelector.
Options: `1m, 5m, 15m, 1h, 4h`.
Active timeframe gets a blue border instead of filled background (different visual from pair selector — they serve different roles).
On click: calls `setTimeframe`.

---

## File Checklist

```
lib/
├── feeds/
│   ├── adapter.ts           — Candle, Trade types + FeedAdapter interface
│   ├── binance.ts           — BinanceAdapter class
│   └── index.ts             — singleton export
└── store/
    └── chart.ts             — Zustand store

components/
├── FeedProvider.tsx          — useEffect wiring
└── ui/
    ├── ConnectionStatus.tsx
    ├── PairSelector.tsx
    └── TimeframeSelector.tsx
```

---

## What This Phase Does Not Cover

- Rendering any chart — Phase 3
- Historical candle backfill via Binance REST — Phase 3 decision
- Per-candle trade bucketing for footprint — Phase 4
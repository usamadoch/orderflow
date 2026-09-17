# Orderflow Platform — Historical Data, Windowing & Cache System Design

**Scope:** how historical candles, footprint and profile data are fetched, chunked, cached, evicted and rendered when the user scrolls back through time or switches timeframe.
**Target behaviour:** scroll back 7 days, switch 1m → 5m → 15m, never see a blank chart, never see already-loaded data vanish and refetch.
**Stack assumed:** Next.js App Router, Zustand, custom Canvas engine, TimescaleDB + `pg`, Node collector daemon, single-user for now.

---

## 0. The one-line reframe

**This is not pagination. It is a windowed view over an immutable, chunk-addressed time series.**

Pagination is the wrong mental model and it is the root of most of the bugs:

| Pagination thinking           | Time-series windowing                       |
| ----------------------------- | ------------------------------------------- |
| Cursor / page number          | Absolute time-aligned chunk index           |
| Page N is "after" page N-1    | Any chunk can be requested in any order     |
| Pages are transient results   | Closed chunks are **immutable forever**     |
| Cache keyed by request params | Cache keyed by `(symbol, tf, chunkIndex)`   |
| New request replaces old data | New data **merges into** a persistent store |

The single most important property: **a closed candle never changes.** Once the 5-minute candle at `14:35:00` is closed, its OHLCV, its footprint cells and its volume profile are frozen. Only the rightmost forming candle mutates.

Everything below is downstream of that fact. If you cache immutable things by a deterministic key, you get: free deduplication, free HTTP caching, free IndexedDB persistence, no invalidation logic, and no reason to ever refetch something you already have.

---

## 1. Root-cause analysis of the current symptoms

Before the design, here is the mapping from what you observe to what is almost certainly wrong. Fix the causes, not the symptoms.

### 1.1 "I go back, and in front of me I lose the data and it starts fetching again"

This is the headline bug. It has one of four causes, and usually more than one at once:

**Cause A — cache lives inside React component state.**
If loaded candles sit in `useState` / a `useEffect`-scoped variable / a Zustand slice that gets reset on some dependency change, then any remount, symbol change, timeframe change, or dependency-array churn wipes it. The data was never cached; it was just _held_.
→ **Fix:** cache lives in a **module-level singleton**, outside React, outside the component tree. React/Zustand only holds a _pointer_ and a version counter to trigger repaints.

**Cause B — cache key is the request range, not the data identity.**
If you key by `` `${symbol}-${tf}-${from}-${to}` ``, then scrolling back to a _slightly_ different `from` produces a cache miss even though you already hold 95% of those candles. Scroll left, scroll right, scroll left again → three different keys, three fetches, and the "same" data appears to reload.
→ **Fix:** key by **epoch-anchored chunk index**. Any viewport maps deterministically onto the same chunk set every single time.

**Cause C — over-aggressive `AbortController`.**
A very common pattern: `useEffect` on visible-range change creates an `AbortController`, and the cleanup aborts on every range change. Scroll is a _continuous_ stream of range changes, so every in-flight request is cancelled by the next scroll frame, forever. Data arrives only when you stop moving — and if a late response is discarded because its controller was aborted, the store may be left empty.
→ **Fix:** abort scope is **symbol change only**. Scroll never aborts. Instead, scroll _reprioritises_ a fetch queue.

**Cause D — "clear then load" render flow.**
`setCandles([])` → fetch → `setCandles(data)`. There is a window where the chart holds nothing. With slow fetches this is exactly "the data disappears in front of me."
→ **Fix:** never clear. Merge-only writes, `keepPreviousData` semantics, per-chunk loading state instead of a global one.

### 1.2 "Fetching is a bit slow even though I'm just one user"

Single-user slowness is never a concurrency problem. It is one of:

- **On-the-fly aggregation on the read path.** If the 15m endpoint runs `time_bucket('15 minutes', ...)` over raw trades/footprint rows on every request, you are re-doing at query time work that should have been done once at write time. This is usually 10–100x.
- **Missing or wrong index.** You need a composite index whose leading columns match the filter and whose trailing column matches the sort: `(symbol, bucket DESC)` per hypertable/CAGG. A `bucket`-only index forces a filter-then-sort over a huge range.
- **Payload shape.** An array of 500 JSON objects with named keys ships and parses ~4x slower than columnar arrays. For footprint data with nested price levels the ratio is worse.
- **No compression.** `Content-Encoding` not enabled on the Next.js route, or the payload is already-gzipped-then-base64'd.
- **Cold chunk decompression.** Timescale columnar compression is great for storage but a compressed chunk must be decompressed to read. Compress only chunks older than your hot window.
- **Connection churn.** A new `pg` client per request in a serverless route handler pays TCP + TLS + auth on every call. Use a pooler.

### 1.3 The 720-slice Volume Profile cap

Same disease, different organ. A **fixed-size cache** was used as a substitute for a **windowed chunk cache**. Zooming out shows "only what's cached" because the cache is an accidental capacity limit, not a designed one. Under this design, volume profile slices become just another chunk-addressed layer with the same fetch/merge/evict rules as footprint, and Composite mode becomes a **server-side aggregate over a requested range**, never a client-side sum of whatever happens to be resident.

---

## 2. Architecture overview

```
┌───────────────────────────────────────────────────────────────────┐
│  L0  INGEST        Collector daemon (VPS, PM2) → raw trades/depth  │
├───────────────────────────────────────────────────────────────────┤
│  L1  STORAGE       TimescaleDB hypertables                         │
│                    + hierarchical continuous aggregates            │
│                    1m → 5m → 15m → 1h  (precomputed, never on read)│
├───────────────────────────────────────────────────────────────────┤
│  L2  API           Chunk-aligned range endpoints                   │
│                    /history  (immutable, cacheable forever)        │
│                    /tail     (forming edge, no-store)              │
│                    WS        (live forming candle)                 │
├───────────────────────────────────────────────────────────────────┤
│  L3  TRANSPORT     HTTP immutable caching, columnar payloads,      │
│                    gzip/br, ETag                                   │
├───────────────────────────────────────────────────────────────────┤
│  L4  CLIENT CACHE  ChunkStore (module singleton, Map)              │
│                    + IndexedDB persistence                         │
│                    + in-flight registry + LRU eviction             │
├───────────────────────────────────────────────────────────────────┤
│  L5  ORCHESTRATOR  Viewport → required chunks → priority queue     │
│                    → prefetch ahead of scroll direction            │
├───────────────────────────────────────────────────────────────────┤
│  L6  RENDER        Canvas reads ChunkStore synchronously.          │
│                    Missing chunk = skeleton, never blank.          │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. L1 — Storage design (TimescaleDB)

### 3.1 Precompute every timeframe. Never aggregate on read.

Use **hierarchical continuous aggregates**: build 1m from raw, then build 5m _from 1m_, 15m from 5m, 1h from 15m. Each level only merges a handful of rows from the level below instead of rescanning raw trades — this is the documented pattern and the reason timeframe switching can be fast at all.

```sql
-- Raw footprint/trade hypertable (already exists)
SELECT create_hypertable('trades', 'time', chunk_time_interval => INTERVAL '1 hour');
CREATE INDEX ON trades (symbol, time DESC);

-- Level 1: 1-minute, from raw
CREATE MATERIALIZED VIEW ohlcv_1m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  symbol,
  first(price, time)  AS open,
  max(price)          AS high,
  min(price)          AS low,
  last(price, time)   AS close,
  sum(qty)            AS volume,
  sum(qty) FILTER (WHERE is_buyer_maker = false) AS ask_vol,
  sum(qty) FILTER (WHERE is_buyer_maker = true)  AS bid_vol
FROM trades
GROUP BY 1, 2
WITH NO DATA;

-- Level 2: 5-minute, rolled up FROM the 1-minute aggregate
CREATE MATERIALIZED VIEW ohlcv_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', bucket) AS bucket,
  symbol,
  first(open, bucket) AS open,
  max(high)           AS high,
  min(low)            AS low,
  last(close, bucket) AS close,
  sum(volume)         AS volume,
  sum(ask_vol)        AS ask_vol,
  sum(bid_vol)        AS bid_vol
FROM ohlcv_1m
GROUP BY 1, 2
WITH NO DATA;

-- Level 3: 15-minute, rolled up FROM 5-minute. Same shape.
-- Level 4: 1-hour, rolled up FROM 15-minute.
```

> If you enable the Timescale Toolkit, `candlestick_agg()` + `rollup()` does the same thing with less SQL and gives you `vwap()` for free. Optional — the manual version above has no extension dependency.

**Refresh policies.** Refresh each level slightly behind real time so the forming bucket is never materialised half-finished; the live edge comes from the WS layer, not from the CAGG.

```sql
SELECT add_continuous_aggregate_policy('ohlcv_1m',
  start_offset => INTERVAL '3 hours',
  end_offset   => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

SELECT add_continuous_aggregate_policy('ohlcv_5m',
  start_offset => INTERVAL '6 hours',
  end_offset   => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');
-- ...same pattern for 15m, 1h
```

### 3.2 Footprint and profile are separate, heavier layers

OHLCV is tiny. Footprint is not. Keep them in **separate tables addressed by the same bucket key** so the client can load the cheap skeleton eagerly and the expensive detail lazily.

```sql
-- One row per (symbol, tf, bucket, price_level)
CREATE TABLE footprint_cells (
  symbol      text        NOT NULL,
  tf          text        NOT NULL,   -- '1m','5m','15m'
  bucket      timestamptz NOT NULL,
  price       numeric     NOT NULL,
  bid_vol     numeric     NOT NULL,
  ask_vol     numeric     NOT NULL,
  PRIMARY KEY (symbol, tf, bucket, price)
);
SELECT create_hypertable('footprint_cells', 'bucket',
  chunk_time_interval => INTERVAL '6 hours');
CREATE INDEX ON footprint_cells (symbol, tf, bucket DESC);
```

Same shape for `volume_profile_slices`. The point is: **one index, leading `(symbol, tf)`, trailing `bucket DESC`.** Every read path below matches that index exactly.

### 3.3 Tiered retention — this is your cost and speed control

Not everything deserves 7 days.

| Layer                       | Hot (uncompressed) | Compressed   | Dropped after |
| --------------------------- | ------------------ | ------------ | ------------- |
| OHLCV 1m/5m/15m/1h          | 7 days             | 7–90 days    | 90 days       |
| Footprint cells             | 48 hours           | 48h – 7 days | 7 days        |
| Volume profile slices       | 48 hours           | 48h – 7 days | 7 days        |
| Orderbook heatmap snapshots | 12 hours           | 12–48 hours  | 48 hours      |
| Raw trades                  | 24 hours           | 24h – 3 days | 3 days        |

```sql
ALTER TABLE footprint_cells SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol, tf',
  timescaledb.compress_orderby   = 'bucket DESC, price'
);
SELECT add_compression_policy('footprint_cells', INTERVAL '48 hours');
SELECT add_retention_policy('footprint_cells',   INTERVAL '7 days');
```

The hot window must comfortably exceed your normal scrollback so the common case never touches a compressed chunk. Compressed reads still work — they are just slower, which is the correct trade for the rare deep look-back.

### 3.4 The "seven days is small" observation

Do the arithmetic once, because it changes the design:

| Timeframe | Candles in 7 days |
| --------- | ----------------- |
| 1m        | 10,080            |
| 5m        | 2,016             |
| 15m       | 672               |
| 1h        | 168               |

**7 days of 1m OHLCV is ~10k rows.** As columnar float arrays that is roughly 400–500 KB uncompressed, well under 150 KB over the wire with gzip and delta-encoded timestamps.

That is small enough to **load the entire 7-day OHLCV skeleton up front** for the active timeframe. Do this. It is the single change that makes scrollback feel instant, because the price chart then _never_ waits on the network — only the footprint/profile detail layer streams in per chunk, and it streams in on top of an already-drawn chart.

Footprint is the opposite: ~40 price levels × 3 numbers × 10,080 candles ≈ 10 MB for 7 days of 1m. That must be chunked and evicted. Hence the two-tier split in §5.3.

---

## 4. L2 — API design

### 4.1 Chunk addressing (the core primitive)

Every request is aligned to a deterministic, **epoch-anchored** chunk. Both client and server compute the same index from the same formula, with zero negotiation.

```ts
export const CHUNK_CANDLES = 500;

export const TF_MS = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
} as const;

export type TF = keyof typeof TF_MS;

/** Chunk index for a timestamp. Anchored to the Unix epoch. */
export function chunkIndexOf(ts: number, tf: TF): number {
  return Math.floor(ts / (TF_MS[tf] * CHUNK_CANDLES));
}

export function chunkRange(idx: number, tf: TF): [number, number] {
  const span = TF_MS[tf] * CHUNK_CANDLES;
  return [idx * span, (idx + 1) * span]; // [start, end)
}

export function chunkKey(symbol: string, tf: TF, idx: number): string {
  return `${symbol}:${tf}:${idx}`;
}
```

Why this and not a cursor:

- The **same viewport always maps to the same chunk set**, no matter how you arrived at it. Scroll left, right, left again → same keys → zero refetches. This alone kills bug 1.1(B).
- Chunks are content-addressable, so a closed chunk can be cached forever by HTTP, by IndexedDB, and later by Redis, all with the same key.
- No server-side cursor state. Requests are order-independent and idempotent.
- `CHUNK_CANDLES = 500` is a starting value. It should be ~1.5–2x a typical viewport (a 1920px chart at normal zoom shows ~250–400 candles), so a static viewport needs 2 chunks and a scroll crosses a boundary every few seconds rather than every frame. Tune, do not agonise.

### 4.2 Two endpoint classes, different cache semantics

This split matters more than anything else in the API layer.

**`GET /api/history/ohlcv`** — closed chunks only.

```
/api/history/ohlcv?symbol=BTCUSDT&tf=5m&chunk=931442
```

```
Cache-Control: public, max-age=31536000, immutable
ETag: "btcusdt-5m-931442-v1"
```

`immutable` tells the browser to not even send a revalidation request. A chunk you have already fetched in this session, or in a previous session, costs **zero network**. This is a free, correct, and permanent cache tier that you currently do not have.

**Guard:** the server must refuse to serve a chunk whose range overlaps `now` with immutable headers — that chunk is still forming. If `chunkRange(idx)[1] > now`, respond with `Cache-Control: no-store` and set `"complete": false` in the body so the client knows not to persist it.

**`GET /api/tail/ohlcv`** — the forming edge.

```
/api/tail/ohlcv?symbol=BTCUSDT&tf=5m&count=120
Cache-Control: no-store
```

Used once on mount to bootstrap the right edge, then the WS takes over. Never cached, never persisted.

**WS** — forming candle updates only. WS **always wins** for the newest bucket; on conflict, WS overwrites HTTP.

### 4.3 Columnar payloads

Do not ship arrays of objects.

```jsonc
// ❌ ~92 bytes/candle, slow to parse
[{"time":1737000000000,"open":97431.2,"high":97502.0,
  "low":97388.5,"close":97460.1,"volume":812.44}, ...]

// ✅ ~40 bytes/candle, and V8 parses it into packed arrays
{
  "symbol": "BTCUSDT",
  "tf": "5m",
  "chunk": 931442,
  "t0": 1737000000000,        // first bucket
  "step": 300000,             // implicit timestamps — ship no time array at all
  "n": 500,
  "complete": true,           // false ⇒ do not persist, contains forming candle
  "o": [97431.2, 97460.1, ...],
  "h": [...], "l": [...], "c": [...], "v": [...],
  "bv": [...], "av": [...]    // bid/ask volume for delta
}
```

Two wins stacked: **implicit timestamps** (a chunk is a contiguous, gap-filled grid, so `time[i] = t0 + i*step`) and **columnar layout** (no repeated key strings, and each column deserialises into a homogeneous packed array the Canvas engine can iterate without pointer chasing).

For gaps in the grid, emit `null` in `o/h/l/c` and `0` in `v`. Do not collapse the grid — index-addressability is worth more than the bytes.

**Footprint payload** — run-length the price axis, since price levels are contiguous ticks:

```jsonc
{
  "chunk": 931442,
  "tick": 0.1,
  "bars": [
    { "i": 0, "p0": 97380.0, "n": 42, "bid": [...42], "ask": [...42] },
    { "i": 1, "p0": 97392.5, "n": 38, "bid": [...38], "ask": [...38] }
  ]
}
```

`i` is the candle's offset within the chunk, `p0` the lowest price level, `n` the level count; price of level `k` is `p0 + k*tick`. No price array shipped.

### 4.4 Negative caching — stop the infinite refetch loop

If the client asks for a chunk that predates your retention window, or a market gap, and the server returns an empty body with no signal, the client will keep asking forever every time the viewport touches that range. This is the classic "infinite data requests" failure and it will silently melt your VPS.

Server response for an empty chunk:

```json
{ "chunk": 931100, "n": 0, "empty": true, "boundary": "retention" }
```

Client stores a **tombstone** in the same `ChunkStore` map. A tombstone is a cache hit. It is never refetched. `boundary: "retention"` additionally tells the orchestrator to stop prefetching further left and lets the renderer draw a "no data beyond here" edge.

### 4.5 Backend query

```sql
-- Chunk fetch. Matches (symbol, bucket DESC) index exactly.
SELECT bucket, open, high, low, close, volume, bid_vol, ask_vol
FROM ohlcv_5m
WHERE symbol = $1
  AND bucket >= $2
  AND bucket <  $3
ORDER BY bucket ASC;
```

- Half-open `[from, to)` — non-negotiable, or you double-count boundary candles between adjacent chunks.
- `tf` selects the _table_, never a runtime `time_bucket()`.
- Use a pooled connection (`pg.Pool`, or PgBouncer / Timescale's pooler if the route is serverless). Do not open a client per request.
- Gap-fill server-side so the client always receives exactly `n = CHUNK_CANDLES` rows and can rely on implicit timestamps. `time_bucket_gapfill()` does this natively.

---

## 5. L4 — Client cache design

### 5.1 The store lives outside React. Non-negotiable.

```ts
// lib/chart/chunkStore.ts — module singleton, ONE instance per tab.

type ChunkState =
  | { status: 'loaded';  data: OhlcvChunk; bytes: number; lastUsed: number; pinned: boolean }
  | { status: 'empty';   boundary: 'retention' | 'gap' }       // tombstone
  | { status: 'loading'; promise: Promise<void>; priority: number };

class ChunkStore {
  private ohlcv    = new Map<string, ChunkState>();
  private footprint = new Map<string, ChunkState>();
  private inflight  = new Map<string, Promise<void>>();
  private bytes = 0;
  private version = 0;                       // bumped on every mutation
  private listeners = new Set<() => void>();

  /** Synchronous read. The render loop calls this every frame. Never async. */
  getOhlcv(key: string): OhlcvChunk | 'empty' | undefined { ... }

  /** Merge-only write. NEVER clears, NEVER replaces the whole map. */
  private commit(key: string, chunk: OhlcvChunk) {
    this.ohlcv.set(key, { status:'loaded', data:chunk, bytes:sizeOf(chunk),
                          lastUsed:performance.now(), pinned:false });
    this.bytes += sizeOf(chunk);
    this.version++;
    this.evictIfNeeded();
    this.listeners.forEach(fn => fn());   // tells the canvas to repaint
  }

  subscribe(fn: () => void) { ... }        // React binds via useSyncExternalStore
}

export const chunkStore = new ChunkStore();  // <- lives for the tab's lifetime
```

React's only relationship with this object is `useSyncExternalStore(chunkStore.subscribe, () => chunkStore.version)`. Zustand holds **viewport state** (symbol, tf, visible range, scroll velocity) — never candle data. A component unmounting, a Fast Refresh, a timeframe switch: none of them can touch the cache.

This is the fix for symptom 1.1. Everything else in this section is optimisation; this is correctness.

### 5.2 Request coalescing

```ts
async ensureChunk(symbol: string, tf: TF, idx: number, priority: number) {
  const key = chunkKey(symbol, tf, idx);

  // 1. Already have it (data or tombstone)? Return. No network.
  const existing = this.ohlcv.get(key);
  if (existing && existing.status !== 'loading') {
    if (existing.status === 'loaded') existing.lastUsed = performance.now();
    return;
  }

  // 2. Already fetching? Reuse the SAME promise. This is what stops the
  //    scroll-jitter storm of duplicate requests for the same chunk.
  const pending = this.inflight.get(key);
  if (pending) return pending;

  // 3. Fetch. Abort signal is scoped to SYMBOL, not to scroll.
  const p = fetchChunk(symbol, tf, idx, this.symbolAbort.signal)
    .then(chunk => {
      if (chunk.empty) this.commitTombstone(key, chunk.boundary);
      else             this.commit(key, chunk);
      if (chunk.complete) persistToIdb(key, chunk);  // only closed chunks
    })
    .catch(err => { if (err.name !== 'AbortError') this.markRetryable(key, err); })
    .finally(() => this.inflight.delete(key));

  this.inflight.set(key, p);
  return p;
}
```

Three rules encoded here, each killing a specific bug:

1. **A cache hit short-circuits before any network call.** Scrolling over already-loaded chunks is free.
2. **Identical concurrent requests share one promise.** Scroll jitter cannot produce N requests for chunk 931442.
3. **`AbortController` is per-symbol, never per-scroll.** Changing symbol aborts everything in flight (correct — it is all garbage now). Scrolling aborts nothing (correct — that data is still wanted, just maybe not first).

### 5.3 Two-tier loading: skeleton eager, detail lazy

Directly from the arithmetic in §3.4:

**Tier 1 — OHLCV skeleton.** On symbol/timeframe selection, fetch **the whole 7-day range** for the active timeframe in one request (or 3–4 parallel chunk requests). ~150 KB gzipped for 1m; less for everything above. Pin these chunks — they are never evicted while the symbol is active.

Consequence: **scrolling back through price never hits the network.** The chart draws candles instantly at any scroll position, all the way to the retention edge. This alone removes 90% of the perceived lag.

**Tier 2 — footprint / profile / heatmap detail.** Fetched per chunk, on demand, driven by the viewport. Evicted under memory pressure. While a detail chunk is missing, the candle is drawn as a **plain candle** — correct, readable, just without the footprint cells — and fills in when the chunk lands.

The chart is therefore _never_ blank and _never_ shows a spinner over the whole canvas. It shows price immediately and progressively enriches.

### 5.4 Memory budget and eviction

| Layer                      | Resident target         | Policy                               |
| -------------------------- | ----------------------- | ------------------------------------ |
| OHLCV skeleton (active tf) | Full 7 days, ~0.5 MB    | **Pinned**, never evicted            |
| OHLCV (other tfs)          | Last-used 2 timeframes  | LRU, low priority                    |
| Footprint chunks           | ~40 chunks (~25 MB)     | LRU, pin the 3 nearest the viewport  |
| Volume profile slices      | ~40 chunks              | LRU, pin nearest 3                   |
| Heatmap snapshots          | Viewport ± 1 chunk only | Aggressive eviction — heaviest layer |

Total JS heap ceiling: **~200 MB**. Beyond roughly 300–400 MB, Chrome's GC pauses become long enough to produce visible canvas stutter — that is your "app starts freezing" symptom, and it is a memory problem, not a rendering problem.

```ts
private evictIfNeeded() {
  const LIMIT = 200 * 1024 * 1024;
  if (this.bytes < LIMIT) return;

  const victims = [...this.footprint.entries()]
    .filter(([, s]) => s.status === 'loaded' && !s.pinned)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);   // oldest touched first

  for (const [key, s] of victims) {
    if (this.bytes < LIMIT * 0.8) break;              // evict down to 80%, not to the line
    this.footprint.delete(key);
    this.bytes -= s.bytes;
  }
}
```

Evict to 80%, not to exactly the limit — otherwise you thrash, evicting and refetching the same chunk every frame. Evicted chunks that were persisted to IndexedDB come back from disk, not from the network.

### 5.5 IndexedDB persistence tier

Closed chunks are immutable, so they can be written to IndexedDB once and reused across sessions and across evictions.

```
DB: orderflow-cache
  store: chunks      key = "BTCUSDT:5m:931442"   value = OhlcvChunk (as ArrayBuffer)
  store: meta        key = same                  value = { bytes, writtenAt, tf, symbol }
```

- Write **only** chunks with `"complete": true`. A forming chunk written to disk becomes a permanently wrong candle.
- Budget ~300–500 MB; sweep on startup, dropping entries older than the retention window (they are dead server-side anyway).
- Read path order: **memory → IndexedDB → network.** An IndexedDB hit is ~1–5 ms versus 80–300 ms for network.
- Do the IDB read off the main thread (a small worker) so a deep scroll never blocks the render loop.

---

## 6. L5 — Fetch orchestration

### 6.1 Viewport → required chunks

```ts
function requiredChunks(view: { from: number; to: number }, tf: TF) {
  const first = chunkIndexOf(view.from, tf);
  const last = chunkIndexOf(view.to, tf);
  const out: number[] = [];
  for (let i = first; i <= last; i++) out.push(i);
  return out;
}
```

### 6.2 Direction-aware prefetch

Scroll direction is known — the user is dragging one way. Prefetch ahead of them, not behind.

```ts
function prefetchPlan(view, tf, velocity: number) {
  const req = requiredChunks(view, tf);
  const ahead = velocity < 0 ? 2 : 0; // dragging into the past
  const behind = velocity > 0 ? 2 : 0;

  return [
    ...req.map((i, k) => ({ idx: i, priority: 0 + k })), // visible: urgent
    ...range(req[0] - ahead, req[0] - 1).map((i) => ({ idx: i, priority: 10 })),
    ...range(req.at(-1)! + 1, req.at(-1)! + behind).map((i) => ({
      idx: i,
      priority: 10,
    })),
    ...range(req[0] - ahead - 2, req[0] - ahead - 1).map((i) => ({
      idx: i,
      priority: 20,
    })), // idle
  ];
}
```

- Priority 0 → fire immediately, up to 4 concurrent.
- Priority 10 → fire when the priority-0 queue drains.
- Priority 20 → fire only during `requestIdleCallback`.

With 2 chunks of lookahead at 500 candles each, you have ~1000 candles of runway. At any realistic drag speed the data is resident before the viewport reaches it, and the user never sees a fetch.

### 6.3 Debounce the _trigger_, not the fetch

```ts
// Scroll fires at 60–120 Hz. Recomputing the plan is cheap; firing is not.
const onViewportChange = rafThrottle((view) => {
  const plan = prefetchPlan(view, tf, velocity);
  scheduler.reconcile(plan); // diff against current queue; cancel nothing in flight
});
```

`reconcile` **reprioritises** the queue. It never cancels an in-flight request. A chunk that is no longer visible is still worth finishing — it cost nothing extra and the user may scroll back to it in two seconds.

### 6.4 Race-safe commits

Responses arrive out of order. That is fine and expected.

```ts
// ✅ Correct: chunk-keyed commit. Order is irrelevant; each lands in its own slot.
store.commit(chunkKey(symbol, tf, idx), chunk);

// ❌ Wrong: whole-array replacement. A late response for a stale range
//    overwrites fresher data, and the chart visibly "jumps back".
setCandles(response.candles);
```

Chunk-keyed merge-only commits make the entire class of response-ordering races structurally impossible. There is no stale-response guard to write, because there is no shared slot to clobber. The one exception is the **forming candle**: guard that with a monotonic sequence number, WS wins over HTTP.

---

## 7. Timeframe switching

This is the second half of what you asked for, and it has its own trick.

### 7.1 Instant switch via client-side rollup

When switching 1m → 5m, you frequently already hold the 1m data. Rolling 5 one-minute candles into one five-minute candle is pure arithmetic over data already in memory — sub-millisecond for a full viewport.

```ts
function rollup(src: OhlcvChunk, from: TF, to: TF): Candle[] {
  const factor = TF_MS[to] / TF_MS[from]; // 1m→5m = 5
  const out: Candle[] = [];
  for (let i = 0; i + factor <= src.n; i += factor) {
    out.push({
      time: src.t0 + i * TF_MS[from],
      open: src.o[i],
      high: Math.max(...src.h.slice(i, i + factor)),
      low: Math.min(...src.l.slice(i, i + factor)),
      close: src.c[i + factor - 1],
      volume: sum(src.v, i, i + factor),
      provisional: true, // <- flagged as derived
    });
  }
  return out;
}
```

**Two hard constraints:**

1. **Alignment.** The rollup is only valid if `src.t0` is aligned to the _target_ timeframe boundary. Because chunks are epoch-anchored and `CHUNK_CANDLES` is 500, a 1m chunk starts at a multiple of 500 minutes — **not** a multiple of 5 minutes in general. Either set `CHUNK_CANDLES` to a value divisible by all your rollup factors (**720** works: divisible by 5, 15, 60 — and matches the slice count you already use elsewhere), or trim the leading partial group before rolling up. Setting `CHUNK_CANDLES = 720` is the cleaner call.

2. **Provisional, then reconciled.** Draw the rolled-up candles **immediately** (`provisional: true`, rendered identically), and fire the real 5m chunk request in the background at priority 0. When the server chunk lands, it replaces the provisional data. Any tiny discrepancy — a trade landing exactly on a boundary, a late-arriving fill — is corrected without the user ever seeing an empty chart.

The user experience: timeframe switching is **instant**, then silently becomes authoritative ~100 ms later.

### 7.2 Footprint does not roll up client-side

Merging footprint cells across timeframes requires re-bucketing the _price_ axis too, and the tick grouping differs per timeframe. Do not attempt it in the browser. Footprint on timeframe switch: show the plain candles from the rollup, fetch real footprint chunks at priority 0, fill in on arrival. This is the expected, acceptable ~200 ms.

### 7.3 Keep the other timeframe's cache

On switching 1m → 5m, **do not clear the 1m chunks.** They cost you ~0.5 MB and the user switches back constantly. Keep the last 2–3 timeframes fully resident; LRU past that. This makes 1m ↔ 5m ↔ 15m flipping entirely free after the first visit to each.

---

## 8. L6 — Rendering rules

The render loop reads the store **synchronously**. It never awaits anything, and it never blanks.

```ts
function drawViewport(ctx, view, tf, symbol) {
  for (const idx of requiredChunks(view, tf)) {
    const key = chunkKey(symbol, tf, idx);
    const chunk = chunkStore.getOhlcv(key);

    if (chunk === undefined)
      drawSkeleton(ctx, chunkRange(idx, tf)); // loading
    else if (chunk === "empty")
      drawNoDataEdge(ctx, chunkRange(idx, tf)); // tombstone
    else {
      drawCandles(ctx, chunk);
      const fp = chunkStore.getFootprint(key);
      if (fp && fp !== "empty") drawFootprint(ctx, fp); // detail layer, optional
    }
  }
}
```

Four rules:

1. **Per-chunk loading state.** A skeleton over one 500-candle region, not a spinner over the whole canvas. The user keeps their spatial orientation.
2. **Never `clear()` on a fetch.** The canvas only clears on an actual repaint, and the repaint always draws whatever is currently resident.
3. **Repaint is driven by store version, not by fetch completion.** `useSyncExternalStore` → version bump → `requestAnimationFrame` → redraw. Multiple chunks landing in one frame produce one repaint.
4. **Skeleton is a muted band, not an empty region.** Visually communicates "arriving" rather than "nothing here" — the difference between feeling slow and feeling broken.

---

## 9. Implementation plan

Phased so each step is independently shippable and independently verifiable. This ordering is deliberate: **Phase 1 alone fixes the disappearing-data bug**, and Phase 2 alone fixes most of the slowness.

### Phase 1 — Kill the disappearing-data bug (highest value, lowest risk)

- Create `lib/chart/chunkStore.ts` as a module singleton. No React imports in that file.
- Move all candle/footprint data out of component state and Zustand slices into it.
- Implement `chunkIndexOf` / `chunkKey` with `CHUNK_CANDLES = 720`.
- Implement `ensureChunk` with the in-flight registry (§5.2).
- Re-scope `AbortController` to symbol change only. Delete every scroll-triggered abort.
- Bind React via `useSyncExternalStore`.

**Acceptance:** scroll left 3 days, scroll right to live, scroll left again → **zero** network requests on the second pass. Verify in the Network tab.

### Phase 2 — Backend precomputation

- Create hierarchical continuous aggregates 1m → 5m → 15m → 1h with refresh policies.
- Add `(symbol, bucket DESC)` composite indexes on every CAGG and on `footprint_cells`.
- Switch all read endpoints to select from the CAGG matching `tf`. Delete every runtime `time_bucket()` on the read path.
- Add compression + retention policies per §3.3.
- Confirm the route uses a pooled `pg` connection.

**Acceptance:** `EXPLAIN ANALYZE` on a 720-candle 15m chunk query returns under 20 ms. Endpoint p95 under 100 ms locally.

### Phase 3 — Chunk-aligned API + immutable caching

- Replace `?from=&to=` with `?chunk=`.
- Split `/api/history/*` (immutable) from `/api/tail/*` (no-store); add the `chunkRange[1] > now` guard.
- Switch payloads to columnar with implicit timestamps.
- Add tombstone responses for empty/retention-boundary chunks.
- Enable gzip/brotli on the route.

**Acceptance:** a second request for the same closed chunk shows `(disk cache)` in DevTools with no server hit. Payload for a 720-candle chunk is under 40 KB gzipped.

### Phase 4 — Two-tier loading + orchestration

- Eager-load the full 7-day OHLCV skeleton on symbol/tf select; pin it.
- Move footprint/profile/heatmap to lazy per-chunk fetch.
- Implement the priority queue and direction-aware prefetch (§6.2).
- Implement LRU eviction with the 200 MB budget and pinning.

**Acceptance:** dragging back 7 days at normal speed shows candles with zero blank frames; footprint fills in progressively. `performance.memory.usedJSHeapSize` stays under 250 MB.

### Phase 5 — Timeframe switching

- Set `CHUNK_CANDLES = 720` if not already.
- Implement client-side `rollup()` with the `provisional` flag.
- Reconcile against the server chunk on arrival.
- Retain the last 3 timeframes in cache instead of clearing on switch.

**Acceptance:** 1m → 5m → 15m → 1m renders in under 50 ms per switch on the second pass, no blank frames, no spinner.

### Phase 6 — IndexedDB persistence

- Persist closed chunks; startup sweep of stale entries.
- Read path: memory → IDB → network.
- Move IDB reads to a worker.

**Acceptance:** reload the page after a deep scroll session; scrolling back over the same range does zero network requests.

### Phase 7 — Fix Volume Profile properly

- Remove the 720-slice cap; profile slices become chunk-addressed like everything else.
- Implement Composite mode as a **server-side aggregate over an explicit requested range**, not a client-side sum of resident slices.

**Acceptance:** zoom out to 7 days in Composite mode and get a true full-range profile, independent of what is currently cached.

---

## 10. Things deliberately deferred

**Redis.** Correctly not now. At one user it buys nothing: Timescale's own buffer cache serves your hot window from RAM, HTTP `immutable` serves repeat requests from the browser with zero server hit, and IndexedDB serves across sessions. Redis becomes worthwhile when **many users request overlapping chunks** — then it caches serialised chunk payloads (`chunk:BTCUSDT:5m:931442` → the exact gzipped response bytes, TTL infinite for closed chunks) so N users share one DB read. The chunk-key design here is already Redis-shaped; adding it later is a ~50-line change in one file. Revisit at roughly 20+ concurrent users.

**Binary transport (Protobuf / Arrow / raw `ArrayBuffer`).** Another ~2–3x over columnar JSON and removes parse cost entirely. Real, but columnar JSON + brotli is already fast enough that this would be optimising the wrong thing right now. Revisit if payload parse shows up above 10 ms in a profile.

**CDN edge caching.** Your `/api/history/*` responses are immutable and public — they are perfect CDN candidates and Vercel will cache them at the edge with the headers in §4.2 essentially for free. Worth enabling in Phase 3, but it does nothing for a single user near your VPS.

**Server-sent aggregate push.** Streaming chunks over the existing WS instead of separate HTTP requests. Saves handshake overhead but loses HTTP caching, which is currently worth far more.

---

## 11. Quick reference — invariants

These are the rules that, if any one is broken, reintroduce the bugs:

1. Cache lives **outside React**, in a module singleton.
2. Cache key is `(symbol, tf, chunkIndex)`, **epoch-anchored** — never a raw time range.
3. Writes are **merge-only**. Nothing ever clears the store except symbol change or eviction.
4. `AbortController` is scoped to **symbol change**, never to scroll.
5. Closed chunks are **immutable** — cacheable forever, at every tier.
6. The forming candle is **never persisted** and always sourced from WS.
7. Loading state is **per chunk**, never global.
8. Timeframes are **precomputed server-side**; the read path never aggregates.
9. Empty ranges get a **tombstone**, never a silent empty response.
10. Concurrent requests for one key share **one promise**.

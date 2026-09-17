# Gap Report — Updated Status
*Original audit: 2026-09-16 | Updated: 2026-09-17*

---

## Priority 1 — Status (all done)

| ID | Gap | Original Status | Current Status | Evidence |
|----|-----|----------------|---------------|---------|
| **P1-A** | Stop clearing candles on timeframe switch (A3) | ❌ Missing | ✅ **Done** | `lib/chart/candleRetentionCache.ts` [NEW] — module-level singleton keyed by `symbol::contractType::timeframe`. `resetPanelRuntime` now accepts `{ keepCandles }`. TF switch replays cache instantly; symbol switch full-clears. All 4 `pushAllCandles` sites update cache. |
| **P1-A bugfix** | Stale closure / wrong-TF candles bleeding into cache | (not in original) | ✅ **Done** | All 4 `candleRetentionCache.set` and `pushAllCandles` sites gated to `active && activeTimeframe === timeframe`. Site 2 derives source params from `snapshot.key`. |
| **P1-A bugfix 2** | 1m chart only showing live session ticks (strict mode race) | (not in original) | ✅ **Done** | Removed premature `!active` early-return inside `candleCache.restoreHistory`. Binance fetch completes for shared cache; result is replayed on resolution. |
| **P1-B** | Reduce poll interval 1200ms → 250ms | ❌ Missing | ✅ **Done** | `setInterval` at FeedProvider:2745 now fires at **250ms**. Confirmed in code. |
| **P1-B** | Widen prefetch threshold 150 → 500 bars | ❌ Missing | ✅ **Done** | `getScrolledCandlesRestoreWindow` threshold at FeedProvider:2157 is `< 500`. Confirmed in code. |
| **P1-C** | Fetch full 7-day candle count upfront | ❌ Missing (was `limit=500`) | ✅ **Done** | `fetchStoredHistory` now sends `limit = Math.min(10080, ceil(604800 / timeframeSeconds))`. For 1m → 10,080 candles. Verified API returns 10,080 rows. DB cap is 50,000. |
| **P1-D** | Add `Cache-Control` headers on past-range responses | ❌ Missing | ✅ **Done** | `app/api/history/candles/route.ts`: past-range requests (`until < now - 3600`) get `public, max-age=3600, stale-while-revalidate=86400`; live-edge gets `no-store`. |
| **P1-D** | Remove `force-dynamic` and `cache: 'no-store'` | ❌ Present (blocking cache) | ✅ **Done** | Removed `export const dynamic = 'force-dynamic'` from candles route. Removed `cache: 'no-store'` from all 3 client fetch calls (initial load, lazy candles, footprint restore). |
| **P1-D** | Same Cache-Control for footprint route | ❌ Missing | ✅ **Done** | `app/api/history/footprint/route.ts`: same pattern — past range gets `public, max-age=3600, stale-while-revalidate=86400`. `force-dynamic` removed. |
| **P1-E** | Empty tombstone on scroll-past-retention | ✅ Already done in original | ✅ **Done** | `lastLazyCandlesRestoreKey = until` on empty response. No change needed. |

### New gaps discovered and fixed (not in original report)

| ID | Gap | Status |
|----|-----|--------|
| **P1-F** | `market_candles` table had 0 rows — no historical data in DB at all | ✅ **Done** — `lib/feeds/serverBinanceCandles.ts` [NEW]: server-side Binance REST fetcher via `undici.ProxyAgent` (`BINANCE_PROXY_URL`). Auto-persists 10,080 closed candles to TimescaleDB via `storeCandles()`. |
| **P1-G** | Footprint retention capped at 500 candles & 720 base slices | ✅ **Done** — Increased `MARKET_CACHE_MAX_BASE_SLICES` to 15,000 (~10 days) and `AggregationEngine.maxCandles` to 15,000 across main thread & worker. Guarded `trim()` to prevent deleting historical footprints. |
| **P1-H** | Footprint chunks not hydrating main thread engine directly | ✅ **Done** — In `hydrateStoredFootprintRange`, added `engineRef.current.hydrateBaseFootprintCandle(candleTime, cells)` before worker postMessage, ensuring instant canvas render without waiting on worker roundtrip. |
| **P1-I** | Lazy profile restore interval blocking footprint scroll restores | ✅ **Done** — Removed early `return;` statements in `lazyProfileRestoreInterval`. Panning left now evaluates `scrolledFootprintRange` and `scrolledCandleUntil` immediately, regardless of background profile loading. Capped historical session batches to 2 segments. |
| **P1-J** | TimescaleDB pool connection starvation & redundant quicksorts | ✅ **Done** — Raised pool `max` from 5 to 20 in `lib/db/timescale/client.ts`. Removed `ORDER BY bucket_price ASC` from `footprintRepository` and `profileRepository` SQL queries (retaining indexed `time ASC`). |
| **P1-K** | Historical profile HTTP caching & non-blocking bubble restore | ✅ **Done** — Added `Cache-Control` on `/api/history/profile` and `/api/history/aggregate-bubbles`; decoupled bubble restore from blocking initial chart startup. |

---

## Priority 2 — Not started

| ID | Gap | Impact | Effort | Notes |
|----|-----|--------|--------|-------|
| **P2-A** | Module-level `ChunkStore` singleton with chunk-index addressing (A1, A2, A4) | HIGH | HIGH | The architecture change that unlocks A3 (done via workaround), A5, A6, E1. Currently candles still copy into Zustand. |
| **P2-B** | Columnar payload format (C4) | MEDIUM | MEDIUM | Current: array of objects `{time, open, high, close, ...}`. Each candle ~7 keys. Switch to column arrays → ~4× smaller payload + faster parse. |
| **P2-C** | Per-table retention policies (B4) | LOW | LOW | All tables share `MARKET_DATA_RETENTION_DAYS=90`. Design spec: footprint 7d, raw trades 3d, candles 90d. |
| **P2-D** | Chunk-aligned API with permanent `immutable` cache headers (C1, C2) | MEDIUM | HIGH | Replace `?until=` with `?chunk=` index. Current 1h max-age is a workaround; immutable chunk caching would allow `max-age=31536000`. |

---

## Priority 3 — Not started

| ID | Gap | Notes |
|----|-----|-------|
| **P3-A** | Client-side 1m→5m rollup for instant TF switch (F1, F2) | Needs P2-A ChunkStore first |
| **P3-B** | Direction-aware prefetch priority queue (E2) | Needs P2-A ChunkStore first |
| **P3-C** | Chunk-addressed Volume Profile (G1, G2) | Server-side composite aggregate endpoint |
| **P3-D** | Hierarchical continuous aggregates (B1) | Not needed for single-user; pre-bucketed write-time approach works |
| **P3-E** | `AbortController` scoped to symbol change (A5) | Low severity — `active` boolean provides logical guard |
| **P3-F** | `useSyncExternalStore` binding (A8) | Polish only |

---

## Deferred (unchanged)

- **H1, H2, H3** — IndexedDB persistence
- Redis
- Binary transport (Protobuf/Arrow)

---

## Key Invariant Status

| Invariant | Before | After |
|-----------|--------|-------|
| Cache lives outside React | ⚠️ Partial | ⚠️ Partial — `candleRetentionCache` is module-level; candles still copy into Zustand as render source |
| Writes are merge-only (no clear on TF switch) | ❌ | ✅ TF switch replays cache; symbol switch still full-clears |
| Closed chunks have caching headers | ❌ | ✅ `public, max-age=3600, stale-while-revalidate=86400` on past-range |
| Client doesn't bypass cache with `no-store` | ❌ | ✅ Removed from all fetch calls |
| 7-day candle window fetched upfront | ❌ | ✅ 10,080 for 1m; timeframe-proportional for 5m+ |
| Scroll prefetch fires before edge | ❌ | ✅ 500-bar trigger (was 150) at 250ms poll (was 1200ms) |
| DB has historical candle data | ❌ 0 rows | ✅ 10,079 rows; auto-seeds on cold start |
| Cache key is chunk-indexed | ❌ | ❌ Still raw `until` timestamp |
| Per-chunk loading skeleton | ❌ | ❌ Still global `isLoadingHistory` |
| AbortController on symbol change | ❌ | ❌ `active` boolean only |
| Forming candle never persisted | ✅ | ✅ |
| Empty ranges get tombstone (candles) | ✅ | ✅ |

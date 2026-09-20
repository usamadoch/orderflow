# Task: Fix Candle/Profile Load Regression + Footprint Cache Verification + Loading Indicator + Regression Guard

## Context

Same root cause as the bubble fix from the previous task: large row counts over the remote Timescale Cloud connection are slow regardless of query speed on the DB side. The bubble fix (server-side `minVolume` filter, reducing rows before transfer) worked. It was never applied to candles or volume profile, and yesterday's P1-C change (raising the initial candle fetch from 500 to 10,080 rows) made the candle case worse by increasing the exact payload size that's slow to transfer.

Evidence from production logs:

```
GET /api/history/candles?...limit=10080 200 in 175034ms        <- 175s, was fine at 500 rows
GET /api/history/profile?...&start=X&end=Y  200 in 132414ms    <- 2500+ rows, 130s+
GET /api/history/profile?...rowsFetched: 0  200 in 902ms       <- 0 rows, <1s (proves it's row count, not query speed)
GET /api/history/footprint?...start=A&end=B 200 in 20124ms
GET /api/history/footprint?...start=A&end=B 200 in 20444ms     <- SAME range fetched twice, both slow, no cache hit
```

Do not implement anything until Step 1 (diagnostic) is done and reported back. This task has 5 independent pieces — treat them as separate, individually-committable changes.

---

## Step 1 — Diagnostic first (do this before any fix)

For each of candles, profile, and footprint, confirm the bottleneck is wire transfer and not something else:

1. Run `EXPLAIN ANALYZE` on the actual candle, profile, and footprint queries for a realistic row count (10,080 candles; ~2,500 profile rows; ~2,000 footprint rows). Confirm DB execution time is low (should be well under 500ms, matching what was found for bubbles).
2. If DB execution time is low but total request time is high, this confirms wire transfer is the bottleneck for all three, same as bubbles. Report the numbers.
3. If any of the three shows high DB execution time (not just transfer), stop and report — that one needs a different fix (index/query, not chunking).

---

## Step 2 — Fix candle upfront fetch (the regression)

**Do not revert P1-C.** The 7-day upfront load is correct and valuable — it's what makes scrollback instant. The fix is to make the large payload cheap to transfer, not to shrink it back to 500.

Options, in order of preference:

**A. Reduce payload size per row (columnar/compact format).** If the candle API currently returns one JSON object per candle with named keys, switch to a columnar response (arrays of values, implicit timestamps via `t0` + `step`) as outlined in the original system design doc. This alone can cut payload size 3-4x with no reduction in row count, directly attacking the wire-transfer cost.

**B. Chunk the initial 10,080-row fetch into parallel smaller requests.** Instead of one request for 10,080 rows, fire 4-5 parallel requests of ~2,000-2,500 rows each (same pattern already proven to work for footprint's chunked range fetching). Parallel smaller requests transfer faster in aggregate than one large sequential one, and the user sees the first chunk render while later chunks are still in flight.

Implement A first — it requires no change to the fetch/render pipeline, just the response shape. If A alone doesn't get the initial load under ~5 seconds, add B on top.

**Verification:** Reload the app cold. Time from page load to first candle render. Target: under 5 seconds for the full 10,080-candle load.

---

## Step 3 — Fix volume profile load (same fix as bubbles)

Apply the same fix pattern that worked for aggregate bubbles: reduce the number of rows that need to travel over the wire per request.

1. Check whether the profile API already supports a resolution/bucket-size parameter that reduces row count server-side (the `baseBucketSize=1.5` param is visible in the logs — confirm whether raising it reduces `rowsFetched`, or whether the fine-grained rows are always fetched at full resolution regardless of this param).
2. If fine-resolution rows are always fetched regardless of the requested bucket size, that's the bug — the server should pre-aggregate to roughly the requested resolution before sending, not send every fine row and let the client re-bucket. This mirrors the bubble fix conceptually: filter/reduce before the wire, not after.
3. Apply columnar payload format here too, same as Step 2's option A — profile rows are a strong fit for this (price + volume per bucket, no need for repeated JSON keys per row).

**Verification:** Time a session-profile load for a similar row count to the ones in the log (2,000-3,000 rows). Target: under 5 seconds. Compare against the `rowsFetched: 0 → 902ms` baseline in the logs — a 2,500-row fetch should not be 100x slower than a 0-row fetch.

---

## Step 4 — Verify footprint caching is actually wired

The logs show the identical time range fetched twice in one session, both slow, no cache hit:

```
start=1789747200&end=1789754400 → 20124ms
start=1789747200&end=1789754400 → 20444ms
```

This means either:

- The `Cache-Control` headers added in the earlier P1-D task aren't present on this route (check if it regressed — search for `force-dynamic` or `cache: 'no-store'` reappearing anywhere in the footprint route or its client fetch call), or
- Headers are present but something client-side (a cache-busting query param, a changed request shape) is preventing a cache hit even on an identical range.

1. Confirm `Cache-Control` headers are still present on `/api/history/footprint` responses for past ranges. If missing, someone (an agent, a partial revert) removed them — re-add per the P1-D pattern.
2. If headers are present, check the Network tab for the second identical request — does it show `(disk cache)`/`(memory cache)`, or a fresh network response? If fresh despite correct headers, check for any per-request cache-busting (timestamp param, random query string) being added client-side.
3. Report which of the two it is before fixing.

---

## Step 5 — HSVP loading indicator

Historical Session Volume Profile currently gives no visual feedback while loading — the user sees nothing until it either appears or silently fails to.

1. Find where HSVP fetch state is tracked (or confirm it isn't tracked at all).
2. Add a loading state that renders a visible indicator (skeleton, spinner, or "loading session profile..." label) positioned where the profile will appear, from the moment the fetch starts until data arrives or an error occurs.
3. If the fetch errors or times out, show an explicit error state instead of silently doing nothing — the current failure mode ("it's been some time and it's not even showing indication") is worse than a visible error.

This is independent of Steps 1-4 and can ship on its own regardless of how long the fetch actually takes once Step 3 is fixed.

---

## Step 6 — Regression guard (prevents this exact cycle from recurring)

Create a script that times the three core endpoints against a fixed threshold, so a performance regression is caught before a task is marked done, not discovered the next morning.

**File: `scripts/perf-check.mjs`** (or `.ts`, match project convention)

```js
// Pseudocode structure — implement against actual API routes and realistic params
const CHECKS = [
  {
    name: "candles-initial",
    url: "/api/history/candles?...limit=10080",
    maxMs: 5000,
  },
  { name: "profile-session", url: "/api/history/profile?...", maxMs: 5000 },
  { name: "footprint-range", url: "/api/history/footprint?...", maxMs: 5000 },
  {
    name: "bubbles-filtered",
    url: "/api/history/aggregate-bubbles?...",
    maxMs: 5000,
  },
];

// For each: time the request, fail (non-zero exit) with a clear message if over threshold.
// Run against a local dev server or staging — not production.
```

Add a note to the project's task/log workflow (`log.md` or equivalent) that this script should run before any task touching a `/api/history/*` route is marked complete. This doesn't need to be CI-wired yet — a manual `node scripts/perf-check.mjs` run at the end of relevant tasks is enough for now, given this is a single-user setup.

---

## Priority order

1. **Step 1** (diagnostic) — always first, don't skip.
2. **Step 2** (candles) — highest user-facing impact, this is what's currently blocking the app from loading at all.
3. **Step 3** (profile) — second highest impact, same fix pattern, should be fast to apply once Step 2's approach is proven.
4. **Step 4** (footprint cache) — likely a quick find-and-fix once confirmed which of the two causes it is.
5. **Step 5** (HSVP indicator) — independent, low-risk, ship anytime.
6. **Step 6** (regression guard) — do this last, once the actual thresholds are known to be achievable from Steps 2-3.

## Verification (full pass, after all steps)

1. `npx tsc --noEmit` — must exit 0.
2. Cold reload the app. Full candle load, footprint, and any open profile should each complete within the thresholds set in Step 6.
3. Draw a new HSVP session profile — loading indicator appears immediately, resolves within a few seconds, no silent multi-minute wait.
4. Scroll left/right across a range already fetched this session — footprint and profile should not re-fetch (confirm via Network tab).
5. Run `node scripts/perf-check.mjs` — all four checks pass.

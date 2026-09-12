# Task: Collector Reliability + Logging Fixes

File: BTCUSDT collector (Binance WS → aggregation → TimescaleDB writer).

Context: this collector feeds a live order-flow trading platform, including a
web-to-MT5 execution bridge that has already placed real trades. Silent data
loss here is a correctness bug with financial consequences, not just a log
nuisance. Priority is: never silently treat incomplete data as complete, and
make every skip/loss event visible in logs immediately, not just as a buried
counter.

Do not refactor working logic beyond what's specified below. Specifically,
leave `getCoverageStart` / `getClosedBeforeTime` / the slice-flush gating
alone — that design is correct as-is and depends on `isBackfilling` /
`connected` being accurate, which is what Fix 2 and Fix 3 restore.

---

## P1 — Data Integrity (Critical)

### Fix 1: `lastTradeTimeMs` is stamped on non-trade messages

**Problem:** `ws.onmessage` sets `sourceState[source].lastTradeTimeMs =
Date.now()` for every message, including `kline_1m` updates. This value is
used as the backfill `gapStart` on reconnect. Because it isn't scoped to
actual trades, the recorded "last trade time" can be later than the last
trade actually processed, which can cause backfill to start after a real
gap boundary.

**Fix:**

- Remove the stamp from the top of `ws.onmessage`.
- Inside `handleStreamMessage`, move the stamp into the `@aggTrade` branch,
  after `isValidTrade(trade)` returns true — not before.

```js
// remove this from ws.onmessage:
sourceState[source].lastTradeTimeMs = Date.now();

// add this inside handleStreamMessage, right after:
if (!isValidTrade(trade)) return;
sourceState[source].lastTradeTimeMs = Date.now(); // <-- add here
metrics.tradesReceived[source] += 1;
```

**Acceptance:** `lastTradeTimeMs` only changes on validated aggTrade
messages. Verify via a quick log/assert during a manual reconnect test.

---

### Fix 2: A failed backfill is reported as a completed backfill

**Problem:** `runBackfill()` catches network/HTTP errors, logs them, and
`break`s out of its loop — then returns normally. The caller's `.finally()`
sets `sourceState[source].isBackfilling = false` regardless of whether the
backfill actually reached `endTime`. Downstream, `getClosedBeforeTime` only
checks the boolean, not actual completeness — so persistence can resume
over a real gap without anyone knowing.

**Fix — make completion explicit, retry until actually caught up:**

1. Change `runBackfill(source, startTime, endTime)` to return whether it
   reached `endTime`:

   ```js
   async function runBackfill(source, startTime, endTime) {
     // ...existing loop body, unchanged...
     return currentStartTime >= endTime;
   }
   ```

2. Replace the direct call in `ws.onopen` with a retry wrapper that keeps
   `isBackfilling = true` until backfill genuinely completes or a retry
   budget is exhausted:

   ```js
   async function runBackfillUntilComplete(source, startTime) {
     let cursor = startTime;
     let attempt = 0;
     const maxAttempts = 20; // ~30min at max backoff — tune as needed

     while (!shuttingDown) {
       const endTime = Date.now();
       const completed = await runBackfill(source, cursor, endTime);
       if (completed) return { ok: true };

       attempt += 1;
       if (attempt > maxAttempts) {
         return { ok: false, cursor };
       }

       const delay = Math.min(
         config.reconnectMaxMs,
         config.reconnectMinMs * 2 ** Math.min(attempt - 1, 10),
       );
       logger.warn("backfill incomplete, retrying", {
         source,
         attempt,
         delayMs: delay,
       });
       await new Promise((r) => setTimeout(r, delay));
     }
     return { ok: false, cursor };
   }
   ```

   Note: `runBackfill` currently doesn't expose where it stopped on partial
   failure. Add a way to read that (return the last successfully processed
   `currentStartTime` alongside the completion flag) so retries resume from
   there instead of re-fetching the whole window each time. Overlap is safe
   either way (dedupe handles it) — this is just to avoid wasted calls.

3. In `ws.onopen`, call the wrapper and act on the result:
   ```js
   if (gapStart) {
     sourceState[source].isBackfilling = true;
     runBackfillUntilComplete(source, gapStart)
       .then((result) => {
         if (!result.ok) {
           markSourceGap(source, result.cursor, Date.now());
         }
       })
       .finally(() => {
         sourceState[source].isBackfilling = false;
       });
   }
   ```

**Fix 2b — finish `markSourceGap` / `taintedRangesBySource` instead of
deleting it.** This is the correct home for "backfill gave up, this range
might be incomplete":

- Add `taintedRangesBySource: { spot: [], futures: [] }` to
  `createRuntime()`'s return object (currently missing — this is why the
  function would throw if called today).
- `markSourceGap(source, start, end)` should push `{ start, end }` onto
  `runtime.taintedRangesBySource[source]` for every runtime with that
  source active.
- Persisted rows written for a slice time inside a tainted range should
  carry a flag (e.g. `data_quality: 'gap'` column, or a
  `tainted_ranges` row in `collector_meta`) so the trading platform's UI
  can visually distinguish "verified complete" from "gap, unresolved" data
  instead of presenting both identically.
- Log this loudly (see logging section below) — this is the single most
  important thing to make visible, since it means the collector itself
  doesn't have full confidence in a stretch of its own data.

**Acceptance:** Simulate a Binance API failure during backfill (e.g. point
`baseUrl` at an unreachable host temporarily). Confirm: (a) `isBackfilling`
stays `true` across the failed attempt and subsequent retries, (b)
persistence does not resume for that source during retries, (c) after
exhausting `maxAttempts`, a tainted range is recorded and logged clearly.

---

### Fix 3: Heartbeat is a no-op — zombie connections go undetected

**Problem:** `heartbeatTimer` calls `ws.ping?.()`. Node's built-in global
`WebSocket` (WHATWG-style) doesn't implement `.ping()` — so this is
silently doing nothing every 30s. A half-dead connection (no `close` event
fired, but no data flowing either) won't trigger reconnect/backfill until
something else notices.

**Fix:** track time since last message per source and self-heal:

```js
// in the heartbeat interval, replace the ping call with:
const idleMs = Date.now() - (sourceState[source].lastMessageAtMs ?? 0);
if (idleMs > EXPECTED_IDLE_THRESHOLD_MS) {
  // e.g. 90000 — tune to stream cadence
  logger.warn("stream appears stalled, forcing reconnect", { source, idleMs });
  ws.close(); // triggers existing onclose -> scheduleReconnect path
}
```

Add `sourceState[source].lastMessageAtMs = Date.now()` at the top of
`ws.onmessage` (separate from `lastTradeTimeMs` from Fix 1 — this one
tracks _any_ message, for liveness, not trade coverage).

**Acceptance:** Confirm a stalled-but-not-closed socket gets force-closed
and reconnected within one `EXPECTED_IDLE_THRESHOLD_MS` window.

---

## P2 — Resource Safety

### Fix 4: Unbounded memory growth during sustained write failures

**Problem:** `queuedAggregateBubbleEvents` has no size cap. If TimescaleDB
is unreachable or erroring for an extended period, this array (and the
per-runtime `footprintSlices` / `profileSlices` maps, which can't be
flushed either under the same failure) grow without bound. On a
memory-constrained host this is the realistic OOM path — not steady-state
trade volume.

**Fix:**

- Add a hard cap (e.g. `MAX_QUEUED_BUBBLE_EVENTS = 50000`). When exceeded,
  drop the oldest entries and log a `WARN`/`ERROR` with the count dropped —
  don't drop silently.
- Add an equivalent guard for accumulated footprint/profile slices: if
  `persistRuntimeEligibleSlices` has been failing for longer than some
  threshold (track a `firstFailureAtMs` per runtime), log an escalating
  warning and consider whether to keep buffering or start dropping the
  oldest closed slices with a loud log — pick one deliberately rather than
  leaving it unbounded.
- Either way, this failure path must be loud (see logging section) — data
  being dropped due to a resource guard is exactly the kind of event Dean
  currently can't see.

---

## P3 — Logging Overhaul

**Problem statement (verbatim goal):** right now, when something goes
wrong or data gets skipped, it isn't visible in the logs — everything's
either silent (a counter incremented with no log line) or buried inside a
30-second interval JSON blob that's hard to scan.

**Requirements:**

1. **Every event that means data was lost or might be incomplete gets its
   own log line at the moment it happens**, not just a counter that shows
   up later in `logStatus()`. Concretely, add log calls (currently
   missing) at:
   - `ingestTrade`, the `!Number.isFinite(alignedPrice)` branch
     (`tradesSkippedMissingReference`) — this silently drops an accepted
     trade right now with zero log output.
   - Any tainted-range creation from Fix 2b.
   - Any drop event from Fix 4's memory guards.
   - `writeClosedSlice` / `insertAggregateBubbleDocuments` failures already
     call `logger.error`, keep those, but include current backlog size
     (pending slices / pending bubble events) in the payload so it's clear
     whether it's a blip or a growing backlog.

2. **Use a consistent, grep-able marker for anything meaning real data
   loss or unresolved risk** — e.g. prefix the log message with
   `DATA_GAP` or `DATA_LOSS`. Example:

   ```js
   logger.error("DATA_GAP backfill exhausted retries", {
     source,
     rangeStart: cursor,
     rangeEnd: Date.now(),
   });
   ```

   This lets Dean run `grep DATA_GAP` (or filter by that string in whatever
   log viewer he's using) and immediately see every event that matters,
   instead of reading full output.

3. **Separate severity correctly** — this collector currently logs almost
   everything through `info`/`warn` regardless of whether it's routine or
   actually bad:
   - `info`: normal operation (connect, slice persisted, backfill started
     and completed successfully).
   - `warn`: recoverable/expected (duplicate skip, single retry attempt).
   - `error` + `DATA_GAP`/`DATA_LOSS` marker: anything meaning data is
     actually missing, dropped, or unverified.

4. **Make the periodic status log (`logStatus`, every
   `statusIntervalMs`) delta-based and scannable, not just cumulative
   totals.** Store the previous snapshot, log the _change_ since last
   interval front-and-center, keep full cumulative counts as secondary
   detail:
   ```js
   logger.info('collector status', {
     health: hasActiveTaintedRanges() ? 'DEGRADED' : 'ok',   // <-- add this
     sinceLastInterval: { tradesSkipped: ..., writeFailures: ..., dataGaps: ... },
     cumulative: { ...existing metrics... },
   })
   ```
   The `health` field is the key addition — a single glance at any status
   line should answer "is everything actually fine right now."

**Acceptance:** with these changes, deliberately trigger each of: a
missing-price-reference skip, a duplicate skip, a backfill failure, and a
write failure. Confirm each produces an immediate, distinguishable log line
(not just a counter bump), and that `DATA_GAP`/`DATA_LOSS` events are
grep-able and never mixed in with routine `info` noise.

---

## Constraints

- Don't touch `getCoverageStart` / `getClosedBeforeTime` / slice-flush
  gating logic — correct as-is, just needs accurate inputs (which these
  fixes restore).
- Don't change the `_test` export's existing keys/behavior for anything
  not touched above; do add any new internals worth testing (e.g.
  `runBackfillUntilComplete`, `markSourceGap`, the memory-guard functions)
  to `_test` following the existing pattern.
- Keep changes scoped to what's listed here — no unrelated style/refactor
  passes in the same change.

## Verification checklist before calling this done

- [ ] Fix 1: `lastTradeTimeMs` only updates on validated aggTrade
- [ ] Fix 2: simulated backfill failure keeps `isBackfilling: true` through
      retries; tainted range recorded and flagged on exhaustion
- [ ] Fix 3: stalled connection force-reconnects within one idle threshold
- [ ] Fix 4: queue/slice growth is capped with a loud drop log, not silent
- [ ] Logging: every data-loss path produces an immediate, grep-able log
      line; status log shows a clear `health` field
- [ ] Credentials moved to env var; old password flagged for rotation

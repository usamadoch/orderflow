Yes, got it. After the current quick-win task, I’d go in this order:

## Phase 2: “Disabled but still working” audit

Find anything that is visually hidden but still doing work in background.

Examples:

* CVD hidden but still calculating
* liquidity hidden but still scanning candles
* signals hidden/disabled but still computing
* bubbles hidden but still filtering/sorting events
* profile hidden but still restoring/building
* crosshair/mousemove still triggering full redraw
* Zustand still saving non-important state to localStorage

Goal: make disabled actually mean **no fetch, no calculate, no render, no store update**.

---

## Phase 3: Add real performance timers

Right now audit could not measure canvas layer timings.

So add internal timings:

* candles draw time
* footprint draw time
* bubbles draw time
* volume profile draw time
* signals draw time
* total redraw time
* restore fetch/parse/hydrate time

Goal: when chart freezes, you can see exactly which layer is expensive.

---

## Phase 4: Footprint display cache

Right now footprint display aggregation is recalculated repeatedly.

Fix:

* base footprint data stays same
* display result gets cached by timeframe + bucket size
* if user changes bucket/timeframe, reuse cache when possible

Goal: stop recalculating footprint cells every redraw.

---

## Phase 5: Volume Profile cache upgrade

Current profile cache is weak.

Fix:

* cache multiple profiles, not just one
* default profile and custom profiles should not evict each other
* cache by range + row size + source

Goal: custom/default profiles don’t rebuild again and again.

---

## Phase 6: Aggregate bubble visible lookup optimization

Right now aggregate bubbles can scan the full 20k buffer per redraw.

Fix:

* keep events sorted by time
* only lookup events inside visible time range
* avoid full-buffer scan/filter every frame

Goal: bubbles stay fast even with restored history.

---

## Phase 7: Reduce redraw frequency

Right now mousemove/crosshair/countdown can trigger too much redraw.

Fix:

* crosshair should not force expensive layers to redraw
* countdown should not redraw whole chart if unnecessary
* live updates should be batched/throttled

Goal: chart feels smooth during mouse movement and live updates.

---

## Phase 8: Split canvas layers

Instead of redrawing everything every time:

* static/background layer: grid, candles, footprint
* indicator layer: profile, bubbles, signals
* interaction layer: crosshair, drawings, hover

Goal: mousemove only redraws lightweight layer, not the full chart.

---

## Phase 9: Web Worker / chunked restore

Only after the above.

Move heavy parsing/aggregation/hydration away from main browser thread.

Goal: loading 6–24 hours should not freeze the UI.

---

## Phase 10: Longer candle history

Right now candles come from Binance latest 500, so not much is lost.

Later, collector can store candles too:

* 3–5 days candles
* restore from DB
* Binance only fills recent missing part

Goal: real historical chart continuity for a full week.

My recommendation: next do **Phase 2 audit** first. That will likely reveal a lot of hidden wasted work.

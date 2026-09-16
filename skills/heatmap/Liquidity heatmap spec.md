# Order Book Liquidity Heatmap — Implementation Spec

## 0. Read This First — Likely Cause of Prior Bugs

Bookmap-style heatmaps are almost always broken by one thing: **order book desync**. Binance's depth stream is a diff feed, not a full snapshot — you must combine it with a REST snapshot correctly, or the book silently drifts and every cell after that point is wrong (looks fine for a while, then garbage). Section 4 below is the part to get right before anything else.

## 1. Goal

A panel that shows where resting bid/ask liquidity has been sitting in the order book, over time, so it's easier to judge realistic areas for stop-loss/take-profit — walls of resting size tend to act as support/resistance. It doesn't matter if that liquidity later gets pulled or filled; the heatmap is a record of what was there, not a prediction.

## 2. Scope

**In scope:** live order book depth rendered as a heatmap, historical replay of that heatmap, executed trades drawn on top as a separate layer.

**Out of scope — do not build:** iceberg/spoofing detection, order lifecycle tracking (why liquidity left), any new indicators, any changes to existing footprint/volume-profile/bubbles/VWAP code. This is one panel, nothing else.

## 3. Architecture Overview

New panel, separate from the candlestick chart — a DOM/Bookmap-style vertical price ladder that scrolls horizontally through time.

- Its own `<canvas>` and its own render loop, decoupled from the main chart's render loop.
- **Y-axis (price):** subscribes to the same price-scale state as the main chart, so panning/zooming price stays visually aligned.
- **X-axis (time):** subscribes to the same time-scale state as the main chart, so both scroll together.
- **Background layer:** heat intensity per price bucket per time slot = resting bid/ask size at that moment.
- **Foreground layer:** executed trades drawn on top as simple markers (dots/ticks) — not the existing Volume Bubbles indicator, keep it visually distinct and simple.

## 4. Data Ingestion — Binance Order Book Depth

Plain-English: Binance gives you a live stream of _changes_ to the book (diffs), not the full book each time. To know the actual state of the book you have to start from a full snapshot and then correctly apply only the diffs that come _after_ that snapshot, in order, with no gaps. If a gap is ever detected, the book must be considered untrustworthy and re-synced from a fresh snapshot — never patched over.

**Implementation steps:**

1. Open the depth diff WebSocket stream for the symbol first, and start buffering incoming events (don't process them yet).
2. Fetch a REST order book snapshot (includes `lastUpdateId`).
3. Discard any buffered diff event where `u <= lastUpdateId` (older than the snapshot).
4. The first diff event you apply must satisfy `U <= lastUpdateId+1 <= u`. If it doesn't, drop the snapshot and retry from step 2.
5. Apply subsequent diffs in order. Each new event's `U` must equal the previous event's `u + 1`. If it doesn't — gap detected — discard the current book state and restart from step 2.
6. On any WS disconnect/reconnect, always restart from step 2. Never resume from local state.

Add a visible dev-mode counter/log for resync events — if this fires constantly in normal operation, that's the bug, not the rendering.

## 5. Data Model

- **Price bucket size:** configurable, default = instrument tick size. Don't hardcode.
- **Time bucket (sample interval):** how often the live book is snapshotted into the historical grid. Default 200–250ms — enough to feel live without sampling every single diff.
- **Storage:** sparse structure keyed by `[timeSlot][priceLevel] -> { bidSize, askSize }`. Ring buffer over time, capped at a configurable retention window (e.g. a few hours) — old slots are evicted as new ones come in, not stored forever.
- Once a time slot is written, its values are fixed (it's a historical record of what the book looked like then). Only the current/latest slot is live and changing.

## 6. Rendering

**Color mapping (plain English):** resting size at a given price/time varies hugely — a normal level might have 2 BTC resting, a wall might have 200. If you map size to color linearly, everything below the wall looks like nothing. Use a non-linear scale.

**Implementation notes:**

- Use log scaling or percentile clamping (e.g. clamp to the 95th percentile of currently visible sizes, anything above that is "max color") before mapping to the color gradient.
- Recompute the clamp bounds periodically (e.g. once per second) from the currently visible viewport, not once globally — liquidity conditions change.
- Gradient: dark/transparent for near-zero, through to a bright color for high size. Keep it visually separate from candle colors so it doesn't compete with the main chart.

## 7. Trade Overlay

Executed trades drawn as a lightweight marker layer on top of the heatmap, at their execution price/time. No bubble sizing logic, no color-by-aggressor complexity — this is a simple visual reference layer, not a new indicator.

## 8. Performance Constraints

This platform has an existing history of main-thread stalls from synchronous per-tick work (VWAP recompute, volume profile rebuild, candle scoring). Do not repeat that pattern here:

- Depth-stream processing and grid aggregation should run off the main thread (Web Worker), posting only changed cells to the main thread for paint.
- Throttle paint to the configured sample interval — never re-render on every raw WS message.
- Ring-buffer eviction must actually free memory (verify with heap snapshots), not just stop growing the visible window.
- Reuse the existing `PerformanceObserver('longtask')` instrumentation already in the platform to confirm this feature adds no long tasks.

## 9. Config / Tunables to Expose

- Price bucket size
- Time sample interval
- History retention window length
- Color scale clamp (percentile or fixed min/max)
- Panel width

## 10. Acceptance Criteria

- [ ] Panel renders beside the chart; y-axis price scale matches the main chart 1:1 while panning/zooming.
- [ ] Heat values match Binance's own order book depth for the same moment (spot-check against exchange UI).
- [ ] Forcing a dropped/out-of-order WS message triggers a clean resync (Section 4), not a permanently wrong book.
- [ ] No new long tasks attributable to this feature under the existing longtask instrumentation.
- [ ] Running for an extended session does not grow memory unboundedly (retention window enforced).
- [ ] Trade overlay renders independently of heat layer and can be toggled without affecting it.

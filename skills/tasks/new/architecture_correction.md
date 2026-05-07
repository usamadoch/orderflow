







# Architecture Correction — Custom Canvas

---

## What Changed and Why

Original plan used `lightweight-charts` (TradingView's OSS library) as the candlestick renderer, then attempted to overlay a second canvas on top for footprint cells. That approach is broken by design — the library owns its canvas internally and does not expose it. Syncing two canvases across scroll and zoom is a fragile workaround, not a real solution.

Correct approach: one canvas, owned entirely by us, rendering everything.

---

## What Stays Valid

These phase docs are unchanged. No rewrites needed.

- **Phase 1** — shell, layout, fonts, CSS variables — untouched
- **Phase 2** — Binance adapter, WebSocket, store — fully valid
- **Phase 4** — aggregation engine, footprint data structure, delta math — fully valid

The data layer is correct. Only the rendering layer changes.

---

## What Needs Rewriting

### Phase 3 — Candlestick Chart
The doc must be fully replaced. Remove all references to `lightweight-charts`. The candlestick chart is now drawn on our own canvas using our own coordinate system. Pan and zoom are implemented by us. Axes are drawn by us.

### Phase 5 — Footprint Canvas
The doc must be fully replaced. The overlay approach is gone. Footprint is now just a different draw mode on the same canvas Phase 3 sets up. The coordinate functions are shared. A mode toggle switches which draw function runs.

---

## New Architecture — Single Canvas

One `<canvas>` element. One coordinate system. Two draw modes.

```
ChartCanvas
├── Coordinate system        priceToY(), indexToX()
├── Visible range            which candle indices are on screen
├── Pan                      mouse drag → scrollOffset → redraw
├── Zoom                     scroll wheel → barWidth → redraw
├── Price axis               right strip, auto min/max from visible candles
├── Time axis                bottom strip, labels every N bars
├── Draw mode: candlestick   OHLCV bars using same coordinates
└── Draw mode: footprint     cells using same coordinates, mode toggle in UI
```

The toggle between candlestick and footprint is a UI switch. Nothing in the coordinate system or canvas setup changes — only which draw function is called at the end of the render loop.

---

## Coordinate System — The Foundation

Everything depends on two functions. They must be defined before any drawing happens.

### `indexToX(candleIndex)`
- Takes the position of a candle in the candles array (its index)
- Returns the pixel x coordinate of its center on the canvas
- Depends on: `barWidth` (pixels per candle), `scrollOffset` (how far user has panned), canvas width
- Candles to the right are higher index. Latest candle anchors to the right edge by default.

### `priceToY(price)`
- Takes a price number
- Returns the pixel y coordinate
- Depends on: `visiblePriceMin`, `visiblePriceMax` (derived from visible candles' high/low), canvas height minus axis strip heights
- Higher price = lower y value (canvas y increases downward)

These two functions are defined once. Candlestick renderer uses them. Footprint renderer uses them. Volume profile uses them. Nothing else needs to know about scrollOffset or price range directly.

---

## Pan and Zoom

### Pan
- Mouse `mousedown` + `mousemove` on the canvas
- Track delta x between mouse positions
- Apply delta to `scrollOffset`
- Trigger redraw

### Zoom
- Mouse `wheel` event on the canvas
- Increase or decrease `barWidth` (pixels per candle)
- Clamp to min/max — e.g. `4px` minimum (very compressed), `120px` maximum (very zoomed)
- Anchor zoom to the candle under the cursor if possible, otherwise anchor to right edge
- Trigger redraw

### Visible range
- Derived from `scrollOffset`, `barWidth`, and canvas width
- `firstVisibleIndex` and `lastVisibleIndex` computed before every draw
- Price min/max auto-scaled from the high/low of only the visible candles
- This is recalculated on every redraw — never cached between frames

---

## Axes

### Price axis — right strip
- Fixed width strip on the right edge (e.g. 60px)
- Draws horizontal grid lines + price labels at regular intervals
- Interval calculated from visible price range — auto-adjusts with zoom
- Label format depends on asset: BTC uses 2 decimal places, ETH same

### Time axis — bottom strip
- Fixed height strip at the bottom (e.g. 24px)
- Labels every N candles depending on `barWidth`
- At tight zoom: label every 50 candles. At wide zoom: every 5.
- Format: `HH:MM` for intraday timeframes, `DD MMM` for daily+

---

## Candlestick Draw Mode

Called when mode is set to `"candle"`.

For each visible candle:
- Body: rectangle from `priceToY(open)` to `priceToY(close)`, centered on `indexToX(i)`, width ~70% of `barWidth`
- Wick: vertical line from `priceToY(high)` to `priceToY(low)`, centered on `indexToX(i)`
- Color: bullish if `close >= open` (`#26A69A`), bearish if `close < open` (`#EF5350`)

---

## Footprint Draw Mode

Called when mode is set to `"footprint"`.

Uses the exact same `indexToX` and `priceToY` as candlestick mode. No new coordinate logic.

For each visible candle:
- Get `FootprintCandle` from aggregation engine by `candle.time`
- For each price bucket in `footprintCandle.cells`:
  - `y = priceToY(bucketPrice + bucketSize)` — top of row
  - `rowHeight = priceToY(bucketPrice) - y`
  - `x = indexToX(i) - barWidth / 2` — left edge of candle column
  - Draw left half (bid vol) and right half (ask vol) with opacity scaling
- Draw delta label per candle (below low or in bottom strip)
- Optionally draw a thin OHLC wick behind the cells so price structure is still readable

Opacity scaling works the same as originally designed in Phase 5 — find max volume across all visible cells first, then scale each cell relative to that.

---

## Mode Toggle

A single `chartMode` value in the Zustand store: `"candle" | "footprint"`.

UI renders a toggle button. On change: update store, trigger canvas redraw. No remounting, no canvas teardown, same canvas instance draws differently.

The footprint mode requires the aggregation engine to have data. If the engine is empty (pair just connected, no trades yet), footprint mode shows wicks only until cells start filling in.

---

## What the Updated Phase Docs Need to Cover

### Revised Phase 3
- Remove `lightweight-charts` entirely
- Canvas setup, DPR handling
- Coordinate system: `indexToX`, `priceToY`
- Visible range calculation
- Pan and zoom implementation
- Price and time axis rendering
- Candlestick draw function
- Redraw trigger system (`requestAnimationFrame`)

### Revised Phase 5
- Mode toggle in store and UI
- Footprint draw function (cells, opacity, delta)
- How it reuses Phase 3 coordinate system
- Wick rendering in footprint mode
- Redraw trigger on new trade data (throttled)

---

## Files Affected

```
Unchanged:
├── lib/feeds/             — Phase 2, untouched
├── lib/store/chart.ts     — add chartMode field only
├── lib/aggregation/       — Phase 4, untouched
└── types/footprint.ts     — untouched

Rewritten:
└── components/chart/
    ├── ChartCanvas.tsx          — single canvas, owns setup + redraw loop
    ├── useCoordinates.ts        — indexToX, priceToY, visible range
    ├── usePanZoom.ts            — mouse event handlers, scrollOffset, barWidth
    ├── drawCandles.ts           — candlestick draw function
    ├── drawFootprint.ts         — footprint cell draw function
    └── drawAxes.ts              — price axis, time axis, grid lines

Removed:
├── CandleChart.tsx              — was lightweight-charts wrapper
├── FootprintCanvas.tsx          — was the broken overlay
└── useChartInit.ts              — was lightweight-charts specific
```

---

## Next Step

Revised Phase 3 doc first — that establishes the canvas and coordinate system everything else builds on. Then revised Phase 5 doc after.







# Phase 5 (Revised) — Footprint Draw Mode

---

## Goal

Add footprint rendering to the existing canvas from Phase 3.
No new canvas. No overlay. Same coordinate system, same redraw loop — just a second draw function called when `chartMode === 'footprint'`.

Phase 3 and Phase 4 must be complete before starting this phase.

---

## What Already Exists (Do Not Rebuild)

From Phase 3:
- `ChartCanvas.tsx` — canvas, redraw loop, resize, pan/zoom
- `useCoordinates.ts` — `indexToX`, `priceToY`, `getVisibleRange`, `getVisiblePriceRange`
- `usePanZoom.ts` — `scrollOffset`, `barWidth`
- `drawAxes.ts` — grid, price axis, time axis
- `chartMode` in Zustand store

From Phase 4:
- `AggregationEngine` — `getFootprintCandle(time)`, `getAllFootprintCandles()`
- `FootprintCandle`, `FootprintCell` types
- `normalizePriceToBucket`, `getCandleTimeForTrade` utilities

This phase adds one new file and wires it into the existing redraw branch.

---

## File Structure Changes

```
components/chart/
├── ChartCanvas.tsx         — minor edit: call drawFootprint in the chartMode branch
└── drawFootprint.ts        — new file, all footprint rendering logic here

lib/utils/canvas.ts         — add drawFootprintCell and drawDelta helpers
```

Nothing else changes structurally.

---

## 1. Mode Toggle UI

**File:** `components/ui/ChartModeToggle.tsx`

Simple two-option toggle. Reads `chartMode` from store, calls `setChartMode`.

### Appearance
- Two buttons side by side: `CANDLE` and `FOOTPRINT`
- Active mode: filled background `#3D7EFF`, white text
- Inactive: transparent background, muted text `#4A4A4A`
- Font: `JetBrains Mono`, small size
- Lives in the toolbar alongside pair and timeframe selectors

### Behavior
- On switch to footprint: if the aggregation engine has no data yet (feed just connected), footprint mode shows only wicks — cells fill in as trades arrive
- No loading state needed — partial data rendering is acceptable

---

## 2. ChartCanvas Edit

**File:** `components/chart/ChartCanvas.tsx`

The only change here is in the draw branch that already has a `chartMode` slot reserved from Phase 3.

Replace the placeholder comment with:
- If `chartMode === 'candle'` → call `drawCandles()` as before
- If `chartMode === 'footprint'` → call `drawFootprint()` instead

`drawCandles` and `drawFootprint` are mutually exclusive per frame. Both receive the same coordinate functions.

Also: footprint mode needs the engine. Pass the engine instance (from context) into `drawFootprint` alongside the coordinate functions.

---

## 3. drawFootprint Function

**File:** `components/chart/drawFootprint.ts`

### `drawFootprint(ctx, candles, visibleRange, indexToX, priceToY, barWidth, bucketSize, engine)`

The main footprint draw function. Called once per redraw when in footprint mode.

**Parameters:**
- `ctx` — 2D canvas context
- `candles` — the candles array from store (for OHLCV and time values)
- `visibleRange` — `{ firstIndex, lastIndex }` from `useCoordinates`
- `indexToX` — coordinate function from Phase 3
- `priceToY` — coordinate function from Phase 3
- `barWidth` — current zoom level, pixels per candle
- `bucketSize` — from store, e.g. `100`
- `engine` — the `AggregationEngine` instance

**What it does, step by step:**

**Step 1 — Find maxVol across all visible candles**

Before drawing anything, iterate all visible candles, get each one's `FootprintCandle` from the engine, iterate all cells, find the single highest value across all `askVol` and `bidVol` entries. This is `maxVol`.

This must happen before the draw loop — opacity scaling is relative to this value and cannot be computed per-candle independently.

**Step 2 — Draw wicks for all visible candles**

Even in footprint mode, draw thin OHLC wicks behind the cells. This preserves price structure readability. Wick color: `#4A4A4A` (muted, not the full bullish/bearish color — cells carry the color in this mode).

**Step 3 — Draw footprint cells**

For each visible candle:
- Get `x` from `indexToX(i)` — skip if null
- Get `FootprintCandle` from engine by `candle.time` — if null, skip (no trade data yet for this candle)
- Iterate each entry in `footprintCandle.cells` map:
  - Compute `y` and `rowHeight` using `priceToY` on the bucket's price range
  - Skip rows where `rowHeight < 2` — too compressed to be meaningful
  - Call `drawFootprintCell(ctx, x, y, barWidth, rowHeight, cell, maxVol)`

**Step 4 — Draw delta per candle**

After all cells are drawn, iterate visible candles again and call `drawDelta()` for each.

---

## 4. drawFootprintCell Helper

**File:** `lib/utils/canvas.ts`

### `drawFootprintCell(ctx, x, y, barWidth, rowHeight, cell, maxVol)`

**Parameters:**
- `ctx` — context
- `x` — center x of the candle column
- `y` — top pixel of this price row
- `barWidth` — full width of the candle's column
- `rowHeight` — height of this price row in pixels
- `cell` — `{ bidVol, askVol }` from the FootprintCandle
- `maxVol` — maximum single-side volume across all visible cells (for opacity scaling)

**What it draws:**

Each cell is split into two halves at the center of the candle column:
- Left half → bid volume (sellers aggressive) — red side
- Right half → ask volume (buyers aggressive) — teal side

Half width = `barWidth / 2 - 1` (1px gap between halves)

**Opacity scaling:**
- Bid opacity = `Math.max(cell.bidVol / maxVol, 0.06)` — floor of 0.06 keeps faint cells visible
- Ask opacity = `Math.max(cell.askVol / maxVol, 0.06)`
- Bid fill color: `rgba(239, 83, 80, bidOpacity)`
- Ask fill color: `rgba(38, 166, 154, askOpacity)`

**Volume text labels:**
- Only render if `rowHeight >= 11` and `barWidth >= 36` — below these thresholds fill only, no text
- Bid number: right-aligned inside the left half
- Ask number: left-aligned inside the right half
- Font: `JetBrains Mono`, `10px`
- Color: `#E8E8E8`
- Format: if volume is >= 1000, abbreviate to `1.2k`

---

## 5. drawDelta Helper

**File:** `lib/utils/canvas.ts`

### `drawDelta(ctx, x, delta, canvasHeight, timeAxisHeight)`

**Parameters:**
- `ctx` — context
- `x` — center x of the candle
- `delta` — the candle's `delta` value from `FootprintCandle`
- `canvasHeight` — total canvas height
- `timeAxisHeight` — height of the bottom time axis strip

**What it draws:**
- Renders delta value in a fixed strip just above the time axis
- Strip position: `y = canvasHeight - timeAxisHeight - 16`
- Text: signed number, e.g. `+1842` or `−934`
- Color: `#26A69A` if positive, `#EF5350` if negative
- Font: `JetBrains Mono`, `9px`
- Alignment: centered on `x`
- Abbreviate if >= 1000: `+1.8k`
- If `barWidth < 20`: skip rendering (too narrow, numbers overlap)

---

## 6. Redraw Throttling for Live Trades

In footprint mode, the canvas needs to update as trades come in — cells fill and brighten in real time.

The aggregation engine updates on every trade. At high volume that's thousands of trades per minute. Do not redraw on every single trade.

### Approach
- In `FeedProvider`, after calling `engine.ingestTrade()`, set a flag `pendingFootprintRedraw = true`
- A `setInterval` running at ~100ms checks this flag — if true, calls `redraw()` and clears the flag
- This caps footprint redraws to ~10 per second — smooth enough, not wasteful
- Candle mode does not need this — it only redraws on candle updates which are already infrequent

---

## 7. Engine Access

The `AggregationEngine` instance lives in a ref inside `FeedProvider`. Expose it via `ChartEngineContext` so `ChartCanvas` and `drawFootprint` can read from it without prop drilling.

```ts
// context shape
interface ChartEngineContextValue {
  engine: AggregationEngine | null
}
```

`ChartCanvas` reads from context, passes engine into `drawFootprint` as a parameter.

---

## 8. Bucket Size Control

Add a small input to the toolbar for bucket size. Reads `bucketSize` from store, calls `setBucketSize`.

When bucket size changes:
- `engine.reset()` is called
- Store clears candles? No — OHLCV data is still valid. Only footprint data is invalid.
- Canvas redraws — footprint cells are empty until trades rebuild them
- This is acceptable behavior — make it clear in UI with a brief "Rebuilding..." label if desired

---

## Completion Checklist

```
components/chart/
├── ChartCanvas.tsx               — drawFootprint wired into chartMode branch
└── drawFootprint.ts              — main footprint draw function

components/ui/
├── ChartModeToggle.tsx           — candle / footprint switch
└── BucketSizeInput.tsx           — bucket size config in toolbar

lib/utils/canvas.ts
├── drawFootprintCell             — cell halves, opacity, volume labels
└── drawDelta                     — delta strip below each candle

ChartEngineContext                — engine accessible to canvas without prop drilling

Behavior:
├── Footprint mode renders on same canvas as candlestick mode
├── Cells scale opacity to max visible volume across all visible candles
├── Bid/ask split clearly visible within each cell
├── Wicks visible behind cells for price structure reference
├── Delta rendered per candle in bottom strip
├── Text labels degrade gracefully at small bar widths
├── Live updates throttled to ~10 redraws/sec
└── Bucket size change resets cells, OHLCV unaffected
```

---

## What This Phase Does Not Cover

- Volume profile sidebar — Phase 6
- Imbalance highlighting (cells where ask/bid ratio exceeds threshold) — post-MVP
- Cumulative delta line — post-MVP
- Crosshair price/volume readout on hover — post-MVP
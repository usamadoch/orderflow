# Phase 3 (Revised) — Custom Canvas Candlestick Chart

---

## Goal

Build a fully custom canvas chart from scratch. No third-party chart library.
Renders candlesticks, price axis, time axis, grid. Supports pan and zoom via mouse.
This canvas is the foundation — Phase 5 footprint and Phase 6 volume profile both plug into what gets built here.

---

## File Structure

```
components/chart/
├── ChartCanvas.tsx        — canvas element, mounts everything, triggers redraws
├── useCoordinates.ts      — indexToX, priceToY, visible range, price min/max
├── usePanZoom.ts          — mouse event handlers, scrollOffset, barWidth state
├── drawCandles.ts         — candlestick draw function
└── drawAxes.ts            — price axis, time axis, grid lines

lib/utils/
└── canvas.ts              — initCanvas (DPR setup), shared helpers
```

---

## 1. Canvas Setup

**File:** `lib/utils/canvas.ts`

### `initCanvas(canvas, container)`

- Reads `window.devicePixelRatio` (default `1` if unavailable)
- Sets `canvas.width` and `canvas.height` to container dimensions multiplied by DPR
- Sets `canvas.style.width` and `canvas.style.height` to container dimensions in px (CSS size stays logical)
- Gets 2D context, calls `ctx.scale(dpr, dpr)` once — this makes everything render crisp on retina without any other changes
- Returns the context

Called on mount and whenever the container resizes.

---

## 2. ChartCanvas Component

**File:** `components/chart/ChartCanvas.tsx`

The top-level chart component. Owns the canvas ref, wires everything together, drives the redraw loop.

### What it holds
- `canvasRef` — ref to the `<canvas>` element
- `ctx` — 2D context, stored in a ref after init
- `scrollOffset` and `barWidth` from `usePanZoom`
- `candles` from Zustand store

### On mount
- Calls `initCanvas` to set up DPR-aware canvas
- Sets up a `ResizeObserver` on the container — on resize, calls `initCanvas` again then redraws
- Calls `redraw()` once to paint initial state

### `redraw()`
- Clears the canvas: `ctx.clearRect(0, 0, width, height)`
- Computes visible range and coordinate functions via `useCoordinates`
- Calls `drawGrid()`
- Calls `drawCandles()`
- Calls `drawAxes()`
- This function is called imperatively — not via React re-render. It runs via `requestAnimationFrame`.

### When redraw is triggered
- On every pan or zoom event
- On every new candle from the store (via `useEffect` watching `candles`)
- On container resize

### What it renders
- A `div` wrapper with `position: relative`, full width and height
- The `<canvas>` element inside it, also full width and height
- No other visual elements — axes and grid are drawn on canvas

---

## 3. Coordinate System

**File:** `components/chart/useCoordinates.ts`

Takes current state as input, returns coordinate functions. Called at the start of every redraw — never cached between frames.

### Inputs it takes
- `candles` — full candles array from store
- `scrollOffset` — how many pixels the user has panned from the right edge
- `barWidth` — pixels per candle (zoom level)
- `canvasWidth`, `canvasHeight` — logical canvas dimensions (not multiplied by DPR)
- `priceAxisWidth` — reserved strip on the right (e.g. `60`)
- `timeAxisHeight` — reserved strip on the bottom (e.g. `24`)

### `getVisibleRange()`
- Returns `firstIndex` and `lastIndex` — which candles in the array are currently on screen
- Chart anchors to the right: the most recent candle is at the right edge when `scrollOffset = 0`
- `lastIndex = candles.length - 1 - Math.floor(scrollOffset / barWidth)`
- `firstIndex = lastIndex - Math.floor(chartWidth / barWidth)`
- Clamp both to valid array bounds

### `getVisiblePriceRange()`
- Iterates visible candles only
- Finds the lowest `low` and highest `high` across them
- Adds padding — e.g. 5% on each side — so candles don't touch the top and bottom edges
- Returns `priceMin` and `priceMax`

### `priceToY(price)`
- Maps a price value to a canvas y coordinate
- Uses `priceMin`, `priceMax`, and the drawable height (canvas height minus time axis strip)
- Higher price → smaller y (canvas y increases downward)
- Formula: `((priceMax - price) / (priceMax - priceMin)) * drawableHeight`

### `indexToX(candleIndex)`
- Maps a candle's array index to the pixel x of its center
- Accounts for `scrollOffset` and `barWidth`
- Right-anchored: `chartWidth - (candles.length - 1 - candleIndex) * barWidth - scrollOffset % barWidth`
- Returns null if the x falls outside the drawable area — callers skip drawing that candle

---

## 4. Pan and Zoom

**File:** `components/chart/usePanZoom.ts`

Returns `scrollOffset`, `barWidth`, and the event handlers to attach to the canvas.

### State it manages
- `scrollOffset` — pixels panned from the right edge. `0` = latest candle at right. Increases as user pans left (into history).
- `barWidth` — pixels per candle. Default `12`. Min `3`. Max `80`.

### `onMouseDown(e)`
- Records starting mouse x, sets a dragging flag

### `onMouseMove(e)`
- If dragging: compute delta x from last position
- Apply delta to `scrollOffset` (drag left = increase offset, drag right = decrease)
- Clamp `scrollOffset` to `0` minimum (can't pan past the latest candle)
- Clamp to maximum: `(candles.length - 1) * barWidth` (can't pan past oldest candle)
- Trigger redraw

### `onMouseUp()`
- Clears dragging flag

### `onWheel(e)`
- `e.preventDefault()` to stop page scroll
- Read `e.deltaY` — negative = zoom in (increase `barWidth`), positive = zoom out (decrease)
- Scale factor: small multiplier per scroll tick, e.g. `barWidth *= 1.1` or `barWidth *= 0.9`
- Clamp to min/max
- Trigger redraw

All handlers are attached to the canvas element in `ChartCanvas` via `useEffect`. Wheel handler needs `{ passive: false }` in the event listener options to allow `preventDefault`.

---

## 5. Candlestick Draw Function

**File:** `components/chart/drawCandles.ts`

### `drawCandles(ctx, candles, visibleRange, indexToX, priceToY, barWidth)`

- Iterates from `firstIndex` to `lastIndex`
- For each candle:
  - Gets `x` from `indexToX(i)` — skip if null
  - Determines color: `#26A69A` if `close >= open`, `#EF5350` if `close < open`
  - **Wick:** draws a 1px vertical line from `priceToY(high)` to `priceToY(low)`, centered on `x`
  - **Body:** draws a filled rectangle centered on `x`
    - Width: `barWidth * 0.6` (60% of bar space, leaves gap between candles)
    - Top: `priceToY(Math.max(open, close))`
    - Bottom: `priceToY(Math.min(open, close))`
    - Minimum body height: `1px` — so doji candles (open === close) are still visible
- Draws wicks before bodies so bodies paint over the wick center cleanly

Takes no returns. Draws directly to context.

---

## 6. Axes and Grid

**File:** `components/chart/drawAxes.ts`

### `drawGrid(ctx, priceToY, indexToX, visibleRange, canvasWidth, canvasHeight, priceAxisWidth, timeAxisHeight)`

Grid lines are drawn first, underneath everything else.

- **Horizontal lines:** same intervals as price axis labels. Draw faint lines (`#1F1F1F`) across full canvas width
- **Vertical lines:** one per visible candle, or every N candles at tight zoom. Same faint color.

### `drawPriceAxis(ctx, priceMin, priceMax, priceToY, canvasWidth, canvasHeight, priceAxisWidth, timeAxisHeight)`

- Fills the right strip with background `#141414`
- Calculates a sensible tick interval from the visible price range
  - Target ~6–8 labels visible at any zoom level
  - Round interval to a clean number (e.g. nearest 10, 50, 100, 500 depending on asset price)
- For each tick price in range: draw a short horizontal tick mark and a price label
- Label format: no more than 2 decimal places for BTC-range prices

### `drawTimeAxis(ctx, candles, visibleRange, indexToX, canvasHeight, timeAxisHeight)`

- Fills the bottom strip with background `#141414`
- Labels every N candles — N scales with `barWidth`:
  - Wide bars (zoomed in): label every 5–10 candles
  - Tight bars (zoomed out): label every 20–50 candles
- Label format: `HH:MM` for 1m/5m/15m/1h timeframes
- Skip labels whose x position would overlap the previous one

---

## 7. Store Integration

`ChartCanvas` reads `candles` from Zustand. A `useEffect` watches the candles array and calls `redraw()` when it changes.

Important: `redraw()` must be called via `requestAnimationFrame` — never call it directly inside a React state update or you risk calling it before the browser is ready to paint.

When `pair` or `timeframe` changes in the store, candles clear to `[]`. The `useEffect` fires, canvas clears, and redraws an empty chart. New candles arrive from the feed and trigger redraws one by one.

---

## 8. Redraw Timing

Every state change that requires a visual update goes through one path: `requestAnimationFrame(() => redraw())`.

Avoid stacking multiple `requestAnimationFrame` calls. Use a flag `isRedrawScheduled` — if a redraw is already queued, do not queue another. Clear the flag at the start of `redraw()`.

---

## 9. Chart Mode in Store

Add `chartMode: 'candle' | 'footprint'` to the Zustand store. Default `'candle'`.

In `ChartCanvas`, after drawing axes and grid, check `chartMode`:
- `'candle'` → call `drawCandles()`
- `'footprint'` → call `drawFootprint()` (Phase 5 — function not yet written, this slot is reserved)

The toggle button in the toolbar updates `chartMode`. No canvas teardown, no remount — just a different branch in the draw call.

---

## Completion Checklist

```
lib/utils/canvas.ts
└── initCanvas                    — DPR setup, returns context

components/chart/
├── ChartCanvas.tsx               — canvas mount, redraw loop, resize handling
├── useCoordinates.ts             — getVisibleRange, getVisiblePriceRange, priceToY, indexToX
├── usePanZoom.ts                 — scrollOffset, barWidth, mouse + wheel handlers
├── drawCandles.ts                — candlestick renderer
└── drawAxes.ts                   — grid, price axis, time axis

lib/store/chart.ts
└── chartMode added               — 'candle' | 'footprint', default 'candle'

Behavior:
├── Candlesticks render correctly at all zoom levels
├── Pan left/right through history
├── Zoom in/out via scroll wheel
├── Price axis auto-scales to visible candles
├── Time axis labels adapt to zoom level
├── Canvas redraws correctly on resize
├── Pair/timeframe change clears and refills cleanly
└── chartMode slot reserved for Phase 5
```

---

## What This Phase Does Not Cover

- Footprint draw function — Phase 5
- Volume profile — Phase 6
- Crosshair / price line on hover — post-MVP
- Historical candle backfill via REST — optional, discuss before starting Phase 3
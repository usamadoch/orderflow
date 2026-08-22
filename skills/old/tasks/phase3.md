# Phase 3 — Candlestick Chart (Custom Canvas)

---

## Goal

Render a live candlestick chart using our own custom HTML5 `<canvas>`.
Remove `lightweight-charts` entirely. We manage the coordinate system, pan, zoom, axes, and rendering loop.

---

## 1. Uninstall Lightweight Charts (if applicable)

```bash
pnpm remove lightweight-charts
```

---

## 2. File Structure for This Phase

```
components/chart/
├── ChartCanvas.tsx          — single canvas, owns setup + redraw loop
├── useCoordinates.ts        — indexToX, priceToY, visible range
├── usePanZoom.ts            — mouse event handlers, scrollOffset, barWidth
├── drawCandles.ts           — candlestick draw function
└── drawAxes.ts              — price axis, time axis, grid lines
```

*(Note: `CandleChart.tsx`, `FootprintCanvas.tsx`, `useChartInit.ts`, and `ChartContainer.tsx` from older iterations should be removed or repurposed if needed).*

---

## 3. Coordinate System (useCoordinates.ts)

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

---

## 4. Pan and Zoom (usePanZoom.ts)

### Pan
- Mouse `mousedown` + `mousemove` on the canvas
- Track delta x between mouse positions
- Apply delta to `scrollOffset`
- Trigger redraw

### Zoom
- Mouse `wheel` event on the canvas
- Increase or decrease `barWidth` (pixels per candle)
- Clamp to min/max — e.g. `4px` minimum, `120px` maximum
- Anchor zoom to right edge (or cursor)
- Trigger redraw

### Visible range
- Derived from `scrollOffset`, `barWidth`, and canvas width
- Compute `firstVisibleIndex` and `lastVisibleIndex` before every draw
- Price min/max auto-scaled from the high/low of only the visible candles
- Recalculated on every redraw — never cached between frames

---

## 5. Draw Functions

### `drawAxes.ts`
- **Price axis (right strip):** Fixed width (e.g. 60px). Draws horizontal grid lines + price labels at regular intervals (auto-adjusts with zoom).
- **Time axis (bottom strip):** Fixed height (e.g. 24px). Labels every N candles depending on `barWidth`.

### `drawCandles.ts`
For each visible candle:
- Body: rectangle from `priceToY(open)` to `priceToY(close)`, centered on `indexToX(i)`, width ~70% of `barWidth`
- Wick: vertical line from `priceToY(high)` to `priceToY(low)`, centered on `indexToX(i)`
- Color: bullish if `close >= open` (`#26A69A`), bearish (`#EF5350`)

---

## 6. ChartCanvas Component (ChartCanvas.tsx)

This handles the `<canvas>` DOM element, the resize observer, and the `requestAnimationFrame` render loop.

- Setup standard canvas with `devicePixelRatio` scaling.
- Wire up pan/zoom handlers.
- Read candles from the Zustand store.
- Call coordinate setup, `drawAxes`, and `drawCandles` in sequence for every frame needed.

---

## Completion Checklist

- Custom `<canvas>` rendering OHLCV candles
- Pan via drag, Zoom via scroll wheel
- Auto-scaling price axis on the right
- Time axis on the bottom
- Resizes cleanly with window
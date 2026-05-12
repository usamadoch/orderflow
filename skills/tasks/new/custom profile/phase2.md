# Custom Range Profile — Task 2 of 3
## Anchor Rectangle to Chart Coordinates

---

## Goal for This Task Only

Convert the rectangle from raw pixel coordinates into chart coordinates — candle index range and price range. The rectangle must stay locked to the correct candles and prices when the user pans, zooms, or resizes the window. No profile rendering yet. Just the rectangle staying correctly anchored.

---

## What Gets Built Here

- `xToIndex` inverse coordinate function
- `yToPrice` inverse coordinate function
- Convert finalized pixel rectangle into `{ firstIndex, lastIndex, priceHigh, priceLow }`
- Store that anchored range
- Redraw the rectangle from chart coords back to pixels on every frame

---

## Why This is a Separate Task

In Task 1 the rectangle is stored as raw pixels. If the user pans left after drawing, the rectangle stays in the same pixel position while candles move — it drifts off. This task fixes that by converting pixel coords to chart coords on mouse release, then re-projecting back to pixels on every redraw using the current coordinate system.

---

## Two New Inverse Coordinate Functions

**File:** `lib/utils/coordinates.ts`

These must use the exact same variables as `indexToX` and `priceToY` — same `scrollOffset`, `barWidth`, `paddedMin`, `paddedMax`, same drawable dimensions. Write them in the same file immediately below those functions.

### `xToIndex(x, candles, scrollOffset, barWidth, canvasWidth)`

- Takes a pixel x on the canvas
- Returns the nearest candle array index
- Formula is the algebraic inverse of `indexToX`
- Clamp result to `[0, candles.length - 1]`

### `yToPrice(y, visiblePriceMin, visiblePriceMax, canvasHeight, timeAxisHeight)`

- Takes a pixel y on the canvas
- Returns the price at that pixel
- Formula is the inverse of `priceToY`
- Do not clamp — price outside visible range is valid for a tall selection

---

## Store Changes

**File:** `lib/store/chart.ts`

Replace the pixel-based drag refs with a stored anchored range. Add:

```ts
customProfileRange: {
  firstIndex: number
  lastIndex:  number
  priceHigh:  number
  priceLow:   number
} | null
```

Action: `setCustomProfileRange(range | null)`

This replaces tracking `dragStart` / `dragEnd` in pixel refs for the finalized state. During the active drag, pixel refs are still fine — only convert to chart coords on mouse release.

---

## Conversion on Mouse Release

**File:** `components/chart/ChartCanvas.tsx`

On `onMouseUp` when a drag completes:

- Take the pixel `dragStart` and `dragEnd`
- Call `xToIndex` on both x values → get `firstIndex` and `lastIndex`
- Call `yToPrice` on both y values → get `priceHigh` and `priceLow`
- Ensure `firstIndex <= lastIndex` and `priceHigh >= priceLow` — swap if needed
- Call `setCustomProfileRange({ firstIndex, lastIndex, priceHigh, priceLow })`
- Clear pixel drag refs

---

## Redraw the Rectangle from Chart Coords

**File:** `lib/draw/drawSelectionRect.ts`

Update `drawSelectionRect` to accept chart-coord range instead of raw pixels.

### New signature
`drawSelectionRect(ctx, customProfileRange, indexToX, priceToY, barWidth)`

- If `customProfileRange` is null and no active drag: return
- During active drag: use pixel refs directly (same as Task 1)
- After finalized: convert back to pixels using `indexToX` and `priceToY`:
  - `x1 = indexToX(firstIndex) - barWidth / 2`
  - `x2 = indexToX(lastIndex) + barWidth / 2`
  - `y1 = priceToY(priceHigh)`
  - `y2 = priceToY(priceLow)`
- Draw the dashed rectangle using these computed pixel values
- Same visual style as Task 1 — no changes to appearance

Since `indexToX` and `priceToY` are called fresh every redraw with current pan/zoom state, the rectangle automatically repositions correctly on every frame.

---

## How to Verify This Task is Done

- Draw a rectangle over a specific set of candles
- Pan left and right — rectangle moves with the candles, stays anchored to same price levels
- Zoom in and out — rectangle scales correctly with the chart
- Resize the browser window — rectangle repositions correctly
- Console log `customProfileRange` on mouse release — verify `firstIndex`, `lastIndex`, `priceHigh`, `priceLow` look correct for what was drawn
- Draw a rectangle, pan far away so candles are off screen — rectangle disappears (candles off screen = `indexToX` returns null — handle this by skipping draw if either anchor x is null)

Do not proceed to Task 3 until the rectangle stays correctly anchored through all pan, zoom, and resize scenarios.
# Phase 6 — Volume Profile

---

## Goal

Render a volume profile on the right side of the chart — horizontal bars showing total volume traded at each price level across all currently visible candles. Updates on every scroll and zoom as the visible range changes. Shows POC, VA High, and VA Low.

Phase 3 (canvas + coordinates) and Phase 4 (aggregation engine) must be complete. Phase 5 is not a dependency — volume profile works in both candle and footprint mode.

---

## Concept First

### What volume profile shows

Across all visible candles, for each price bucket — how much total volume traded there. Rendered as horizontal bars stacked along the price axis. Taller bars = more volume at that price. The profile sits on the right side of the chart, inside the price axis strip or just to the left of it.

### What POC is

Point of Control — the single price bucket with the highest total volume in the visible range. Marked with a horizontal line across the full chart width. This is the price level the market spent the most time and volume at.

### What Value Area is

The range of price levels that contain 70% of the total volume. Value Area High (VA High) is the top of that range, Value Area Low (VA Low) is the bottom. Standard in TPO and volume profile analysis.

---

## 1. File Structure

```
components/chart/
├── ChartCanvas.tsx          — minor edit: call drawVolumeProfile in redraw
└── drawVolumeProfile.ts     — all volume profile rendering logic

lib/utils/
└── volumeProfile.ts         — aggregation math: buildProfile, findPOC, findValueArea
```

---

## 2. Volume Profile Data Structure

**File:** `lib/utils/volumeProfile.ts`

### Types

```ts
interface ProfileRow {
  price:     number   // normalized bucket price (same bucketing as footprint)
  totalVol:  number   // bid + ask volume combined
  bidVol:    number   // sell aggression volume
  askVol:    number   // buy aggression volume
}

interface VolumeProfile {
  rows:      ProfileRow[]   // sorted low → high by price
  poc:       number         // price of highest volume bucket
  vaHigh:    number         // top of 70% value area
  vaLow:     number         // bottom of 70% value area
  maxVol:    number         // highest single row volume (for bar width scaling)
  totalVol:  number         // sum of all row volumes
}
```

---

## 3. Profile Aggregation

**File:** `lib/utils/volumeProfile.ts`

### `buildProfile(visibleCandles, engine, bucketSize)`

**Takes:**
- `visibleCandles` — the slice of the candles array currently on screen (from `getVisibleRange`)
- `engine` — the `AggregationEngine` instance
- `bucketSize` — current bucket size from store

**What it does:**
- Creates a `Map<number, ProfileRow>` keyed by normalized bucket price
- Iterates each visible candle → gets its `FootprintCandle` from the engine
- If no footprint data for a candle, falls back to distributing that candle's total OHLCV volume evenly across its price range (high to low, bucketed) — this ensures candle-mode users still get a profile even without trade-level data
- For candles with footprint data: iterates each cell, adds `bidVol` and `askVol` to the matching row in the map
- After all candles processed: converts map to sorted `ProfileRow[]` array (low → high)
- Finds `maxVol` and `totalVol` from the resulting rows
- Calls `findPOC()` and `findValueArea()` to complete the profile
- Returns a `VolumeProfile` object

The fallback to OHLCV volume distribution is important — without it, the profile is empty in candle mode or on first load before trades arrive.

---

### `findPOC(rows)`

**Takes:** `ProfileRow[]`

**What it does:**
- Finds the row with the highest `totalVol`
- Returns that row's `price`

Simple max search. O(n) pass through rows.

---

### `findValueArea(rows, totalVol, targetPercent = 0.70)`

**Takes:** sorted `ProfileRow[]`, total volume sum, and the target percentage (default 70%)

**What it does:**
- Starts from the POC row (highest volume)
- Expands outward — on each step, compares the next row above vs the next row below, adds whichever has higher volume to the value area
- Keeps a running volume sum
- Stops when running sum / totalVol >= targetPercent
- Returns `{ vaHigh, vaLow }` — the outermost prices added to the value area

This is the standard value area algorithm used by Sierra Chart, Bookmap, and others. Always expands from POC outward, always adds the higher-volume side first.

---

## 4. When to Build the Profile

The profile is recalculated on every redraw in which the visible range has changed — i.e. on every scroll, zoom, resize, or new candle arrival.

It is not cached. It is rebuilt from scratch each frame.

At 500 candles × ~50 rows each this is fast enough to be synchronous. No workers needed.

---

## 5. drawVolumeProfile Function

**File:** `components/chart/drawVolumeProfile.ts`

### `drawVolumeProfile(ctx, profile, priceToY, canvasWidth, profileWidth, priceAxisWidth)`

**Parameters:**
- `ctx` — 2D canvas context
- `profile` — the `VolumeProfile` built this frame
- `priceToY` — coordinate function from Phase 3
- `canvasWidth` — total canvas width
- `profileWidth` — how wide the profile bars are allowed to be (in pixels)
- `priceAxisWidth` — width of the price axis strip (profile sits just left of it)

**What it draws, in order:**

### Step 1 — Profile bars

For each row in `profile.rows`:
- `y = priceToY(row.price + bucketSize)` — top of this row
- `rowHeight = priceToY(row.price) - y`
- Skip rows where `rowHeight < 1` — below visible resolution
- Bar width = `(row.totalVol / profile.maxVol) * profileWidth` — scales 0 to max profile width
- Bar is drawn from the right edge inward: `x = canvasWidth - priceAxisWidth - barWidth`
- Fill color: split into bid and ask proportions within the bar
  - Left portion of bar (ask side): `#26A69A` at low opacity (`0.4`)
  - Right portion of bar (bid side): `#EF5350` at low opacity (`0.4`)
  - Split point within bar: `barWidth * (row.askVol / row.totalVol)`
  - If footprint data is unavailable for a candle (fallback mode), render the bar as a single neutral color `#8A8A8A` at `0.3` opacity — no bid/ask split

### Step 2 — POC line

- `y = priceToY(profile.poc + bucketSize / 2)` — center of the POC bucket
- Draw a horizontal line from `x = 0` to `x = canvasWidth - priceAxisWidth`
- Color: `#F0B90B` (yellow — visually distinct from bull/bear colors)
- Line width: `1px`
- Dashed: `[4, 4]` using `ctx.setLineDash`
- Reset line dash after drawing

### Step 3 — VA High and VA Low lines

Same style as POC line but different color and lighter weight.
- Color: `#3D7EFF` (accent blue)
- Line width: `1px`
- Dashed: `[2, 4]` — shorter dash, more gap than POC
- Draw one line at `priceToY(profile.vaHigh)`, one at `priceToY(profile.vaLow)`

### Step 4 — Labels

On the right side, just inside the price axis strip:
- `POC` label next to the POC line — `#F0B90B`, `9px JetBrains Mono`
- `VAH` label next to VA High line — `#3D7EFF`, `9px`
- `VAL` label next to VA Low line — `#3D7EFF`, `9px`

If VA High and VA Low are too close to each other (less than 14px apart), show only the POC label and skip VAH/VAL labels to avoid overlap.

---

## 6. Wiring Into ChartCanvas

**File:** `components/chart/ChartCanvas.tsx`

Minor addition to the redraw function. After `drawCandles` or `drawFootprint` is called:

- Call `buildProfile(visibleCandles, engine, bucketSize)` — returns `VolumeProfile`
- Call `drawVolumeProfile(ctx, profile, priceToY, ...)`

Volume profile renders on top of candles/footprint cells, underneath the price axis strip background. Draw order matters:

```
1. drawGrid
2. drawCandles OR drawFootprint
3. drawVolumeProfile          ← new, goes here
4. drawAxes                   ← axes paint over profile edges for clean borders
```

This ensures the profile bars are clipped cleanly by the axis strips.

---

## 7. Profile Width Config

`profileWidth` — how many pixels wide the profile bars can grow at maximum.

Reasonable default: `120px`. This comes out of the chart's drawable area, not the price axis. The profile occupies `120px` on the right side of the chart, just left of the price axis strip.

This means `drawCandles` and `drawFootprint` should treat the drawable chart width as `canvasWidth - priceAxisWidth - profileWidth`. Otherwise candles render under the profile bars.

Add `profileWidth` to the coordinate system inputs in `useCoordinates` so `indexToX` accounts for it in the drawable area calculation.

---

## 8. Visible Range Reuse

`buildProfile` needs the visible candle range. This is already computed in `useCoordinates` as `getVisibleRange()`. Do not recompute it — pass the same `firstIndex` and `lastIndex` used for candle/footprint rendering into `buildProfile`.

The profile must always reflect exactly what is on screen — not more, not less.

---

## Completion Checklist

```
lib/utils/volumeProfile.ts
├── ProfileRow, VolumeProfile types
├── buildProfile              — aggregates footprint + fallback OHLCV data
├── findPOC                   — max volume row
└── findValueArea             — 70% expansion from POC outward

components/chart/
├── drawVolumeProfile.ts      — bars, POC line, VA lines, labels
└── ChartCanvas.tsx           — buildProfile + drawVolumeProfile added to redraw

useCoordinates.ts             — profileWidth factored into drawable area

Behavior:
├── Profile updates on every scroll and zoom
├── Bars scale to max volume row
├── Bid/ask split visible within each bar
├── POC line visible across full chart width
├── VA High and VA Low lines visible
├── Labels rendered without overlap
├── Works in both candle and footprint mode
├── Graceful fallback when footprint data unavailable
└── Profile bars clipped cleanly by axis strips
```

---

## What This Phase Does Not Cover

- Multiple profiles (session vs composite) — post-MVP
- Fixed range profile (user-defined range, not just visible) — post-MVP
- Profile histogram on left side — post-MVP
# Measurement Tool — Task 2 of 3
## Coordinate Conversion and Metric Calculation

---

## Goal for This Task Only

Convert the raw pixel coordinates from Task 1 into chart coordinates — price and candle index. Calculate all the metrics that will be displayed: price difference, percentage, candle count, elapsed time, and ticks. Store the computed result. No info panel rendered yet — verify by logging to console.

Task 1 must be complete before starting this.

---

## What Needs to Change in Store

The current `activeMeasurement` stores raw pixels. Extend it to also store the computed chart coordinates and metrics once the drag ends.

**File:** `lib/store/chart.ts`

Extend `activeMeasurement` type:

```ts
activeMeasurement: {
  // Raw pixels — used for drawing the rectangle (Task 1)
  startX: number
  startY: number
  endX:   number
  endY:   number
  live:   boolean

  // Chart coordinates — populated on mouse up, null while live
  metrics: MeasurementMetrics | null
} | null
```

---

## MeasurementMetrics Type

**File:** `types/measurement.ts`

```ts
interface MeasurementMetrics {
  // Price
  startPrice:       number
  endPrice:         number
  priceDiff:        number      // endPrice - startPrice (signed)
  pricePercent:     number      // (priceDiff / startPrice) * 100 (signed)
  ticks:            number      // abs(priceDiff) / 0.01

  // Time
  startIndex:       number      // candle array index (earlier of the two)
  endIndex:         number      // candle array index (later of the two)
  candleCount:      number      // abs(endIndex - startIndex) + 1
  elapsedSeconds:   number      // candleCount * timeframeSeconds
  elapsedLabel:     string      // human readable e.g. "14m", "1h 15m"

  // Direction
  isPositive:       boolean     // endPrice > startPrice
}
```

---

## When to Compute Metrics

Metrics are computed once on `onMouseUp` — when the drag finalizes. Not during live drag. This keeps the mouse move handler fast.

In `onMouseMove`, only update `endX` and `endY`. Do not compute metrics.

In `onMouseUp`, after confirming the drag was real (not a tap):
1. Compute metrics from the final pixel positions
2. Call `setActiveMeasurement({ ...existing, live: false, metrics: result })`

---

## Computing Metrics

**File:** `lib/utils/measurement.ts`

### `computeMeasurementMetrics(startX, startY, endX, endY, candles, coords, timeframe)`

Parameters:
- `startX`, `startY`, `endX`, `endY` — pixel coordinates from the drag
- `candles` — candles array from store
- `coords` — the `CoordinateSystem` object from the current frame's `buildCoordinates` call
- `timeframe` — current timeframe string e.g. `'1m'`, `'5m'`

Returns `MeasurementMetrics | null` — null if conversion fails (e.g. canvas has no candles).

### Step 1 — Convert pixels to chart coordinates

**Prices:**
- `startPrice = yToPrice(startY, coords.visiblePriceMin, coords.visiblePriceMax, canvasHeight, TIME_AXIS_HEIGHT)`
- `endPrice = yToPrice(endY, ...)` — same function, same parameters
- Both use the existing `yToPrice` function from `lib/utils/coordinates.ts`

**Candle indices:**
- `rawStartIndex = xToIndex(startX, candles, scrollOffset, barWidth, canvasWidth)`
- `rawEndIndex = xToIndex(endX, ...)`
- Both use the existing `xToIndex` function

### Step 2 — Normalize direction

The user may have dragged right-to-left (earlier candle as end, later candle as start). Normalize:
- `earlierIndex = Math.min(rawStartIndex, rawEndIndex)`
- `laterIndex = Math.max(rawStartIndex, rawEndIndex)`

Price direction is NOT normalized — keep the sign based on where the user started and ended:
- `priceDiff = endPrice - startPrice` — follows the actual drag direction

### Step 3 — Compute values

```
candleCount    = laterIndex - earlierIndex + 1
elapsedSeconds = candleCount * TIMEFRAME_SECONDS[timeframe]
ticks          = Math.round(Math.abs(priceDiff) / 0.01)
pricePercent   = (priceDiff / startPrice) * 100
isPositive     = endPrice > startPrice
```

### Step 4 — Format elapsed time label

A helper function `formatElapsed(seconds)`:
- `< 60s`: `"Ns"` — e.g. `"45s"`
- `< 3600s`: `"Nm"` or `"Nh Nm"` — e.g. `"14m"`, `"1h 15m"`
- `>= 3600s`: `"Nh"` or `"Nh Nm"` — e.g. `"3h"`, `"3h 40m"`
- Drop the minutes part if it is zero for cleanliness — `"2h"` not `"2h 0m"`

Place `formatElapsed` in `lib/utils/format.ts` alongside existing formatters.

---

## Access to CoordinateSystem at Mouse Up

`computeMeasurementMetrics` needs the current `CoordinateSystem`. The coordinate system is rebuilt on every redraw inside `ChartCanvas` — it is not stored in the store.

The cleanest solution: store the most recently computed `CoordinateSystem` in a ref inside `ChartCanvas`:

```ts
const coordsRef = useRef<CoordinateSystem | null>(null)
```

At the start of every `redraw()`, after calling `buildCoordinates`, assign:
```ts
coordsRef.current = coords
```

In `onMouseUp`, read `coordsRef.current` to get the current coordinate system. This is safe — `onMouseUp` fires after the most recent redraw, so the ref holds a fresh coordinate system.

Also store `canvasWidth` and `canvasHeight` in refs updated in the resize handler — needed as parameters for `yToPrice`.

---

## Wiring in ChartCanvas

**File:** `components/chart/ChartCanvas.tsx`

In `onMouseUp`, after confirming valid drag:

```ts
if (coordsRef.current && candles.length > 0) {
  const metrics = computeMeasurementMetrics(
    startX, startY, endX, endY,
    candles,
    coordsRef.current,
    timeframe
  )
  setActiveMeasurement({ startX, startY, endX, endY, live: false, metrics })
} else {
  setActiveMeasurement({ startX, startY, endX, endY, live: false, metrics: null })
}
```

---

## Console Verification Helper

Add a temporary `useEffect` in `ChartCanvas` that watches `activeMeasurement`:

```ts
useEffect(() => {
  if (activeMeasurement?.metrics && !activeMeasurement.live) {
    console.log('[Measurement]', activeMeasurement.metrics)
  }
}, [activeMeasurement])
```

Remove this after Task 3 is complete.

---

## How to Verify This Task is Done

Open the browser console. Draw a measurement on the chart. On mouse release, the console should log a `MeasurementMetrics` object.

Check each field:

**Price fields:**
- Draw from a lower price to a higher price — `priceDiff` should be positive, `isPositive` true
- Draw from higher to lower — `priceDiff` negative, `isPositive` false
- `pricePercent` should be roughly correct — a `$500` move on a `$50,000` BTC price is `1.0%`
- `ticks` should be `priceDiff * 100` — a `$500` move is `50000` ticks

**Candle fields:**
- Draw across exactly 5 candles — `candleCount` should be `5`
- On 1m timeframe: `elapsedSeconds` should be `300`, `elapsedLabel` should be `"5m"`
- On 5m timeframe same 5 candles: `elapsedSeconds` should be `1500`, `elapsedLabel` should be `"25m"`

**Direction:**
- Drag right to left (backward in time) — `earlierIndex` and `laterIndex` should still be in correct order (earlier < later), even though you dragged right-to-left

**Edge cases to check:**
- Draw on a single candle (no horizontal movement) — `candleCount` should be `1`
- Draw perfectly horizontal — `priceDiff` should be near zero, `isPositive` false

Do not proceed to Task 3 until all logged values look correct for multiple test measurements.
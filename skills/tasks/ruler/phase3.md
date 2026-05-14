# Measurement Tool — Task 3 of 3
## Info Panel, Directional Arrow, and Footprint Metrics

---

## Goal for This Task Only

Render the info panel showing all measurement metrics. Draw the directional arrow inside the rectangle. Add footprint-specific metrics when in footprint mode. Handle panel positioning so it never clips outside the canvas.

Tasks 1 and 2 must be complete and verified before starting this.

---

## Directional Arrow

**File:** `lib/draw/drawMeasurement.ts`

Add arrow rendering inside `drawMeasurementRect`, after the rectangle is drawn.

The arrow is a horizontal line drawn at the vertical midpoint of the rectangle, spanning from left edge to right edge.

```
arrowY  = y + h / 2
arrowX1 = x              (left edge of rectangle)
arrowX2 = x + w          (right edge of rectangle)
```

Only draw when `w > barWidth * 2` — if the rectangle is narrower than two candles, skip the arrow.

**Color:**
- Green `#26A69A` if `metrics.isPositive` is true
- Red `#EF5350` if false
- Neutral `#8A8A8A` if `metrics` is null (live drag, not yet computed) or `priceDiff` is near zero

**Line:**
- `lineWidth = 1.5px`
- Solid, no dash

**Arrow head** at `arrowX2` (right end — always points toward later time):
Draw two short diagonal lines forming a `>` shape:
- Line 1: from `(arrowX2 - 8, arrowY - 5)` to `(arrowX2, arrowY)`
- Line 2: from `(arrowX2 - 8, arrowY + 5)` to `(arrowX2, arrowY)`
- Same color and line width as the main arrow line

---

## Info Panel Component

The panel is an HTML `div` overlay — not drawn on canvas. Same pattern as the absorption tooltip.

**File:** `components/chart/MeasurementPanel.tsx`

Receives `activeMeasurement` and `canvasRect` as props. `canvasRect` is the bounding rect of the canvas element — needed to position the panel correctly relative to the page.

If `activeMeasurement` is null or `activeMeasurement.metrics` is null: render nothing (return null).

The panel renders only after mouse release (`live === false`) — do not show the panel while actively dragging, only the rectangle.

### Panel positioning logic

Default position: top-right corner of the rectangle, just outside.
```
panelLeft = canvasRect.left + measurement.endX + 8
panelTop  = canvasRect.top  + Math.min(measurement.startY, measurement.endY) - 4
```

After computing default position, check if it clips:
- If `panelLeft + 160 > window.innerWidth`: flip to left side — `panelLeft = canvasRect.left + Math.min(startX, endX) - 168`
- If `panelTop < canvasRect.top`: move down — `panelTop = canvasRect.top + Math.max(startY, endY) + 8`

Apply as inline styles: `position: fixed`, `left: panelLeft + 'px'`, `top: panelTop + 'px'`.
`pointer-events: none` — panel never captures mouse events.
`z-index: 100` — above everything.

---

## Panel Layout and Styling

```
┌──────────────────────┐
│ PRICE    +$842.50    │
│ %        +1.24%      │
│ CANDLES  14          │
│ TIME     14m         │
│ TICKS    84250       │
├──────────────────────┤  ← only in footprint mode
│ VOL      124.3 BTC   │
│ DELTA    +1,842      │
│ BUY VOL  68.4 BTC    │
│ SELL VOL 55.9 BTC    │
│ B/S      1.22        │
└──────────────────────┘
```

**Container styles:**
- `background: #141414`
- `border: 1px solid #1F1F1F`
- `border-radius: 4px`
- `padding: 8px 10px`
- `width: 160px`
- `font-family: 'JetBrains Mono', monospace`

**Each row:**
- `display: flex`, `justify-content: space-between`, `align-items: center`
- `height: 18px`

**Label:**
- `font-size: 9px`, `color: #4A4A4A`, `text-transform: uppercase`

**Value:**
- `font-size: 12px`
- Color per row (see below)

**Divider between standard and footprint rows:**
- `border-top: 1px solid #1F1F1F`
- `margin: 4px 0`

---

## Value Colors

| Row | Color rule |
|---|---|
| PRICE | `#26A69A` if positive, `#EF5350` if negative, `#8A8A8A` if zero |
| % | Same as PRICE |
| CANDLES | `#E8E8E8` always |
| TIME | `#E8E8E8` always |
| TICKS | `#8A8A8A` always — de-emphasized |
| VOL | `#E8E8E8` always |
| DELTA | `#26A69A` if positive, `#EF5350` if negative |
| BUY VOL | `#26A69A` always |
| SELL VOL | `#EF5350` always |
| B/S | `#26A69A` if > 1.0, `#EF5350` if < 1.0, `#8A8A8A` if = 1.0 |

---

## Value Formatting

All formatting uses existing functions from `lib/utils/format.ts`.

- **PRICE:** `+$842.50` or `−$842.50` — always show sign, always show `$`, 2 decimal places
- **%:** `+1.24%` or `−0.87%` — always show sign, 2 decimal places
- **CANDLES:** plain integer, no formatting
- **TIME:** `elapsedLabel` from `MeasurementMetrics` — already formatted in Task 2
- **TICKS:** integer with comma separator for thousands — e.g. `84,250`
- **VOL:** `formatVol` — e.g. `124.3 BTC`
- **DELTA:** `formatDelta` — e.g. `+1,842` or `−934`
- **BUY VOL / SELL VOL:** `formatVol`
- **B/S:** `ratio.toFixed(2)`

If `metrics` has a `*` flag for partial footprint data, append a `*` to the `VOL` value and add a small note below the panel: `* partial data` in `8px`, `#4A4A4A`.

---

## Footprint Metrics Calculation

**File:** `lib/utils/measurement.ts`

Add `computeFootprintMetrics(metrics, candles, engine)` — called separately from `computeMeasurementMetrics`, only when `chartMode === 'footprint'`.

```ts
interface FootprintMeasurementMetrics {
  totalVolume:  number
  totalDelta:   number
  totalBuyVol:  number
  totalSellVol: number
  buySellRatio: number
  isPartial:    boolean   // true if some candles in range had no footprint data
}
```

**What it does:**
- Iterates candle indices from `metrics.earlierIndex` to `metrics.laterIndex`
- For each candle: calls `engine.getFootprintCandle(candles[i].time)`
- If null: marks `isPartial = true`, skips that candle
- If found: iterates all cells, adds `askVol` to `totalBuyVol`, `bidVol` to `totalSellVol`
- Also sums `footprintCandle.delta` into `totalDelta`
- `totalVolume = totalBuyVol + totalSellVol`
- `buySellRatio = totalBuyVol / Math.max(totalSellVol, 0.0001)` — guard against zero division
- Returns the result

---

## Wiring Footprint Metrics

**File:** `components/chart/ChartCanvas.tsx`

After computing `metrics` in `onMouseUp`, if `chartMode === 'footprint'` and `engine` is available:

```ts
const fpMetrics = computeFootprintMetrics(metrics, candles, engine)
// attach to activeMeasurement or pass separately to MeasurementPanel
```

Simplest approach: add `footprintMetrics: FootprintMeasurementMetrics | null` to `activeMeasurement` in the store. Populate it in `onMouseUp` alongside `metrics`.

`MeasurementPanel` reads `footprintMetrics` from `activeMeasurement`. If null (candle mode or no footprint data at all): the divider and footprint rows are not rendered.

---

## Mounting MeasurementPanel

**File:** `app/page.tsx` or `components/chart/ChartCanvas.tsx`

`MeasurementPanel` is an HTML overlay that needs access to the canvas bounding rect. Mount it as a sibling of the canvas inside the chart container div, not inside the canvas element itself.

Pass `activeMeasurement` from store and `canvasRef.current?.getBoundingClientRect()` as props. Recompute the bounding rect each render — do not cache it, as the window may have been resized.

---

## Small Rectangle Behavior

If `w < 20 || h < 20` (tiny rectangle): do not render the panel. The panel would overlap the rectangle completely and be unreadable. The rectangle itself still draws — just no panel.

Check this in `MeasurementPanel` before rendering: if rectangle dimensions are below threshold, return null.

---

## Remove Console Debug Log

Remove the temporary `useEffect` console log added in Task 2.

---

## How to Verify This Task is Done

**Standard metrics:**
- Draw a measurement — info panel appears at top-right of rectangle
- PRICE and % show correct signed values and correct colors
- CANDLES count matches what you visually count on the chart
- TIME is correct — 14 candles on 1m = `14m`, 14 candles on 5m = `1h 10m`
- TICKS is a large integer roughly equal to price difference × 100

**Panel positioning:**
- Draw in the center of the chart — panel appears top-right of rectangle
- Draw at the right edge of the chart — panel flips to top-left of rectangle
- Draw at the top edge of the chart — panel moves to below the rectangle
- Panel never clips outside the browser window in any position

**Arrow:**
- Arrow appears as horizontal line at vertical midpoint of rectangle
- Points right (toward later candles) always
- Green for upward measurements, red for downward
- Arrow does not render when rectangle is narrower than 2 candles

**Footprint mode:**
- Switch to footprint mode, draw a measurement
- Divider and footprint rows appear below the standard rows
- VOL, DELTA, BUY VOL, SELL VOL, B/S all show values
- BUY VOL + SELL VOL approximately equals VOL
- DELTA sign matches the visual delta of the range
- Draw across candles with no footprint data — `*` appears on VOL, `* partial data` note below panel

**Candle mode:**
- Switch to candle mode, draw a measurement
- Footprint rows do not appear, divider not visible
- No errors or empty rows

**Clearing:**
- Panel disappears when measurement is cleared via Escape, tap, or tool switch
- Panel disappears when pair or timeframe changes
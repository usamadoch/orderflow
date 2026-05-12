# Exhaustion Detection — Task 2 of 3
## Visual Markers on Canvas

---

## Goal for This Task Only

Render exhaustion markers on the chart using the `exhaustionMap` built in Task 1. Each detected candle gets a subtle visual indicator near its high or low depending on direction. Markers scale by rank. Nothing else changes — no toolbar controls yet, no settings panel yet. Just the visual output of what Task 1 detected.

Task 1 must be complete and producing reasonable scores before starting this task.

---

## How Exhaustion Markers Differ From Absorption Markers

Absorption markers are circles placed clearly above or below the candle — they signal a decisive event.

Exhaustion markers should feel more subtle — they signal a gradual fading, not a sudden stop. The visual language should reflect this:

- Smaller than absorption markers
- Fading/gradient feel rather than solid fill
- Positioned closer to the candle extreme, not floated away from it
- A horizontal dash or small arc works better than a full circle

Use a **small horizontal dash** as the primary marker. Simple, clean, does not compete with the footprint cells or candles underneath.

---

## Marker Design by Rank

All markers are horizontal lines (dashes) drawn near the candle extreme. Width and opacity scale with rank.

**Weak (30–50):**
- Width: `barWidth * 0.5`
- Thickness: `1px`
- Opacity: `0.4`
- No label

**Moderate (50–65):**
- Width: `barWidth * 0.7`
- Thickness: `1.5px`
- Opacity: `0.6`
- No label

**Strong (65–80):**
- Width: `barWidth * 0.9`
- Thickness: `2px`
- Opacity: `0.8`
- Small label: `EX` rendered in `8px JetBrains Mono` above or below the dash

**Extreme (80–100):**
- Width: `barWidth * 1.0` — full bar width
- Thickness: `2px`
- Opacity: `1.0`
- Label: `EX` + score e.g. `EX 84`
- Secondary dash drawn `4px` away from the first — a double dash indicates extreme confidence

---

## Marker Position

**Buyer exhaustion** (buyers fading, upward move weakening):
- Marker placed above the candle high
- `y = priceToY(candle.high) - 6 - (rank offset)`
- Rank offset: weak `2px`, moderate `3px`, strong `4px`, extreme `5px`
- The stronger the signal, the further from the high — creates natural visual separation

**Seller exhaustion** (sellers fading, downward move weakening):
- Marker placed below the candle low
- `y = priceToY(candle.low) + 6 + (rank offset)`

Marker is centered on `indexToX(i)`.

---

## Marker Color

Exhaustion color is intentionally different from both absorption and bubble colors to avoid confusion.

- Buyer exhaustion (upward move fading): `#F0B90B` — amber/yellow. Same as POC color but used here as "caution" — the upward move is losing steam.
- Seller exhaustion (downward move fading): `#B39DDB` — muted purple. Distinct from red (which signals aggression) and teal (which signals buying). Purple for fading downward momentum.

For provisional markers (live candle, not yet closed): same color at `0.35` opacity, no label.

---

## Draw Function

**File:** `lib/draw/drawExhaustion.ts`

### `drawExhaustion(ctx, candles, visibleRange, indexToX, priceToY, barWidth, exhaustionMap, settings)`

Parameters:
- `ctx` — canvas context
- `candles` — from store
- `visibleRange` — from coordinates
- `indexToX`, `priceToY` — coordinate functions
- `barWidth` — current zoom level
- `exhaustionMap` — `Map<number, ExhaustionResult>` from store
- `settings` — object with `exhaustionMinScore`, `exhaustionSide`

### What it does

For each visible candle:
- Get `x` from `indexToX(i)` — skip if null
- Get `ExhaustionResult` from `exhaustionMap` by `candle.time` — skip if null
- Skip if `result.score < settings.exhaustionMinScore`
- Skip if `settings.exhaustionSide` does not include this result's direction
- Determine marker position (above high or below low) from `result.direction`
- Determine width, thickness, opacity, label from `result.rank`
- Draw the horizontal dash
- If rank is `strong` or `extreme`: draw the label
- If rank is `extreme`: draw the second dash `4px` further out
- If `result.provisional`: apply reduced opacity, skip label

### Drawing a single dash

```
ctx.strokeStyle = color at computed opacity
ctx.lineWidth   = thickness
ctx.beginPath()
ctx.moveTo(x - dashWidth / 2, y)
ctx.lineTo(x + dashWidth / 2, y)
ctx.stroke()
```

No arc, no circle, no filled shape. Just a line.

---

## Label Rendering

For `strong` and `extreme` markers:

- `EX` or `EX 84` text
- Font: `JetBrains Mono`, `8px`
- Color: same as marker color, full opacity
- Position: centered above the dash for buyer exhaustion, below for seller exhaustion
- Gap between dash and label: `3px`
- If `barWidth < 20`: skip label even for strong/extreme — too narrow to read

---

## Minimum Bar Width Guard

If `barWidth < 5`: skip exhaustion rendering entirely. At this zoom level individual candles are barely visible and markers would blend into noise.

---

## Draw Order

```
1. drawGrid
2. drawLines
3. drawSelectionHighlight
4. drawCandles OR drawFootprint
5. drawBubbles
6. drawAbsorption
7. drawExhaustion          ← new, after absorption
8. drawCustomProfile
9. drawVolumeProfile
10. drawAxes
```

Exhaustion renders after absorption so that if both fire on the same candle (which `buildExhaustionMap` tries to prevent but may not always prevent for weak scores), the absorption marker is visible underneath and exhaustion renders on top.

---

## Wiring Into ChartCanvas

**File:** `components/chart/ChartCanvas.tsx`

Add to the redraw function:

```
if (exhaustionEnabled && exhaustionMap.size > 0) {
  drawExhaustion(ctx, candles, coords.visibleRange, coords.indexToX, coords.priceToY, coords.barWidth, exhaustionMap, { exhaustionMinScore, exhaustionSide })
}
```

Read `exhaustionEnabled`, `exhaustionMap`, `exhaustionMinScore`, `exhaustionSide` from the store.

---

## Wiring the Exhaustion Map Build

**File:** `components/FeedProvider.tsx`

The exhaustion map is built after the absorption map since `buildExhaustionMap` takes the absorption map as input.

On candle close:
1. `engine.ingestCandle(candle)` — existing
2. `absorption.scoreCandle(...)` → update `absorptionMap` in store — existing
3. `exhaustion.scoreExhaustion(...)` → update `exhaustionMap` in store — new

For the live candle, score exhaustion provisionally on each trade update — throttled at the same ~100ms interval used for footprint redraws.

---

## How to Verify This Task is Done

- Open the chart and wait several minutes for candles to accumulate
- Exhaustion markers should appear on some candles — not all, not most
- Buyer exhaustion dashes appear above candle highs in amber
- Seller exhaustion dashes appear below candle lows in purple
- Dash width scales visibly between weak and extreme
- Strong and extreme markers have the `EX` label
- Extreme markers have a double dash
- Provisional markers on the live candle are visibly more transparent
- Zooming in and out: markers stay correctly positioned relative to their candles
- Markers do not appear on strong clean trending candles with no wick and growing delta
- Verify one marker manually: pick a marked candle, check the console log from Task 1's `E` shortcut, confirm the score and reasons match what you see visually on that candle

Do not proceed to Task 3 until markers look visually reasonable and positioned correctly.
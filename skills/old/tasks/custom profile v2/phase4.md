# Volume Profile Improvements — Task 4 of 4
## Split Layout — Delta Profile on Left, Volume Profile on Right

---

## Goal for This Task Only

Add a second profile strip to the left of the selected region that shows per-price-level delta (ask volume minus bid volume) instead of total volume. The existing volume profile renders inside the selection from left to right as it does now. The new delta profile renders outside the selection on the left side, extending right to left. This creates a split view — volume structure on one side, buying/selling aggression on the other.

This task applies to both the custom profile (selected region) and the default visible-range profile.

Tasks 1, 2, and 3 must be complete before this task.

---

## Concept

```
  delta profile     │  selected region  │ price axis
  (outside, left)   │  (volume profile) │
                    │                   │
  ◄─── red/teal ───│─── teal/red ──►  │
   right to left    │   left to right   │
```

The delta profile shows how aggressive buyers and sellers were at each price level — not total volume, but the imbalance between the two sides. Positive delta (more ask hits) = green bar extending left. Negative delta (more bid hits) = red bar extending left.

This tells a different story from the volume profile. A price level can have huge total volume (profile bar is wide) but near-zero delta (buyers and sellers were equal). Or a level can have moderate volume but extreme delta (one side dominated completely).

---

## Delta Per Price Level

**File:** `lib/utils/volumeProfile.ts`

`ProfileRow` already has `bidVol` and `askVol`. Delta per row is simply:

`rowDelta = row.askVol - row.bidVol`

Positive = more buying aggression at this level. Negative = more selling aggression.

No new calculation needed — this is derived from existing `ProfileRow` data. No changes to `buildProfile`.

Add one derived value to `VolumeProfile`:

```ts
interface VolumeProfile {
  // existing fields...
  maxAbsDelta: number    // highest absolute delta across all rows, for scaling
}
```

Compute `maxAbsDelta` inside `buildProfile` after rows are built:
- Iterate all rows, find `Math.max(...rows.map(r => Math.abs(r.askVol - r.bidVol)))`
- Store on the profile object

---

## Delta Profile Strip Width

The delta profile renders to the left of the selection. It needs its own reserved width.

Add to store:
```ts
deltaProfileWidth: number   // default 80px, range 40–160, persisted
```

For the default (visible-range) profile, the delta strip sits to the left of the existing profile strip, both on the right side of the chart. Total reserved width on the right becomes `PROFILE_WIDTH + deltaProfileWidth`.

Update `buildCoordinates` and `useCoordinates` — the drawable chart area shrinks by `deltaProfileWidth` to make room. Candles shift left accordingly.

For the custom profile, the delta strip sits directly to the left of the selection rectangle's `x1` edge, extending leftward.

---

## Draw Function — Delta Profile

**File:** `lib/draw/drawDeltaProfile.ts`

### `drawDeltaProfile(ctx, profile, priceToY, stripRightEdge, deltaProfileWidth, profileBucketSize, profileOpacity, profileScaleMode)`

Parameters:
- `ctx` — canvas context
- `profile` — `VolumeProfile` object (contains `rows`, `maxAbsDelta`)
- `priceToY` — coordinate function
- `stripRightEdge` — the right edge of the delta strip in pixels. For the default profile this is `canvasWidth - PRICE_AXIS_WIDTH - PROFILE_WIDTH`. For custom profile this is `x1` of the selection rectangle.
- `deltaProfileWidth` — max pixel width of delta bars
- `profileBucketSize` — for row height calculation
- `profileOpacity` — reuse the same opacity setting from Task 1
- `profileScaleMode` — reuse the same sqrt/linear scaling from Task 2

### What it draws

For each row in `profile.rows`:
- `rowDelta = row.askVol - row.bidVol`
- If `rowDelta === 0`: skip this row — no bar drawn, no visual noise
- `topY = priceToY(row.price + profileBucketSize)`
- `bottomY = priceToY(row.price)`
- `rowHeight = Math.max(1, bottomY - topY)`

**Bar width scaling:**
- `absDelta = Math.abs(rowDelta)`
- Apply same normalization as volume profile (`linear` or `sqrt`) using `maxAbsDelta` as the reference
- `barW = normalize(absDelta / profile.maxAbsDelta) * deltaProfileWidth`
- Apply `profileMinRowWidth` floor — same minimum as volume bars

**Bar direction:**
- Bars always grow from `stripRightEdge` leftward
- `barX = stripRightEdge - barW`
- Bar spans from `barX` to `stripRightEdge`

**Bar color:**
- Positive delta (ask > bid, buyers dominated): `rgba(38, 166, 154, profileOpacity)` — teal
- Negative delta (bid > ask, sellers dominated): `rgba(239, 83, 80, profileOpacity)` — red
- No bid/ask split inside delta bars — the entire bar is one color representing direction

**Zero line:**
- Draw a thin vertical line at `x = stripRightEdge` from top of visible price range to bottom
- Color: `#1F1F1F`, `1px` — a subtle separator between the delta strip and the volume profile

---

## Default Profile — Layout Update

For the default visible-range profile, both strips render on the right side of the chart.

Current layout (right side):
```
[chart content] [PROFILE_WIDTH] [PRICE_AXIS_WIDTH]
```

New layout:
```
[chart content] [deltaProfileWidth] [PROFILE_WIDTH] [PRICE_AXIS_WIDTH]
```

The delta strip is between the chart content and the volume profile strip. Delta bars grow leftward from the boundary between the two strips. Volume bars grow rightward from that same boundary.

Update `PROFILE_WIDTH` constant usage throughout — the total reserved space on the right is now `PROFILE_WIDTH + deltaProfileWidth`. Update `buildCoordinates` to pass the correct drawable width.

In `drawVolumeProfile` and `drawDeltaProfile`, the x anchor points must be computed using the new layout.

---

## Custom Profile — Layout Update

For the custom profile, the volume profile already renders inside the selection (left to right from `x1`). The delta profile renders outside the selection on its left side.

- Delta strip right edge: `x1` of the selection rectangle
- Delta strip left edge: `x1 - deltaProfileWidth`
- Delta bars grow leftward from `x1`

The selection rectangle outline from Task 3 (Tasks 1–3 of the original custom profile series) still renders as-is. The delta strip is purely additive — it sits adjacent to the rectangle, not inside it.

If there is not enough space to the left of the selection (e.g. the selection starts near the left edge of the chart), clip the delta bars at `x = 0`. Do not let them overflow into negative x territory.

---

## Toggle

Add to settings panel `VOLUME PROFILE` section:

```
Show delta profile    [toggle]   on
Delta width           [slider]   80px
```

Store:
```ts
profileShowDelta:  boolean   // default true, persisted
deltaProfileWidth: number    // default 80, range 40–160, persisted
```

In `ChartCanvas` redraw, gate `drawDeltaProfile` on `profileShowDelta`.

When `profileShowDelta` is false, the `deltaProfileWidth` space is no longer reserved — the drawable chart area expands back. This requires recalculating `buildCoordinates` with `deltaProfileWidth = 0` when the delta profile is hidden.

---

## Draw Order Update

```
1.  drawGrid
2.  drawLines
3.  drawSelectionHighlight (background tint)
4.  drawCandles OR drawFootprint
5.  drawBubbles
6.  drawAbsorption
7.  drawExhaustion
8.  drawDeltaProfile          ← new, before volume profile
9.  drawCustomProfile (volume bars inside selection)
10. drawDeltaProfile (custom variant, outside selection left side)
11. drawVolumeProfile
12. drawAxes
```

`drawDeltaProfile` is called twice when a custom profile is active — once for the default visible-range delta strip, once for the custom selection's delta strip. Pass different `stripRightEdge` values each time.

---

## How to Verify This Task is Done

- Default profile: a new strip appears to the left of the existing volume profile bars
- Delta strip shows teal bars (positive delta levels) and red bars (negative delta levels)
- Delta bars grow right to left, volume bars grow left to right — they face each other
- A level with large total volume but balanced buying/selling shows a wide volume bar but a narrow or absent delta bar
- Toggle `Show delta profile` off — delta strip disappears and chart content expands to fill the space
- Toggle back on — delta strip returns and chart content shifts back
- Delta width slider changes the strip width — larger values give more detail on each level
- Custom profile: draw a selection rectangle, custom volume profile appears inside (left to right), delta profile appears outside to the left (right to left)
- Custom delta profile only covers the selected candle range — not the full visible range
- If selection is near left edge of chart, delta bars clip at canvas edge without crashing
- No regression from Tasks 1–3 — all previous improvements still working